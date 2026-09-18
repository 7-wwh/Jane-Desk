#!/usr/bin/env python3
"""Guarded API writer for Jane-Desk agent skills.

Validates supported payloads before writing, treats non-2xx responses as failures,
and reads the created/updated record back to verify the supplied fields.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE = os.environ.get("LIFE_DASH_URL", "http://127.0.0.1:8000").rstrip("/")
ROOT = Path(__file__).resolve().parents[1]
ENTITIES = {
    "project": "projects",
    "goal": "goals",
    "learning": "learnings",
    "journal": "journal",
    "note": "notes",
}


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def request(method: str, path: str, payload: dict | None = None) -> tuple[int, object]:
    body = json.dumps(payload).encode() if payload is not None else None
    req = Request(
        f"{BASE}{path}", body, method=method,
        headers={"Content-Type": "application/json"} if body else {},
    )
    try:
        with urlopen(req, timeout=10) as response:
            raw = response.read().decode()
            return response.status, json.loads(raw) if raw else None
    except HTTPError as error:
        raw = error.read().decode(errors="replace")
        fail(f"{method} {path} returned HTTP {error.code}: {raw}")
    except URLError as error:
        fail(f"cannot reach {BASE}: {error.reason}")


def parse_payload(raw: str) -> dict:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        fail(f"payload is not valid JSON: {error}")
    if not isinstance(value, dict):
        fail("payload must be one JSON object")
    return value


def ensure_healthy() -> None:
    status, _ = request("GET", "/api/health")
    if status != 200:
        fail(f"health check returned HTTP {status}")


def validate(entity: str, payload: dict, is_update: bool) -> None:
    if entity not in {"task", "project", "goal"}:
        return
    # The existing deterministic guard has the source-of-truth field rules.
    # For partial updates it intentionally accepts title-only or title-plus-change payloads.
    command = [sys.executable, str(ROOT / "bin" / "check_payloads.py"), "--entity", entity]
    result = subprocess.run(command, input=json.dumps(payload), text=True, capture_output=True)
    if result.returncode:
        fail(result.stdout.strip() or result.stderr.strip())


def verify(entity: str, record_id: int, supplied: dict) -> dict:
    endpoint = "tasks" if entity == "task" else ENTITIES[entity]
    status, saved = request("GET", f"/api/{endpoint}/{record_id}")
    if status != 200 or not isinstance(saved, dict):
        fail(f"verification fetch for {entity} #{record_id} did not return a record")
    mismatches = {key: value for key, value in supplied.items() if saved.get(key) != value}
    if mismatches:
        fail(f"verification mismatch for {entity} #{record_id}: {mismatches}; saved={saved}")
    return saved


def main(argv: list[str]) -> None:
    if not argv:
        fail("usage: agent_write.py <entity> [project_id] <json> | update <entity> <id> <json>")
    ensure_healthy()
    update = argv[0] == "update"
    if update:
        if len(argv) != 4 or argv[1] not in {"project", "task", "goal", "learning", "journal", "note"}:
            fail("usage: agent_write.py update <entity> <id> <json>")
        entity, record_id, payload_raw = argv[1], argv[2], argv[3]
        if not record_id.isdigit() or int(record_id) < 1:
            fail("record ID must be a positive integer")
        payload = parse_payload(payload_raw)
        validate(entity, payload, True)
        endpoint = "tasks" if entity == "task" else ENTITIES[entity]
        status, response = request("PUT", f"/api/{endpoint}/{record_id}", payload)
    else:
        entity = argv[0]
        if entity == "task":
            if len(argv) != 3 or not argv[1].isdigit() or int(argv[1]) < 1:
                fail("usage: agent_write.py task <project_id> <json>")
            project_id, payload = argv[1], parse_payload(argv[2])
            validate(entity, payload, False)
            status, response = request("POST", f"/api/projects/{project_id}/tasks", payload)
        else:
            if entity not in ENTITIES or len(argv) != 2:
                fail("usage: agent_write.py <project|goal|learning|journal|note> <json>")
            payload = parse_payload(argv[1])
            validate(entity, payload, False)
            status, response = request("POST", f"/api/{ENTITIES[entity]}", payload)
    expected = 200 if update else 201
    if status != expected or not isinstance(response, dict) or not isinstance(response.get("id"), int):
        fail(f"expected HTTP {expected} and a record body, got HTTP {status}: {response}")
    saved = verify(entity, response["id"], payload)
    print(json.dumps(saved, indent=2, default=str))


if __name__ == "__main__":
    main(sys.argv[1:])
