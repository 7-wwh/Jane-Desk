---
name: task-master
description: Extract structured task metadata from natural language messages. Use this skill whenever the user provides a message describing a task and needs to extract: task name, task description, importance level (high/medium/low), begin date, deadline, duration, and branch classification (main/sub-branch). Triggers include task creation inputs, planning messages, or when users want to parse task information into your task-tracker dashboard.
---

# Task Extractor

A skill for parsing natural language task descriptions and extracting structured metadata for task management systems.

## What it does

Given a message describing one or more tasks, this skill extracts a **JSON array** of tasks,
one element per task found in the message. For each task it extracts:

- **Task Name**: A concise identifier for the task
- **Task Description**: Detailed explanation of what needs to be done
- **Importance**: Priority level (High / Medium / Low)
- **Begin Date**: When the task should start (format: YYYY-MM-DD, or "N/A" if not specified)
- **Deadline**: When the task must be completed (format: YYYY-MM-DD, or "N/A" if not specified)
- **Duration**: Estimated time to complete (e.g., "2 hours", "3 days", "1 week")
- **Branch**: Task classification (Main Branch / Sub-Branch)
- **Confidence**: how sure the extraction is (High / Medium / Low)
- **Flags**: `[]` normally; a list of warnings when input is contradictory or ambiguous

It also guards against weird input: if no actionable task is present it returns a
`noTask` marker instead of fabricating one, and it sanity-checks absurd dates/durations.

## When to use this skill

Use this skill when:
- A user describes a task in prose and needs it parsed into structured fields
- Building or populating your personal task-tracker dashboard
- Converting quick notes into actionable task entries
- Organizing tasks hierarchically (main vs sub-branches)

## How to use

Provide a message describing the task. The skill will infer missing information intelligently based on context and reasonable defaults.

### Example inputs and outputs

**Input:**
```
"I need to finish the Q3 report by Friday. It's pretty urgent so I should start tomorrow. 
Probably takes a day to do, and it feeds into the board presentation deliverables."
```

**Output:**
```json
[
  {
    "taskName": "Q3 Report",
    "taskDescription": "Complete quarterly report for board presentation deliverables",
    "importance": "High",
    "beginDate": "2026-08-06",
    "deadline": "2026-08-08",
    "duration": "1 day",
    "branch": "Main Branch",
    "confidence": "High",
    "flags": []
  }
]
```

**Input:**
```
"Review and approve Sarah's pull request - just a quick code review, shouldn't take more than 30 mins. 
It's part of the database refactoring we're doing."
```

**Output:**
```json
[
  {
    "taskName": "Review Sarah's Pull Request",
    "taskDescription": "Code review for database refactoring PR",
    "importance": "Medium",
    "beginDate": "N/A",
    "deadline": "N/A",
    "duration": "30 minutes",
    "branch": "Sub-Branch",
    "confidence": "High",
    "flags": []
  }
]
```

**Input (multiple tasks):**
```
"Book the flight tomorrow, and then also prepare the presentation deck by Friday, and clean the inbox."
```

**Output:**
```json
[
  {
    "taskName": "Book the flight",
    "taskDescription": "Book travel arrangements",
    "importance": "Medium",
    "beginDate": "2026-08-06",
    "deadline": "N/A",
    "duration": "30 minutes",
    "branch": "Main Branch",
    "confidence": "High",
    "flags": []
  },
  {
    "taskName": "Prepare presentation deck",
    "taskDescription": "Create presentation deck",
    "importance": "Medium",
    "beginDate": "N/A",
    "deadline": "2026-08-08",
    "duration": "2-4 hours",
    "branch": "Sub-Branch",
    "confidence": "High",
    "flags": []
  },
  {
    "taskName": "Clean the inbox",
    "taskDescription": "Tidy email inbox",
    "importance": "Low",
    "beginDate": "N/A",
    "deadline": "N/A",
    "duration": "30 minutes",
    "branch": "Main Branch",
    "confidence": "High",
    "flags": []
  }
]
```

## Inference rules

### Importance levels
- **High**: Uses language like "urgent", "asap", "critical", "blocker", "priority", "deadline today/tomorrow", or has explicit time pressure
- **Medium**: Regular task, mentioned deadline within a week, or standard work
- **Low**: Optional, nice-to-have, no time pressure, or informally phrased

