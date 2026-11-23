"""
ResiFix auto-assigner
---------------------
Gives new residence reports to a maintenance technician automatically.

1. Reads new, unassigned reports from PostgreSQL (the same database as the backend).
2. Asks Groq (AI) what kind of job it is and how urgent. If Groq is down, slow, over its free
   limit, or answers nonsense, simple keyword matching is used instead, so assignment never breaks.
3. Picks the technician with the matching job and the fewest open jobs (plain SQL, no AI), from
   those on duty (clocked in). If nobody is on duty the report waits.
4. Saves the assignment, a history entry and notifications, in the same format as the backend.
5. Optionally emails the technician through Brevo.

The backend runs this automatically for every report a student submits through the form:
    python assign_issues.py <report id>
You can also run it by hand to sweep up every report still waiting for a technician:
    python assign_issues.py

Settings come from backend/.env (never commit it):
    DATABASE_URL     the backend's PostgreSQL connection (already there)
    GROQ_API_KEY     from console.groq.com (already there for the AI assistant)
    GROQ_MODEL       optional, defaults to openai/gpt-oss-120b
    BREVO_API_KEY    optional, to email technicians
    SENDER_EMAIL     optional, a sender address verified in Brevo
"""

import json
import os
import secrets
import sys
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv

# backend/.env, one folder up from this file.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

GROQ_MODEL = os.getenv("GROQ_MODEL") or "openai/gpt-oss-120b"

# Priorities as the database stores them, lowest first. "MEDIUM" is shown as "Normal" in the app.
PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

# Categories students cannot report themselves. Keep in step with NOT_REPORTABLE in
# backend/src/services/assistant.ts.
NOT_REPORTABLE = {"security", "heating", "cat-security", "cat-hvac"}

# Which technician job handles each category. Anything not listed goes to general maintenance.
# Keep in step with CATEGORY_SPECIALIZATION in backend/src/services/assignment.ts.
CATEGORY_SPECIALIZATION = {
    "plumbing": "Plumbing",
    "water": "Plumbing",
    "electrical": "Electrical",
    "lighting": "Electrical",
    "wifi": "IT / Wi-Fi",
}
GENERAL_SPECIALIZATION = "General Maintenance"

# Keyword fallback. Checked in this order, so "light switch" is lighting before electrical.
KEYWORD_RULES = [
    ("water", ["no water", "water pressure", "water supply", "no running water"]),
    ("plumbing", ["leak", "tap", "toilet", "shower", "drain", "sink", "geyser", "pipe", "blocked", "basin"]),
    ("lighting", ["light", "bulb", "lamp", "fluorescent", "flicker"]),
    ("electrical", ["plug", "socket", "power", "electric", "wire", "switch", "spark", "breaker", "trip"]),
    ("wifi", ["wifi", "wi-fi", "internet", "network", "router", "connection"]),
    ("furniture", ["bed", "desk", "chair", "cupboard", "wardrobe", "mattress", "shelf", "drawer"]),
    ("damage", ["door", "window", "wall", "ceiling", "crack", "roof", "hinge", "broken glass"]),
    ("cleaning", ["dirty", "clean", "rubbish", "bin", "smell", "pest", "cockroach", "rat", "mould", "mold"]),
]

# Words that make a report urgent even when Groq is not available.
URGENT_WORDS = ["flood", "spark", "smoke", "fire", "burning", "exposed wire", "gas", "electric shock"]


def log(message: str) -> None:
    print(message, flush=True)


# ---------------------------------------------------------------------------
# 1. Work out what kind of job it is
# ---------------------------------------------------------------------------
_groq_client = None


def groq_client():
    """Created on first use, so the tests (and runs without a key) never need one."""
    global _groq_client
    if _groq_client is None:
        from groq import Groq

        if not os.getenv("GROQ_API_KEY"):
            raise RuntimeError("GROQ_API_KEY is not set")
        _groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"), timeout=20, max_retries=1)
    return _groq_client


