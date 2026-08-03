#!/usr/bin/env python3
"""
write_knowledge.py — Append or update atoms in knowledge.json.

Usage:
  # Append new atoms from a JSON array string
  python write_knowledge.py --append '<json array of atom objects>'

  # Replace the whole knowledge.json
  python write_knowledge.py --replace '<full knowledge json>'

  # Append from a file
  python write_knowledge.py --append-file <path>

Atom object shape (for --append):
{
  "id": "atom_xxxxxx",
  "title": "...",
  "description": "...",
  "source_task": "task_id",
  "source_project": "project_slug",
  "learned_at": "ISO timestamp",
  "tags": ["..."],
  "notes": ""
}
"""

import json
import os
import argparse
from datetime import datetime, timezone

VAULT = "/home/ubuntu/Documents/ObsidianVault/task-tracking-visualize"
KNOWLEDGE_FILE = os.path.join(VAULT, "knowledge.json")


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_knowledge():
    if os.path.exists(KNOWLEDGE_FILE):
        with open(KNOWLEDGE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "meta": {"last_updated": now_iso(), "total_atoms": 0},
        "atoms": []
    }


def save_knowledge(data):
    data["meta"]["last_updated"] = now_iso()
    data["meta"]["total_atoms"] = len(data["atoms"])
    os.makedirs(VAULT, exist_ok=True)
    with open(KNOWLEDGE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[write_knowledge] knowledge.json written ({data['meta']['total_atoms']} atoms)")


def main():
    parser = argparse.ArgumentParser(description="Write knowledge.json")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--append", help="JSON array of atom objects to append")
    group.add_argument("--append-file", help="Path to JSON file with atom array")
    group.add_argument("--replace", help="Full knowledge JSON as string")
    group.add_argument("--replace-file", help="Path to full knowledge JSON file")
    args = parser.parse_args()

    if args.replace or args.replace_file:
        if args.replace_file:
            with open(args.replace_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = json.loads(args.replace)
        save_knowledge(data)
        return

    # Append mode
    if args.append_file:
        with open(args.append_file, "r", encoding="utf-8") as f:
            new_atoms = json.load(f)
    else:
        new_atoms = json.loads(args.append)

    if not isinstance(new_atoms, list):
        new_atoms = [new_atoms]

    data = load_knowledge()
    existing_ids = {a["id"] for a in data["atoms"]}

    added = 0
    updated = 0
    for atom in new_atoms:
        if atom["id"] in existing_ids:
            # Update in place
            for i, existing in enumerate(data["atoms"]):
                if existing["id"] == atom["id"]:
                    data["atoms"][i] = {**existing, **atom}
                    updated += 1
                    break
        else:
            if "learned_at" not in atom:
                atom["learned_at"] = now_iso()
            data["atoms"].append(atom)
            added += 1

    save_knowledge(data)
    print(f"[write_knowledge] Added {added} new atoms, updated {updated} existing.")


if __name__ == "__main__":
    main()
