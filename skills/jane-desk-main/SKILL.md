---
name: jane-desk-main
description: Primary entry point for third-party agents using Jane-Desk (Life-at-a-Glance). Routes dashboard data requests to the appropriate specialized skill before any API write.
---

# Jane-Desk main skill

Use this as the entry point for every Life-at-a-Glance request. Classify the request, then load only the appropriate specialist from the same installed Jane-Desk skill bundle.

| Request | Load next |
| --- | --- |
| Add, plan, change, complete, postpone, prioritize, or start a task/project/goal expressed in natural language | `jane-desk-task-master/SKILL.md` |
| Persist a structured task, project, goal, learning, journal entry, or note; resolve IDs; perform a timer action | `jane-desk-data/SKILL.md` |
| Build, debug, redesign, or deploy the dashboard application | This is not a data-skill request; follow the repository's contributor instructions instead. |
| Ambiguous or conversational message | Ask a focused clarification. Do not create a record merely because a user mentioned an activity. |

All specialists share one invariant: write through the local API only. Never edit `data/life.db` directly. `jane-desk-data` owns endpoint selection, payload validation, and post-write verification.

If this platform cannot load a sibling skill by name, read the sibling's `SKILL.md` from the installed Jane-Desk skills directory before proceeding. Do not substitute its instructions from memory.
