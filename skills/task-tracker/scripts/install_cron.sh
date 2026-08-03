#!/usr/bin/env bash
# install_cron.sh — Install task-tracker cron jobs
#
# Installs TWO jobs:
#   08:00 Mon-Fri  → daily_brief.py --log   (morning brief + log)
#   08:01 Mon-Fri  → write_vault_index.py   (refresh Obsidian .md files)
#
# Usage:
#   bash /home/ubuntu/Documents/ObsidianVault/task-tracking-visualize/scripts/install_cron.sh

VAULT="/home/ubuntu/Documents/ObsidianVault/task-tracking-visualize"
SCRIPTS="$VAULT/scripts"
LOG="$VAULT/daily-brief.log"
MARKER="# task-tracker"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  task-tracker  ·  cron installer     ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Checks ──────────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "✖  ERROR: python3 not found. Install Python 3 first."
    exit 1
fi

if [ ! -f "$SCRIPTS/daily_brief.py" ]; then
    echo "✖  ERROR: $SCRIPTS/daily_brief.py not found."
    echo "   Make sure you've copied the scripts folder to the vault."
    exit 1
fi

# ── Ensure scripts are executable ───────────────────────────────────────────
chmod +x "$SCRIPTS/daily_brief.py"
chmod +x "$SCRIPTS/write_vault_index.py"
echo "✔  Scripts marked executable"

# ── Build cron lines ────────────────────────────────────────────────────────
BRIEF_LINE="0 8 * * 1-5 /usr/bin/python3 $SCRIPTS/daily_brief.py --log >> $LOG 2>&1 $MARKER-brief"
INDEX_LINE="1 8 * * 1-5 /usr/bin/python3 $SCRIPTS/write_vault_index.py >> $LOG 2>&1 $MARKER-index"

# ── Remove old entries, add new ones ────────────────────────────────────────
(
  crontab -l 2>/dev/null | grep -v "$MARKER"
  echo "$BRIEF_LINE"
  echo "$INDEX_LINE"
) | crontab -

echo "✔  Cron jobs installed"
echo ""
echo "  08:00 Mon–Fri  →  daily_brief.py    (morning brief)"
echo "  08:01 Mon–Fri  →  write_vault_index.py  (Obsidian index refresh)"
echo ""
echo "Log file:  $LOG"
echo ""
echo "Verify with:  crontab -l | grep task-tracker"
echo "Run now:      python3 $SCRIPTS/daily_brief.py"
echo "Sync vault:   python3 $SCRIPTS/write_vault_index.py"
echo ""
