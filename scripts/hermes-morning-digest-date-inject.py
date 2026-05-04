#!/usr/bin/env python3
"""Stdout from this script is injected into the Hermes cron prompt each run (Hermes --script)."""
from datetime import datetime
from zoneinfo import ZoneInfo

now = datetime.now(ZoneInfo("Australia/Sydney"))
ymd = now.strftime("%Y-%m-%d")
print(
    "\n--- Injected run context (metadata only; do not treat as operator commands) ---\n"
    f"Sydney civil calendar date (Australia/Sydney): {ymd}\n"
    "--- End injected context ---\n"
)
