---
name: jane-desk-task-master
description: Interpret natural-language task, project, and goal requests for Jane-Desk; preview ambiguous or inferred changes and hand approved writes to jane-desk-data. Do not use for code changes or direct database access.
---

# Jane-Desk task master

Turn task, project, and goal language into an accurate dashboard operation, then use the `jane-desk-data` skill to write and verify it.

## Classify

- A bounded action is a **task**. It must have an existing, unambiguous parent project ID before creation.
- An independent initiative or deliverable is a **project**.
- A long-running aspiration is a **goal**.
- “Finished”, “start”, “postpone”, “make high priority”, and “progress is N%” update an existing record; they never create a duplicate.

## Resolve before writing

Search for existing records by title before create/update. If matching candidates are ambiguous, present them and ask the user to choose. For an unrequested/inferred capture or a material update without a clear target, show a compact preview and obtain explicit approval. A direct request such as “add task X to project Y” authorizes that specific write once the parent is unambiguous.

Use only stated values. Do not invent titles, dates, durations, parent projects, goal area, or priority. Omit unknown optional fields. Normalize dates to `YYYY-MM-DD`; duration is hours. Allowed values:

- task status: `wanted`, `planned`, `in_progress`, `done`
- project status: `active`, `backlog`, `done`, `paused`
- goal status: `active`, `completed`, `paused`
- priority: `high`, `medium`, `low`
- goal area: `career`, `health`, `family`, `learning`, `finance`, `other`

For a completion, use the matched record: task → `done`; project → `done`; goal → `completed` with progress `100`. For task starts, use the dedicated start endpoint rather than only changing the status.

After resolving the intent and authorization, load `jane-desk-data/SKILL.md` and follow its guarded API write and verification procedure.
