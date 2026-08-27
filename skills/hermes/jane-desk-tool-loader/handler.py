"""jane-desk-tool-loader — Hermes gateway event hook.

Fires on session:start / session:reset (every new conversation) and refreshes the
Life-at-a-Glance (Jane-Desk) skill/tool catalog inside $HERMES_HOME/SOUL.md, which
Hermes loads verbatim into the system prompt of every session. This keeps the agent
aware of which skills/tools exist so it uses them instead of hallucinating.

Only content between the managed marker comments is touched; everything else in
SOUL.md is preserved byte-for-byte.
"""

import logging
import os
import re
from pathlib import Path

logger = logging.getLogger("hooks.jane-desk-tool-loader")

MARKER_START = "<!-- jane-desk:tools:start -->"
MARKER_END = "<!-- jane-desk:tools:end -->"

HEADER = (
    "[Life-at-a-Glance / Jane-Desk] The following skills and tools ARE available "
    "to you:"
)
FOOTER = (
    "When a user message matches one of these skills, load it (skill_view by name, "
    "or read its SKILL.md) and follow its workflow before acting. Search this list "
    "first; never claim a needed tool is unavailable and never invent tools."
)
DESC_MAX_CHARS = 220


def _hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))


def _parse_frontmatter(text: str):
    match = re.match(r"\A---\s*\n(.*?)\n---", text, re.S)
    if not match:
        return None
    fm = match.group(1)
    name = re.search(r"^name:\s*(.+)$", fm, re.M)
    desc = re.search(r"^description:\s*(.+)$", fm, re.M)
    if not (name or desc):
        return None
    description = desc.group(1).strip() if desc else "(no description)"
    if len(description) > DESC_MAX_CHARS:
        description = description[: DESC_MAX_CHARS - 3] + "..."
    return (name.group(1).strip() if name else "", description)


def _build_catalog():
    skills_dir = _hermes_home() / "skills" / "jane-desk"
    lines = []
    if not skills_dir.is_dir():
        return lines
    for skill_md in sorted(skills_dir.glob("*/SKILL.md")):
        try:
            parsed = _parse_frontmatter(
                skill_md.read_text(encoding="utf-8", errors="replace")
            )
        except OSError as err:
            logger.warning("jane-desk-tool-loader: cannot read %s: %s", skill_md, err)
            continue
        if not parsed:
            continue
        name, description = parsed
        rel = "/".join(skill_md.parts[-3:])
        lines.append("- {}: {} ({})".format(name or skill_md.parent.name, description, rel))
    return lines


def _catalog_block(lines) -> str:
    body = "\n".join([HEADER] + lines + ["", FOOTER])
    return "{}\n{}\n{}".format(MARKER_START, body, MARKER_END)


def _upsert_soul(block: str) -> int:
    soul_path = _hermes_home() / "SOUL.md"
    try:
        existing = soul_path.read_text(encoding="utf-8") if soul_path.exists() else ""
    except OSError as err:
        logger.error("jane-desk-tool-loader: cannot read %s: %s", soul_path, err)
        return 0
    pattern = re.compile(
        re.escape(MARKER_START) + r".*?" + re.escape(MARKER_END), re.S
    )
    if pattern.search(existing):
        updated = pattern.sub(lambda _match: block, existing)
    elif existing.strip():
        updated = existing.rstrip() + "\n\n" + block + "\n"
    else:
        updated = block + "\n"
    try:
        soul_path.write_text(updated, encoding="utf-8")
    except OSError as err:
        logger.error("jane-desk-tool-loader: cannot write %s: %s", soul_path, err)
        return 0
    return len(updated)


async def handle(event_type: str, context: dict) -> None:
    """Entry point required by Hermes gateway hooks. Never raises."""
    del context  # unused; kept for the documented signature
    try:
        lines = _build_catalog()
        if not lines:
            logger.info(
                "jane-desk-tool-loader: no jane-desk skills installed; "
                "nothing injected (%s)",
                event_type,
            )
            return
        size = _upsert_soul(_catalog_block(lines))
        if size:
            logger.info(
                "jane-desk-tool-loader: refreshed tool catalog in SOUL.md "
                "(%d skills, %d chars, %s)",
                len(lines),
                size,
                event_type,
            )
    except Exception as err:  # noqa: BLE001 — hooks must never crash the agent
        logger.error("jane-desk-tool-loader failed: %s", err)
