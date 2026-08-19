---
name: main-skill
description: Dispatcher/router for the Life-at-a-Glance skills directory. Entry point for any agent arriving with a message or request. Read this file first to classify the incoming message and find the sub-skill to execute. When the message is a task, project, or goal input — e.g. "add a task...", "I need to finish X by...", a natural-language task description, a goal ("my goal is..."), or an update/completion message ("I finished X", "push the deadline", "set progress to 50%") — route to and execute /home/ubuntu/Personal Projects/Jane-Desk/skills/task-master.md.
---

# Main Skill — Dispatcher / Router

The distributor of the `skills/` directory. Every agent that arrives with a message reads this file first, determines what the message asks for, and is pointed to the correct sub-skill to execute.

## How to route

1. Read the incoming message and classify its intent.
2. Match the intent to the routing table below.
3. Read the target skill file and execute it against the message.

## Routing table

| If the message is… | Execute this skill |
|---|---|
| A task input — user describes a task to add/capture ("add a task…", "I need to finish X by…", any task description) | `task-master.md` → `/home/ubuntu/Personal Projects/Jane-Desk/skills/task-master.md` (fill the TASK/PROJECT forms, confirm, log) |
| A goal input — user states an aspiration ("my goal is…", "I want to be able to… by December") with an area, progress, or target date | `task-master.md` → `/home/ubuntu/Personal Projects/Jane-Desk/skills/task-master.md` (fill the GOAL form, confirm, log via `/api/goals`) |
| An update / completion message — "I finished X", "mark X done", "starting work on X", "push/delay X's deadline", "make X high priority", "goal is at N% now" | `task-master.md` → `/home/ubuntu/Personal Projects/Jane-Desk/skills/task-master.md` (MARK DONE / CHANGE / GOAL PROG forms; match the existing record, show the change, confirm) |
| A completion of a project (done with the whole project) or goal (reached the goal) | `task-master.md` → `/home/ubuntu/Personal Projects/Jane-Desk/skills/task-master.md` (MARK DONE; PUT status / status=completed + progress=100) |
| "Run the evals" / "test the skill" — verify extraction, format, and confirmation behavior | `task-master.md` → `/home/ubuntu/Personal Projects/Jane-Desk/skills/task-master.md`, section "Appendix: Eval suite" (**spawn a subagent** to run Layers A–C; extraction-only, never writes) |

## Human-in-the-loop rule

The `task-master` skill **never writes to the database without explicit user approval**.
Every planned create, update, completion, or goal-progress change is shown as a filled form
(preview) and confirmed first. Silence, "sure", or inferred consent is NOT approval. If you
route to `task-master`, keep the user in the loop — the router never sends data to the
database on its own.

## Unhandled intents

If no entry in the routing table matches, say so and list what the router currently supports, rather than guessing.
Do Not guess

## Notes

- Sub-skills live in the same `skills/` directory; add a new row to the routing table when a new sub-skill is introduced.
- The repo lives at `/home/ubuntu/Personal Projects/Jane-Desk` — use that path when referencing skill files.
- The skill's eval suite (Layers A–C) is **agent-run**: a spawned subagent applies the skill to each fixture and returns a PASS/FAIL table. It never writes to the database.