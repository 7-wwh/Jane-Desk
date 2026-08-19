---
name: task-master
description: Capture tasks, projects, and goals from natural language and persist them in the Life-at-a-Glance dashboard by FILLING IN a printed form. Each box shows the exact JSON key and allowed values, so the agent's job is to fill boxes from the message (blanks stay blank — never invented), show the filled form to the user, get explicit approval, then log. Also handles updates ("I finished X", "push the deadline", "set progress to 50%"). Triggers: task capture, planning messages, goal setting, and update/completion requests.
---

# Task Master — Fill the Form, Confirm, Log

A skill for turning natural-language messages about tasks, projects, and goals into
database records. **The format is the mechanism**: every operation has a fill-in form
printed below. The agent fills the boxes from the message and shows the filled form to the
user for approval. Nothing is invented and nothing is written without explicit human
approval.

## The workflow

1. **Classify** the message (create task / create project / create goal / update / no-op).
2. **Fill the form(s)** — copy what the message says into the boxes. Blank boxes stay blank.
3. **Match** existing records (updates, duplicate prevention).
4. **Preview** — show the filled form(s) to the user as the confirmation.
5. **Self-check** — box-by-box against the printed form (keys, dropdown values, dates).
6. **Confirm** — get explicit approval. Silence, "sure", or inferred consent is NOT approval.
   If the user edits a box, re-fill and re-confirm.
7. **Log** via the API. Verify the response echoes the fields. Never touch `data/life.db` directly.

Steps 1–5 never write anything.

---

## Classify the message

- **Create task/project**: work to do — "add a task…", "I need to finish X by…", "plan…",
  a numbered list of things to do.
- **Create goal**: a long-term aspiration with an area, progress, or target date — "my goal
  is…", "I want to be able to…".
- **Update**: existing work — `done`/`finished`/`completed`/`closed`, `start`/`begin working`,
  `postpone`/`push`/`delay`/`move`/`reschedule` + new date, "make X high priority", "goal at
  N% now".
- **No-op**: noise, statements, greetings, emoji-only, idle chat → return
  `{ "noTask": true, "reason": "…" }`. Never fabricate an intent.

A message can mix intents; fill one form per entity/operation and confirm them together.

---

## The forms

### TASK — create under a project

```
TASK  POST /api/projects/{matched_to_id}/tasks
  title       [                              ]  (required — non-empty, never invented)
  status      [ planned ]   ← wanted | planned | in_progress | done
  priority    [ medium ]   ← high | medium | low
  begin_date  [            ]  (YYYY-MM-DD or blank)
  due_date    [            ]  (YYYY-MM-DD or blank)
  duration    [            ]  (float HOURS: 0.5, 24.0, 168.0 … or blank)
  branch_path [            ]  (full path, e.g. work/2026/Q3 report)
  matched_to  [ project #__ "________" ]
```

### PROJECT — create (a Main-Branch deliverable)

```
PROJECT  POST /api/projects
  title       [                              ]  (required — non-empty, never invented)
  description [                              ]  (optional, ≤200 chars)
  status      [ active ]    ← active | backlog | done | paused
  priority    [ medium ]   ← high | medium | low
  target_date [            ]  (YYYY-MM-DD or blank)
  begin_date  [            ]  (YYYY-MM-DD or blank)
  duration    [            ]  (float HOURS or blank)
  branch_path [            ]  (ROOT segment, e.g. work)
  tags        [            ]  (comma-separated)
```

### GOAL — create

```
GOAL  POST /api/goals
  area        [ other ]   ← career | health | family | learning | finance | other
  title       [                              ]  (required — non-empty, never invented)
  description [                              ]  (optional)
  progress    [ 0     ]   (number 0–100, or blank if not stated)
  target_date [            ]  (YYYY-MM-DD or blank)
  status      [ active ]  ← active | completed | paused
```

### MARK DONE — complete an existing record

```
MARK DONE
  kind       [ task ]   ← task | project | goal
  title      [ "________________" ]   (from the matched record)
  matched_to [ #__ ]
  → task:    PATCH /api/tasks/{id}/status?status=done
  → project: PUT /api/projects/{id}  {"title":"…","status":"done"}
  → goal:    PUT /api/goals/{id}     {"title":"…","status":"completed","progress":100}
```

