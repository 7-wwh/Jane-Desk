---
name: agent-initialization
description: One-time setup/installer for the Jane-Desk (Life-at-a-Glance) project on a machine running Hermes Agent. Installs the project skills into ~/.hermes/skills/jane-desk/ and registers a gateway event hook that injects the available skill/tool catalog into every new conversation so the agent never forgets or hallucinates its tools. Triggers - "initialize this project", "set up this project for hermes", "install the hooks", "run agent initialization", first run on a fresh machine.
---

# Agent Initialization — Hermes Setup

**You are the installing agent.** Execute every step below, in order, **on this
machine** — the machine where this repository was downloaded and where Hermes runs.
Do not skip verification. All steps are idempotent (safe to re-run). Never modify
anything under `~/.hermes` except what these steps explicitly tell you to create.

## What this installs

1. Project skills → `~/.hermes/skills/jane-desk/<skill-name>/SKILL.md`
   (Hermes' native skill index picks them up automatically).
2. One gateway event hook (`session:start` + `session:reset`) that refreshes the
   skill/tool catalog inside `~/.hermes/SOUL.md`, which Hermes loads into the system
   prompt of **every new conversation** — so the agent always knows which tools are
   available and uses them instead of hallucinating.

No Python packages, no config edits, no plugins. Dependencies: `bash`, `python3`.

## Step 1 — Detect Hermes

```bash
[[ -d "$HOME/.hermes" ]] && command -v hermes >/dev/null && echo OK
```

If this fails, Hermes Agent is not installed on this machine. Stop and report that
this project currently ships Hermes integration only; nothing was modified.

## Step 2 — Resolve the repository root

Set `REPO_ROOT` to the absolute path of this repository (the folder containing
`skills/agent-initialization.md`). For example:

```bash
REPO_ROOT="/home/YOURUSER/Jane-Desk"   # adjust to the actual clone location
[[ -f "$REPO_ROOT/skills/agent-initialization.md" ]] && echo OK
```

## Step 3 — Install the skills

Hermes requires each skill as `<folder>/SKILL.md`. Convert and copy:

```bash
mkdir -p "$HOME/.hermes/skills/jane-desk/main-skill" \
         "$HOME/.hermes/skills/jane-desk/task-master"
cp "$REPO_ROOT/skills/main-skill.md"  "$HOME/.hermes/skills/jane-desk/main-skill/SKILL.md"
cp "$REPO_ROOT/skills/task-master.md" "$HOME/.hermes/skills/jane-desk/task-master/SKILL.md"
```

Future skills added to the bundle get copied the same way (one folder per skill).
Do NOT copy `agent-initialization.md` itself.

## Step 4 — Install the gateway hook

Copy the bundled hook directory into Hermes' hooks folder:

```bash
mkdir -p "$HOME/.hermes/hooks"
rm -rf "$HOME/.hermes/hooks/jane-desk-tool-loader"
cp -r "$REPO_ROOT/skills/hermes/jane-desk-tool-loader" "$HOME/.hermes/hooks/"
ls "$HOME/.hermes/hooks/jane-desk-tool-loader/"   # expect: HOOK.yaml  handler.py
```

What the hook does: on `session:start` and `session:reset` (i.e. every new
conversation) its `handler.py` scans `$HOME/.hermes/skills/jane-desk/*/SKILL.md`
frontmatter and rewrites **only the block between** `<!-- jane-desk:tools:start -->`
and `<!-- jane-desk:tools:end -->` markers inside `$HOME/.hermes/SOUL.md`.
Everything else in SOUL.md is preserved. New skills dropped into the jane-desk
skills folder are advertised automatically — the handler never needs editing.

## Step 5 — Restart the gateway

Gateway hooks are discovered at startup:

```bash
hermes gateway restart
```

## Step 6 — Verify

1. Hook loads:

   ```bash
   hermes logs --follow --level INFO | grep jane-desk-tool-loader
   ```

   Then start a new conversation from any connected messaging platform (or send
   `/new`). Expect a line like
   `jane-desk-tool-loader: refreshed tool catalog in SOUL.md (2 skills, ...)`.

2. Catalog landed in context:

   ```bash
   grep -A5 "jane-desk:tools:start" "$HOME/.hermes/SOUL.md"
   ```

   Expect `main-skill` and `task-master` with their descriptions.

3. Native skill index also picked them up:

   ```bash
   hermes skills list | grep -E "main-skill|task-master"
   ```

4. End-to-end: ask the agent *"what tools do you have?"* in a fresh conversation —
   it must name the Life-at-a-Glance skills without being told.

Report success to the user once all four checks pass.

## Caveats

- Gateway hooks fire on messaging-platform sessions (Telegram, Discord, Slack, …),
  not bare CLI runs; the native skill index still covers CLI sessions.
- The hook writes only between its marker comments in SOUL.md — never touch other
  content there, or the next refresh will not preserve your edits.

## Uninstall

```bash
hermes gateway stop
rm -rf "$HOME/.hermes/hooks/jane-desk-tool-loader"
rm -rf "$HOME/.hermes/skills/jane-desk"
# remove the block between the jane-desk:tools markers from ~/.hermes/SOUL.md
hermes gateway start
```
