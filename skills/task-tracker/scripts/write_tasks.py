#!/usr/bin/env python3
"""
write_tasks.py — Atomically write tasks.json and regenerate active-tasks.json.

Usage:
  python write_tasks.py --tasks <json_string>
  python write_tasks.py --tasks-file <path>

The script reads the current tasks.json (if it exists), merges the provided
data, writes tasks.json, then regenerates active-tasks.json from scratch.
"""

import json
import sys
import os
import argparse
from datetime import datetime, timezone

VAULT = "/home/ubuntu/Documents/ObsidianVault/task-tracking-visualize"
TASKS_FILE = os.path.join(VAULT, "tasks.json")
ACTIVE_FILE = os.path.join(VAULT, "active-tasks.json")

PRIORITY_SCORE = {"critical": 4, "high": 3, "medium": 2, "low": 1}
ACTIVE_STATUSES = {"pending", "active", "blocked"}


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_tasks():
    if os.path.exists(TASKS_FILE):
        with open(TASKS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "meta": {"version": "1.0", "last_updated": now_iso()},
        "projects": {}
    }


def save_tasks(data):
    data["meta"]["last_updated"] = now_iso()
    os.makedirs(VAULT, exist_ok=True)
    with open(TASKS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[write_tasks] tasks.json written ({len(data['projects'])} projects)")


def days_until(deadline_str):
    if not deadline_str:
        return None
    try:
        deadline = datetime.strptime(deadline_str, "%Y-%m-%d")
        delta = (deadline - datetime.now()).days
        return delta
    except ValueError:
        return None


def flatten_tasks(project_slug, project_name, tasks_dict, result):
    """Recursively flatten tasks + subtasks into a list."""
    for task_id, task in tasks_dict.items():
        if task.get("status") in ACTIVE_STATUSES:
            due = task.get("deadline")
            days = days_until(due)
            result.append({
                "task_id": task_id,
                "project_slug": project_slug,
                "project_name": project_name,
                "title": task.get("title", ""),
                "priority": task.get("priority", "medium"),
                "status": task.get("status", "pending"),
                "deadline": due,
                "days_until_deadline": days,
                "duration_estimate": task.get("duration_estimate", ""),
                "tags": task.get("tags", []),
            })
        # Recurse into subtasks
        subtasks = task.get("subtasks", {})
        if subtasks:
            flatten_tasks(project_slug, project_name, subtasks, result)


def sort_key(task):
    days = task["days_until_deadline"]
    priority_score = PRIORITY_SCORE.get(task["priority"], 2)
    if days is None:
        urgency = 0
    elif days < 0:
        urgency = 2000 + (-days)  # overdue: higher = more overdue
    else:
        urgency = 1000 - days     # upcoming: higher = sooner
    return -(urgency * 10 + priority_score)


def regenerate_active(tasks_data):
    flat = []
    for slug, project in tasks_data.get("projects", {}).items():
        flatten_tasks(slug, project.get("name", slug), project.get("tasks", {}), flat)

    flat.sort(key=sort_key)

    active_data = {
        "meta": {
            "generated_at": now_iso(),
            "total_active": len(flat)
        },
        "tasks": flat
    }
    with open(ACTIVE_FILE, "w", encoding="utf-8") as f:
        json.dump(active_data, f, indent=2, ensure_ascii=False)
    print(f"[write_tasks] active-tasks.json regenerated ({len(flat)} tasks)")


def main():
    parser = argparse.ArgumentParser(description="Write tasks.json and regenerate active-tasks.json")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--tasks", help="Full tasks JSON as string")
    group.add_argument("--tasks-file", help="Path to a JSON file with full tasks data")
    args = parser.parse_args()

    if args.tasks_file:
        with open(args.tasks_file, "r", encoding="utf-8") as f:
            new_data = json.load(f)
    else:
        new_data = json.loads(args.tasks)

    save_tasks(new_data)
    regenerate_active(new_data)
    print("[write_tasks] Done.")


if __name__ == "__main__":
    main()