def classify_with_groq(title: str, description: str, location: str, categories: dict) -> dict:
    """Asks Groq for the category and priority. Only the report's title, description and
    location are sent: never the student's name, email or student number."""
    system_prompt = (
        "You classify student residence maintenance reports.\n"
        f"Categories (answer with the key): {', '.join(f'{key} = {name}' for key, name in categories.items())}.\n"
        f"Priorities: {', '.join(PRIORITIES)}.\n"
        "URGENT = danger to safety or damage spreading (flooding, sparks or exposed wires, fire or gas smell, "
        "no water at all, cannot lock the room). HIGH = affects daily living (no hot water, toilet broken, "
        "no Wi-Fi). MEDIUM = inconvenient. LOW = cosmetic, can wait.\n"
        'Reply ONLY with JSON: {"category": "<key>", "priority": "<priority>", "reason": "<one short sentence>"}'
    )
    user_prompt = f"Title: {title}\nDescription: {description}\nLocation: {location}"

    extra = {"reasoning_effort": "low"} if GROQ_MODEL.startswith("openai/gpt-oss") else {}
    response = groq_client().chat.completions.create(
        model=GROQ_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        extra_body=extra or None,
    )
    result = json.loads(response.choices[0].message.content)

    # Never trust AI output blindly: only real categories and priorities get through.
    category = str(result.get("category", "")).strip().lower()
    if category not in categories:
        # Accept the category's name too ("Plumbing" instead of "plumbing").
        by_name = {name.lower(): key for key, name in categories.items()}
        category = by_name.get(category, "other")
    priority = str(result.get("priority", "MEDIUM")).strip().upper()
    if priority not in PRIORITIES:
        priority = "MEDIUM"
    reason = str(result.get("reason", "")).strip()[:200]
    return {"category": category, "priority": priority, "reason": reason, "source": "Groq AI"}


def classify_with_keywords(title: str, description: str) -> dict:
    """Fallback when Groq is down, too slow or over its free limit."""
    text = f"{title} {description}".lower()
    priority = "URGENT" if any(word in text for word in URGENT_WORDS) else "MEDIUM"
    for category, words in KEYWORD_RULES:
        if any(word in text for word in words):
            return {"category": category, "priority": priority, "reason": "keyword match", "source": "keywords"}
    return {"category": "other", "priority": priority, "reason": "no keyword matched", "source": "keywords"}


def classify_issue(title: str, description: str, location: str, categories: dict) -> dict:
    try:
        return classify_with_groq(title, description, location, categories)
    except Exception as error:  # network error, timeout, 429 rate limit, bad JSON, no key...
        log(f"  ! Groq failed ({type(error).__name__}: {error}); using keyword matching instead")
        return classify_with_keywords(title, description)


# ---------------------------------------------------------------------------
# 2. Pick the technician (plain SQL, no AI)
# ---------------------------------------------------------------------------
# Active maintenance staff with a given job, with how many unfinished jobs each has.
# Same rule as the backend: fewest open jobs wins, then whoever has been here longest.
FIND_TECHNICIAN_SQL = """
    SELECT u.id, u.full_name, u.email,
           COALESCE(u.specialization, 'General Maintenance') AS specialization,
           COUNT(i.id) AS open_jobs
      FROM users u
      LEFT JOIN maintenance_issues i
             ON i.assignee_id = u.id
            AND i.status NOT IN ('RESOLVED', 'CLOSED')
     WHERE u.role = 'MAINTENANCE'
       AND u.is_active = TRUE
       -- On duty: clocked in, not clocked out yet, and not on a break.
       -- (Times are stored as UTC without a time zone, hence NOW() AT TIME ZONE 'UTC'.)
       AND EXISTS (SELECT 1 FROM duty_shifts s
                    WHERE s.user_id = u.id AND s.clock_out_at IS NULL
                      AND (s.break_until IS NULL OR s.break_until <= NOW() AT TIME ZONE 'UTC'))
       AND (%(skill)s IS NULL OR COALESCE(u.specialization, 'General Maintenance') = %(skill)s)
     GROUP BY u.id, u.full_name, u.email, u.specialization, u.created_at
     ORDER BY open_jobs ASC, u.created_at ASC
     LIMIT 1
"""


def find_technician(cur, category: str):
    """The matching technician on duty; if nobody with that job is in, general maintenance; then anyone on duty."""
    skill = CATEGORY_SPECIALIZATION.get(category, GENERAL_SPECIALIZATION)
    for wanted in (skill, GENERAL_SPECIALIZATION, None):
        cur.execute(FIND_TECHNICIAN_SQL, {"skill": wanted})
        tech = cur.fetchone()
        if tech:
            return tech
    return None


# ---------------------------------------------------------------------------
# 3. Small helpers that match how the backend stores things
# ---------------------------------------------------------------------------
def new_id(prefix: str) -> str:
    """Same style as the backend's ids, e.g. "h-lq3x9k2a7f1c"."""
    return f"{prefix}-{int(time.time() * 1000):x}{secrets.token_hex(3)}"