### CHANGE — edit fields on an existing record (partial PUT)

```
CHANGE
  kind       [ task ]   ← task | project | goal
  title      [ "________________" ]   (from the matched record — always carried)
  matched_to [ #__ ]
  changed fields: only the boxes that actually change
    e.g. due_date [ 2026-08-14 ], priority [ high ], status [ in_progress ]
  → PUT /api/tasks/{id} | PUT /api/projects/{id} | PUT /api/goals/{id}
```

**No-change detection:** if a proposed field value already equals the matched record's stored
value, mark that box `(no change)`. If ALL boxes are `(no change)`, say so and ask whether to
proceed with the (no-op) write or skip it — never silently write a no-op, never skip silently
either. Always show it and confirm.

### GOAL PROG — update a goal's progress

```
GOAL PROG  PUT /api/goals/{id}
  title      [ "________________" ]   (from the matched record)
  matched_to [ #__ ]
  progress   [ __ ]   (0–100)
```

---

## How to fill the boxes

### Priority
- **high**: "urgent", "asap", "critical", "blocker", "priority", deadline today/tomorrow.
- **medium**: regular task, deadline within a week, standard work. Default when nothing stated.
- **low**: optional, nice-to-have, no time pressure. Be conservative with high.
- **Conflicting signals** ("URGENT!! … actually no rush") → leave the priority **blank** and
  ask the user; add a `conflicting-importance` note. Do not guess which signal wins.
- Never invent a priority the user did not state.

### Dates (resolve against today; 2026-08-05 in the eval fixtures)
- "tomorrow" → +1 day; "today" → today; "Friday" → the next upcoming Friday
  (from Wed 2026-08-05 → **2026-08-07**); "next Friday" → the Friday of the following week
  (**2026-08-14**); "next week" → **+7 days** (2026-08-12); "end of the month" → last day of
  the stated month, or **the current month if no month is stated** (December → **2026-12-31**);
  "in N days/weeks" → +N days/+7N days.
- "now", "asap", "immediately" are NOT dates — leave begin_date/due_date blank.
- Anything unclear or unstated → **blank**. A year outside 2000–2100, or unparseable
  ("0000-00-00", "year 9999") → blank + a `suspicious-date` note.

### Duration (always hours, float, cap 8760)
| Human estimate | Box value |
|---|---|
| 30 minutes / 1 hour | `0.5` / `1.0` |
| 2 / 6 hours | `2.0` / `6.0` |
| 1 / 2 days | `24.0` / `48.0` |
| 1 / 2 weeks | `168.0` / `336.0` |
| 1 fortnight | `336.0` (2 weeks) |
| months / unspecified | **blank** |
| unknown unit | blank + `unparsed-units` note |
| negative / > 8760 | reject / cap 8760 + note |

Never convert a unit not in this table. Never estimate a duration the user didn't give.

### Branch
- **TASK (Sub-Branch)**: a concrete, bounded piece of work described as an action — "do",
  "finish", "prepare", "review", "draft", "book", "clean", "send", "follow up", "write X by
  date" — and anything that **"feeds into" / feeds other work**. This is the default for
  routine work items.
- **PROJECT (Main Branch)**: a top-level deliverable or initiative framed as a project —
  "launch the site", "build X", "start a Y initiative", an independent body of work that is
  not one bounded action.
- Uncertain between the two → **TASK** (a task is the safer default; projects can be created
  from tasks later).
- Multiple roots ("work, personal, learning all at once") → pick a root but add an
  `ambiguous-branch` note and flag it in the preview.

### Multi-task splitting
Split numbered/bulleted lists ("1)… 2)…", "- … - …") and coordinating action conjunctions
("and then", "also", "then also", "Do X, do Y"). Each item gets its own form. A date or
priority given once for the whole message applies to all items unless an item overrides it.

### Goals
- A goal is an aspiration, not a task. It lives in `/api/goals` with an `area`.
- `progress` only if stated (0–100). `target_date` only if stated (end-of-month → last day).
- Do not also create a project or task for the same sentence.

