"""Seed dummy projects, tasks, and tracked sessions so you can verify the UI wiring.

Idempotent: running it again skips if the marker project already exists.

Usage: python3 bin/seed_dummy.py
"""

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import models
from app.database import SessionLocal

MARKER = "DUMMY-SEED-ALPHA"
db = SessionLocal()

if db.query(models.Project).filter(models.Project.title == MARKER).count() > 0:
    print("Dummy seed already present; skipping.")
    db.close()
    sys.exit(0)

now = datetime.utcnow()
today = date.today()

# ---- Projects ----
alpha = models.Project(
    title=MARKER,
    description="Dummy active project (work) to verify hours and task list.",
    status="active",
    priority="high",
    branch_path="work",
    tags="dummy,work",
)
fitness = models.Project(
    title="DUMMY-SEED-FITNESS",
    description="Dummy active project (personal).",
    status="active",
    priority="medium",
    branch_path="personal",
    tags="dummy,personal",
)
db.add_all([alpha, fitness])
db.flush()  # assign ids

# ---- Tasks ----
a_current = models.Task(
    project_id=alpha.id, title="Refine onboarding flow", status="in_progress",
    priority="high", due_date=today, branch_path="work",
)
a_planned = models.Task(
    project_id=alpha.id, title="Write API integration tests", status="planned",
    priority="medium", due_date=today + timedelta(days=1), branch_path="work",
)
a_wanted = models.Task(
    project_id=alpha.id, title="Design landing page", status="wanted",
    priority="medium", due_date=today, branch_path="work",
)
a_done = models.Task(
    project_id=alpha.id, title="Ship v1 announcement", status="done",
    priority="high", due_date=today - timedelta(days=2), branch_path="work",
)
b_planned = models.Task(
    project_id=fitness.id, title="Plan weekly meal prep", status="planned",
    priority="low", due_date=today, branch_path="personal",
)
b_wanted = models.Task(
    project_id=fitness.id, title="Book annual checkup", status="wanted",
    priority="low", due_date=today + timedelta(days=3), branch_path="personal",
)
b_done = models.Task(
    project_id=fitness.id, title="Monthly gym review", status="done",
    priority="medium", due_date=today - timedelta(days=7), branch_path="personal",
)

tasks = [a_current, a_planned, a_wanted, a_done, b_planned, b_wanted, b_done]
db.add_all(tasks)
db.flush()

# ---- Sessions (tracked time) so the summary pills show real hours ----
def session(task, seconds, start_days_ago=0):
    started = now - timedelta(days=start_days_ago, seconds=seconds)
    return models.TaskSession(
        task_id=task.id,
        started_at=started,
        ended_at=started + timedelta(seconds=seconds),
        duration_seconds=float(seconds),
    )

sessions = [
    session(a_current, 9000),  # 2.5h
    session(a_current, 3600, start_days_ago=1),  # 1.0h  -> current task total 3.5h
    session(a_planned, 5400, start_days_ago=1),  # 1.5h
    session(b_planned, 1800),  # 0.5h
    session(a_done, 7200, start_days_ago=3),  # done task, 2.0h (not summed because task done)
]
notes = [
    models.Note(
        title="DUMMY-NOTE-1",
        content="This is a dummy note to verify the frontend rendering of the new notes section.",
        tags="dummy,testing",
    )
]
db.add_all(sessions + notes)
db.commit()

open_tasks = [t for t in tasks if t.status != "done"]
print(f"Seeded 2 dummy projects, {len(tasks)} tasks ({len(open_tasks)} open), "
      f"{len(sessions)} tracked sessions, and {len(notes)} dummy notes.")
print("Current task (hero):", a_current.title, "-> 3.5h tracked")
for t in open_tasks:
    secs = sum(s.duration_seconds or 0 for s in sessions if s.task_id == t.id)
    print(f"  open task: {t.title!r:35} status={t.status:11} tracked={(secs/3600):.1f}h")
db.close()
