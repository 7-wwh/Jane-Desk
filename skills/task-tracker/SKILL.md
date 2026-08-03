---
name: task-tracker
version: "4.0"
description: >
  External JSON/Obsidian task tracker (secondary system) with knowledge atom capture and
  vault visualization. This is the SKILL for the standalone task-tracker running out of
  /home/ubuntu/Documents/ObsidianVault/task-tracking-visualize/ — daily brief, project
  tree, atoms, cron. The dashboard's own SQLite task feature is the PRIMARY task system
  (see skills/task-planning/SKILL.md); use this skill when working on the external tracker,
  its vault files, or its scripts.
---

# Task Tracker Skill — v4.0

## Relationship to the dashboard

This skill manages the **external** task-tracker: JSON data files plus auto-generated
Obsidian markdown, all under the vault path below, with a cron daily brief. It is
**secondary** to the dashboard's own task feature. The dashboard's tasks live in SQLite
(`wanted/planned/in_progress/done`) and are written via the API — see
`skills/task-planning/SKILL.md`. Keep the two systems separate; do not point one at the
other's data. Scripts here read/write the vault at its absolute path and are safe to run
from anywhere on this machine.

## Overview

Manages Heng's personal task system across three JSON files, plus three auto-generated
Obsidian markdown files for visualization. Everything lives at:

```
/home/ubuntu/Documents/ObsidianVault/task-tracking-visualize/
  tasks.json              ← Master tree (all projects, all statuses, atoms)
  active-tasks.json       ← Derived snapshot: pending/active/blocked tasks only
  knowledge.json          ← Knowledge atom ledger
  PROJECT-TREE.md         ← 🗂 Visual project tree (auto-generated)
  KNOWLEDGE-INDEX.md      ← 📚 Atom ledger in readable form (auto-generated)
  README.md               ← 🏠 Vault landing page with stats (auto-generated)
  daily-brief.log         ← Morning brief history
  scripts/
    daily_brief.py        ← Terminal brief (cron + manual)
    write_tasks.py        ← Atomic task writer
    write_knowledge.py    ← Knowledge atom writer
    write_vault_index.py  ← Generates PROJECT-TREE.md / KNOWLEDGE-INDEX.md / README.md
    install_cron.sh       ← Install cron jobs
```

**Always read current files before writing. Never overwrite from memory alone.**

After every task or knowledge write, run `write_vault_index.py` to keep the .md files current.

---

## 1. Data Schemas

See `references/schemas.md` for full field definitions. Quick summary:

### tasks.json
```json
{
  "projects": {
    "<project_slug>": {
      "name": "Human-readable name",
      "description": "What this project is about",
      "tasks": {
        "<task_id>": {
          "title": "...",
          "description": "...",
          "plan": "How Heng plans to approach it",
          "priority": "critical | high | medium | low",
          "status": "pending | active | blocked | done | cancelled",
          "deadline": "YYYY-MM-DD or null",
          "duration_estimate": "e.g. '3 days'",
          "created_at": "ISO timestamp",
          "updated_at": "ISO timestamp",
          "done_at": "ISO timestamp or null",
          "tags": ["..."],
          "notes": "Running notes",
          "atoms": [{"id":"atom_xxx","title":"...","description":"...","transferred":false}],
          "subtasks": { /* same Task shape, nested */ }
        }
      }
    }
  },
  "meta": {"last_updated": "ISO", "version": "1.0"}
}
```

### active-tasks.json
Derived from tasks.json. Contains only `pending | active | blocked` tasks.
Regenerated fully on every write — never edit independently.

### knowledge.json
```json
{
  "meta": {"last_updated": "ISO", "total_atoms": 0},
  "atoms": [{
    "id": "atom_xxx",
    "title": "...",
    "description": "What specifically was learned",
    "source_task": "<task_id>",
    "source_project": "<project_slug>",
    "learned_at": "ISO timestamp",
    "tags": ["..."],
    "notes": ""
  }]
}
```

---

## 2. Operations

### ADD TASK
Trigger: "add a task", "new task", "I need to do X", "track this"

