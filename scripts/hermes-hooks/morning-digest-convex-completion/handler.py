"""Gateway hook: deterministic Convex completion after morning-digest (Story 68-10)."""

from __future__ import annotations

import logging
import os
import re
import subprocess
import threading
from pathlib import Path

logger = logging.getLogger("hooks.morning-digest-convex-completion")

_TRIGGER_RE = re.compile(
    r"(?:^|\s)(?:run\s+)?morning[\s-]digest(?:\s|$)|cron:morning-digest",
    re.IGNORECASE,
)


def _repo_root() -> Path:
    env_root = os.environ.get("OMNIPOTENT_REPO", "").strip()
    if env_root:
        return Path(env_root)
    return Path.home() / "ai-factory" / "projects" / "Omnipotent.md"


def _is_morning_digest_trigger(message: str) -> bool:
    return bool(_TRIGGER_RE.search(message or ""))


def _run_completion() -> None:
    repo = _repo_root()
    script = repo / "scripts" / "run-digest-convex-completion.mjs"
    if not script.is_file():
        logger.warning("completion script missing: %s", script)
        return
    env = {**os.environ, "OMNIPOTENT_REPO": str(repo)}
    try:
        subprocess.run(
            ["node", str(script)],
            cwd=str(repo),
            env=env,
            timeout=600,
            check=False,
        )
    except Exception as exc:
        logger.error("morning-digest completion failed: %s", exc)


async def handle(event_type: str, context: dict) -> None:
    if event_type != "agent:end":
        return
    message = str(context.get("message") or "")
    if not _is_morning_digest_trigger(message):
        return
    logger.info("morning-digest agent:end — spawning Convex completion backfill")
    thread = threading.Thread(
        target=_run_completion,
        name="morning-digest-convex-completion",
        daemon=True,
    )
    thread.start()
