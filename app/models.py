from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

NOW = datetime.utcnow


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active/backlog/done/paused
    priority: Mapped[str] = mapped_column(String(10), default="medium")  # high/medium/low
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    begin_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)  # hours
    branch_path: Mapped[str] = mapped_column(String(300), default="")  # root segment, e.g. "work"
    tags: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=NOW)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=NOW, onupdate=NOW)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="wanted")  # wanted/planned/in_progress/done
    priority: Mapped[str] = mapped_column(String(10), default="medium")  # high/medium/low
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    begin_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)  # hours
    branch_path: Mapped[str] = mapped_column(String(300), default="")  # full path, e.g. "work/2026/Q3 report"
    done_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=NOW)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=NOW, onupdate=NOW)


class TaskSession(Base):
    __tablename__ = "task_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=NOW)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=NOW)


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    area: Mapped[str] = mapped_column(String(50), nullable=False)  # career/health/family/learning/finance...
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    progress: Mapped[float] = mapped_column(Float, default=0.0)  # 0..100
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active/completed/paused
    created_at: Mapped[datetime] = mapped_column(DateTime, default=NOW)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=NOW, onupdate=NOW)


class Learning(Base):
    __tablename__ = "learnings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    date: Mapped[date] = mapped_column(Date, default=date.today)
    tags: Mapped[str] = mapped_column(String(200), default="")
    related_project: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=NOW)


class Journal(Base):
    __tablename__ = "journal"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, default=date.today)
    type: Mapped[str] = mapped_column(String(20), default="note")  # milestone/note/reflection
    content: Mapped[str] = mapped_column(Text, default="")
    related_entity: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=NOW)


class Setting(Base):
    """Key-value app settings (display name, widget layout, dashboard targets)."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")  # JSON-serialized value
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=NOW, onupdate=NOW)
