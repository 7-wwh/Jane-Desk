# Life-at-a-Glance

A personal life dashboard that shows your projects, goals, learnings, and timeline in one glance — fed by your agents.

## Quick start

```bash
./bin/run.sh                       # start dev server on :8000
systemctl --user start life-dashboard   # or run as a service (already enabled)
```

- Dashboard UI: http://127.0.0.1:8000 or http://100.74.182.63:8000 (Tailscale)
- API docs: http://127.0.0.1:8000/docs
- How agents write data: see `AGENTS.md` and `bin/post.sh`

## Structure

- `app/` — FastAPI backend (models, schemas, routes)
- `static/` — dashboard UI (vanilla HTML/CSS/JS)
- `bin/post.sh` — one-command helper for agents to add entries
- `deploy/life-dashboard.service` — systemd unit (installed at `~/.config/systemd/user/`)
- `data/life.db` — SQLite database (auto-created)

## Service management

```bash
systemctl --user status life-dashboard
systemctl --user restart life-dashboard
journalctl --user -u life-dashboard -f
```
