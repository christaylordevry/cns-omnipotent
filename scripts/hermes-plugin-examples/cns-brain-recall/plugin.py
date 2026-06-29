"""CNS Brain Recall — production pre_llm_call inject via brain-recall-prefetch.mjs (ADR-HERMES-015).

Subprocesses Omnipotent.md scripts/brain-recall-prefetch.mjs which calls buildRecallInjection (79-3).
Respects config/brain-recall-policy.json shadow_mode: logs would-inject, returns empty context until 79-4 gate.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("cns-brain-recall")

RECALL_PREFIX_RE = re.compile(r"^\[cns-recall:voice_pane\]\s*", re.I)
VOICE_SESSION_SOURCE = "nexus-voice"
SPIKE_LOG_ENV = "CNS_BRAIN_RECALL_SPIKE_LOG"

PREFETCH_SCRIPT = "scripts/brain-recall-prefetch.mjs"
DEFAULT_PREFETCH_TIMEOUT_S = 5.0
DEFAULT_VOICE_PREFETCH_TIMEOUT_S = 3.0


def _resolve_omnipotent_root() -> Path:
    for key in ("CNS_OMNIPOTENT_ROOT", "OMNIPOTENT_REPO"):
        raw = os.environ.get(key, "").strip()
        if raw:
            return Path(raw).expanduser().resolve()
    default = Path.home() / "ai-factory/projects/Omnipotent.md"
    if default.is_dir():
        return default.resolve()
    raise RuntimeError(
        "CNS Brain Recall: set CNS_OMNIPOTENT_ROOT to Omnipotent.md repo root "
        f"(default {default} not found)"
    )


def _resolve_node_bin() -> str:
    """Resolve node for Hermes gateway/systemd PATH (mirrors awareness-pull NVM pattern)."""
    for key in ("CNS_NODE_BIN", "NODE_BIN"):
        raw = os.environ.get(key, "").strip()
        if raw:
            candidate = Path(raw).expanduser()
            if candidate.is_file():
                return str(candidate.resolve())
            found = shutil.which(raw)
            if found:
                return found

    nvm_root = Path.home() / ".nvm/versions/node"
    if nvm_root.is_dir():
        bin_dirs = sorted(
            (p for p in nvm_root.glob("*/bin") if (p / "node").is_file()),
            key=lambda p: p.parent.name,
        )
        if bin_dirs:
            return str((bin_dirs[-1] / "node").resolve())

    found = shutil.which("node")
    if found:
        return found
    return "node"


def _parse_timeout_env(key: str) -> float | None:
    raw = os.environ.get(key, "").strip()
    if not raw:
        return None
    try:
        val = float(raw)
    except ValueError:
        return None
    return val if val > 0 else None


def _load_prefetch_timeouts() -> tuple[float, float]:
    std = DEFAULT_PREFETCH_TIMEOUT_S
    voice = DEFAULT_VOICE_PREFETCH_TIMEOUT_S
    try:
        policy_path = _resolve_omnipotent_root() / "config/brain-recall-policy.json"
        if policy_path.is_file():
            data = json.loads(policy_path.read_text(encoding="utf-8"))
            prefetch = data.get("prefetch")
            if isinstance(prefetch, dict):
                timeout_seconds = prefetch.get("timeout_seconds")
                voice_timeout_seconds = prefetch.get("voice_pane_timeout_seconds")
                if isinstance(timeout_seconds, (int, float)) and timeout_seconds > 0:
                    std = float(timeout_seconds)
                if isinstance(voice_timeout_seconds, (int, float)) and voice_timeout_seconds > 0:
                    voice = float(voice_timeout_seconds)
    except Exception:
        logger.debug("cns-brain-recall: using default prefetch timeouts", exc_info=True)

    env_std = _parse_timeout_env("CNS_BRAIN_RECALL_PREFETCH_TIMEOUT_S")
    env_voice = _parse_timeout_env("CNS_BRAIN_RECALL_VOICE_PREFETCH_TIMEOUT_S")
    if env_std is not None:
        std = env_std
    if env_voice is not None:
        voice = env_voice
    return std, voice


def _resolve_state_db_path() -> Path:
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")).expanduser()
    return (hermes_home / "state.db").resolve()


def _session_source_from_db(session_id: str) -> str | None:
    """Read-only lookup: sessions.id → sessions.source (Path C, SPIKE-OMNI-002)."""
    sid = (session_id or "").strip()
    if not sid:
        return None
    db_path = _resolve_state_db_path()
    if not db_path.is_file():
        return None
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        try:
            cur = conn.execute("SELECT source FROM sessions WHERE id = ? LIMIT 1", (sid,))
            row = cur.fetchone()
            if not row or row[0] is None:
                return None
            source = str(row[0]).strip()
            return source or None
        finally:
            conn.close()
    except Exception:
        logger.debug("cns-brain-recall: session source lookup failed", exc_info=True)
        return None


def _resolve_recall_channel(*, user_message: str, session_id: str) -> tuple[str, str | None]:
    """Return (prefetch_query, recall_channel_hint). Path C preferred; Path A prefix fallback."""
    query = (user_message or "").strip()
    source = _session_source_from_db(session_id)
    if source == VOICE_SESSION_SOURCE:
        return query, "voice_pane"
    match = RECALL_PREFIX_RE.match(query)
    if match:
        return query[match.end() :].strip(), "voice_pane"
    return query, None


def _prefetch_timeout_s(platform: str | None, recall_channel: str | None = None) -> float:
    std, voice = _load_prefetch_timeouts()
    if recall_channel == "voice_pane":
        return voice
    if platform and platform.strip().lower() == "nexus-voice":
        return voice
    return std


def _log_spike_kwargs(**fields) -> None:
    """Structured spike observer when CNS_BRAIN_RECALL_SPIKE_LOG=1 (SPIKE-OMNI-002)."""
    redacted = {
        k: (v[:80] + "…" if isinstance(v, str) and len(v) > 80 else v)
        for k, v in fields.items()
    }
    logger.info("cns-brain-recall spike pre_llm_call kwargs: %s", json.dumps(redacted, default=str))
    try:
        log_dir = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")) / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        path = log_dir / f"cns-brain-recall-spike-{stamp}.json"
        path.write_text(json.dumps(redacted, indent=2, default=str) + "\n", encoding="utf-8")
    except Exception:
        logger.debug("cns-brain-recall: spike log write failed", exc_info=True)


def _prefetch_script_path() -> Path:
    root = _resolve_omnipotent_root()
    script = root / PREFETCH_SCRIPT
    if not script.is_file():
        raise RuntimeError(f"CNS Brain Recall: prefetch script missing: {script}")
    return script


def _run_prefetch(
    *,
    user_message: str,
    platform: str | None,
    recall_channel: str | None = None,
) -> dict:
    script = _prefetch_script_path()
    node_bin = _resolve_node_bin()
    cmd = [node_bin, str(script), "--query", user_message]
    if platform:
        cmd.extend(["--platform", platform])
    if recall_channel:
        cmd.extend(["--recall-channel", recall_channel])

    timeout_s = _prefetch_timeout_s(platform, recall_channel)
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            env=os.environ.copy(),
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning(
            "brain-recall-prefetch timed out after %.1fs (platform=%s recall_channel=%s)",
            timeout_s,
            platform or "default",
            recall_channel or "none",
        )
        return {}
    except OSError as exc:
        logger.warning("brain-recall-prefetch failed to start node: %s", exc)
        return {}

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "unknown error").strip()
        logger.warning("brain-recall-prefetch failed (rc=%s): %s", proc.returncode, err[:500])
        return {}

    stdout = (proc.stdout or "").strip()
    if not stdout:
        logger.warning("brain-recall-prefetch returned empty stdout")
        return {}

    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        logger.warning("brain-recall-prefetch returned non-JSON stdout: %s", stdout[:200])
        return {}

    if not isinstance(payload, dict):
        logger.warning("brain-recall-prefetch returned non-object JSON")
        return {}

    return payload


def _recall_status_dir() -> Path:
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")).expanduser()
    d = hermes_home / "recall-status"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _safe_session_id(session_id: str) -> str | None:
    sid = (session_id or "").strip()
    if not sid or "/" in sid or "\\" in sid or ".." in sid:
        return None
    return sid


def _normalize_citation_paths(citations: Any) -> list[str]:
    if not isinstance(citations, list):
        return []
    paths: list[str] = []
    for item in citations:
        if isinstance(item, str) and item.strip():
            paths.append(item.strip())
        elif isinstance(item, dict):
            raw = item.get("path")
            if isinstance(raw, str) and raw.strip():
                paths.append(raw.strip())
    return paths


def _write_recall_status_sidecar(
    *,
    session_id: str,
    turn_id: Any,
    channel: str,
    citations: list[str],
    shadow: bool,
    injected: bool,
) -> None:
    """Atomic JSON sidecar for VoiceDrawer ground truth (SPIKE-OMNI-003). Fail-open."""
    sid = _safe_session_id(session_id)
    if not sid:
        return
    try:
        payload = {
            "session_id": sid,
            "turn_id": str(turn_id).strip() if turn_id is not None and str(turn_id).strip() else None,
            "channel": channel or "unknown",
            "citations": citations,
            "injected": bool(injected),
            "shadow": bool(shadow),
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        }
        if payload["turn_id"] is None:
            del payload["turn_id"]
        status_dir = _recall_status_dir()
        final_path = status_dir / f"{sid}.json"
        tmp_path = status_dir / f"{sid}.json.tmp"
        tmp_path.write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(tmp_path, final_path)
    except Exception:
        logger.debug("cns-brain-recall: recall-status sidecar write failed", exc_info=True)


def recall_hook(
    session_id: str = "",
    user_message: str = "",
    platform: str = "",
    **kwargs,
):
    """pre_llm_call hook — subprocess prefetch CLI, inject cited recall or shadow-empty."""
    try:
        if os.environ.get(SPIKE_LOG_ENV) == "1":
            _log_spike_kwargs(
                session_id=session_id,
                platform=platform,
                user_message=user_message,
                task_id=kwargs.get("task_id"),
                turn_id=kwargs.get("turn_id"),
                sender_id=kwargs.get("sender_id"),
                is_first_turn=kwargs.get("is_first_turn"),
                model=kwargs.get("model"),
            )

        query, recall_channel = _resolve_recall_channel(
            user_message=user_message,
            session_id=session_id,
        )
        if not query:
            return {}

        platform_hint = (platform or "").strip() or None
        payload = _run_prefetch(
            user_message=query,
            platform=platform_hint,
            recall_channel=recall_channel,
        )

        shadow = bool(payload.get("shadow"))
        context = payload.get("context")
        channel = payload.get("channel", "unknown")
        citations = _normalize_citation_paths(payload.get("citations"))
        injected = (
            not shadow
            and isinstance(context, str)
            and bool(context.strip())
        )
        _write_recall_status_sidecar(
            session_id=session_id,
            turn_id=kwargs.get("turn_id"),
            channel=str(channel),
            citations=citations,
            shadow=shadow,
            injected=injected,
        )

        if shadow:
            logger.info(
                "cns-brain-recall shadow_mode channel=%s citations=%d (no inject until 79-4 gate)",
                channel,
                len(citations) if isinstance(citations, list) else 0,
            )
            return {}

        if isinstance(context, str) and context.strip():
            return {"context": context}

        return {}
    except Exception as exc:
        logger.warning("cns-brain-recall hook fail-open: %s", exc)
        return {}


def register(ctx):
    ctx.register_hook("pre_llm_call", recall_hook)
