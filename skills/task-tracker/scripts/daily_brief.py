#!/usr/bin/env python3
"""
daily_brief.py — Clean, scannable daily brief from the task vault.

Outputs a terminal-friendly brief and (with --log) appends to daily-brief.log.
Designed for morning cron: read it in 30 seconds, know exactly what to do.

Usage:
  python3 daily_brief.py          # print to stdout
  python3 daily_brief.py --log    # print + append to daily-brief.log
"""

import json
import os
import sys
import argparse
from datetime import datetime, timedelta

VAULT = "/home/ubuntu/Documents/ObsidianVault/task-tracking-visualize"
ACTIVE_FILE  = os.path.join(VAULT, "active-tasks.json")
TASKS_FILE   = os.path.join(VAULT, "tasks.json")
KNOWLEDGE_FILE = os.path.join(VAULT, "knowledge.json")
LOG_FILE     = os.path.join(VAULT, "daily-brief.log")

PRIORITY_ICON = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}
STATUS_ICON   = {"active": "▶", "pending": "○", "blocked": "✖", "done": "✔", "cancelled": "—"}

DAY_NAMES   = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
MONTH_NAMES = ["January","February","March","April","May","June",
               "July","August","September","October","November","December"]


# ─── helpers ────────────────────────────────────────────────────────────────

def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def fmt_date(dt):
    return f"{DAY_NAMES[dt.weekday()]}, {dt.day} {MONTH_NAMES[dt.month-1]} {dt.year}"

def days_label(d):
    if d is None: return "no deadline"
    if d < 0:  return f"{abs(d)}d OVERDUE"
    if d == 0: return "due TODAY"
    if d == 1: return "due tomorrow"
    return f"due in {d}d"

def bar(n, total, width=12):
    """Tiny ASCII progress bar."""
    if total == 0: return "▒" * width
    filled = round(n / total * width)
    return "█" * filled + "▒" * (width - filled)


# ─── sections ───────────────────────────────────────────────────────────────

def section_header(title):
    return f"\n{'─'*48}\n  {title}\n{'─'*48}"

