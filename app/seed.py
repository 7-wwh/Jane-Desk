"""Seed the dashboard with initial example entries."""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import models
from app.database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.query(models.Project).count() > 0:
    print("Database already has data; skipping seed.")
    db.close()
    sys.exit(0)

today = date.today()
yesterday = today - timedelta(days=1)

projects = [
    models.Project(
        title="Life-at-a-Glance dashboard",
        description="Personal life dashboard: projects, goals, learnings, and timeline in one view.",
        status="active",
        priority="high",
        tags="dashboard,personal,fastapi",
    ),
    models.Project(
        title="Learn Tailscale networking",
        description="Understand how the dashboard is reachable from phone and laptop anywhere.",
        status="active",
        priority="medium",
        tags="networking,tailscale",
    ),
    models.Project(
        title="Build a personal website",
        description="Share projects and writing on the open web.",
        status="backlog",
        priority="high",
        target_date=today + timedelta(days=90),
        tags="web,blog",
    ),
    models.Project(
        title="Morning reading habit",
        description="Read 20 minutes every morning before work.",
        status="paused",
        priority="low",
        tags="habit,reading",
    ),
]

goals = [
    models.Goal(
        area="learning",
        title="Ship 10 completed projects this year",
        description="Keep momentum by finishing what I start.",
        progress=10,
        status="active",
    ),
    models.Goal(
        area="health",
        title="Run 5km without stopping",
        description="Build up endurance gradually.",
        progress=40,
        target_date=today + timedelta(days=60),
        status="active",
    ),
    models.Goal(
        area="career",
        title="Master backend development",
        description="Deep knowledge of APIs, databases, and deployment.",
        progress=35,
        status="active",
    ),
]

learnings = [
    models.Learning(
        title="FastAPI serves static files with StaticFiles",
        content="Mount a directory at '/' with html=True to serve index.html at the root alongside the API.",
        date=yesterday,
        tags="fastapi,python,web",
        related_project="Life-at-a-Glance dashboard",
    ),
    models.Learning(
        title="Tailscale gives devices a private IP anywhere",
        content="The tailscale0 interface shows 100.74.182.63, reachable from any signed-in device.",
        date=yesterday,
        tags="tailscale,networking",
    ),
    models.Learning(
        title="SQLAlchemy Mapped[] annotations",
        content="SQLAlchemy 2.0 uses Mapped[type] annotations with mapped_column() instead of old Column() style.",
        date=yesterday,
        tags="sqlalchemy,python",
        related_project="Life-at-a-Glance dashboard",
    ),
]

journal = [
    models.Journal(
        date=today,
        type="milestone",
        content="Started the Life-at-a-Glance dashboard project. First commit: FastAPI backend + dashboard UI plan.",
        related_entity="Life-at-a-Glance dashboard",
    ),
    models.Journal(
        date=yesterday,
        type="reflection",
        content="I want a single glance to tell me what I am building, what I learned, and where I am going.",
    ),
]

db.add_all(projects + goals + learnings + journal)
db.commit()
print(f"Seeded {len(projects)} projects, {len(goals)} goals, {len(learnings)} learnings, {len(journal)} journal entries.")
db.close()
