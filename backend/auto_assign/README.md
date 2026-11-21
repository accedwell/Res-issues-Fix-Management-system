# ResiFix auto-assigner

Gives every new report a technician automatically, so the staff manager no longer has to assign it by hand.

1. A student submits a report through the form.
2. The backend saves it and immediately starts `assign_issues.py <report id>` in the background. The student does not wait for it.
3. The script asks **Groq** (AI) what kind of job it is and how urgent. If Groq is down, slow or over its free limit, it uses **keyword matching** instead, so assignment never breaks.
4. **Plain SQL** picks the technician with the right job and the fewest open jobs. If nobody has that job, it falls back to general maintenance, then to anyone.
5. The report becomes **Assigned**. A history entry is added and the technician and student are notified. With Brevo set up, the technician is also emailed.

The staff manager still sees every report and can re-assign it. The script never overwrites an existing assignment.

Reports written with the **AI assistant** do not use this script. The assistant already knows the category from the conversation, so the backend assigns those immediately.

## The student's choices win

- The **category** only changes when the student picked "Other".
- The **priority** can only go up. The AI never lowers the urgency the student chose.
- Only the report's title, description and location are sent to Groq. The student's name, email and student number are never sent.

## Set up (once per computer)

From the `backend/auto_assign` folder:

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt      # Windows
.venv/bin/pip install -r requirements.txt          # Mac / Linux
```

The script reads `backend/.env`, the same file as the backend. It needs:

| Setting | What it is |
|---|---|
| `DATABASE_URL` | Already there for the backend |
| `GROQ_API_KEY` | Free key from [console.groq.com](https://console.groq.com) → API Keys. Already there if the AI assistant works |
| `GROQ_MODEL` | Optional. Defaults to `openai/gpt-oss-120b` |
| `BREVO_API_KEY`, `SENDER_EMAIL` | Optional. To email technicians. Get a free key at [brevo.com](https://www.brevo.com) → SMTP & API → API Keys, and verify the sender address in Brevo |
| `AUTO_ASSIGN=off` | Optional. Turns automatic assignment off; reports wait for the staff manager again |

Without the `.venv` folder the backend tries the system `python`. If Python is missing, reports simply wait for the staff manager.

## Run it by hand

```bash
.venv\Scripts\python assign_issues.py                 # every new report still waiting for a technician
.venv\Scripts\python assign_issues.py <report id>     # just one report (the database id, e.g. i-mwmizv6xmvmz)
```

## Tests

No real Groq calls and no database needed:

```bash
.venv\Scripts\python -m unittest discover -s tests -v
```

They cover the keyword fallback, checking Groq's answers, Groq failing or answering nonsense, the student's choices winning, falling back to general maintenance, nobody being available, and never overwriting an assignment.

## Keep in step with the backend

The category-to-job table (`CATEGORY_SPECIALIZATION`) must match `backend/src/services/assignment.ts`. The list of categories students cannot report (`NOT_REPORTABLE`) must match `backend/src/services/assistant.ts`.
