# Jane-Desk API contract

Base URL: `${LIFE_DASH_URL:-http://127.0.0.1:8000}`. All endpoints below are prefixed with `/api`.

| Record | Create | Update | Lookup |
| --- | --- | --- | --- |
| Project | `POST /projects` | `PUT /projects/{id}` | `GET /projects?q=` |
| Task | `POST /projects/{project_id}/tasks` | `PUT /tasks/{id}` | `GET /tasks?q=` |
| Goal | `POST /goals` | `PUT /goals/{id}` | `GET /goals` |
| Learning | `POST /learnings` | `PUT /learnings/{id}` | `GET /learnings?q=` |
| Journal | `POST /journal` | `PUT /journal/{id}` | `GET /journal?date=&type=` |
| Note | `POST /notes` | `PUT /notes/{id}` | `GET /notes?q=` |

Task statuses: `wanted`, `planned`, `in_progress`, `done`.

Project statuses: `active`, `backlog`, `done`, `paused`.

Goal statuses: `active`, `completed`, `paused`; areas: `career`, `health`, `family`, `learning`, `finance`, `other`.

Priorities: `high`, `medium`, `low`. Dates are ISO `YYYY-MM-DD`; duration is hours from 0 through 8760. Omit unknown optional values instead of using placeholders such as `N/A`.

Create payloads must include a nonblank `title` for a task, project, goal, learning, or note. A journal entry requires meaningful `content`. Do not include API path fields such as `project_id` in a task-create payload.
