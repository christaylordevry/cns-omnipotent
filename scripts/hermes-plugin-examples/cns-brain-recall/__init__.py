"""Hermes plugin entry — loads register() from sibling plugin.py source."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_PLUGIN_PATH = Path(__file__).resolve().parent / "plugin.py"
_SPEC = importlib.util.spec_from_file_location(
    "cns_brain_recall_plugin_impl",
    _PLUGIN_PATH,
)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError(f"Cannot load plugin implementation from {_PLUGIN_PATH}")

_MOD = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MOD)

register = _MOD.register

__all__ = ["register"]