### The no-name rule
If a required `title` box cannot be filled from the message (no usable name), do NOT invent
one ("Finish task" is fabrication). **Ask the user for the name** and leave the box blank in
the preview. Never send an empty or whitespace title.

### Titles
Take the title verbatim from the message, trimmed; capitalize meaningfully (a title's first
word and proper nouns). Non-English titles are fine ("il faut terminer le rapport Q3" →
"Rapport Q3") — translate only the object of the action, keep the wording recognizable.

### Never invent
- No date, duration, priority, progress, area, or title that the user did not say.
- Missing info → blank box. Contradictory info (e.g. conflicting priority) → blank that box
  and ask, with a note/flag in the preview. What is safely stated → fill it; what is not → ask.

---

## Match existing records (dedup + update targets)

For updates, and before creating anything that may already exist:

1. `GET /api/tasks?q=<title>` and `GET /api/projects?q=<title>` (goals have no `q` —
   fetch `/api/goals` and filter locally).
2. Prefer **case-insensitive `title` matches** over `branch_path` matches.
3. **Unique confident match** (titles contain each other / near identical) → fill `matched_to`
   with that id and use the UPDATE form.
4. **Ambiguous** (2+ plausible) → fill `matched_to` with `?` and list the candidates in the
   preview — never guess-write.
5. **No match on a CREATE intent** → it's a new record (CREATE form).
6. **No match on an UPDATE intent** (mark-done / reschedule / progress) → **do NOT create,
   do NOT guess-update a nearby record.** Fill `matched_to` with `— none`, and ask the user:
   create it and then apply the change, match a different record, or drop it. Nothing is
   written until they answer.
7. **No parent stated** (a task with no project in the message, and none matches) → fill
   `matched_to` with `?` and ask which project it lives under (or whether to create a parent)
   before logging.
8. **Conservative default**: when a dedup/update match is in doubt, treat creates as "new
   record" and updates as "ask" — never auto-merge records that merely look similar.
9. Flag `DUMMY-SEED-*` parents in the preview so a seed project is never silently chosen as
   the parent.
10. `branch_path` first segment must match an existing project by title (or branch_path); if
   none, create a parent project for the root segment (TASK) or the project itself
   (PROJECT). Deeper segments are virtual: store the full path on the task.

---

## Self-check before logging (box-by-box)

Compare the filled form to the printed form above. Each box must match its rule:

- Only the documented keys exist (`title, status, priority, begin_date, due_date, duration,
  branch_path, matched_to` for tasks; project/goal keys likewise).
- `status`, `priority`, `area`, `progress`, `status` values are exactly from the dropdowns.
- Dates are `YYYY-MM-DD` or blank. Durations are float hours or blank.
- No `taskName`, `taskDescription`, `confidence`, `flags`, or the string `"N/A"` anywhere.
- `title` is always present and non-empty — including on updates.
- `matched_to` is resolved (an id) for updates; `?` for ambiguous.

If any box fails its rule, fix the form and re-run the self-check before previewing.

---

## Log to the database (only after approval)

Base `http://127.0.0.1:8000` (Tailscale `100.74.182.63:8000`). Never edit `data/life.db`
directly — API or `bin/post.sh` only.

1. `curl -s http://127.0.0.1:8000/api/health` — must be healthy.
2. Push each approved, self-checked form:
   - TASK create: `bin/post.sh task <project_id> '<json>'`
   - PROJECT create: `bin/post.sh project '<json>'` ; update: `bin/post.sh update project <id> '<json>'`
   - GOAL create: `bin/post.sh goal '<json>'` ; update: `bin/post.sh update goal <id> '<json>'`
   - TASK update: `bin/post.sh update task <id> '<json>'`
   - MARK DONE (task): `curl -s -X PATCH "$BASE/api/tasks/$id/status?status=done"`
   - START task: `curl -s -X POST "$BASE/api/tasks/$id/start"`
3. The JSON is the filled form's boxes with the printed key names (drop `matched_to`,
   notes, flags, and blank boxes).
4. Verify the response: `201` create / `200` update, and that dates, duration, and
   branch_path are echoed back unchanged.
