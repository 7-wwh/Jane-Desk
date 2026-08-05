#!/usr/bin/env python3
"""Deterministic API guard evals for the Life-at-a-Glance server.

Hits the running API with deliberately-bad payloads and asserts the HTTP
status codes. Exits non-zero if any case fails. Requires the server to be up.

Usage:
    python3 bin/run_api_evals.py
    LIFE_DASH_URL=http://100.74.182.63:8000 python3 bin/run_api_evals.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("LIFE_DASH_URL", "http://127.0.0.1:8000")


def request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    code, body = request("GET", "/api/health")
    if code != 200:
        print(f"FAIL  server not healthy at {BASE} (got {code})")
        return 1

    code, body = request("GET", "/api/projects")
    projects = json.loads(body)
    temp_project = None
    if not projects:
        code, body = request("POST", "/api/projects", {"title": "Eval Parent"})
        if code != 201:
            print(f"FAIL  could not create eval parent project (got {code})")
            return 1
        temp_project = json.loads(body)["id"]
        pid = temp_project
    else:
        pid = projects[0]["id"]

    cases = [
        ("negative duration",            {"title": "x", "duration": -4.0},            422),
        ("duration over 8760h cap",      {"title": "x", "duration": 23999976.0},      422),
        ("empty title",                  {"title": ""},                               422),
        ("whitespace-only title",        {"title": "   "},                            422),
        ("'N/A' begin_date",             {"title": "x", "begin_date": "N/A"},         422),
        ("uppercase priority",           {"title": "x", "priority": "URGENT"},        400),
        ("invalid due_date 0000-00-00",  {"title": "x", "due_date": "0000-00-00"},    422),
        ("invalid branch status",        {"title": "x", "status": "gone"},            400),
    ]

    failures = 0
    created = []

    for name, payload, expected in cases:
        code, _ = request("POST", f"/api/projects/{pid}/tasks", payload)
        ok = code == expected
        print(f"{'PASS' if ok else 'FAIL'}  {name:<28} -> {code} (expected {expected})")
        failures += 0 if ok else 1

    control = {
        "title": "Eval Control",
        "status": "planned",
        "priority": "low",
        "due_date": "2026-08-08",
        "begin_date": "2026-08-06",
        "duration": 8.0,
        "branch_path": "eval/deep/nested control",
    }
    code, body = request("POST", f"/api/projects/{pid}/tasks", control)
    ok = code == 201
    print(f"{'PASS' if ok else 'FAIL'}  valid deep branch_path control -> {code} (expected 201)")
    failures += 0 if ok else 1
    if code == 201:
        task = json.loads(body)
        echo_ok = all(
            task[k] == control[k] for k in ("begin_date", "duration", "branch_path")
        )
        print(f"{'PASS' if echo_ok else 'FAIL'}  control echoes begin_date/duration/branch_path")
        failures += 0 if echo_ok else 1
        created.append(task["id"])

    for tid in created:
        request("DELETE", f"/api/tasks/{tid}")

    # --- time-tracking session guards ---
    code, body = request("POST", f"/api/projects/{pid}/tasks", {"title": "Session Guard"})
    if code != 201:
        print(f"FAIL  could not create session-guard task (got {code})")
        return 1
    sid_task = json.loads(body)["id"]

    code, _ = request("POST", "/api/tasks/999999/sessions/start")
    ok = code == 404
    print(f"{'PASS' if ok else 'FAIL'}  start session on missing task -> {code} (expected 404)")
    failures += 0 if ok else 1

    code, _ = request("POST", "/api/sessions/999999/stop")
    ok = code == 404
    print(f"{'PASS' if ok else 'FAIL'}  stop non-existent session -> {code} (expected 404)")
    failures += 0 if ok else 1

    code, body = request("POST", f"/api/tasks/{sid_task}/sessions/start")
    ok = code == 201
    print(f"{'PASS' if ok else 'FAIL'}  start session on real task -> {code} (expected 201)")
    failures += 0 if ok else 1

    code, body = request("GET", "/api/sessions/active")
    active_ok = code == 200
    if active_ok:
        active = json.loads(body)
        active_ok = active.get("session") and active["session"]["task_id"] == sid_task
    print(f"{'PASS' if active_ok else 'FAIL'}  active session points at started task")
    failures += 0 if active_ok else 1

    session_id = json.loads(body)["session"]["id"]
    code, body = request("POST", f"/api/sessions/{session_id}/stop")
    stop_ok = code == 200 and json.loads(body).get("duration_seconds") is not None
    print(f"{'PASS' if stop_ok else 'FAIL'}  stop running session returns duration -> {code}")
    failures += 0 if stop_ok else 1

    code, body = request("GET", f"/api/tasks/{sid_task}/sessions")
    list_ok = code == 200
    if list_ok:
        data = json.loads(body)
        list_ok = data["session_count"] == 1 and len(data["sessions"]) == 1
    print(f"{'PASS' if list_ok else 'FAIL'}  session list reflects stopped session")
    failures += 0 if list_ok else 1

    code, _ = request("POST", f"/api/tasks/{sid_task}/sessions/start")
    second = code == 201
    code, body = request("GET", "/api/sessions/active")
    second = second and code == 200
    if second:
        second = json.loads(body)["session"]["task_id"] == sid_task
    print(f"{'PASS' if second else 'FAIL'}  second start after stop is clean")
    failures += 0 if second else 1

    code, body = request("GET", "/api/sessions/active")
    second_id = json.loads(body)["session"]["id"]
    code, _ = request("DELETE", f"/api/sessions/{second_id}")
    del_ok = code == 204
    print(f"{'PASS' if del_ok else 'FAIL'}  delete session -> {code} (expected 204)")
    failures += 0 if del_ok else 1

    code, body = request("GET", f"/api/tasks/{sid_task}/sessions")
    final = code == 200 and json.loads(body)["session_count"] == 1
    print(f"{'PASS' if final else 'FAIL'}  sessions persist after per-session delete")
    failures += 0 if final else 1

    request("DELETE", f"/api/tasks/{sid_task}")
    if temp_project:
        request("DELETE", f"/api/projects/{temp_project}")

    print(f"\n{len(cases) + 2 + 9} checks, {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
