---
name: agent-initialization
description: One-time installer for the native Jane-Desk skills on Codex or Hermes. Installs the source-controlled skill directories and, for Hermes, its conversation-start catalog hook. Triggers - "initialize this project", "set up this project", "install the hooks", "run agent initialization", first run on a fresh machine.
---

# Agent Initialization — Codex and Hermes Setup

The source of truth is this repository's `skills/jane-desk-*/SKILL.md` directories.
Install from the repository rather than copying the legacy standalone `.md` files.
The installer is idempotent. It replaces only the Jane-Desk skill folders and its named
Hermes hook.

## What this installs

1. Codex skills → `${CODEX_HOME:-~/.codex}/skills/jane-desk-*/SKILL.md`, or Hermes
   skills → `~/.hermes/skills/jane-desk/jane-desk-*/SKILL.md`.
2. One gateway event hook (`session:start` + `session:reset`) that refreshes the
   skill/tool catalog inside `~/.hermes/SOUL.md`, which Hermes loads into the system
   prompt of **every new conversation** — so the agent always knows which tools are
   available and uses them instead of hallucinating.

No Python packages, no config edits, no plugins. Dependencies: `bash`, `python3`.

## Install

From the repository root:

```bash
skills/install.sh codex     # default; install for Codex
skills/install.sh hermes    # install native skills plus the Hermes catalog hook
skills/install.sh all       # install both
```

The Codex destination honors `CODEX_HOME`; Hermes honors `HERMES_HOME`. The installer
does not touch database data or application code.

## Hermes hook

The Hermes installation includes the bundled hook. On `session:start` and `session:reset` (i.e. every new
conversation) its `handler.py` scans `$HOME/.hermes/skills/jane-desk/*/SKILL.md`
frontmatter and rewrites **only the block between** `<!-- jane-desk:tools:start -->`
and `<!-- jane-desk:tools:end -->` markers inside `$HOME/.hermes/SOUL.md`.
Everything else in SOUL.md is preserved. New skills dropped into the jane-desk
skills folder are advertised automatically — the handler never needs editing.

## Restart Hermes

Gateway hooks are discovered at startup:

```bash
hermes gateway restart
```

## Verify

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

   Expect `jane-desk-main`, `jane-desk-task-master`, and `jane-desk-data` with their descriptions.

3. Native skill index also picked them up:

   ```bash
   hermes skills list | grep -E "jane-desk-main|jane-desk-task-master|jane-desk-data"
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