5. Report to the user exactly what was logged.

---

## Appendix: Eval suite (agent-run)

Evals are **checked by an agent, not a script**. A spawned subagent applies this skill to
each fixture, verifies the expectations by inspecting the filled forms, and returns a
PASS/FAIL table. Running the evals never writes to the database.

### How to run
1. **Spawn a subagent** and give it:
   - The skill under test: `/home/ubuntu/Personal Projects/Jane-Desk/skills/task-master.md`
   - Instruction: for each fixture below, apply the skill to the `input` (assume today is
     2026-08-05), produce the filled form(s) or the update plan, and verify the `assert` by
     inspecting the form box-by-box. Do not call any write API. Return a per-fixture
     `PASS`/`FAIL` table with the actual filled form for any FAIL, plus an overall tally.
2. **Layer C note:** C1–C7/C9–C11 are prescribed mini-stories — the matched record is part of
   the scenario (ids are illustrative, resolved at runtime by search). They evaluate the
   skill's mandated *behavior* (preview, confirmation, ambiguity handling), not live data.
3. If any fixture FAILs: **do not log anything.** Report the failure and stop.
4. If the suite passes, proceed with the normal workflow (fill → preview → confirm → log).

### Layer A — extraction correctness (form contents, no invention)

| # | Input | Assert |
|---|---|---|
| A1 | "I need to finish the Q3 report by Friday. It's urgent so I should start tomorrow. Probably takes a day to do, and it feeds into the board presentation deliverables." | 1 TASK form; title "Q3 Report"; priority high; begin_date 2026-08-06; due_date **2026-08-07** (Friday); duration 24.0; TASK ("feeds into other work"); status planned |
| A2 | "Review Sarah's PR — quick code review, ~30 mins, part of the database refactoring." | 1 TASK form; priority medium; duration 0.5; TASK |
| A3 | "Book the flight tomorrow, and then also prepare the presentation deck by Friday, and clean the inbox." | **3** TASK forms: "Book the flight" (begin 2026-08-06), "Prepare presentation deck" (due 2026-08-07, TASK), "Clean the inbox" (**medium** — no priority stated, default) |
| A4 | "Write the Q3 report. No rush at all, whenever." | begin_date **blank**, due_date **blank** — must NOT invent a date from "no rush" |
| A5 | "My goal is to run a half marathon by December, currently at 20%. It's a health goal." | 1 GOAL form; area health; title "Run a half marathon"; progress 20; target_date 2026-12-31; no task/project invented |
| A6 | "Water the plant daily for 999999 days starting year 9999, deadline 0000-00-00." | duration blank or 8760.0 with a note; begin_date and due_date **blank** + suspicious-date note |
| A7 | "asdf qwerty 12345 🚀 blorp blorp" / "I like pizza. It's Tuesday." | Returns `{noTask:true}` — nothing fabricated, no form produced |
| A8 | "URGENT must finish today!! Actually no, no rush at all, low priority, whenever. But it's also a critical blocker." | conflict noted (`conflicting-importance` — a preview note, never a payload key); **no name present → the agent asks for a name**; no fabricated title |
| A9 | "Assemble the death star by yesterday. It's been running 0.0003 microseconds, needs half a jiffy and 2 fortnights of work." | due_date 2026-08-04; duration 672.0 (2 × 336h); unknown units noted `unparsed-units`, never guessed |
| A10 | "1) Write the proposal 2) send it to the client 3) follow up next week." | **3** TASK forms; last item due_date **2026-08-12** (next week = +7 days) |
| A11 | "il faut terminer le rapport Q3 avant vendredi" | 1 TASK form; title recognized ("Rapport Q3"); due_date 2026-08-07; priority medium |
| A12 | "this is work, personal, learning, finance and kitchen-sink related all at once" | No usable task name → `ambiguous-branch` noted **and** the agent asks for a name (no-name rule); nothing fabricated — no payload produced |
| A13 | "follow up next week" | due_date **2026-08-12** (pinned rule) |
| A14 | "Handle this now, highest priority, the Q3 analysis write-up." | 1 TASK form; title "Q3 analysis write-up"; priority high; begin_date and due_date **blank** (no dates stated) |

