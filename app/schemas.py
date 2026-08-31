import datetime as dt
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

PROJECT_STATUSES = {"active", "backlog", "done", "paused"}
PRIORITIES = {"high", "medium", "low"}
GOAL_AREAS = {"career", "health", "family", "learning", "finance", "other"}
GOAL_STATUSES = {"active", "completed", "paused"}
JOURNAL_TYPES = {"milestone", "note", "reflection"}
TASK_STATUSES = {"wanted", "planned", "in_progress", "done"}

DURATION_MAX_HOURS = 8760.0  # 1 year ceiling


def clean_title(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("title must not be empty")
    return v


class ProjectBase(BaseModel):
    title: str
    description: str = ""
    status: str = "active"
    priority: str = "medium"
    target_date: date | None = None
    begin_date: date | None = None
    duration: float | None = Field(default=None, ge=0.0, le=DURATION_MAX_HOURS)
    branch_path: str = ""
    tags: str = ""

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        return clean_title(v)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    target_date: date | None = None
    begin_date: date | None = None
    duration: float | None = Field(default=None, ge=0.0, le=DURATION_MAX_HOURS)
    branch_path: str | None = None
    tags: str | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        return clean_title(v) if v is not None else v


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


class TaskBase(BaseModel):
    title: str
    status: str = "wanted"
    priority: str = "medium"
    due_date: date | None = None
    begin_date: date | None = None
    duration: float | None = Field(default=None, ge=0.0, le=DURATION_MAX_HOURS)
    branch_path: str = ""

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        return clean_title(v)


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    priority: str | None = None
    project_id: int | None = None
    due_date: date | None = None
    begin_date: date | None = None
    duration: float | None = Field(default=None, ge=0.0, le=DURATION_MAX_HOURS)
    branch_path: str | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        return clean_title(v) if v is not None else v


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    done_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TaskTimeOut(TaskOut):
    total_seconds: float = 0.0
    session_count: int = 0
    running_session_id: int | None = None


class TaskSessionBase(BaseModel):
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: float | None = Field(default=None, ge=0.0)


class TaskSessionCreate(BaseModel):
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: float | None = Field(default=None, ge=0.0)


class TaskSessionUpdate(BaseModel):
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: float | None = Field(default=None, ge=0.0)


class TaskSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: float | None = None


class TaskSessionsOut(BaseModel):
    sessions: list[TaskSessionOut] = []
    total_seconds: float = 0.0
    session_count: int = 0


class ActiveSession(BaseModel):
    session: TaskSessionOut
    task_title: str


class TaskTimeSummary(BaseModel):
    total_seconds: float = 0.0
    session_count: int = 0
    running_session_id: int | None = None


class TimelineItem(BaseModel):
    kind: str
    date: dt.date
    title: str
    body: str
    tags: str = ""
    entity_id: int


class DailyStatOut(BaseModel):
    date: date
    active_projects: int = 0
    tasks_due: int = 0
    work_seconds: float = 0.0


class AnalyticsBucket(BaseModel):
    start: date
    label: str
    tasks_created: int = 0
    tasks_completed: int = 0
    work_seconds: float = 0.0
    focus_score: float = 0.0


class AnalyticsOut(BaseModel):
    range: str
    waking_hours: int
    buckets: list[AnalyticsBucket] = []


class SettingsUpdate(BaseModel):
    # Any JSON-encodable value is allowed per key.
    settings: dict[str, Any] = Field(default_factory=dict)


class SettingsOut(BaseModel):
    settings: dict[str, Any] = Field(default_factory=dict)


class WorkTask(TaskTimeOut):
    project_title: str


class ActiveProject(BaseModel):
    project: ProjectOut
    done: int = 0
    total: int = 0
    open_tasks: list[TaskTimeOut] = []
    overdue: bool = False


class Idea(BaseModel):
    project: ProjectOut
    top_task: TaskOut | None = None


class WorkOut(BaseModel):
    today: date
    current: WorkTask | None = None
    needs_start: bool = False
    upcoming: list[WorkTask] = []
    active_projects: list[ActiveProject] = []
    ideas: list[Idea] = []
    last_started: WorkTask | None = None


class TreeProject(BaseModel):
    project: ProjectOut
    done: int = 0
    total: int = 0
    overdue: bool = False
    running: bool = False
    open_tasks: list[WorkTask] = []


class TreeNode(BaseModel):
    name: str
    path: str
    projects: list[TreeProject] = []
    tasks: list[WorkTask] = []
    children: list["TreeNode"] = []


class TreeOut(BaseModel):
    today: date
    roots: list[TreeNode] = []


class NoteBase(BaseModel):
    title: str
    content: str = ""
    tags: str = ""

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        return clean_title(v)


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: str | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        return clean_title(v) if v is not None else v


class NoteOut(NoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


TreeNode.model_rebuild()
