# JSON Schemas Reference

## tasks.json — Full Field Definitions

```
VAULT = /home/ubuntu/Documents/ObsidianVault/task-tracking-visualize
```

### Top-level
| Field | Type | Description |
|---|---|---|
| `projects` | object | Keyed by `project_slug` (snake_case) |
| `meta.last_updated` | ISO string | Set on every write |
| `meta.version` | string | Schema version, currently "1.0" |

### Project object
| Field | Type | Description |
|---|---|---|
| `name` | string | Human-readable project name |
| `description` | string | What the project is |
| `color` | string | Hex color for UI (optional) |
| `tasks` | object | Keyed by `task_id` |

### Task object
| Field | Type | Description |
|---|---|---|
| `title` | string | Short task title |
| `description` | string | Full description of what needs doing |
| `plan` | string | How Heng plans to approach it |
| `priority` | enum | `critical` / `high` / `medium` / `low` |
| `status` | enum | `pending` / `active` / `blocked` / `done` / `cancelled` |
| `deadline` | string\|null | `YYYY-MM-DD` or null |
| `duration_estimate` | string | Free text: "3 days", "1 week", "2 hours" |
| `created_at` | ISO string | UTC timestamp |
| `updated_at` | ISO string | UTC timestamp, updated on every change |
| `done_at` | string\|null | UTC timestamp when marked done |
| `tags` | array[string] | Free tags |
| `atoms` | array[Atom] | Knowledge atoms (see below) |
| `subtasks` | object | Same Task shape, nested one level |
| `notes` | string | Running notes / journal for this task |

### Atom object (inside a task)
| Field | Type | Description |
|---|---|---|
| `id` | string | `atom_<6-char-hex>` |
| `title` | string | Short skill/knowledge title |
| `description` | string | What specifically was learned |
| `transferred` | bool | `false` until task is done and Heng confirms |

### Task ID format
`<project_slug>_<2-3 word descriptor in snake_case>_<YYYYMMDD>`

Example: `enactus_candle_cost_model_20250720`

---

## active-tasks.json — Derived Snapshot

Always regenerated from `tasks.json`. Contains only `status: pending | active | blocked`.

```json
{
  "meta": {
    "generated_at": "ISO string",
    "total_active": 12
  },
  "tasks": [
    {
      "task_id": "...",
      "project_slug": "...",
      "project_name": "...",
      "title": "...",
      "priority": "...",
      "status": "...",
      "deadline": "YYYY-MM-DD or null",
      "days_until_deadline": 5,
      "duration_estimate": "..."
    }
  ]
}
```

Sorted by: (1) overdue first, (2) deadline ascending, (3) priority descending.

---

## knowledge.json — Atom Ledger

```json
{
  "meta": {
    "last_updated": "ISO string",
    "total_atoms": 42
  },
  "atoms": [
    {
      "id": "atom_a3f9c1",
      "title": "LoRa packet framing for telemetry",
      "description": "Learned how to structure variable-length LoRa packets with a CRC tail for reliable 915 MHz telemetry links.",
      "source_task": "rocket_lora_integration_20250710",
      "source_project": "rocket_telemetry",
      "learned_at": "2025-07-10T14:22:00Z",
      "tags": ["embedded", "LoRa", "radio", "telemetry"],
      "notes": ""
    }
  ]
}
```

---

## Priority → urgency score (used by daily_brief.py)
| Priority | Score |
|---|---|
| critical | 4 |
| high | 3 |
| medium | 2 |
| low | 1 |

Sorting key in brief: `overdue_flag * 1000 + days_until_deadline_inv * 10 + priority_score`
