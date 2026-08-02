from datetime import date
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Life-at-a-Glance", version="0.1.0")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


def validate_project(data: schemas.ProjectCreate | schemas.ProjectUpdate):
    status = data.status if isinstance(data, schemas.ProjectCreate) else None
    if status is not None and status not in schemas.PROJECT_STATUSES:
        raise HTTPException(400, f"status must be one of {sorted(schemas.PROJECT_STATUSES)}")
    priority = data.priority if isinstance(data, schemas.ProjectCreate) else None
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


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------- Projects ----------

@app.get("/api/projects", response_model=list[schemas.ProjectOut])
def list_projects(
    status: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Project)
    if status:
        query = query.filter(models.Project.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(models.Project.title.ilike(like), models.Project.tags.ilike(like))
        )
    return query.order_by(models.Project.created_at.desc()).all()


@app.post("/api/projects", response_model=schemas.ProjectOut, status_code=201)
def create_project(data: schemas.ProjectCreate, db: Session = Depends(get_db)):
    validate_project(data)
    project = models.Project(**data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@app.get("/api/projects/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    return project


@app.put("/api/projects/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: int, data: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    validate_project(data)
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(404, "project not found")
    db.delete(project)
    db.commit()


# ---------- Goals ----------

@app.get("/api/goals", response_model=list[schemas.GoalOut])
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


@app.post("/api/goals", response_model=schemas.GoalOut, status_code=201)
def create_goal(data: schemas.GoalCreate, db: Session = Depends(get_db)):
    validate_goal(data)
    goal = models.Goal(**data.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@app.get("/api/goals/{goal_id}", response_model=schemas.GoalOut)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.get(models.Goal, goal_id)
    if not goal:
        raise HTTPException(404, "goal not found")
    return goal


@app.put("/api/goals/{goal_id}", response_model=schemas.GoalOut)
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


@app.delete("/api/goals/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.get(models.Goal, goal_id)
    if not goal:
        raise HTTPException(404, "goal not found")
    db.delete(goal)
    db.commit()


# ---------- Learnings ----------

@app.get("/api/learnings", response_model=list[schemas.LearningOut])
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


@app.post("/api/learnings", response_model=schemas.LearningOut, status_code=201)
def create_learning(data: schemas.LearningCreate, db: Session = Depends(get_db)):
    learning = models.Learning(**data.model_dump())
    db.add(learning)
    db.commit()
    db.refresh(learning)
    return learning


@app.get("/api/learnings/{learning_id}", response_model=schemas.LearningOut)
def get_learning(learning_id: int, db: Session = Depends(get_db)):
    learning = db.get(models.Learning, learning_id)
    if not learning:
        raise HTTPException(404, "learning not found")
    return learning


@app.put("/api/learnings/{learning_id}", response_model=schemas.LearningOut)
def update_learning(learning_id: int, data: schemas.LearningUpdate, db: Session = Depends(get_db)):
    learning = db.get(models.Learning, learning_id)
    if not learning:
        raise HTTPException(404, "learning not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(learning, key, value)
    db.commit()
    db.refresh(learning)
    return learning


@app.delete("/api/learnings/{learning_id}", status_code=204)
def delete_learning(learning_id: int, db: Session = Depends(get_db)):
    learning = db.get(models.Learning, learning_id)
    if not learning:
        raise HTTPException(404, "learning not found")
    db.delete(learning)
    db.commit()


# ---------- Journal ----------

@app.get("/api/journal", response_model=list[schemas.JournalOut])
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


@app.post("/api/journal", response_model=schemas.JournalOut, status_code=201)
def create_journal(data: schemas.JournalCreate, db: Session = Depends(get_db)):
    validate_journal(data)
    entry = models.Journal(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@app.get("/api/journal/{journal_id}", response_model=schemas.JournalOut)
def get_journal(journal_id: int, db: Session = Depends(get_db)):
    entry = db.get(models.Journal, journal_id)
    if not entry:
        raise HTTPException(404, "journal entry not found")
    return entry


@app.put("/api/journal/{journal_id}", response_model=schemas.JournalOut)
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


@app.delete("/api/journal/{journal_id}", status_code=204)
def delete_journal(journal_id: int, db: Session = Depends(get_db)):
    entry = db.get(models.Journal, journal_id)
    if not entry:
        raise HTTPException(404, "journal entry not found")
    db.delete(entry)
    db.commit()


# ---------- Aggregates ----------

@app.get("/api/dashboard")
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
    return {
        "today": today.isoformat(),
        "active_projects": [schemas.ProjectOut.model_validate(p) for p in active_projects],
        "backlog": [schemas.ProjectOut.model_validate(p) for p in backlog],
        "recent_learnings": [schemas.LearningOut.model_validate(l) for l in learnings],
        "goals": [schemas.GoalOut.model_validate(g) for g in goals],
        "journal": [schemas.JournalOut.model_validate(j) for j in journal],
    }


@app.get("/api/timeline", response_model=list[schemas.TimelineItem])
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
    items.sort(key=lambda i: i.date, reverse=True)
    return items[:limit]


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