### Dates
- Parse relative dates ("tomorrow" → tomorrow's date, "next Friday" → that Friday)
- Use "N/A" if no begin date or deadline is mentioned
- Assume current date is 2026-08-05 for calculations

### Duration
- Look for explicit time estimates ("30 mins", "2 hours", "a week")
- If not provided, estimate based on task complexity: simple = 30 mins, moderate = 2-4 hours, complex = full day(s)
- Return in human-readable format (e.g., "2 hours", "3 days")

### Branch classification
- **Main Branch**: Top-level strategic tasks, deliverables, long-term goals, or independent projects
- **Sub-Branch**: Supporting tasks, dependencies, subtasks, code reviews, or tasks that feed into other work
- If uncertain, default to Main Branch

### Multi-task splitting
- A message may describe several tasks. Split whenever you see numbered/bulleted lists
  ("1) ... 2) ...", "- ... - ...") or coordinating conjunctions with new actions
  ("and then", "also", "then also", "Do X, do Y", "…, and … afterwards").
- Each item becomes its own object in the output array, inferred independently.
- Dates and importance given once for the whole message apply to all items unless an item
  overrides them; a date stated for a specific item applies only to that item.

### Confidence and flags
- **Confidence** (High / Medium / Low) reflects how reliably fields could be inferred.
  Conflicting signals ("URGENT!! …actually no rush") → **Low**.
- Add **flags** when something is off, but still return the best-guess values:
  - `"conflicting-importance"` — both urgent and relaxed language present
  - `"ambiguous-branch"` — multiple roots mentioned ("work, personal, learning all at once")
  - `"unparsed-units"` — a duration unit not covered by the table below
  - `"suspicious-date"` — a date outside the sane range, kept as N/A instead
- Never refuse a task that exists just because it is weird — extract it and flag it.

### Safeguards for weird data
- **No-task guard**: if the message contains no actionable task (pure noise, a statement,
  an emoji string, idle chat), do NOT invent one. Return:
  ```json
  { "noTask": true, "reason": "No actionable task found in the message." }
  ```
- **Date sanity**: any date with year < 2000 or > 2100, or unparseable ("0000-00-00",
  "year 9999"), becomes `"N/A"` and raises a `"suspicious-date"` flag.
- **Duration sanity**: reject negative estimates; if an estimate is absurdly large
  (e.g. "999999 days"), cap it at the 8760-hour ceiling used by the API.
- **Non-English**: parse if the structure is recognizable ("il faut terminer le rapport
  Q3 avant vendredi" works); pure symbols/no structure fall to the no-task guard.

## Output format

Always return a **JSON array** — one object per task (a single task is a one-element array).
Each object uses exactly these fields:
```json
[
  {
    "taskName": "string",
    "taskDescription": "string",
    "importance": "High" | "Medium" | "Low",
    "beginDate": "YYYY-MM-DD" | "N/A",
    "deadline": "YYYY-MM-DD" | "N/A",
    "duration": "string",
    "branch": "Main Branch" | "Sub-Branch",
    "confidence": "High" | "Medium" | "Low",
    "flags": ["string"]
  }
]
```

Or, when no task exists:
```json
{ "noTask": true, "reason": "string" }
```

## Notes

- If a field cannot be reasonably inferred, use "N/A"
- Be conservative with High importance — reserve it for genuinely time-critical or blocking work
- The skill treats ambiguous branch assignments as Main Branch by default
- Date parsing is flexible and handles common natural language expressions
- Always return the array shape, even for one task; the push step iterates it
- Never send `"N/A"` strings or `"30 minutes"` text to the API — see the conversion rules below

---

## Output format for the database

The extraction above is the intermediate format. To persist it in the Life-at-a-Glance
dashboard, map each field onto the API payload. `branch` decides which entity to write.

| task-master field | API field | Entity | Example |
|---|---|---|---|
| `taskName` | `title` | project / task | `Q3 Report` |
| `taskDescription` | `description` | **project only** (tasks have no description — fold into `title` if essential) | `Complete quarterly report` |
| `importance` | `priority` (lowercase) | project / task | `high` / `medium` / `low` |
| `beginDate` | `begin_date` (YYYY-MM-DD) | project / task | `2026-08-06` |
| `deadline` | `target_date` (project) / `due_date` (task) | | `2026-08-08` |
| `duration` | `duration` (**float, hours**) | project / task | `8.0` |
| `branch` | decides entity | Main → project, Sub → task | |
| — | `branch_path` | project: root segment; task: full path | `work` / `work/2026/Q3 report` |
| `confidence` / `flags` | not persisted | use for judgment only | |

### Duration → hours conversion (24h day / 168h week)

| Human estimate | Hours |
|---|---|
| `30 minutes`, `1 hour` | `0.5`, `1.0` |
| `2 hours`, `6 hours` | `2.0`, `6.0` |
| `1 day`, `2 days` | `24.0`, `48.0` |
| `1 week` | `168.0` |
| `2 weeks`, `1 fortnight` | `336.0` |
| months / unspecified | omit (leave `null`) |
| negative / > 8760 | rejected / capped at `8760.0` |

The extraction output is an **array**; iterate it and map every element the same way.

## Resolving the branch destination

Before pushing, read the existing branch structure from the database and assign a
destination path so the task lands in the right place in the tree.

1. Fetch existing branches:
   - `GET /api/projects` — list all projects (main branches)
   - `GET /api/dashboard` — projects plus their tasks in one call (sub-branches)
2. Derive the destination path from the message context and the `branch` field. Look for
   explicit roots ("work", "personal", "learning") or the natural home of the task
   ("it feeds into the board presentation deliverables" → `work/...`).
3. Match the **first segment** of the path to an existing project — case-insensitive on
   `title` or `branch_path`. If found, attach to that project's `id`.
4. If no project matches:
   - **Main Branch** → create the project with `branch_path` = the root segment.
   - **Sub Branch** → auto-create a parent project for the root segment, then the task
     under it (per "Match + auto-create").
5. Deeper segments are **virtual** — store the full multi-level path on the task
   (`work/2026/Q3 report`); only the first segment must be a real project.
6. Write `branch_path`: root segment on the project, full path on the task.

## Running the evals

This skill is verified by an eval suite that **runs together with every execution**.
The suite lives in the appendix below ("Appendix: Eval suite") so it can grow without
distracting from the extraction logic.

1. Run the fixture suite in the appendix against this skill's extraction rules
   (assume today is 2026-08-05). This is **extraction only — never write to the API or
   database** during the eval run.
2. If any fixture FAILs: **do not push anything.** Report the failing fixture (input, expected
   assert, actual output) and stop.
3. If the whole suite passes, continue to the push step below.
4. Contract rule: if a change to this skill intentionally alters behavior, update the affected
   fixture's `assert` in the appendix at the same time so the suite stays green.

## Pushing to the database

Push via the API (base `http://127.0.0.1:8000`, Tailscale `100.74.182.63:8000`).
Never edit `data/life.db` directly — always use the API or `bin/post.sh`.
**The extraction output is an array — iterate it and push each task.**

1. Health check: `curl -s http://127.0.0.1:8000/api/health`
2. For each task in the array:
   - **Main Branch → upsert a Project:**
     - Search first: `GET /api/projects?q=<name>`
     - If it exists, update with `PUT /api/projects/{id}`; otherwise create with
       `POST /api/projects` (prefer updating over duplicating).
     ```bash
     bin/post.sh project '{"title":"Work","status":"active","priority":"high","branch_path":"work","begin_date":"2026-08-06","duration":8.0}'
     ```
   - **Sub Branch → create a Task under the resolved parent project:**
     ```bash
     bin/post.sh task <project_id> '{"title":"Q3 Report","status":"planned","priority":"high","due_date":"2026-08-08","begin_date":"2026-08-06","duration":8.0,"branch_path":"work/2026/Q3 report"}'
     ```
3. Drop any field that is `"N/A"`, `confidence`, or `flags` before sending.
4. Verify the `201` response and that `begin_date`, `duration`, and `branch_path` are echoed back.
5. Keep descriptions under ~200 characters.

---

## Appendix: Eval suite

Verifies this skill's behavior on normal and pathological inputs. Complements the
deterministic API evals in `bin/run_api_evals.py` (that script covers the server-side guards;
this appendix covers the extraction layer). Runs together with every task-master execution and
standalone on request ("run the evals"). Either way: **extraction only, never writes to the
database.**

### How to run

1. Read the fixture table below.
2. **Spawn a subagent** to run the suite. Give it:
   - The skill under test: `/home/ubuntu/Personal Projects/life-at-a-glance/skills/task-master.md`
   - Instruction: for each `input` below, execute the skill's extraction rules against it
     (assume today is 2026-08-05), then check the `assert` expectations. Do **not** push to
     the database. Return a per-case `PASS`/`FAIL` table with the actual output for any FAIL,
     plus an overall tally.
3. Report the subagent's table back to the user.

### Fixtures

| # | Input | Assert |
|---|---|---|
| 1 | "I need to finish the Q3 report by Friday. It's pretty urgent so I should start tomorrow. Probably takes a day to do, and it feeds into the board presentation deliverables." | Array of 1; taskName "Q3 Report"; importance High; beginDate 2026-08-06; deadline 2026-08-08; branch Main Branch; confidence High |
| 2 | "Review Sarah's PR — quick code review, ~30 mins, part of the database refactoring." | Array of 1; importance Medium; duration "30 minutes"; branch Sub-Branch |
| 3 | "Book the flight tomorrow, and then also prepare the presentation deck by Friday, and clean the inbox." | Array of **3**; items: "Book the flight" (beginDate 2026-08-06), "Prepare presentation deck" (deadline 2026-08-08, Sub-Branch), "Clean the inbox" (Low) |
| 4 | "1) Write the proposal 2) send it to the client 3) follow up next week." | Array of **3**; last item has deadline = next week's date |
| 5 | "asdf qwerty 12345 🚀 blorp blorp" | Returns `{"noTask": true, ...}` — must NOT fabricate a task |
| 6 | "I like pizza. It's Tuesday. The sky is blue." | Returns `{"noTask": true, ...}` |
| 7 | "URGENT must finish today!! Actually no, no rush at all, low priority, whenever. But it's also a critical blocker." | Importance flagged; confidence **Low**; flags include `conflicting-importance` |
| 8 | "Assemble the death star by yesterday. It's been running 0.0003 microseconds, needs half a jiffy and 2 fortnights of work." | deadline 2026-08-04; duration "2 fortnights" (convertible → 672h at push time: 2 × 336h); flags include `unparsed-units` if any unit stays unparsed |
| 9 | "Water the plant daily for 999999 days starting year 9999, deadline 0000-00-00." | duration capped to 8760h (or flagged); beginDate N/A + `suspicious-date` flag; deadline N/A |
| 10 | "il faut terminer le rapport Q3 avant vendredi" | Array of 1; taskName recognized ("Rapport Q3"); deadline 2026-08-08; importance Medium |
| 11 | "this is work, personal, learning, finance and kitchen-sink related all at once" | Single task; branch ambiguity flagged (`ambiguous-branch`); pick a root but flag it |
| 12 | "Do A, and B, and also C, then maybe D." | Array of **3** definite tasks (D is "maybe" — exclude or flag as optional) |

### Eval notes

- The extraction layer must always return the JSON-array shape (or the `noTask` object).
- Running the evals must not write anything to the database.
- If a change to this skill is intentional and a case "fails", update the fixture's `assert`
  to match the new contract — do not silently change behavior.

### Adding new evals

This appendix is a growing registry. To add a case:

1. Append a row to the fixtures table with the next number.
2. `input` — the exact message to run through the skill.
3. `assert` — the observable expectation (task count, a specific field value, a flag, or the
   `noTask` shape). Prefer assertions that stay true if unrelated details change.
4. Keep inputs varied: one normal case, one multi-task, one guard case (`noTask`), one
   contradictory case, one units/dates sanity case.
5. Run the suite (bundled or standalone) to confirm the new row passes before committing it.

Each row stays small and independent, so the suite can grow to hundreds of cases without
the extraction logic itself getting longer.