import datetime as dt
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

PROJECT_STATUSES = {"active", "backlog", "done", "paused"}
PRIORITIES = {"high", "medium", "low"}
GOAL_AREAS = {"career", "health", "family", "learning", "finance", "other"}
GOAL_STATUSES = {"active", "completed", "paused"}
JOURNAL_TYPES = {"milestone", "note", "reflection"}


class ProjectBase(BaseModel):
    title: str
    description: str = ""
    status: str = "active"
    priority: str = "medium"
    target_date: date | None = None
    tags: str = ""


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    target_date: date | None = None
    tags: str | None = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class GoalBase(BaseModel):
    area: str = "other"
    title: str
    description: str = ""
    progress: float = Field(default=0.0, ge=0.0, le=100.0)
    target_date: date | None = None
    status: str = "active"


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    area: str | None = None
    title: str | None = None
    description: str | None = None
    progress: float | None = Field(default=None, ge=0.0, le=100.0)
    target_date: date | None = None
    status: str | None = None


class GoalOut(GoalBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class LearningBase(BaseModel):
    title: str
    content: str = ""
    date: dt.date = Field(default_factory=date.today)
    tags: str = ""
    related_project: str = ""


class LearningCreate(LearningBase):
    pass


class LearningUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    date: dt.date | None = None
    tags: str | None = None
    related_project: str | None = None


class LearningOut(LearningBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class JournalBase(BaseModel):
    date: dt.date = Field(default_factory=date.today)
    type: str = "note"
    content: str = ""
    related_entity: str = ""


class JournalCreate(JournalBase):
    pass


class JournalUpdate(BaseModel):
    date: dt.date | None = None
    type: str | None = None
    content: str | None = None
    related_entity: str | None = None


class JournalOut(JournalBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class TimelineItem(BaseModel):
    kind: str
    date: dt.date
    title: str
    body: str
    tags: str = ""
    entity_id: int
