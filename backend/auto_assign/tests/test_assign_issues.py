"""Unit tests for the auto-assigner. No real Groq calls and no database: both are faked.

Run from backend/auto_assign:
    .venv\\Scripts\\python -m unittest discover -s tests -v     (Windows)
    .venv/bin/python -m unittest discover -s tests -v           (Mac/Linux)
"""

import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import assign_issues as aa  # noqa: E402

CATEGORIES = {
    "plumbing": "Plumbing",
    "electrical": "Electrical",
    "lighting": "Lighting",
    "wifi": "Wi-Fi / Internet",
    "water": "Water Supply",
    "furniture": "Furniture",
    "other": "Other",
}


def groq_answer(payload):
    """A fake Groq client whose reply is the given dict (or raw text)."""
    content = payload if isinstance(payload, str) else json.dumps(payload)
    reply = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])
    client = mock.Mock()
    client.chat.completions.create.return_value = reply
    return client


class FakeCursor:
    """Records every SQL statement. Technician lookups return the queued answers in order."""

    def __init__(self, technicians=(), update_rowcount=1):
        self.technicians = list(technicians)
        self.update_rowcount = update_rowcount
        self.statements = []
        self.rowcount = 0
        self._next = None

    def execute(self, sql, params=None):
        self.statements.append((sql, params))
        self._next = None
        if sql is aa.FIND_TECHNICIAN_SQL:
            self._next = self.technicians.pop(0) if self.technicians else None
        elif sql.lstrip().startswith("UPDATE maintenance_issues") and "assignee_id IS NULL" in sql:
            self.rowcount = self.update_rowcount
        elif "SELECT reporter_id" in sql:
            self._next = {"reporter_id": "student-1"}

    def fetchone(self):
        return self._next

    def find(self, text):
        return [(sql, params) for sql, params in self.statements if text in sql]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeConnection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return self._cursor

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def new_report(**changes):
    report = {
        "id": "i-1", "reference": "ISS-2026-00200", "title": "Toilet keeps running",
        "description": "The toilet in my room will not stop running.", "status": "REPORTED",
        "priority": "MEDIUM", "category_id": "other", "assignee_id": None,
        "block_name": "Block A", "place": "204",
    }
    report.update(changes)
    return report


PLUMBER = {"id": "u-plumber", "full_name": "Thabo Nkosi", "email": "t.nkosi@resStaff.ac.za",
           "specialization": "Plumbing", "open_jobs": 2}
HANDYMAN = {"id": "u-general", "full_name": "Sipho Dlamini", "email": "s.dlamini@resStaff.ac.za",
            "specialization": "General Maintenance", "open_jobs": 0}


class KeywordFallbackTests(unittest.TestCase):
    def test_common_problems(self):
        cases = {
            ("Leaking tap", "The bathroom tap drips all night"): "plumbing",
            ("No water", "There is no water in the whole block"): "water",
            ("Light broken", "The ceiling light flickers"): "lighting",
            ("Dead socket", "The plug socket by my desk has no power"): "electrical",
            ("Internet", "The wifi keeps dropping"): "wifi",
            ("Bed", "My bed frame is broken"): "furniture",
            ("Something odd", "Not sure what this is"): "other",
        }
        for (title, description), expected in cases.items():
            with self.subTest(title=title):
                self.assertEqual(aa.classify_with_keywords(title, description)["category"], expected)

    def test_danger_words_make_it_urgent(self):
        result = aa.classify_with_keywords("Socket", "It sparks when I plug in my charger")
        self.assertEqual(result["priority"], "URGENT")
        self.assertEqual(aa.classify_with_keywords("Chair", "wobbly chair")["priority"], "MEDIUM")


class GroqValidationTests(unittest.TestCase):
    def classify(self, payload):
        with mock.patch.object(aa, "groq_client", return_value=groq_answer(payload)):
            return aa.classify_with_groq("t", "d", "Block A, 204", CATEGORIES)

    def test_valid_answer_is_kept(self):
        result = self.classify({"category": "plumbing", "priority": "HIGH", "reason": "toilet"})
        self.assertEqual((result["category"], result["priority"], result["source"]), ("plumbing", "HIGH", "Groq AI"))

    def test_unknown_category_and_priority_are_replaced(self):
        result = self.classify({"category": "spaceship", "priority": "EXTREME"})
        self.assertEqual((result["category"], result["priority"]), ("other", "MEDIUM"))

    def test_category_name_and_lowercase_priority_are_accepted(self):
        result = self.classify({"category": "Plumbing", "priority": "urgent"})
        self.assertEqual((result["category"], result["priority"]), ("plumbing", "URGENT"))

    def test_only_report_details_are_sent(self):
        client = groq_answer({"category": "wifi", "priority": "HIGH"})
        with mock.patch.object(aa, "groq_client", return_value=client):
            aa.classify_with_groq("Wi-Fi down", "No internet", "Block A, 204", CATEGORIES)
        sent = json.dumps(client.chat.completions.create.call_args.kwargs["messages"])
        self.assertIn("Wi-Fi down", sent)
        self.assertNotIn("@", sent)  # no email addresses