def higher_priority(current: str, suggested: str) -> str:
    """Never lower the urgency the student chose; only raise it."""
    return max(current, suggested, key=PRIORITIES.index)


def add_history(cur, issue_id: str, status: str, action: str, note: str) -> None:
    # new_value is the status as the app names it ("Submitted", "Assigned").
    cur.execute(
        "INSERT INTO issue_history (id, issue_id, user_id, action, new_value, comment, created_at) "
        "VALUES (%s, %s, NULL, %s, %s, %s, NOW())",
        (new_id("h"), issue_id, action, status, note),
    )


def add_notification(cur, user_id: str, issue_id: str, title: str, message: str, kind: str = "ISSUE_ASSIGNED") -> None:
    cur.execute(
        "INSERT INTO notifications (id, user_id, type, title, message, is_read, issue_id, created_at) "
        "VALUES (%s, %s, %s, %s, %s, FALSE, %s, NOW())",
        (new_id("n"), user_id, kind, title, message, issue_id),
    )


def database_url() -> str:
    """The backend's DATABASE_URL, without Prisma's ?schema=... which PostgreSQL itself does not accept."""
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set in backend/.env")
    parts = urlsplit(url)
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if k != "schema"])
    return urlunsplit(parts._replace(query=query))


# ---------------------------------------------------------------------------
# 4. Email the technician (optional)
# ---------------------------------------------------------------------------
def email_technician(tech, issue, classification) -> None:
    api_key = os.getenv("BREVO_API_KEY")
    sender = os.getenv("SENDER_EMAIL")
    if not api_key or not sender:
        return  # email is not set up: the in-app notification is enough
    import requests
    from html import escape

    body = (
        f"<p>Hi {escape(tech['full_name'])},</p>"
        "<p>You have been given a new ResiFix job:</p><ul>"
        f"<li><b>{escape(issue['reference'])}:</b> {escape(issue['title'])}</li>"
        f"<li><b>Where:</b> {escape(issue['block_name'])}, {escape(issue['place'])}</li>"
        f"<li><b>Priority:</b> {classification['priority'].title()}</li>"
        f"<li><b>Details:</b> {escape(issue['description'])}</li></ul>"
    )
    try:
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": api_key, "Content-Type": "application/json"},
            json={
                "sender": {"email": sender, "name": "ResiFix Maintenance"},
                "to": [{"email": tech["email"], "name": tech["full_name"]}],
                "subject": f"[{classification['priority'].title()}] New job {issue['reference']}: {issue['title']}",
                "htmlContent": body,
            },
            timeout=10,
        )
        response.raise_for_status()
        log(f"  > emailed {tech['email']}")
    except Exception as error:
        log(f"  ! email failed: {error}")  # the assignment still stands


# ---------------------------------------------------------------------------
# 5. Main flow
# ---------------------------------------------------------------------------
# A new report with everything the auto-assigner needs. No student details are selected.
ISSUE_SQL = """
    SELECT i.id, i.reference, i.title, i.description, i.status, i.priority, i.category_id,
           i.assignee_id, b.name AS block_name, COALESCE(i.room_number, i.location, '') AS place
      FROM maintenance_issues i
      JOIN residence_blocks b ON b.id = i.block_id
"""


def report_categories(cur) -> dict:
    """The categories students can report, as {key: name}, straight from the database."""
    cur.execute("SELECT id, name FROM issue_categories WHERE is_active = TRUE ORDER BY name")
    return {row["id"]: row["name"] for row in cur.fetchall() if row["id"] not in NOT_REPORTABLE}


