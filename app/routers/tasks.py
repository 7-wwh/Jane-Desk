from datetime import date, datetime, timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app import models, schemas
from app.database import get_db
from app.utils import *

router = APIRouter(tags=["Tasks"])
# ---------- Tasks ----------






@router.get("/api/projects/{project_id}/tasks", response_model=list[schemas.TaskOut])
def list_tasks(project_id: int, db: Session = Depends(get_db)):
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    return (
        db.query(models.Task)
        .filter(models.Task.project_id == project_id)
        .order_by(models.Task.updated_at.desc())
        .all()
    )


@router.post("/api/projects/{project_id}/tasks", response_model=schemas.TaskOut, status_code=201)
def create_task(project_id: int, data: schemas.TaskCreate, db: Session = Depends(get_db)):
    if not db.get(models.Project, project_id):
        raise HTTPException(404, "project not found")
    validate_task(data)
    data_dict = data.model_dump()
    data_dict["branch_path"] = _clean_str(data_dict.get("branch_path"))
    task = models.Task(project_id=project_id, **data_dict)
    sync_done_at(task)
    db.add(task)
    db.commit()
    db.refresh(task)
    touch_project(db, project_id)
    return task


@router.get("/api/tasks", response_model=list[schemas.WorkTask])
def list_all_tasks(
    status: str | None = None,
    project_id: int | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    """Every task (open + done) with project title and time summary."""
    query = db.query(models.Task)
    if status:
        query = query.filter(models.Task.status == status)
    if project_id is not None:
        query = query.filter(models.Task.project_id == project_id)
    if q:
        like = f"%{q}%"
        query = query.filter(models.Task.title.ilike(like))
    tasks = query.order_by(models.Task.updated_at.desc()).all()
    projects = {p.id: p for p in db.query(models.Project).all()}
    time_map = task_time_summaries(db)

    def with_time(t) -> schemas.WorkTask:
        base = schemas.TaskOut.model_validate(t).model_dump()
        ts = time_map.get(t.id, schemas.TaskTimeSummary())
        proj = projects.get(t.project_id)
        return schemas.WorkTask(
            **base, **ts.model_dump(), project_title=proj.title if proj else "Unknown"
        )

    return [with_time(t) for t in tasks]


@router.put("/api/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, data: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(models.Task, task_id)
    if not task:
        raise HTTPException(404, "task not found")
    validate_task(data)
    payload = data.model_dump(exclude_unset=True)
    project_id = payload.pop("project_id", None)
    if "branch_path" in payload:
        payload["branch_path"] = _clean_str(payload["branch_path"])
    if project_id is not None:
        if not db.get(models.Project, project_id):
            raise HTTPException(404, "project not found")
        task.project_id = project_id
    for field, value in payload.items():
        setattr(task, field, value)
    sync_done_at(task)
    db.commit()
    db.refresh(task)
    touch_project(db, task.project_id)
    return task


@router.patch("/api/tasks/{task_id}/status", response_model=schemas.TaskOut)
def update_task_status(task_id: int, status: str = Query(...), db: Session = Depends(get_db)):
    task = db.get(models.Task, task_id)
    if not task:
        raise HTTPException(404, "task not found")
    if status not in schemas.TASK_STATUSES:
        raise HTTPException(400, f"status must be one of {sorted(schemas.TASK_STATUSES)}")
    task.status = status
    sync_done_at(task)
    db.commit()
    db.refresh(task)
    touch_project(db, task.project_id)
    return task


@router.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(models.Task, task_id)
    if not task:
        raise HTTPException(404, "task not found")
    db.delete(task)
    db.commit()


@router.post("/api/tasks/{task_id}/start", response_model=schemas.TaskOut)
def start_task(task_id: int, db: Session = Depends(get_db)):
    """Rule 1: one current task globally. Demote any other in_progress task to planned,
    then make this task the single in_progress one."""
    task = db.get(models.Task, task_id)
    if not task:
        raise HTTPException(404, "task not found")
    db.query(models.Task).filter(
        models.Task.status == "in_progress", models.Task.id != task_id
    ).update({"status": "planned"}, synchronize_session=False)
    task.status = "in_progress"
    db.commit()
    db.refresh(task)
    touch_project(db, task.project_id)
    return task


@router.post("/api/projects/{project_id}/start")
def start_project(project_id: int, db: Session = Depends(get_db)):
    """Rule 5: idea -> project. Promote a backlog project to active and start its top task."""
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    project.status = "active"
    tasks = (
        db.query(models.Task)
        .filter(models.Task.project_id == project_id, models.Task.status != "done")
        .all()
    )
    tasks.sort(key=task_sort_key)
    top = tasks[0] if tasks else None
    if top:
        db.query(models.Task).filter(
            models.Task.status == "in_progress", models.Task.id != top.id
        ).update({"status": "planned"}, synchronize_session=False)
        top.status = "in_progress"
    db.commit()
    db.refresh(project)
    if top:
        db.refresh(top)
    touch_project(db, project_id)
    return {
        "project": schemas.ProjectOut.model_validate(project),
        "task": schemas.TaskOut.model_validate(top) if top else None,
    }


# ---------- Time sessions ----------

@router.post("/api/tasks/{task_id}/sessions/start", response_model=schemas.TaskSessionOut, status_code=201)
def start_session(task_id: int, db: Session = Depends(get_db)):
    """Start a time session on a task. Stops any other running session (one timer globally),
    and sets the task as the single in_progress one (play = start work)."""
    task = db.get(models.Task, task_id)
    if not task:
        raise HTTPException(404, "task not found")
    stop_running_sessions(db)
    db.query(models.Task).filter(
        models.Task.status == "in_progress", models.Task.id != task_id
    ).update({"status": "planned"}, synchronize_session=False)
    task.status = "in_progress"
    session = models.TaskSession(task_id=task_id, started_at=datetime.utcnow())
    db.add(session)
    db.commit()
    db.refresh(session)
    touch_project(db, task.project_id)
    return session


@router.post("/api/sessions/{session_id}/stop", response_model=schemas.TaskSessionOut)
def stop_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(models.TaskSession, session_id)
    if not session:
        raise HTTPException(404, "session not found")
    if session.ended_at is None:
        session.ended_at = datetime.utcnow()
        session.duration_seconds = (session.ended_at - session.started_at).total_seconds()
        db.commit()
        db.refresh(session)
    return session


def _resolve_session_times(data, started_at, ended_at, duration_seconds):
    """Fill session start/end/duration from a partial update, keeping derived fields consistent."""
    if started_at is not None:
        started_at = started_at
    if ended_at is not None:
        ended_at = ended_at
    if duration_seconds is not None:
        duration_seconds = duration_seconds
    # If both times known but duration omitted, derive it.
    if duration_seconds is None and started_at is not None and ended_at is not None:
        duration_seconds = max((ended_at - started_at).total_seconds(), 0.0)
    # If duration given but only one time set, keep times as-is (still valid for display).
    return started_at, ended_at, duration_seconds


@router.post("/api/tasks/{task_id}/sessions", response_model=schemas.TaskSessionOut, status_code=201)
def create_session(task_id: int, data: schemas.TaskSessionCreate, db: Session = Depends(get_db)):
    """Manually log a time session on a task (backdated / future)."""
    if not db.get(models.Task, task_id):
        raise HTTPException(404, "task not found")
    started_at = data.started_at or datetime.utcnow()
    ended_at = data.ended_at
    duration_seconds = data.duration_seconds
    if duration_seconds is None and ended_at is not None:
        duration_seconds = max((ended_at - started_at).total_seconds(), 0.0)
    session = models.TaskSession(
        task_id=task_id,
        started_at=started_at,
        ended_at=ended_at,
        duration_seconds=duration_seconds,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    task = db.get(models.Task, task_id)
    touch_project(db, task.project_id)
    return session


@router.put("/api/sessions/{session_id}", response_model=schemas.TaskSessionOut)
def update_session(session_id: int, data: schemas.TaskSessionUpdate, db: Session = Depends(get_db)):
    session = db.get(models.TaskSession, session_id)
    if not session:
        raise HTTPException(404, "session not found")
    started_at = data.started_at if data.started_at is not None else session.started_at
    ended_at = data.ended_at if data.ended_at is not None else session.ended_at
    duration_seconds = (
        data.duration_seconds
        if data.duration_seconds is not None
        else session.duration_seconds
    )
    if duration_seconds is None and ended_at is not None:
        duration_seconds = max((ended_at - started_at).total_seconds(), 0.0)
    session.started_at = started_at
    session.ended_at = ended_at
    session.duration_seconds = duration_seconds
    db.commit()
    db.refresh(session)
    task = db.get(models.Task, session.task_id)
    if task:
        touch_project(db, task.project_id)
    return session


@router.get("/api/tasks/{task_id}/sessions", response_model=schemas.TaskSessionsOut)
def list_sessions(task_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Task, task_id):
        raise HTTPException(404, "task not found")
    sessions = (
        db.query(models.TaskSession)
        .filter(models.TaskSession.task_id == task_id)
        .order_by(models.TaskSession.started_at.desc())
        .all()
    )
    total = sum((s.duration_seconds or 0.0) for s in sessions)
    return schemas.TaskSessionsOut(
        sessions=[schemas.TaskSessionOut.model_validate(s) for s in sessions],
        total_seconds=total,
        session_count=len(sessions),
    )


@router.get("/api/sessions/active", response_model=schemas.ActiveSession | None)
def active_session(db: Session = Depends(get_db)):
    s = (
        db.query(models.TaskSession)
        .filter(models.TaskSession.ended_at.is_(None))
        .order_by(models.TaskSession.started_at.desc())
        .first()
    )
    if not s:
        return None
    task = db.get(models.Task, s.task_id)
    return schemas.ActiveSession(
        session=s,
        task_title=task.title if task else "Unknown",
    )


@router.delete("/api/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(models.TaskSession, session_id)
    if not session:
        raise HTTPException(404, "session not found")
    db.delete(session)
    db.commit()


# ---------- Goals ----------

@router.get("/api/goals", response_model=list[schemas.GoalOut])
def list_goals(
    area: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Goal)
    if area:
        query = query.filter(models.Goal.area == area)
    if status:
        query = query.filter(models.Goal.status == status)
    return query.order_by(models.Goal.area.asc(), models.Goal.created_at.desc()).all()


@router.post("/api/goals", response_model=schemas.GoalOut, status_code=201)
def create_goal(data: schemas.GoalCreate, db: Session = Depends(get_db)):
    validate_goal(data)
    goal = models.Goal(**data.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/api/goals/{goal_id}", response_model=schemas.GoalOut)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.get(models.Goal, goal_id)
    if not goal:
        raise HTTPException(404, "goal not found")
    return goal


@router.put("/api/goals/{goal_id}", response_model=schemas.GoalOut)
def update_goal(goal_id: int, data: schemas.GoalUpdate, db: Session = Depends(get_db)):
    validate_goal(data)
    goal = db.get(models.Goal, goal_id)
    if not goal:
        raise HTTPException(404, "goal not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/api/goals/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.get(models.Goal, goal_id)
    if not goal:
        raise HTTPException(404, "goal not found")
    db.delete(goal)
    db.commit()


# ---------- Learnings ----------

@router.get("/api/learnings", response_model=list[schemas.LearningOut])
def list_learnings(
    date: date | None = None,
    tag: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Learning)
    if date:
        query = query.filter(models.Learning.date == date)
    if tag:
        query = query.filter(models.Learning.tags.ilike(f"%{tag}%"))
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(models.Learning.title.ilike(like), models.Learning.content.ilike(like))
        )
    return query.order_by(models.Learning.date.desc()).all()


@router.post("/api/learnings", response_model=schemas.LearningOut, status_code=201)
def create_learning(data: schemas.LearningCreate, db: Session = Depends(get_db)):
    learning = models.Learning(**data.model_dump())
    db.add(learning)
    db.commit()
    db.refresh(learning)
    return learning


@router.get("/api/learnings/{learning_id}", response_model=schemas.LearningOut)
def get_learning(learning_id: int, db: Session = Depends(get_db)):
    learning = db.get(models.Learning, learning_id)
    if not learning:
        raise HTTPException(404, "learning not found")
    return learning


@router.put("/api/learnings/{learning_id}", response_model=schemas.LearningOut)
def update_learning(learning_id: int, data: schemas.LearningUpdate, db: Session = Depends(get_db)):
    learning = db.get(models.Learning, learning_id)
    if not learning:
        raise HTTPException(404, "learning not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(learning, key, value)
    db.commit()
    db.refresh(learning)
    return learning


@router.delete("/api/learnings/{learning_id}", status_code=204)
def delete_learning(learning_id: int, db: Session = Depends(get_db)):
    learning = db.get(models.Learning, learning_id)
    if not learning:
        raise HTTPException(404, "learning not found")
    db.delete(learning)
    db.commit()


# ---------- Journal ----------

@router.get("/api/journal", response_model=list[schemas.JournalOut])
def list_journal(
    date: date | None = None,
    type: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Journal)
    if date:
        query = query.filter(models.Journal.date == date)
    if type:
        query = query.filter(models.Journal.type == type)
    return query.order_by(models.Journal.date.desc()).all()


@router.post("/api/journal", response_model=schemas.JournalOut, status_code=201)
def create_journal(data: schemas.JournalCreate, db: Session = Depends(get_db)):
    validate_journal(data)
    entry = models.Journal(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/api/journal/{journal_id}", response_model=schemas.JournalOut)
def get_journal(journal_id: int, db: Session = Depends(get_db)):
    entry = db.get(models.Journal, journal_id)
    if not entry:
        raise HTTPException(404, "journal entry not found")
    return entry


@router.put("/api/journal/{journal_id}", response_model=schemas.JournalOut)
def update_journal(journal_id: int, data: schemas.JournalUpdate, db: Session = Depends(get_db)):
    validate_journal(data)
    entry = db.get(models.Journal, journal_id)
    if not entry:
        raise HTTPException(404, "journal entry not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/api/journal/{journal_id}", status_code=204)
def delete_journal(journal_id: int, db: Session = Depends(get_db)):
    entry = db.get(models.Journal, journal_id)
    if not entry:
        raise HTTPException(404, "journal entry not found")
    db.delete(entry)
    db.commit()


# ---------- Notes ----------

@router.get("/api/notes", response_model=list[schemas.NoteOut])
def list_notes(
    tag: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Note)
    if tag:
        query = query.filter(models.Note.tags.ilike(f"%{tag}%"))
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(models.Note.title.ilike(like), models.Note.content.ilike(like))
        )
    return query.order_by(models.Note.updated_at.desc()).all()


@router.post("/api/notes", response_model=schemas.NoteOut, status_code=201)
def create_note(data: schemas.NoteCreate, db: Session = Depends(get_db)):
    note = models.Note(**data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/api/notes/{note_id}", response_model=schemas.NoteOut)
def get_note(note_id: int, db: Session = Depends(get_db)):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "note not found")
    return note


@router.put("/api/notes/{note_id}", response_model=schemas.NoteOut)
def update_note(note_id: int, data: schemas.NoteUpdate, db: Session = Depends(get_db)):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "note not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/api/notes/{note_id}", status_code=204)
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.get(models.Note, note_id)
    if not note:
        raise HTTPException(404, "note not found")
    db.delete(note)
    db.commit()


# ---------- Settings (key-value) ----------




@router.get("/api/settings", response_model=schemas.SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return schemas.SettingsOut(settings=_read_settings(db))


@router.put("/api/settings", response_model=schemas.SettingsOut)
def update_settings(data: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in data.settings.items():
        row = db.get(models.Setting, key)
        if row is None:
            row = models.Setting(key=key, value=_json_dumps(value))
            db.add(row)
        else:
            row.value = _json_dumps(value)
    db.commit()
    return schemas.SettingsOut(settings=_read_settings(db))


@router.patch("/api/settings/{key}", response_model=schemas.SettingsOut)
def update_setting_key(key: str, value: Any = Body(...), db: Session = Depends(get_db)):
    row = db.get(models.Setting, key)
    if row is None:
        row = models.Setting(key=key, value=_json_dumps(value))
        db.add(row)
    else:
        row.value = _json_dumps(value)
    db.commit()
    return schemas.SettingsOut(settings=_read_settings(db))


@router.delete("/api/settings/{key}", response_model=schemas.SettingsOut)
def delete_setting_key(key: str, db: Session = Depends(get_db)):
    row = db.get(models.Setting, key)
    if row:
        db.delete(row)
        db.commit()
    return schemas.SettingsOut(settings=_read_settings(db))


# ---------- Aggregates ----------

PROJECT_STATUS_ORDER = {"active": 0, "backlog": 1, "paused": 2, "done": 3}


class _TreeNode:
    __slots__ = ("name", "path", "projects", "project_tasks", "tasks", "children")

    def __init__(self, name: str, path: str):
        self.name = name
        self.path = path
        self.projects: list = []
        self.project_tasks: dict[int, list] = {}
        self.tasks: list = []
        self.children: dict[str, _TreeNode] = {}

    def child(self, seg: str) -> "_TreeNode":
        if seg not in self.children:
            self.children[seg] = _TreeNode(seg, f"{self.path}/{seg}" if self.path else seg)
        return self.children[seg]


def build_tree(db: Session) -> schemas.TreeOut:
    """Complete project tree: branch roots -> projects -> tasks, built from branch_path."""
    today = date.today()
    projects: list[models.Project] = list(db.query(models.Project).all())
    proj_by_id = {p.id: p for p in projects}
    all_tasks = list(db.query(models.Task).all())
    time_map = task_time_summaries(db)

    running_project_id = None
    active_sess = (
        db.query(models.TaskSession)
        .filter(models.TaskSession.ended_at.is_(None))
        .order_by(models.TaskSession.started_at.desc())
        .first()
    )
    if active_sess:
        t = db.get(models.Task, active_sess.task_id)
        if t:
            running_project_id = t.project_id

    def with_time(t) -> schemas.WorkTask:
        base = schemas.TaskOut.model_validate(t).model_dump()
        ts = time_map.get(t.id, schemas.TaskTimeSummary())
        proj = proj_by_id.get(t.project_id)
        return schemas.WorkTask(**base, **ts.model_dump(), project_title=proj.title if proj else "Unknown")

    def sort_tasks(tasks):
        open_ = [t for t in tasks if t.status != "done"]
        closed = [t for t in tasks if t.status == "done"]
        open_.sort(key=lambda t: task_sort_key(t, proj_by_id))
        closed.sort(key=lambda t: task_sort_key(t, proj_by_id))
        return open_ + closed

    root = _TreeNode("", "")
    for p in projects:
        node = root
        for seg in (p.branch_path or "").split("/"):
            if not seg:
                continue
            node = node.child(seg)
        node.projects.append(p)

    for t in all_tasks:
        proj = proj_by_id.get(t.project_id)
        base = (proj.branch_path or "") if proj else ""
        tp = t.branch_path or ""
        rel = tp[len(base) + 1 :] if (tp and base and tp.startswith(base + "/")) else ""
        node = root
        for seg in base.split("/"):
            if not seg:
                continue
            node = node.child(seg)
        if rel:
            for seg in rel.split("/"):
                if not seg:
                    continue
                node = node.child(seg)
            node.tasks.append(t)
        else:
            node.project_tasks.setdefault(t.project_id, []).append(t)

    def node_out(node: _TreeNode) -> schemas.TreeNode:
        tprojects = []
        for p in node.projects:
            ts = node.project_tasks.get(p.id, [])
            open_tasks = [t for t in ts if t.status != "done"]
            open_tasks.sort(key=lambda t: task_sort_key(t, proj_by_id))
            done = len(ts) - len(open_tasks)
            overdue = any(t.due_date and t.due_date < today for t in open_tasks)
            tprojects.append(
                schemas.TreeProject(
                    project=schemas.ProjectOut.model_validate(p),
                    done=done,
                    total=len(ts),
                    overdue=overdue,
                    running=(p.id == running_project_id),
                    open_tasks=[with_time(t) for t in open_tasks],
                )
            )
        tprojects.sort(
            key=lambda tp: (
                0 if tp.running else 1,
                PROJECT_STATUS_ORDER.get(tp.project.status, 9),
                PRIORITY_ORDER.get(tp.project.priority, 1),
                tp.project.title.lower(),
            )
        )
        return schemas.TreeNode(
            name=node.name,
            path=node.path,
            projects=tprojects,
            tasks=[with_time(t) for t in sort_tasks(node.tasks)],
            children=[node_out(c) for c in sorted(node.children.values(), key=lambda c: c.name.lower())],
        )

    roots = [node_out(c) for c in sorted(root.children.values(), key=lambda c: c.name.lower())]
    if root.projects or root.project_tasks or root.tasks:
        inbox = _TreeNode("inbox", "inbox")
        inbox.projects = root.projects
        inbox.project_tasks = root.project_tasks
        inbox.tasks = root.tasks
        roots.insert(0, node_out(inbox))

    return schemas.TreeOut(today=today, roots=roots)


@router.get("/api/work", response_model=schemas.WorkOut)
def get_work(db: Session = Depends(get_db)):
    """The work screen's single data contract (see WORK_LOGIC.md rules 1-5)."""
    today = date.today()
    projects: dict[int, models.Project] = {p.id: p for p in db.query(models.Project).all()}
    all_tasks = db.query(models.Task).all()
    by_project: dict[int, list] = {}
    for t in all_tasks:
        by_project.setdefault(t.project_id, []).append(t)
    time_map = task_time_summaries(db)

    def project_out(p):
        return schemas.ProjectOut.model_validate(p)

    def with_time(t) -> schemas.TaskTimeOut:
        base = schemas.TaskOut.model_validate(t).model_dump()
        ts = time_map.get(t.id, schemas.TaskTimeSummary())
        return schemas.TaskTimeOut(**base, **ts.model_dump())

    def work_task(t) -> schemas.WorkTask | None:
        if t is None:
            return None
        base = with_time(t).model_dump()
        proj = projects.get(t.project_id)
        return schemas.WorkTask(**base, project_title=proj.title if proj else "Unknown")

    # Rule 2: current task = the in_progress task from the highest-priority active project.
    current = None
    needs_start = False
    in_progress = [t for t in all_tasks if t.status == "in_progress"]
    if in_progress:
        current = min(
            in_progress,
            key=lambda t: (
                task_sort_key(t, projects),
                -((t.updated_at or datetime.min).timestamp()),
            ),
        )
    else:
        active_ids = {p.id for p in projects.values() if p.status == "active"}
        candidates = [
            t for t in all_tasks if t.status != "done" and t.project_id in active_ids
        ]
        if candidates:
            current = min(candidates, key=lambda t: task_sort_key(t, projects))
            needs_start = True
    current_out = work_task(current)

    last_started: schemas.WorkTask | None = None
    last_sess = (
        db.query(models.TaskSession)
        .join(models.Task)
        .filter(models.Task.status != "done")
        .order_by(models.TaskSession.started_at.desc())
        .first()
    )
    if last_sess:
        last_started = work_task(db.get(models.Task, last_sess.task_id))

    # Rule 3: upcoming = non-done tasks in active projects, excluding current.
    active_ids = {p.id for p in projects.values() if p.status == "active"}
    upcoming_tasks = [
        t
        for t in all_tasks
        if t.status != "done"
        and t.project_id in active_ids
        and t.id != (current.id if current else None)
    ]
    upcoming_tasks.sort(key=lambda t: task_sort_key(t, projects))
    upcoming = [work_task(t) for t in upcoming_tasks[:5]]

    # Active projects with progress + open tasks.
    active_projects = []
    for p in sorted(projects.values(), key=lambda p: PRIORITY_ORDER.get(p.priority, 1)):
        if p.status != "active":
            continue
        tasks = by_project.get(p.id, [])
        open_tasks = [t for t in tasks if t.status != "done"]
        open_tasks.sort(key=lambda t: task_sort_key(t, projects))
        done = len(tasks) - len(open_tasks)
        overdue = any(t.due_date and t.due_date < today for t in open_tasks)
        active_projects.append(
            schemas.ActiveProject(
                project=project_out(p),
                done=done,
                total=len(tasks),
                open_tasks=[with_time(t) for t in open_tasks],
                overdue=overdue,
            )
        )

    # Rule 5: ideas = backlog projects, each with its top non-done task.
    ideas = []
    for p in projects.values():
        if p.status != "backlog":
            continue
        ts = [t for t in by_project.get(p.id, []) if t.status != "done"]
        ts.sort(key=lambda t: task_sort_key(t, projects))
        ideas.append(
            schemas.Idea(
                project=project_out(p),
                top_task=schemas.TaskOut.model_validate(ts[0]) if ts else None,
            )
        )

    return schemas.WorkOut(
        today=today,
        current=current_out,
        needs_start=needs_start,
        upcoming=upcoming,
        active_projects=active_projects,
        ideas=ideas,
        last_started=last_started,
    )


@router.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    today = date.today()
    active_projects = (
        db.query(models.Project)
        .filter(models.Project.status == "active")
        .order_by(models.Project.updated_at.desc())
        .all()
    )
    backlog = (
        db.query(models.Project)
        .filter(models.Project.status == "backlog")
        .order_by(models.Project.priority.asc(), models.Project.target_date.asc().nulls_last())
        .all()
    )
    learnings = (
        db.query(models.Learning)
        .order_by(models.Learning.date.desc())
        .limit(10)
        .all()
    )
    goals = db.query(models.Goal).order_by(models.Goal.area.asc()).all()
    journal = (
        db.query(models.Journal)
        .order_by(models.Journal.date.desc())
        .limit(15)
        .all()
    )
    notes = (
        db.query(models.Note)
        .order_by(models.Note.updated_at.desc())
        .limit(15)
        .all()
    )
    tasks = db.query(models.Task).all()
    tasks_by_project: dict[int, list] = {}
    for t in tasks:
        tasks_by_project.setdefault(t.project_id, []).append(t)
    return {
        "today": today.isoformat(),
        "active_projects": [schemas.ProjectOut.model_validate(p) for p in active_projects],
        "backlog": [schemas.ProjectOut.model_validate(p) for p in backlog],
        "recent_learnings": [schemas.LearningOut.model_validate(l) for l in learnings],
        "goals": [schemas.GoalOut.model_validate(g) for g in goals],
        "journal": [schemas.JournalOut.model_validate(j) for j in journal],
        "recent_notes": [schemas.NoteOut.model_validate(n) for n in notes],
        "tasks_by_project": {
            str(pid): [schemas.TaskOut.model_validate(t) for t in tasks]
            for pid, tasks in tasks_by_project.items()
        },
    }


@router.get("/api/daily-stats", response_model=list[schemas.DailyStatOut])
def daily_stats(
    days: int = Query(default=2, ge=1, le=31),
    db: Session = Depends(get_db),
):
    """Per-day counters (UTC) for the header trend metrics. Computes deterministically
    from source data and upserts a snapshot row per day, so history stays accurate."""
    now = datetime.utcnow()
    today = now.date()
    out = []
    for offset in range(days - 1, -1, -1):
        d = today - timedelta(days=offset)
        day_start = datetime.combine(d, datetime.min.time())
        next_day = day_start + timedelta(days=1)

        # Active projects: currently-active whose start (begin_date, else created_at) is <= d.
        active_projects = 0
        for p in db.query(models.Project).all():
            if p.status != "active":
                continue
            start = p.begin_date or (p.created_at.date() if p.created_at else date.max)
            if start <= d:
                active_projects += 1

        # Tasks due on d that weren't already finished before d.
        tasks_due = 0
        for t in db.query(models.Task).all():
            if t.due_date != d:
                continue
            if t.status == "done" and t.done_at and t.done_at.date() < d:
                continue
            tasks_due += 1

        # Work seconds clipped to the UTC day (sessions may span midnight).
        # Running (unended) sessions are excluded here — the frontend adds live elapsed.
        work_seconds = 0.0
        for s in db.query(models.TaskSession).filter(models.TaskSession.started_at < next_day).all():
            if s.ended_at is None:
                continue
            if s.ended_at <= day_start or s.started_at >= next_day:
                continue
            lo = max(day_start, s.started_at)
            hi = min(next_day, s.ended_at)
            work_seconds += max(0.0, (hi - lo).total_seconds())

        row = db.get(models.DailySnapshot, d)
        if row is None:
            row = models.DailySnapshot(
                date=d,
                active_projects=active_projects,
                tasks_due=tasks_due,
                work_seconds=work_seconds,
            )
            db.add(row)
        else:
            row.active_projects = active_projects
            row.tasks_due = tasks_due
            row.work_seconds = work_seconds

        out.append(
            schemas.DailyStatOut(
                date=d,
                active_projects=active_projects,
                tasks_due=tasks_due,
                work_seconds=round(work_seconds, 2),
            )
        )
    db.commit()
    return out


ANALYTICS_RANGES = {"daily", "weekly", "monthly"}


def _bucket_session_seconds(sessions: list[models.TaskSession], day_start: datetime, next_day: datetime) -> float:
    """Sum session seconds clipped to [day_start, next_day). Running (unended) sessions excluded."""
    total = 0.0
    for s in sessions:
        if s.ended_at is None:
            continue
        if s.ended_at <= day_start or s.started_at >= next_day:
            continue
        lo = max(day_start, s.started_at)
        hi = min(next_day, s.ended_at)
        total += max(0.0, (hi - lo).total_seconds())
    return total


def _analytics_bucket(
    day_start: datetime,
    next_day: datetime,
    bucket_days: int,
    label_fmt: str,
    waking_hours: int,
    tasks: list[models.Task],
    sessions: list[models.TaskSession],
) -> schemas.AnalyticsBucket:
    """Aggregate one bucket of the analytics chart (tasks created/done, focus score)."""
    created = 0
    completed = 0
    for t in tasks:
        if t.created_at and day_start <= t.created_at < next_day:
            created += 1
        if t.done_at and day_start <= t.done_at < next_day:
            completed += 1
    work_secs = _bucket_session_seconds(sessions, day_start, next_day)
    wake_secs = waking_hours * 3600 * max(1, bucket_days)
    focus = min(100.0, round((work_secs / wake_secs) * 100, 2)) if wake_secs else 0.0
    return schemas.AnalyticsBucket(
        start=day_start.date(),
        label=day_start.date().strftime(label_fmt),
        tasks_created=created,
        tasks_completed=completed,
        work_seconds=round(work_secs, 2),
        focus_score=focus,
    )


@router.get("/api/analytics", response_model=schemas.AnalyticsOut)
def analytics(
    prange: str = Query(default="daily", alias="range"),
    db: Session = Depends(get_db),
):
    """Bucketed task/focus analytics for the chart widget. Buckets cover the time range
    up to today: last 19 days (daily), last 12 weeks (weekly), last 12 months (monthly)."""
    if prange not in ANALYTICS_RANGES:
        raise HTTPException(400, f"range must be one of {sorted(ANALYTICS_RANGES)}")

    try:
        waking_hours = int(_read_settings(db).get("waking_hours") or 16)
    except (TypeError, ValueError):
        waking_hours = 16
    waking_hours = max(1, min(24, waking_hours))

    tasks = db.query(models.Task).all()
    sessions = db.query(models.TaskSession).all()
    today = datetime.utcnow().date()

    buckets: list[schemas.AnalyticsBucket] = []
    if prange == "daily":
        for offset in range(18, -1, -1):
            d = today - timedelta(days=offset)
            day_start = datetime.combine(d, datetime.min.time())
            buckets.append(
                _analytics_bucket(day_start, day_start + timedelta(days=1), 1, "%b %d", waking_hours, tasks, sessions)
            )
    elif prange == "weekly":
        monday = today - timedelta(days=today.weekday())  # weeks start Monday
        for w in range(11, -1, -1):
            d = monday - timedelta(weeks=w)
            day_start = datetime.combine(d, datetime.min.time())
            bucket_days = max(1, min(7, (today - d).days + 1))
            buckets.append(
                _analytics_bucket(day_start, day_start + timedelta(days=7), bucket_days, "%b %d", waking_hours, tasks, sessions)
            )
    else:  # monthly
        months: list[tuple[int, int]] = []
        y, m = today.year, today.month
        for _ in range(12):
            months.append((y, m))
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        for idx, (y, m) in enumerate(reversed(months)):
            day_start = datetime(y, m, 1)
            if m == 12:
                next_month = datetime(y + 1, 1, 1)
            else:
                next_month = datetime(y, m + 1, 1)
            if idx == 11:  # current (partial) month
                bucket_days = max(1, (today - day_start.date()).days + 1)
            else:
                bucket_days = (next_month.date() - day_start.date()).days
            buckets.append(
                _analytics_bucket(day_start, next_month, bucket_days, "%b %Y", waking_hours, tasks, sessions)
            )

    return schemas.AnalyticsOut(range=prange, waking_hours=waking_hours, buckets=buckets)


@router.get("/api/tree", response_model=schemas.TreeOut)
def get_tree(db: Session = Depends(get_db)):
    return build_tree(db)


@router.get("/api/stats")
def stats(db: Session = Depends(get_db)):
    """Aggregate counters + recent time sessions — powers the analytics/habits/greeting widgets."""
    today = date.today()
    tasks = db.query(models.Task).all()
    projects = db.query(models.Project).all()
    since = datetime.utcnow() - timedelta(days=60)
    sessions = (
        db.query(models.TaskSession)
        .filter(models.TaskSession.started_at >= since)
        .order_by(models.TaskSession.started_at.desc())
        .all()
    )
    open_tasks = [t for t in tasks if t.status != "done"]
    done_tasks = [t for t in tasks if t.status == "done"]
    due_today = [t for t in tasks if t.status != "done" and t.due_date == today]
    return {
        "today": today.isoformat(),
        "open_tasks": len(open_tasks),
        "done_tasks": len(done_tasks),
        "active_projects": sum(1 for p in projects if p.status == "active"),
        "tasks_due_today": len(due_today),
        "sessions": [
            {
                "started_at": s.started_at.isoformat(),
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "duration_seconds": s.duration_seconds,
            }
            for s in sessions
        ],
    }


@router.get("/api/timeline", response_model=list[schemas.TimelineItem])
def timeline(limit: int = Query(default=100, ge=1, le=500), db: Session = Depends(get_db)):
    items: list[schemas.TimelineItem] = []
    for l in db.query(models.Learning).all():
        items.append(
            schemas.TimelineItem(
                kind="learning",
                date=l.date,
                title=l.title,
                body=l.content,
                tags=l.tags,
                entity_id=l.id,
            )
        )
    for p in db.query(models.Project).all():
        items.append(
            schemas.TimelineItem(
                kind="project",
                date=(p.target_date or p.updated_at.date()),
                title=p.title,
                body=f"Status: {p.status} | Priority: {p.priority}\n{p.description}",
                tags=p.tags,
                entity_id=p.id,
            )
        )
    for j in db.query(models.Journal).all():
        items.append(
            schemas.TimelineItem(
                kind="journal",
                date=j.date,
                title=j.type,
                body=j.content,
                tags=j.related_entity,
                entity_id=j.id,
            )
        )
    for n in db.query(models.Note).all():
        items.append(
            schemas.TimelineItem(
                kind="note",
                date=n.updated_at.date(),
                title=n.title,
                body=n.content,
                tags=n.tags,
                entity_id=n.id,
            )
        )
    for t in db.query(models.Task).all():
        items.append(
            schemas.TimelineItem(
                kind="task",
                date=(t.due_date or t.updated_at.date()),
                title=t.title,
                body=f"Status: {t.status} | Priority: {t.priority}",
                tags="",
                entity_id=t.id,
            )
        )
    items.sort(key=lambda i: i.date, reverse=True)
    return items[:limit]


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
