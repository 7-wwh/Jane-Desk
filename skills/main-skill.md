---
name: main-skill
description: Dispatcher/router for the Life-at-a-Glance skills directory. Entry point for any agent arriving with a message or request. Read this file first to classify the incoming message and find the sub-skill to execute. When the message is a task input — e.g. "add a task...", "I need to finish X by...", any natural-language task description — route to and execute /home/ubuntu/Personal Projects/life-at-a-glance/skills/task-master.md.
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
| A task input — user describes a task to add/capture ("add a task…", "I need to finish X by…", any task description) | `task-master.md` → `/home/ubuntu/Personal Projects/life-at-a-glance/skills/task-master.md` (execution includes running the eval suite in its "Appendix: Eval suite") |
| "Run the evals" / "test the skill" — verify task-master extraction behavior | `task-master.md` → `/home/ubuntu/Personal Projects/life-at-a-glance/skills/task-master.md`, section "Appendix: Eval suite" |

## Unhandled intents

If no entry in the routing table matches, say so and list what the router currently supports, rather than guessing.
Do Not guess 

## Notes

- Sub-skills live in the same `skills/` directory; add a new row to the routing table when a new sub-skill is introduced.
