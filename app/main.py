import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import Base, engine, get_db

from app.routers import (
    projects, tasks, sessions, goals, learnings, journal, notes, settings, dashboard
)

app = FastAPI(title="Life-at-a-Glance", version="0.1.0")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(sessions.router)
app.include_router(goals.router)
app.include_router(learnings.router)
app.include_router(journal.router)
app.include_router(notes.router)
app.include_router(settings.router)
app.include_router(dashboard.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
