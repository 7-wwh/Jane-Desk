from datetime import date, datetime, timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app import models, schemas
from app.database import get_db
from app.utils import *

router = APIRouter(tags=["Dashboard"])
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
