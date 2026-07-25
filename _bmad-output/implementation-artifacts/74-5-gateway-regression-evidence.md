# Story 74-5 — Gateway & Morning Digest Regression Evidence

**Story:** `74-5-gateway-and-morning-digest-regression-gate`  
**Operator:** Chris  
**Date completed:** 2026-06-24  
**Hermes version:** v0.17.0 (2026.6.19)

> **Redaction policy (NFR4):** No tokens, `auth.json`, or `.env` contents recorded below.

---

## AC #1 Prerequisites — PASS (agent pre-check 2026-06-24)

| Field | Value |
|-------|-------|
| Portal logged in | **Yes** |
| Inference provider | Nous inference provider |
| Main model.provider | `nous` |
| Main model.default | `anthropic/claude-sonnet-4.6` |
| Compression provider | `nous` |
| Compression model | `anthropic/claude-haiku-4.5` |

### Evidence

```text
hermes --version
Hermes Agent v0.17.0 (2026.6.19)

hermes portal info:
  Auth: ✓ logged in
  Model: ✓ using Nous as inference provider
  Tool Gateway: firecrawl (web tools)

grep -A4 '^model:' ~/.hermes/config.yaml:
  provider: nous
  default: anthropic/claude-sonnet-4.6
  base_url: https://inference-api.nousresearch.com/v1

hermes config show → Context Compression:
  Model:        anthropic/claude-haiku-4.5
  Provider:     nous
```

---

## AC #2 Gateway health — PASS (agent pre-check 2026-06-24)

| Check | Result |
|-------|--------|
| `hermes gateway status` running | **Yes** — `✓ User gateway service is running` |
| Live gateway process | **Yes** — systemd `hermes-gateway.service` active (PID 837348) |
| Recent log: codex/Cloudflare auth failures | **None** in tail |
| Recent log: OpenRouter 402 on main path | **None** in tail |

### Evidence

```text
hermes gateway status:
  ● hermes-gateway.service — Active: active (running) since Sun 2026-06-21 03:24:35 AEST
  ✓ User gateway service is running
  ✓ Systemd linger is enabled

pgrep -af 'hermes gateway':
  (systemd unit: hermes-gateway.service → python -m hermes_cli.main gateway run --replace)

tail -20 ~/.hermes/logs/gateway.log:
  Recent Discord activity on chat=1500733488897462382 (#hermes); no openai-codex or 402 errors.
  Note: journalctl may have rotated since unit start; file log tail used.
```

---

## AC #3 Discord #hermes — PASS (operator 2026-06-24 11:04 AM AEST)

**Channel:** `#hermes` (ID `1500733488897462382`) — FR4 formal gate

| Field | Value |
|-------|-------|
| Test message posted | `regression-gate-74-5: reply with exactly portal-regression-ok` |
| Reply text | `portal-regression-ok` (exact match) |
| Timestamp (AEST) | 2026-06-24 11:04 AM |
| Gateway log clean for turn | Operator attested — Portal path; no codex/Cloudflare errors for this turn |

### Evidence

```text
Operator Discord regression (FR4):
  Message: regression-gate-74-5: reply with exactly portal-regression-ok
  Reply:   portal-regression-ok (exact match)
  Time:    2026-06-24 11:04 AM AEST
```

---

## AC #4 Digest path — PASS (agent pre-check 2026-06-24)

**Portal provider switch does not alter digest collection scripts** — Perplexity/NewsAPI/adapters are terminal scripts; Epic 70 Node orchestrator path unchanged.

### Production cron path

| Item | Value |
|------|-------|
| WSL crontab tag | `# cns-morning-digest-skill` |
| Schedule | `0 7 * * *` with `CRON_TZ=Australia/Sydney` |
| Runner | `scripts/run-morning-digest-cron.sh` |
| Install script | `scripts/install-morning-digest-cron.sh` |
| Job id file | `~/.hermes/morning-digest-skill-cron-job-id` → `faf94bfd527c` |