def process_issue(conn, issue, categories: dict) -> str:
    """Classifies and assigns one report. Returns what happened: assigned, no_technician or skipped."""
    log(f"\n{issue['reference']}: {issue['title']}")
    location = f"{issue['block_name']}, {issue['place']}"
    classification = classify_issue(issue["title"], issue["description"] or "", location, categories)
    log(f"  -> {classification['category']} / {classification['priority']} "
        f"({classification['source']}: {classification['reason']})")

    # The student's own choices win: the category only changes when they picked "Other",
    # and the priority can only go up.
    category = issue["category_id"]
    if category == "other" and classification["category"] in categories:
        category = classification["category"]
    priority = higher_priority(issue["priority"], classification["priority"])

    with conn.cursor() as cur:
        tech = find_technician(cur, category)

        if tech is None:
            # Nobody on duty: keep the better category/priority. It goes to the first technician who
            # clocks in (the backend runs this script again then), or the staff manager assigns it.
            cur.execute(
                "UPDATE maintenance_issues SET category_id = %s, priority = %s, updated_at = NOW() WHERE id = %s",
                (category, priority, issue["id"]),
            )
            add_history(cur, issue["id"], "Submitted", "COMMENT_ADDED",
                        f"Auto-assign: looks like {categories.get(category, category)}, but no technician is "
                        "on duty. It will go to the first technician who clocks in, or the staff manager can assign it.")
            # Tell the student it is waiting (once per report) and that they will hear who gets it.
            cur.execute(
                "SELECT 1 FROM notifications WHERE issue_id = %s AND title = 'Waiting for a technician'",
                (issue["id"],),
            )
            if cur.fetchone() is None:
                cur.execute("SELECT reporter_id FROM maintenance_issues WHERE id = %s", (issue["id"],))
                reporter = cur.fetchone()
                if reporter:
                    add_notification(cur, reporter["reporter_id"], issue["id"], "Waiting for a technician",
                                     f"{issue['reference']} is waiting for a technician: nobody is on duty right now. "
                                     "It will be assigned as soon as someone clocks in, and you will be told who.",
                                     "STATUS_UPDATED")
            # Urgent reports can't wait for someone to clock in: tell the staff manager now.
            if priority == "URGENT":
                cur.execute("SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE")
                for manager in cur.fetchall():
                    add_notification(cur, manager["id"], issue["id"], "Nobody on duty",
                                     f"URGENT {issue['reference']} — {issue['title']} is waiting: no technician is "
                                     "on duty. Please call someone in or assign it.", "SYSTEM")
            conn.commit()
            log("  ! no technician on duty, waiting for someone to clock in")
            return "no_technician"

        # Only if still unassigned and new, so an admin's choice is never overwritten.
        cur.execute(
            """
            UPDATE maintenance_issues
               SET assignee_id = %s, category_id = %s, priority = %s, accepted_at = NULL,
                   status = 'ASSIGNED', assigned_at = NOW(), updated_at = NOW()
             WHERE id = %s
               AND assignee_id IS NULL
               AND status IN ('REPORTED', 'RECEIVED')
            """,
            (tech["id"], category, priority, issue["id"]),
        )
        if cur.rowcount == 0:
            conn.rollback()
            log("  ! already assigned or no longer new, skipped")
            return "skipped"

        add_history(cur, issue["id"], "Assigned", "ASSIGNED",
                    f"Assigned to {tech['full_name']} ({tech['specialization']}) automatically by the auto-assigner.")
        add_notification(cur, tech["id"], issue["id"], "New job",
                         f"New job: {issue['reference']} — {issue['title']} ({issue['block_name']}, {issue['place']}).")
        cur.execute("SELECT reporter_id FROM maintenance_issues WHERE id = %s", (issue["id"],))
        reporter = cur.fetchone()
        if reporter:
            add_notification(cur, reporter["reporter_id"], issue["id"], "Report assigned",
                             f"{issue['reference']} has been assigned to {tech['full_name']}. Waiting for them to accept the job.")
        conn.commit()
        log(f"  OK assigned to {tech['full_name']} ({tech['specialization']}, had {tech['open_jobs']} open jobs)")

    email_technician(tech, issue, {**classification, "priority": priority})
    return "assigned"


def main(argv) -> int:
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(database_url(), cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        with conn.cursor() as cur:
            categories = report_categories(cur)
            if len(argv) > 1:
                cur.execute(ISSUE_SQL + " WHERE i.id = %s", (argv[1],))
            else:
                # Everything still waiting for a technician, oldest first (run after someone clocks in).
                cur.execute(ISSUE_SQL + " WHERE i.status IN ('REPORTED', 'RECEIVED') AND i.assignee_id IS NULL "
                            "ORDER BY i.reported_at")
            issues = cur.fetchall()
        conn.commit()

        if not issues:
            log("No new, unassigned reports.")
            return 0
        for issue in issues:
            if issue["assignee_id"]:
                log(f"\n{issue['reference']}: already assigned, skipped")
                continue
            try:
                process_issue(conn, issue, categories)
            except Exception as error:
                conn.rollback()
                log(f"  x error on {issue['reference']}: {error}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
