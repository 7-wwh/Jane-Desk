#!/usr/bin/env python3
"""
write_vault_index.py — Generate Obsidian-friendly .md files from the task vault.

Creates / updates:
  PROJECT-TREE.md      → Full visual tree of all projects, tasks, subtasks
  KNOWLEDGE-INDEX.md   → All knowledge atoms grouped by project/tags
  README.md            → Vault landing page with stats

Run this after any task or knowledge write to keep the vault in sync.
Also installed as a cron job (daily at 08:01, right after the brief).

Usage:
  python3 write_vault_index.py
"""

import json
import os
from datetime import datetime, timedelta

VAULT          = "/home/ubuntu/Documents/ObsidianVault/task-tracking-visualize"
TASKS_FILE     = os.path.join(VAULT, "tasks.json")
KNOWLEDGE_FILE = os.path.join(VAULT, "knowledge.json")
ACTIVE_FILE    = os.path.join(VAULT, "active-tasks.json")

TREE_FILE      = os.path.join(VAULT, "PROJECT-TREE.md")
KNOWLEDGE_MD   = os.path.join(VAULT, "KNOWLEDGE-INDEX.md")
README_FILE    = os.path.join(VAULT, "README.md")

PRIORITY_ICON = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}
STATUS_ICON   = {"active": "▶️", "pending": "⬜", "blocked": "🚫", "done": "✅", "cancelled": "❌"}
STATUS_TAG    = {"active": "#active", "pending": "#pending", "blocked": "#blocked",
                 "done": "#done", "cancelled": "#cancelled"}