1. If project is new, create it. If ambiguous, ask.
2. Generate `task_id`: `<project_slug>_<short_descriptor>_<YYYYMMDD>`.
3. Pre-populate `atoms` with 2–4 plausible learning atoms (`transferred: false`).
4. Run `scripts/write_tasks.py` → writes `tasks.json` + regenerates `active-tasks.json`.
5. Run `scripts/write_vault_index.py` → refreshes all three .md files.
6. Confirm back to Heng with a clean summary table.

### UPDATE TASK STATUS
Trigger: "mark X as active/blocked/done", "I finished X", "X is done"

If marking **done**:
1. Set `status: done`, `done_at: now`.
2. Show the task's atoms. Ask: *"You completed [task]. Here are the pre-populated learning atoms — what did you actually learn? Edit, add, or confirm, and I'll transfer them to your ledger."*
3. Suggest any atoms Heng might have missed based on task description + plan.
4. On confirmation → transfer: copy to `knowledge.json` with `learned_at: now`, mark `transferred: true`.
5. Regenerate `active-tasks.json` and run `write_vault_index.py`.

If marking **blocked** or updating fields: update in place, regenerate snapshots.

### EDIT KNOWLEDGE ATOM
Trigger: "I learned X", "update my knowledge", "add to my skills", "I also learned"

1. Read `knowledge.json`.
2. Append new atom(s) or update existing ones by title/id match.
3. Run `write_vault_index.py` to refresh `KNOWLEDGE-INDEX.md`.

### DAILY BRIEF
Trigger: cron at 08:00 Mon–Fri, or "daily brief", "what should I work on", "what's due"

Run `scripts/daily_brief.py`. Output shows:
- 🔥 Overdue tasks
- ⚠️ Due this week
- 🎯 Top 5 priorities (sorted by urgency + deadline)
- 📊 Project snapshot with progress bars
- 💡 Focus suggestion (1–2 lines, actionable)
- 📚 Recent knowledge atoms (last 7 days)

### VAULT SYNC
Trigger: "sync vault", "refresh Obsidian", "update project tree", "write vault index"

Run `scripts/write_vault_index.py`. Regenerates:
- `PROJECT-TREE.md` — Visual tree with progress bars, status icons, deadline flags
- `KNOWLEDGE-INDEX.md` — All atoms grouped by project
- `README.md` — Vault home with stats and active task list

### QUERY / STATUS
Trigger: "show my tasks", "what's in [project]", "task status", "show knowledge"

Read the relevant JSON and render a clean markdown table or bulleted list.
Never dump raw JSON.

---

## 3. Writing Rules

- **Always read before write.** Load current file, modify in Python, write back.
- **Regenerate `active-tasks.json` on every task write.** Always derived.
- **Run `write_vault_index.py` after every task or knowledge write.**
- **All timestamps**: ISO 8601 (`datetime.utcnow().isoformat() + "Z"`).
- **Vault path constant**: `/home/ubuntu/Documents/ObsidianVault/task-tracking-visualize`

---

## 4. Cron Setup

Two jobs installed by `scripts/install_cron.sh`:

```
08:00 Mon–Fri  → python3 scripts/daily_brief.py --log
08:01 Mon–Fri  → python3 scripts/write_vault_index.py
```

To install:
```bash
bash /home/ubuntu/Documents/ObsidianVault/task-tracking-visualize/scripts/install_cron.sh
```

To run manually:
```bash
python3 /home/ubuntu/.../scripts/daily_brief.py
python3 /home/ubuntu/.../scripts/write_vault_index.py
```

---

## 5. Interaction Style

- Never dump raw JSON. Always render as clean markdown tables or lists.
- Confirm the full task card before writing when adding tasks.
- Always prompt for atom review when marking done — don't silently transfer.
- Be concise in confirmations.
- After any write, mention that the Obsidian vault files have been refreshed.
- If vault files don't exist yet, initialise them with empty structures first.

---

## 6. File Locations

```
VAULT = /home/ubuntu/Documents/ObsidianVault/task-tracking-visualize

scripts/
  daily_brief.py        ← Morning brief (terminal output)
  write_tasks.py        ← Task writer
  write_knowledge.py    ← Knowledge writer
  write_vault_index.py  ← Obsidian .md generator ← NEW in v4
  install_cron.sh       ← Cron installer (now installs 2 jobs)

references/
  schemas.md            ← Full JSON field specs
  examples.md           ← Sample populated JSONs
```