def build_brief(now):
    lines = []
    W = 52

    # ── Title bar ──
    date_str = fmt_date(now)
    lines.append("╔" + "═"*(W-2) + "╗")
    lines.append(f"║  📅  DAILY BRIEF — {date_str:<28}║")
    lines.append("╚" + "═"*(W-2) + "╝")

    active_data   = load_json(ACTIVE_FILE)
    tasks_data    = load_json(TASKS_FILE)
    knowledge_data = load_json(KNOWLEDGE_FILE)

    if not active_data or not active_data.get("tasks"):
        lines.append("\n  No active tasks. Run the task tracker to add some!\n")
        return "\n".join(lines)

    tasks = active_data["tasks"]
    porder = {"critical": 0, "high": 1, "medium": 2, "low": 3}

    overdue      = [t for t in tasks if t.get("days_until_deadline") is not None and t["days_until_deadline"] < 0]
    due_week     = [t for t in tasks if t.get("days_until_deadline") is not None and 0 <= t["days_until_deadline"] <= 7]
    active_tasks = [t for t in tasks if t["status"] in ("active", "pending")]
    top5 = sorted(active_tasks, key=lambda t: (
        porder.get(t["priority"], 9),
        t["days_until_deadline"] if t["days_until_deadline"] is not None else 9999
    ))[:5]

    # ── 🔥 Overdue ──
    lines.append(section_header("🔥  OVERDUE"))
    if overdue:
        for t in overdue:
            icon = PRIORITY_ICON.get(t["priority"], "·")
            lines.append(f"  {icon}  {t['title']}")
            lines.append(f"      └─ {t['project_name']} · {abs(t['days_until_deadline'])} days overdue")
    else:
        lines.append("  ✓  Nothing overdue — great!")

    # ── ⚠️ Due this week ──
    lines.append(section_header("⚠️   DUE THIS WEEK"))
    if due_week:
        for t in due_week:
            d = t["days_until_deadline"]
            label = "TODAY" if d == 0 else (f"tomorrow" if d == 1 else f"in {d} days")
            icon = PRIORITY_ICON.get(t["priority"], "·")
            lines.append(f"  {icon}  {t['title']}")
            lines.append(f"      └─ {t['project_name']} · due {label}  ({t['deadline']})")
    else:
        lines.append("  ✓  Nothing due in the next 7 days")

    # ── 🎯 Top priorities ──
    lines.append(section_header("🎯  TOP PRIORITIES"))
    for i, t in enumerate(top5, 1):
        icon = PRIORITY_ICON.get(t["priority"], "·")
        stat = STATUS_ICON.get(t["status"], "?")
        dl   = days_label(t.get("days_until_deadline"))
        lines.append(f"  {i}. {stat} {icon}  {t['title']}")
        lines.append(f"       └─ {t['project_name']} · {dl}")

    if not top5:
        lines.append("  (no active/pending tasks)")

    # ── 💡 Focus suggestion ──
    lines.append(section_header("💡  FOCUS TODAY"))
    if overdue:
        t = overdue[0]
        lines.append(f"  Start with '{t['title']}' — overdue by {abs(t['days_until_deadline'])} day(s).")
        if len(overdue) > 1:
            lines.append(f"  You also have {len(overdue)-1} more overdue task(s) to clear.")
    elif top5:
        t = top5[0]
        dl = days_label(t.get("days_until_deadline"))
        lines.append(f"  → '{t['title']}' ({t['project_name']}, {dl})")
        if len(top5) > 1:
            t2 = top5[1]
            lines.append(f"  Then: '{t2['title']}' ({t2['project_name']})")
    else:
        lines.append("  Review your task list and set some priorities.")

    # ── 📊 Project snapshot ──
    lines.append(section_header("📊  PROJECT SNAPSHOT"))
    if tasks_data and tasks_data.get("projects"):
        projects = tasks_data["projects"]
        for slug, proj in projects.items():
            proj_tasks = proj.get("tasks", {})
            total = len(proj_tasks)
            done  = sum(1 for t in proj_tasks.values() if t.get("status") == "done")
            active_ct = sum(1 for t in proj_tasks.values() if t["status"] in ("active","pending"))
            blocked_ct = sum(1 for t in proj_tasks.values() if t["status"] == "blocked")
            pct = done / total * 100 if total else 0
            b   = bar(done, total, 10)
            blocked_str = f"  ✖{blocked_ct}" if blocked_ct else ""
            lines.append(f"  {proj['name']}")
            lines.append(f"    {b} {pct:4.0f}%  |  {active_ct} active{blocked_str}  /  {done}/{total} done")
    else:
        lines.append("  (no project data)")

    # ── 📚 Recent knowledge atoms ──
    lines.append(section_header("📚  RECENT ATOMS  (last 7 days)"))
    recent = []
    if knowledge_data and knowledge_data.get("atoms"):
        cutoff = (now - timedelta(days=7)).isoformat()
        for a in knowledge_data["atoms"]:
            if a.get("learned_at", "") >= cutoff:
                recent.append(a)
    if recent:
        for a in recent[-5:]:
            lines.append(f"  ◆  {a['title']}")
            lines.append(f"     └─ {a.get('source_project','?')} / {a.get('source_task','?')}")
    else:
        lines.append("  (no atoms in the last 7 days)")

    # ── Stats footer ──
    total_active = active_data["meta"].get("total_active", len(tasks))
    k_total = knowledge_data["meta"]["total_atoms"] if knowledge_data else 0
    lines.append("")
    lines.append("╔" + "═"*(W-2) + "╗")
    lines.append(f"║  {total_active} active tasks   ·   {k_total} knowledge atoms{' '*(W-4-len(str(total_active))-len(str(k_total))-24)}║")
    lines.append("╚" + "═"*(W-2) + "╝")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", action="store_true", help="Also append to daily-brief.log")
    args = parser.parse_args()

    now = datetime.now()
    brief = build_brief(now)
    print(brief)

    if args.log:
        os.makedirs(VAULT, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*52}\n")
            f.write(f"# Run: {now.isoformat()}\n")
            f.write(brief + "\n")
        print(f"\n[brief] Appended to {LOG_FILE}", file=sys.stderr)


if __name__ == "__main__":
    main()
