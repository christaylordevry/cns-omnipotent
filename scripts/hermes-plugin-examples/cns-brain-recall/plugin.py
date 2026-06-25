"""CNS Brain Recall — production pre_llm_call inject via brain-recall-prefetch.mjs (ADR-HERMES-015).

Subprocesses Omnipotent.md scripts/brain-recall-prefetch.mjs which calls buildRecallInjection (79-3).
Respects config/brain-recall-policy.json shadow_mode: logs would-inject, returns empty context until 79-4 gate.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger("cns-brain-recall")

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


def _prefetch_timeout_s(platform: str | None) -> float:
    std, voice = _load_prefetch_timeouts()
    if platform and platform.strip().lower() == "nexus-voice":
        return voice
    return std


def _prefetch_script_path() -> Path:
    root = _resolve_omnipotent_root()
    script = root / PREFETCH_SCRIPT
    if not script.is_file():
        raise RuntimeError(f"CNS Brain Recall: prefetch script missing: {script}")
    return script


def _run_prefetch(*, user_message: str, platform: str | None) -> dict:
    script = _prefetch_script_path()
    node_bin = _resolve_node_bin()
    cmd = [node_bin, str(script), "--query", user_message]
    if platform:
        cmd.extend(["--platform", platform])

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=_prefetch_timeout_s(platform),
            env=os.environ.copy(),
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning(
            "brain-recall-prefetch timed out after %.1fs (platform=%s)",
            _prefetch_timeout_s(platform),
            platform or "default",
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


def recall_hook(
    session_id: str = "",
    user_message: str = "",
    platform: str = "",
    **kwargs,
):
    """pre_llm_call hook — subprocess prefetch CLI, inject cited recall or shadow-empty."""
    try:
        del session_id, kwargs  # reserved for future observability

        query = (user_message or "").strip()
        if not query:
            return {}

        platform_hint = (platform or "").strip() or None
        payload = _run_prefetch(user_message=query, platform=platform_hint)

        shadow = bool(payload.get("shadow"))
        context = payload.get("context")
        channel = payload.get("channel", "unknown")
        citations = payload.get("citations") or []

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
