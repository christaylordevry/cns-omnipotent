---
title: 'Fix morning-digest cron gateway check'
type: 'bugfix'
created: '2026-06-12'
status: 'done'
route: 'one-shot'
---

# Fix morning-digest cron gateway check

## Intent

**Problem:** `scripts/run-morning-digest-cron.sh` aborted with "Hermes gateway is not running" even when the gateway was active, because `hermes gateway status` can exit non-zero (e.g. outdated systemd unit warning) and `set -euo pipefail` propagated that exit through the grep pipeline.

**Approach:** Capture `hermes gateway status` output with `2>&1 || true`, then grep the captured text for running-state markers. Context7/Hermes v0.15.1 has no dedicated `gateway health`/`ping` CLI; HTTP `/health` is platform-specific, so output-based detection remains appropriate.

## Suggested Review Order

1. [Gateway check fix](scripts/run-morning-digest-cron.sh) — capture-then-grep pattern and comment explaining pipefail interaction
2. [Install/cron wiring](scripts/install-morning-digest-cron.sh) — confirm log path and cron stderr redirect unchanged