class GroqFailureTests(unittest.TestCase):
    def test_groq_error_falls_back_to_keywords(self):
        with mock.patch.object(aa, "groq_client", side_effect=RuntimeError("429 rate limit")):
            result = aa.classify_issue("Leaking tap", "drips", "Block A, 204", CATEGORIES)
        self.assertEqual((result["category"], result["source"]), ("plumbing", "keywords"))

    def test_bad_json_falls_back_to_keywords(self):
        with mock.patch.object(aa, "groq_client", return_value=groq_answer("this is not json")):
            result = aa.classify_issue("Wifi", "internet keeps dropping", "Block A, 204", CATEGORIES)
        self.assertEqual((result["category"], result["source"]), ("wifi", "keywords"))


class PriorityAndCategoryRules(unittest.TestCase):
    def test_priority_only_goes_up(self):
        self.assertEqual(aa.higher_priority("HIGH", "LOW"), "HIGH")
        self.assertEqual(aa.higher_priority("MEDIUM", "URGENT"), "URGENT")

    def test_database_url_drops_prisma_schema_option(self):
        with mock.patch.dict(aa.os.environ, {"DATABASE_URL": "postgresql://u:p@localhost:5433/resifix?schema=public"}):
            self.assertEqual(aa.database_url(), "postgresql://u:p@localhost:5433/resifix")


class ProcessIssueTests(unittest.TestCase):
    def run_with(self, report, classification, cursor):
        conn = FakeConnection(cursor)
        with mock.patch.object(aa, "classify_issue", return_value=classification), \
                mock.patch.object(aa, "email_technician") as email:
            outcome = aa.process_issue(conn, report, CATEGORIES)
        return outcome, conn, email

    def test_assigns_matching_technician_with_history_and_notifications(self):
        cursor = FakeCursor(technicians=[PLUMBER])
        outcome, conn, email = self.run_with(
            new_report(), {"category": "plumbing", "priority": "HIGH", "reason": "", "source": "Groq AI"}, cursor)
        self.assertEqual(outcome, "assigned")
        _, params = cursor.find("assignee_id IS NULL")[0]
        self.assertEqual(params, ("u-plumber", "plumbing", "HIGH", "i-1"))  # "Other" replaced, priority raised
        history = cursor.find("INSERT INTO issue_history")
        self.assertEqual(history[0][1][2:4], ("ASSIGNED", "Assigned"))
        notified = [params[1] for _, params in cursor.find("INSERT INTO notifications")]
        self.assertEqual(notified, ["u-plumber", "student-1"])
        self.assertEqual(conn.commits, 1)
        email.assert_called_once()

    def test_student_category_and_higher_priority_are_kept(self):
        cursor = FakeCursor(technicians=[PLUMBER])
        self.run_with(new_report(category_id="plumbing", priority="URGENT"),
                      {"category": "water", "priority": "LOW", "reason": "", "source": "Groq AI"}, cursor)
        _, params = cursor.find("assignee_id IS NULL")[0]
        self.assertEqual(params[1:3], ("plumbing", "URGENT"))

    def test_falls_back_to_general_maintenance(self):
        cursor = FakeCursor(technicians=[None, HANDYMAN])
        outcome, _, _ = self.run_with(
            new_report(), {"category": "plumbing", "priority": "MEDIUM", "reason": "", "source": "keywords"}, cursor)
        self.assertEqual(outcome, "assigned")
        skills = [params["skill"] for _, params in cursor.find("FROM users u")]
        self.assertEqual(skills, ["Plumbing", "General Maintenance"])

    def test_no_technician_leaves_report_unassigned_with_a_note(self):
        cursor = FakeCursor(technicians=[None, None, None])
        outcome, conn, email = self.run_with(
            new_report(), {"category": "wifi", "priority": "HIGH", "reason": "", "source": "Groq AI"}, cursor)
        self.assertEqual(outcome, "no_technician")
        self.assertFalse(cursor.find("assignee_id IS NULL"))  # never set to Assigned
        note = cursor.find("INSERT INTO issue_history")[0][1]
        self.assertEqual(note[3], "Submitted")
        self.assertIn("no technician is available", note[4])
        self.assertFalse(cursor.find("INSERT INTO notifications"))
        self.assertEqual(conn.commits, 1)
        email.assert_not_called()

    def test_never_overwrites_an_existing_assignment(self):
        cursor = FakeCursor(technicians=[PLUMBER], update_rowcount=0)  # a supervisor got there first
        outcome, conn, email = self.run_with(
            new_report(), {"category": "plumbing", "priority": "HIGH", "reason": "", "source": "Groq AI"}, cursor)
        self.assertEqual(outcome, "skipped")
        self.assertEqual((conn.rollbacks, conn.commits), (1, 0))
        self.assertFalse(cursor.find("INSERT INTO issue_history"))
        email.assert_not_called()


if __name__ == "__main__":
    unittest.main()