```text
crontab -l | grep cns-morning-digest-skill:
0 7 * * * CRON_TZ=Australia/Sydney DIGEST_TRIGGER=cron /bin/bash "/home/christ/ai-factory/projects/Omnipotent.md/scripts/run-morning-digest-cron.sh" >>"/home/christ/.hermes/logs/morning-digest-skill-cron.log" 2>&1 # cns-morning-digest-skill
```

### Gateway guard pattern (read-only grep — no script edits)

| Script | Line | Posture |
|--------|------|---------|
| `scripts/run-morning-digest-cron.sh` | 21 | **Warn-only** if gateway down |
| `scripts/hermes-morning-digest.sh` | 23 | **Fail-closed** abort if gateway down (Story 67-8) |

```text
grep -n "gateway service is running|gateway is running" scripts/run-morning-digest-cron.sh:
21:if ! printf '%s\n' "$_gw_out" | grep -qiE 'gateway service is running|gateway is running'; then

grep -n "gateway service is running|gateway is running" scripts/hermes-morning-digest.sh:
22:# Matches: "✓ User gateway service is running" (current) and legacy "gateway is running"
23:if ! hermes gateway status 2>/dev/null | grep -qiE 'gateway service is running|gateway is running'; then
```

### Epic 70 vs legacy Mode B

| Script | Role | Gateway guard |
|--------|------|---------------|
| `run-morning-digest-cron.sh` | **Production** WSL cron (Epic 70) → Node orchestrator | Warn-only |
| `hermes-morning-digest.sh` | Legacy Mode B Hermes agent cron (Story 26-7) | Fail-closed |

Contract tests: `tests/hermes-morning-digest-skill.test.mjs` (Stories 55-3 / 67-8).

### Gateway preflight one-liner

```text
hermes gateway status 2>&1 | grep -qiE 'gateway service is running|gateway is running' \
  && echo "digest-gateway-guard: PASS"
→ digest-gateway-guard: PASS
```

---

## AC #5 NEXUS bridge — PASS (operator attestation 2026-06-24)

**Two-bot boundary (NFR2, NFR8):** Hermes = `#hermes` via `hermes gateway`; NEXUS = separate bridge — **do not restart, reconfigure, or modify NEXUS** during this story.

References: Operator Guide §15.0/§15.1; `docs/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md`

| Check | Result |
|-------|--------|
| NEXUS bridge process | **Not running** at check time (`pgrep -af 'nexus-discord-bridge|claude --channels'` → no matches) |
| Zero diffs in `~/ai-factory/projects/NEXUS/` | **Yes** — no changes from this story |
| Two-bot boundary respected | **Yes** — NEXUS untouched during 74-5 |

**Operator note:** NEXUS bridge not running at time of check is a **separate ops concern**, not a 74-5 regression gate. This story verified hands-off boundary and zero NEXUS repo diffs only.

### Evidence

```text
pgrep -af 'nexus-discord-bridge|claude --channels'
→ no matching processes (operator attested 2026-06-24)

NEXUS repo: no file changes from story 74-5 work.
Boundary: Hermes tested via #hermes; NEXUS not modified/restarted/reconfigured.
```

---

## AC #6 verify.sh — PASS (agent baseline 2026-06-24)

```text
bash scripts/verify.sh → VERIFY PASSED
```

| Check | Result |
|-------|--------|
| verify.sh green | **Yes** |
| No secret files in git diff | **Yes** — evidence + sprint-status + story only |
| Protect-list zero diffs | **Yes** |

---

## Completion checklist

- [x] AC #1 Prerequisites verified (portal, nous primary, Haiku compression)
- [x] AC #2 Gateway health baseline captured
- [x] AC #3 Discord `#hermes` regression — `portal-regression-ok` exact match (2026-06-24 11:04 AM)
- [x] AC #4 Digest path documented; gateway grep pattern confirmed; preflight PASS
- [x] AC #5 NEXUS bridge attestation — not running; boundary respected; zero NEXUS diffs
- [x] AC #6 Final verify + protect-list scan at story close