def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def write_md(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[vault-index] Written: {path}")

def progress_bar(done, total, width=15):
    if total == 0: return "░" * width + " 0%"
    filled = round(done / total * width)
    pct = round(done / total * 100)
    return "█" * filled + "░" * (width - filled) + f" {pct}%"

def format_deadline(deadline_str):
    if not deadline_str:
        return ""
    try:
        d = datetime.strptime(deadline_str, "%Y-%m-%d")
        days = (d.date() - datetime.now().date()).days
        if days < 0:   return f" · ⚠️ **OVERDUE** ({abs(days)}d)"
        if days == 0:  return f" · 🔥 **TODAY**"
        if days <= 7:  return f" · ⚡ due in {days}d"
        return f" · 📅 {deadline_str}"
    except:
        return f" · 📅 {deadline_str}"

def render_task(task_id, task, depth=0):
    """Render a single task line for the project tree."""
    indent = "    " * depth
    icon   = STATUS_ICON.get(task.get("status",""), "⬜")
    picon  = PRIORITY_ICON.get(task.get("priority",""), "")
    dl     = format_deadline(task.get("deadline"))
    tag    = STATUS_TAG.get(task.get("status",""), "")
    title  = task.get("title", task_id)
    est    = f" `{task['duration_estimate']}`" if task.get("duration_estimate") else ""

    lines = [f"{indent}- {icon} {picon} **{title}**{dl}{est} {tag}"]

    if task.get("description"):
        lines.append(f"{indent}  > {task['description'][:120]}{'…' if len(task.get('description','')) > 120 else ''}")

    # Atoms inline (untransferred only — the interesting ones)
    atoms = [a for a in task.get("atoms", []) if not a.get("transferred", True)]
    if atoms:
        lines.append(f"{indent}  - 💡 *Atoms to learn:* {', '.join(a['title'] for a in atoms)}")

    # Subtasks
    for sub_id, sub in task.get("subtasks", {}).items():
        lines.extend(render_task(sub_id, sub, depth + 1))

    return lines


def generate_project_tree(tasks_data):
    now = datetime.now()
    lines = [
        "---",
        "tags: [task-tracker, project-tree]",
        f"updated: {now.strftime('%Y-%m-%d %H:%M')}",
        "---",
        "",
        "# 🗂 Project Tree",
        "",
        f"> Auto-generated · {now.strftime('%A, %d %B %Y %H:%M')}  ",
        "> Edit tasks via Claude, not this file directly.",
        "",
    ]

    if not tasks_data or not tasks_data.get("projects"):
        lines.append("_No projects yet._")
        return "\n".join(lines)

    projects = tasks_data["projects"]

    # Stats bar up top
    total_tasks = 0
    total_done  = 0
    for slug, proj in projects.items():
        for tid, task in proj.get("tasks", {}).items():
            total_tasks += 1
            if task.get("status") == "done":
                total_done += 1

    bar = progress_bar(total_done, total_tasks, 20)
    lines.append(f"**Overall progress:** `{bar}` ({total_done}/{total_tasks} tasks done)")
    lines.append("")
    lines.append("---")
    lines.append("")

    for slug, proj in projects.items():
        proj_tasks = proj.get("tasks", {})
        total = len(proj_tasks)
        done  = sum(1 for t in proj_tasks.values() if t.get("status") == "done")
        active = sum(1 for t in proj_tasks.values() if t.get("status") in ("active","pending"))
        blocked = sum(1 for t in proj_tasks.values() if t.get("status") == "blocked")
        bar   = progress_bar(done, total, 12)

        lines.append(f"## {proj.get('name', slug)}")
        if proj.get("description"):
            lines.append(f"> {proj['description']}")
        lines.append("")
        stats = f"`{bar}` &nbsp; {active} active"
        if blocked: stats += f" · 🚫 {blocked} blocked"
        stats += f" · {done}/{total} done"
        lines.append(stats)
        lines.append("")

        if not proj_tasks:
            lines.append("_No tasks yet._")
            lines.append("")
            continue

        # Group by status for visual clarity
        groups = {
            "active":    [],
            "pending":   [],
            "blocked":   [],
            "done":      [],
            "cancelled": [],
        }
        for tid, task in proj_tasks.items():
            groups.get(task.get("status","pending"), groups["pending"]).append((tid, task))

        for status in ("active", "pending", "blocked"):
            if not groups[status]:
                continue
            label = {"active":"▶️ Active","pending":"⬜ Pending","blocked":"🚫 Blocked"}[status]
            lines.append(f"**{label}**")
            lines.append("")
            for tid, task in groups[status]:
                lines.extend(render_task(tid, task, depth=0))
            lines.append("")

        # Done tasks — collapsed
        if groups["done"]:
            lines.append(f"<details><summary>✅ Done ({len(groups['done'])})</summary>")
            lines.append("")
            for tid, task in groups["done"]:
                done_at = task.get("done_at","")[:10] if task.get("done_at") else ""
                lines.append(f"- ✅ {task.get('title', tid)} {f'· {done_at}' if done_at else ''}")
            lines.append("")
            lines.append("</details>")
            lines.append("")

        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def generate_knowledge_index(knowledge_data, tasks_data):
    now = datetime.now()
    lines = [
        "---",
        "tags: [task-tracker, knowledge]",
        f"updated: {now.strftime('%Y-%m-%d %H:%M')}",
        "---",
        "",
        "# 📚 Knowledge Index",
        "",
        f"> Auto-generated · {now.strftime('%A, %d %B %Y %H:%M')}",
        "",
    ]

    if not knowledge_data or not knowledge_data.get("atoms"):
        lines.append("_No knowledge atoms yet. Complete tasks to populate this ledger._")
        return "\n".join(lines)

    atoms = knowledge_data["atoms"]
    total = knowledge_data["meta"].get("total_atoms", len(atoms))
    lines.append(f"**{total} atoms learned** across {len(set(a.get('source_project','?') for a in atoms))} projects")
    lines.append("")

    # Group by project
    by_project = {}
    for a in atoms:
        proj = a.get("source_project", "misc")
        by_project.setdefault(proj, []).append(a)

    # Get project names from tasks_data
    proj_names = {}
    if tasks_data and tasks_data.get("projects"):
        for slug, proj in tasks_data["projects"].items():
            proj_names[slug] = proj.get("name", slug)

    for proj_slug, proj_atoms in sorted(by_project.items()):
        proj_name = proj_names.get(proj_slug, proj_slug)
        lines.append(f"## {proj_name}")
        lines.append("")
        for a in sorted(proj_atoms, key=lambda x: x.get("learned_at",""), reverse=True):
            learned = a.get("learned_at","")[:10]
            tags = " ".join(f"`{t}`" for t in a.get("tags",[]))
            lines.append(f"### {a['title']}")
            lines.append(f"> {a.get('description','')}")
            lines.append("")
            meta = f"Learned: {learned}"
            if a.get("source_task"): meta += f" · from `{a['source_task']}`"
            if tags: meta += f"  \n{tags}"
            lines.append(meta)
            if a.get("notes"):
                lines.append(f"\n*Notes: {a['notes']}*")
            lines.append("")

        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def generate_readme(tasks_data, knowledge_data, active_data):
    now = datetime.now()
    lines = [
        "---",
        "tags: [task-tracker, home]",
        f"updated: {now.strftime('%Y-%m-%d %H:%M')}",
        "---",
        "",
        "# 🏠 Task Vault",
        "",
        f"> Last sync: **{now.strftime('%A, %d %B %Y %H:%M')}**",
        "",
        "## Quick Nav",
        "",
        "| | File | What's inside |",
        "|---|---|---|",
        "| 🗂 | [[PROJECT-TREE]] | All projects, tasks, progress bars |",
        "| 📚 | [[KNOWLEDGE-INDEX]] | Every atom you've learned |",
        "| 📋 | `tasks.json` | Master task database |",
        "| ⚡ | `active-tasks.json` | Live snapshot (active/pending only) |",
        "| 📖 | `daily-brief.log` | Morning brief history |",
        "",
        "---",
        "",
        "## 📊 Vault Stats",
        "",
    ]

    # Stats
    if tasks_data and tasks_data.get("projects"):
        projects = tasks_data["projects"]
        num_proj = len(projects)
        total_tasks = sum(len(p.get("tasks",{})) for p in projects.values())
        done_tasks  = sum(
            sum(1 for t in p.get("tasks",{}).values() if t.get("status")=="done")
            for p in projects.values()
        )
        active_tasks = sum(
            sum(1 for t in p.get("tasks",{}).values() if t.get("status") in ("active","pending"))
            for p in projects.values()
        )
        bar = progress_bar(done_tasks, total_tasks, 20)

        lines.append(f"| | Count |")
        lines.append(f"|---|---|")
        lines.append(f"| Projects | {num_proj} |")
        lines.append(f"| Total tasks | {total_tasks} |")
        lines.append(f"| Active/Pending | {active_tasks} |")
        lines.append(f"| Done | {done_tasks} |")
        k_count = knowledge_data["meta"]["total_atoms"] if knowledge_data else 0
        lines.append(f"| Knowledge atoms | {k_count} |")
        lines.append("")
        lines.append(f"**Overall:** `{bar}`")
        lines.append("")
    else:
        lines.append("_No tasks yet._")
        lines.append("")

    # Active tasks quick list
    if active_data and active_data.get("tasks"):
        lines.append("---")
        lines.append("")
        lines.append("## ⚡ Active Right Now")
        lines.append("")
        porder = {"critical":0,"high":1,"medium":2,"low":3}
        top = sorted(
            [t for t in active_data["tasks"] if t["status"] in ("active","pending")],
            key=lambda t: (porder.get(t["priority"],9), t.get("days_until_deadline") or 9999)
        )[:8]
        for t in top:
            icon = PRIORITY_ICON.get(t["priority"],"")
            dl   = format_deadline(t.get("deadline"))
            lines.append(f"- {icon} **{t['title']}** · {t['project_name']}{dl}")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("*Managed by Claude via the task-tracker skill. Do not edit JSON files directly.*")

    return "\n".join(lines)


def main():
    print("[vault-index] Generating Obsidian vault index files...")
    os.makedirs(VAULT, exist_ok=True)

    tasks_data     = load_json(TASKS_FILE)
    knowledge_data = load_json(KNOWLEDGE_FILE)
    active_data    = load_json(ACTIVE_FILE)

    write_md(TREE_FILE,    generate_project_tree(tasks_data))
    write_md(KNOWLEDGE_MD, generate_knowledge_index(knowledge_data, tasks_data))
    write_md(README_FILE,  generate_readme(tasks_data, knowledge_data, active_data))

    print("[vault-index] Done.")


if __name__ == "__main__":
    main()