### Layer B — database-format conformance (box-by-box on the filled form)

| # | Filled form | Assert |
|---|---|---|
| B1 | A1's TASK form | Keys are exactly `title, status, priority, begin_date, due_date, duration, branch_path, matched_to`; priority lowercase `high`; status ∈ wanted/planned/in_progress/done; duration float 24.0; NO `taskName`/`confidence`/`flags`/`N/A` |
| B2 | A1's `branch_path` | Full path form, e.g. `work/2026/Q3 report`; first segment matches an existing project by title (or is planned for creation) |
| B3 | A5's GOAL form | Keys exactly `area, title, description, progress, target_date, status`; area `health`; progress numeric 20; status `active` |
| B4 | Create-vs-update | A project whose `GET /api/projects?q=<name>` returns an exact title match → the plan is UPDATE (PUT /api/projects/{id}), not a duplicate POST |
| B5 | A8's no-name result | No payload is produced with an empty/whitespace/`"Finish task"` title; the form shows `title [ blank — ask user ]` |
| B6 | CHANGE form (push "Monthly gym review" due to 2026-08-31) | Payload carries `title` AND the changed field: `{"title":"Monthly gym review","due_date":"2026-08-31"}` — box-by-box check passes |
| B7 | Any filled form | Leaked keys (`taskName`, `taskDescription`, `importance`, `branch`, `deadline`, `beginDate`, `confidence`, `flags`, `N/A`) must never appear — FAIL if present |

### Layer C — confirmation gate & updates (mini-stories)

| # | Scenario | Assert |
|---|---|---|
| C1 | "I finished the Q3 report." → the matched record is `Task #N "Q3 Report"` (id N resolved by search), user replies "yes go ahead" | Proceeds to `PATCH /api/tasks/N/status?status=done`; the preview showed exactly that change first. N is whatever id the search returns — never a hardcoded id |
| C2 | Same message, user replies "wait, hold on" | **No write.** Agent stops at the preview |
| C3 | Same message, no reply at all | Treated as NOT approved — no write on silence |
| C4 | "Push the Q3 report deadline to next Friday" | CHANGE form: `due_date` 2026-08-14, payload includes title; diff shown; confirmation required |
| C5 | "Mark the report done" where "Q3 Report" and "Q3 Analysis" both match | `matched_to [?]`; both candidates listed; agent asks — never guess-writes |
| C6 | "Set the run-a-half-marathon goal progress to 50%" | GOAL PROG form: `{"title":"Run a half marathon","progress":50}`; confirmation required |
| C7 | "Add a task to draft slides, and mark the inbox task done." | Preview contains BOTH a TASK create and a MARK DONE; one confirmation covers both; nothing written before approval |
| C8 | "I finished the Q3 report." where **no** task/project named "Q3 report" exists in the DB | `matched_to [— none]`; the agent does NOT create it and does NOT guess-update a nearby record; it asks: create-then-apply, match a different record, or drop. Nothing written until the user answers |
| C9 | Postpone a task whose `due_date` already equals the target | Agent marks "(no change)" on the box and still requires confirmation before a (possibly no-op) write |
| C10 | TASK whose root "work" matches both a real project and `DUMMY-SEED-ALPHA` | Agent prefers the case-insensitive `title` match over branch_path and flags the DUMMY-SEED candidate in the preview |
| C11 | Every update form | The agent runs the box-by-box self-check (Layer B rules) before previewing; failures halt the flow |

### Eval notes
- Extractions always yield the printed form shape (or the `noTask` object). Updates always
  include a matched `title` + id and a single endpoint.
- Evals are extraction-only. Running them must not write anything.
- If a deliberate skill change alters behavior, update the affected fixture's `assert` at the
  same time so the suite stays green.

### Adding new evals
1. Append a row with the next number in the right layer (A extraction, B format, C gate).
2. Keep inputs varied: normal, multi-entity, no-op guard, contradictory, weird units/dates,
  an update story, an ambiguity story.
3. Run the suite via a spawned subagent to confirm the new row passes before committing.