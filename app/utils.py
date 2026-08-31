import json
from datetime import date, datetime
from typing import Any
from sqlalchemy.orm import Session
from app import models, schemas
from fastapi import HTTPException

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

def task_sort_key(task, projects: dict[int, models.Project] | None = None):
    project = projects.get(task.project_id) if projects else None
    prio = PRIORITY_ORDER.get((project.priority if project else task.priority), 1)
    due = task.due_date or date.max
    created = task.created_at or datetime.min
    return (prio, due, created)

def _clean_str(value: Any) -> str:
    return (value or "").strip() if value is not None else ""

def touch_project(db: Session, project_id: int):
    project = db.get(models.Project, project_id)
    if project:
        project.updated_at = models.NOW()
        db.commit()

def sync_done_at(task: models.Task):
    if task.status == "done":
        if task.done_at is None:
            task.done_at = datetime.utcnow()
    else:
        task.done_at = None

def stop_running_sessions(db: Session):
    running = db.query(models.TaskSession).filter(models.TaskSession.ended_at.is_(None)).all()
    now = datetime.utcnow()
    for s in running:
        s.ended_at = now
        s.duration_seconds = (now - s.started_at).total_seconds()
    if running:
        db.commit()

def task_time_summaries(db: Session) -> dict[int, schemas.TaskTimeSummary]:
    counts: dict[int, int] = {}
    totals: dict[int, float] = {}
    for task_id, dur in db.query(
        models.TaskSession.task_id, models.TaskSession.duration_seconds
    ).all():
        counts[task_id] = counts.get(task_id, 0) + 1
        if dur is not None:
            totals[task_id] = totals.get(task_id, 0.0) + dur
    running: dict[int, int] = {}
    for s in db.query(models.TaskSession).filter(models.TaskSession.ended_at.is_(None)).all():
        running[s.task_id] = s.id
    return {
        tid: schemas.TaskTimeSummary(
            total_seconds=totals.get(tid, 0.0),
            session_count=counts.get(tid, 0),
            running_session_id=running.get(tid),
        )
        for tid in set(counts) | set(running)
    }

def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

def _read_settings(db: Session) -> dict[str, Any]:
    rows = db.query(models.Setting).all()
    out: dict[str, Any] = {}
    for row in rows:
        try:
            out[row.key] = json.loads(row.value)
        except (json.JSONDecodeError, TypeError):
            out[row.key] = row.value
    return out

def validate_project(data: schemas.ProjectCreate | schemas.ProjectUpdate):
    status = data.status if isinstance(data, schemas.ProjectCreate) else None
    if status is not None and status not in schemas.PROJECT_STATUSES:
        raise HTTPException(400, f"status must be one of {sorted(schemas.PROJECT_STATUSES)}")
    priority = data.priority if isinstance(data, schemas.ProjectCreate) else None
    if priority is not None and priority not in schemas.PRIORITIES:
        raise HTTPException(400, f"priority must be one of {sorted(schemas.PRIORITIES)}")

def validate_task(data: schemas.TaskCreate | schemas.TaskUpdate):
    status = data.status if isinstance(data, schemas.TaskCreate) else None
    if status is not None and status not in schemas.TASK_STATUSES:
        raise HTTPException(400, f"status must be one of {sorted(schemas.TASK_STATUSES)}")
    priority = data.priority if isinstance(data, schemas.TaskCreate) else None
    if priority is not None and priority not in schemas.PRIORITIES:
        raise HTTPException(400, f"priority must be one of {sorted(schemas.PRIORITIES)}")

def validate_goal(data: schemas.GoalCreate | schemas.GoalUpdate):
    area = data.area if isinstance(data, schemas.GoalCreate) else None
    if area is not None and area not in schemas.GOAL_AREAS:
        raise HTTPException(400, f"area must be one of {sorted(schemas.GOAL_AREAS)}")
    status = data.status if isinstance(data, schemas.GoalCreate) else None
    if status is not None and status not in schemas.GOAL_STATUSES:
        raise HTTPException(400, f"status must be one of {sorted(schemas.GOAL_STATUSES)}")

def validate_journal(data: schemas.JournalCreate | schemas.JournalUpdate):
    jtype = data.type if isinstance(data, schemas.JournalCreate) else None
    if jtype is not None and jtype not in schemas.JOURNAL_TYPES:
        raise HTTPException(400, f"type must be one of {sorted(schemas.JOURNAL_TYPES)}")
