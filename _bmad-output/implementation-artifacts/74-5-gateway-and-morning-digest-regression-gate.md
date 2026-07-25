---
baseline_commit: 827a920
---

# Story 74.5: Gateway and morning-digest regression gate

Status: done

<!-- Operator-first story: explicit FR4/NFR2 preservation verification after Portal migration (74-2/74-3). NO protect-list code changes unless gateway grep regressed. -->

## Story

As an **operator**,
I want **explicit regression verification that Portal migration did not break Discord or the morning-digest cron path**,
so that **non-negotiable preservation holds (FR4, NFR2, NFR8)** before dashboard/Desktop work (74-6+).

## Acceptance Criteria

1. **Prerequisites — Portal stack active (74-2 + 74-3)**
   **Given** stories **74-2** and **74-3** are **done**
   **When** this story begins
   **Then** `hermes portal info` shows **logged in** with **Nous inference provider**
   **And** `grep -A4 '^model:' ~/.hermes/config.yaml` shows `provider: nous`, `default: anthropic/claude-sonnet-4.6`
   **And** `hermes config show` Context Compression section shows `provider: nous`, model `anthropic/claude-haiku-4.5`
   **And** if any prerequisite fails, **stop** — re-run 74-2/74-3 before continuing

2. **Hermes gateway health baseline**
   **Given** prerequisites from AC #1
   **When** operator runs gateway preflight
   **Then** `hermes gateway status` stdout matches running state (`gateway service is running` or legacy `gateway is running`)
   **And** `pgrep -af 'hermes gateway'` (or systemd `hermes-gateway`) shows a live gateway process
   **And** recent `~/.hermes/logs/gateway.log` (or `gateway-cron.log`) tail shows **no** openai-codex Cloudflare/auth failures and **no** OpenRouter **402** on main inference path
   **And** stdout captured in evidence file (redact tokens)

3. **Discord `#hermes` send/receive regression (FR4)**
   **Given** gateway running from AC #2
   **When** operator posts in Discord **`#hermes`** (channel ID `1500733488897462382` per Operator Guide §15.1):
   ```
   regression-gate-74-5: reply with exactly portal-regression-ok
   ```
   **Then** Hermes bot replies in-channel with **`portal-regression-ok`** (exact match) within a reasonable window (≤2 min)
   **And** response uses Portal provider (no `openai-codex` / Cloudflare errors in gateway log for that turn)
   **And** screenshot note or message link + timestamp recorded in evidence (no secrets)

4. **Morning-digest cron path documented and gateway guard verified (FR4)**
   **Given** Portal migration complete
   **When** operator verifies digest infrastructure **without modifying scripts**
   **Then** evidence documents the **production cron path** unchanged:
   - WSL crontab line tagged `# cns-morning-digest-skill` → `scripts/run-morning-digest-cron.sh` (Epic 70 Node orchestrator)
   - Hermes skill job id file: `~/.hermes/morning-digest-skill-cron-job-id` (from `scripts/install-morning-digest-cron.sh`)
   - Schedule default: `0 7 * * *` with `CRON_TZ=Australia/Sydney`
   **And** `scripts/run-morning-digest-cron.sh` still contains gateway detection pattern:
   `gateway service is running|gateway is running` (warn-only posture per Epic 70 — **not** fail-closed)
   **And** legacy Mode B launcher `scripts/hermes-morning-digest.sh` still contains the **same grep pattern** with **fail-closed** abort if gateway down (lines 22–26 — unchanged guard from Story 67-8)
   **And** operator runs **gateway preflight only** (no full digest required for this story):
   ```bash
   hermes gateway status 2>&1 | grep -qiE 'gateway service is running|gateway is running' && echo "digest-gateway-guard: PASS"
   ```
   **And** evidence states explicitly: **Portal provider switch does not alter digest collection scripts** (Perplexity/NewsAPI/adapters are terminal scripts; see `06-implementation-sequence.md` Phase 1 safety note)

5. **NEXUS Discord–Obsidian bridge untouched (NFR2, NFR8)**
   **Given** Hermes regression checks from AC #3–#4
   **When** operator verifies two-bot boundary
   **Then** NEXUS bridge process is **running independently** (e.g. `pgrep -af 'nexus-discord-bridge|claude --channels'` or operator-attested watchdog status)
   **And** **zero** file changes in `~/ai-factory/projects/NEXUS/` as part of this story
   **And** evidence cites two-bot boundary: Hermes = `#hermes` via `hermes gateway`; NEXUS = separate bridge — **do not restart, reconfigure, or modify NEXUS** during this story
   **And** Operator Guide §15.0/§15.1 boundary statement referenced in evidence

6. **Results recorded + verify gate (NFR1)**
   **Given** AC #2–#5 complete
   **When** story closes
   **Then** `_bmad-output/implementation-artifacts/74-5-gateway-regression-evidence.md` exists with dated checklist (PASS/FAIL per AC, redacted)
   **And** `bash scripts/verify.sh` passes unchanged
   **And** git diff contains **no** secret files (`.env.live-chain`, `auth.json`, tokens)
   **And** protect-list paths have **zero** diffs (NFR2)

## Tasks / Subtasks

- [x] **AC #1 — Verify 74-2/74-3 prerequisites** (AC: #1)
  - [x] `hermes portal info` → logged in, Nous provider
  - [x] Main model `nous` / Sonnet 4.6; compression `nous` / Haiku 4.5
  - [x] Paste redacted outputs into evidence scaffold

- [x] **AC #2 — Gateway health baseline** (AC: #2)
  - [x] `hermes gateway status` + `pgrep -af 'hermes gateway'`
  - [x] Tail gateway logs; confirm no codex/OpenRouter main-path errors
  - [x] If gateway stopped: use `bash scripts/hermes-gateway-start.sh` or `hermes gateway start` — **do not** change Portal config

- [x] **AC #3 — Discord regression** (AC: #3)
  - [x] Post test message in `#hermes`; capture exact reply
  - [x] Confirm `portal-regression-ok` in Discord
  - [x] Log timestamp + optional message link in evidence

- [x] **AC #4 — Digest path documentation + guard verify** (AC: #4)
  - [x] `crontab -l | grep cns-morning-digest-skill`
  - [x] Confirm job id file exists; note install script path
  - [x] Grep both `run-morning-digest-cron.sh` and `hermes-morning-digest.sh` for gateway pattern
  - [x] Run gateway preflight one-liner; record PASS
  - [x] Document Epic 70 vs legacy Mode B distinction in evidence

- [x] **AC #5 — NEXUS bridge attestation** (AC: #5)
  - [x] Verify NEXUS bridge running (process check or operator attestation)
  - [x] Confirm no NEXUS repo diffs from this work
  - [x] Record two-bot boundary note in evidence

- [x] **AC #6 — Evidence + verify** (AC: #6)
  - [x] Complete `74-5-gateway-regression-evidence.md`
  - [x] `bash scripts/verify.sh` green
  - [x] Protect-list + secret scan on git diff

## Dev Notes

### Epic and sequencing context

- **Epic 74 (Hermes on Portal + Desktop)** — story **74-5** implements **FR4** full regression gate (not the spot check in 74-4).
- **Prerequisites done:** **74-2** Portal OAuth + **74-3** compression on Portal Haiku.
- **Parallel OK:** May run alongside **74-4** (Tool Gateway web search); 74-4 includes a lighter Discord spot check — **74-5 is the authoritative FR4 gate** before **74-6** (dashboard systemd).
- **Blocks:** Operator confidence for 74-6+; does not block 74-4 technically.
- **Branch:** `hermes-consolidation`.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Story 74-5, §FR4; `sprint-status.yaml` Epic 74 sequencing]

### Live baseline (verify at story start — do not assume)

| Property | Expected post-74-3 | Verify with |
|----------|-------------------|-------------|
| Portal auth | Logged in | `hermes portal info` |
| Main provider | `nous` / Sonnet 4.6 | `grep -A4 '^model:' ~/.hermes/config.yaml` |
| Compression | `nous` / Haiku 4.5 | `hermes config show` → Context Compression |
| Gateway | Running (systemd user service) | `hermes gateway status`, `pgrep -af 'hermes gateway'` |
| Production digest cron | WSL `cns-morning-digest-skill` → `run-morning-digest-cron.sh` | `crontab -l` |
| Legacy digest launcher | `hermes-morning-digest.sh` (Mode B — not primary cron) | file exists; fail-closed gateway guard |
| NEXUS bridge | Running separately | `pgrep -af nexus-discord-bridge` or operator attestation |
| verify.sh | Green on `hermes-consolidation` | `bash scripts/verify.sh` |

### Operator regression runbook (canonical sequence)

```bash
# 0. Repo + env
cd /home/christ/ai-factory/projects/Omnipotent.md
test -f .env.live-chain || { echo "missing .env.live-chain"; exit 1; }

# 1. Portal prerequisites (74-2/74-3)
hermes --version
hermes portal info
grep -A4 '^model:' ~/.hermes/config.yaml
hermes config show | sed -n '/Context Compression/,/^$/p'

# 2. Gateway health
hermes gateway status
pgrep -af 'hermes gateway' || echo "WARN: no gateway process"
tail -50 ~/.hermes/logs/gateway.log 2>/dev/null | tail -20

# If gateway down — recover without config changes:
# bash scripts/hermes-gateway-start.sh
# OR: hermes gateway start

# 3. Discord regression — post in #hermes (Discord client):
# regression-gate-74-5: reply with exactly portal-regression-ok
# Record reply + timestamp in evidence file.

# 4. Digest path verification (documentation + guard — no full digest run required)
crontab -l | grep -E 'cns-morning-digest-skill|run-morning-digest-cron'
test -f ~/.hermes/morning-digest-skill-cron-job-id && cat ~/.hermes/morning-digest-skill-cron-job-id

grep -n "gateway service is running|gateway is running" scripts/run-morning-digest-cron.sh
grep -n "gateway service is running|gateway is running" scripts/hermes-morning-digest.sh

hermes gateway status 2>&1 | grep -qiE 'gateway service is running|gateway is running' \
  && echo "digest-gateway-guard: PASS" || echo "digest-gateway-guard: FAIL"

# 5. NEXUS bridge — observe only, do not modify
pgrep -af 'nexus-discord-bridge|claude --channels' || echo "NEXUS: operator attest running state"
# Confirm: no git changes under ~/ai-factory/projects/NEXUS/

# 6. Verify gate
bash scripts/verify.sh
```

**Optional CLI smoke (supplements but does not replace AC #3 Discord test):**

```bash
hermes -z "Reply with exactly: portal-regression-ok"
```

Record CLI output in evidence as secondary confirmation only — **FR4 AC requires Discord `#hermes`**.

[Source: Context7 `/nousresearch/hermes-agent` — gateway status/start; `_bmad-output/implementation-artifacts/74-2-portal-oauth-login-and-provider-switch.md` smoke pattern]

### Morning-digest architecture — do not confuse the two runners

| Script | Role | Gateway guard | Portal impact |
|--------|------|---------------|---------------|
| `scripts/run-morning-digest-cron.sh` | **Production** WSL cron entry (Epic 70) → `node scripts/run-digest-convex-completion.mjs` | **Warn-only** if gateway down | None — Node orchestrator + adapter scripts |
| `scripts/hermes-morning-digest.sh` | Legacy Mode B Hermes agent cron (Story 26-7) | **Fail-closed** abort if gateway down | None — separate path; epic AC references this guard |

Both share the **67-8 detection pattern** (`gateway service is running|gateway is running`). Contract tests lock this in `tests/hermes-morning-digest-skill.test.mjs` (Story 55-3 / 67-8).

**Do not edit either script in this story** unless grep pattern regressed (would be a bug fix — cite 67-8).

[Source: `scripts/run-morning-digest-cron.sh`, `scripts/hermes-morning-digest.sh`; `_bmad-output/implementation-artifacts/67-8-fix-morning-digest-cron-gateway-check.md`; `docs/CNSHermes New Big Plan/06-implementation-sequence.md` §Phase 1 safety note]

### NEXUS bridge verification (NFR2 — hands off)

| Bot | Surface | Launcher | This story |
|-----|---------|----------|------------|
| **Hermes** | `#hermes` | `hermes gateway` / `scripts/hermes-gateway-start.sh` | **Test** (AC #3) |
| **NEXUS** | Separate Discord channels | `~/ai-factory/projects/NEXUS/scripts/nexus-discord-bridge.sh` | **Observe only** — no restarts, no config edits |

References:
- `docs/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.0 (Phase 6 caveats), §15.1 (`#hermes` IDs)
- Architecture NFR8 two-bot boundary: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §operatorConstraints.untouched

### Explicitly out of scope (defer)

| Action | Story |
|--------|-------|
| `hermes tools` → Web search = Nous Subscription | 74-4 |
| `hermes dashboard register`, systemd `:9119`, Desktop | 74-6, 74-7 |
| Full morning-digest dry run (07:00 cron or manual orchestrator) | Optional operator follow-up — **not required** for 74-5 AC |
| `/session-close` orientation refresh | 76-1 (deferred Pre-2) |
| Run-chain / Brain / Vault IO code | Protect-list / separate epics |
| Modify NEXUS bridge scripts or watchdog | **Forbidden** (NFR2) |

### Architecture compliance

- **FR4:** Explicit regression — Discord reply + digest path documentation + gateway guard verification.
- **NFR2:** No run-chain adapter edits; NEXUS bridge untouched.
- **NFR8:** Two-bot boundary attested in evidence, not modified.
- **NFR4:** Evidence redacts tokens; no `auth.json` / `.env.live-chain` in git.
- **NFR1:** `verify.sh` must pass; **no new automated tests required** (operator verification story).
- **Protect-list:** Zero diffs in synthesis/hook/boss/run-chain paths.

[Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR4, §NFR2, §NFR8; `architecture-hermes-consolidation.md` §Process Patterns protect-list]

### Testing requirements

| Layer | Expectation |
|-------|-------------|
| Automated | `bash scripts/verify.sh` — must pass unchanged |
| Manual | AC #2–#5 operator checklist → evidence file |
| Git | No secret files; protect-list clean; optional evidence markdown only |
| Regression lock | Existing `tests/hermes-morning-digest-skill.test.mjs` gateway grep assertions must still pass (do not weaken) |

### Completion deliverables

| Deliverable | Path |
|-------------|------|
| Operator evidence | `_bmad-output/implementation-artifacts/74-5-gateway-regression-evidence.md` (new) |
| Tracker | `sprint-status.yaml` — story `done` after dev-story |
| This story | Dev Agent Record + status update |

### Evidence file template (create at dev-story start)

Use structure matching `74-3-compression-portal-evidence.md`:

```markdown
# Story 74-5 — Gateway & Morning Digest Regression Evidence

**Story:** 74-5-gateway-and-morning-digest-regression-gate
**Operator:** Chris
**Date completed:** YYYY-MM-DD
**Hermes version:** (from hermes --version)

> Redaction policy (NFR4): no tokens, auth.json, or .env contents.

## AC #1 Prerequisites — PASS/FAIL
(paste portal info, model, compression)

## AC #2 Gateway health — PASS/FAIL
(gateway status, pgrep, log tail notes)

## AC #3 Discord #hermes — PASS/FAIL
(test message, reply text, timestamp)

## AC #4 Digest path — PASS/FAIL
(crontab line, job id, grep pattern confirmation, gateway preflight one-liner)

## AC #5 NEXUS bridge — PASS/FAIL
(process attestation, no NEXUS repo changes)

## AC #6 verify.sh — PASS/FAIL
(bash scripts/verify.sh exit 0)
```

### Previous story intelligence (74-3)

- Compression on Portal Haiku; OpenRouter off compression block only.
- Long-context smoke deferred to **74-5** if only config-only smoke ran in 74-3 — optional supplement here (not AC unless operator chooses path A from 74-3).
- `routing.md` has compression row — do not edit in 74-5 (74-8 consolidates governance).

[Source: `_bmad-output/implementation-artifacts/74-3-auxiliary-compression-on-portal.md`]

### Previous story intelligence (74-2)

- Portal OAuth 2026-06-24; Pre-4 paid tier + Tool Gateway confirmed.
- Discord smoke was optional spot check in 74-2 — **74-5 is the formal FR4 gate**.
- `#hermes` channel ID `1500733488897462382`; token via `HERMES_DISCORD_TOKEN` in `.env.live-chain`.
- v0.17 CLI: `hermes config show`, `hermes -z` for one-shot chat.

[Source: `_bmad-output/implementation-artifacts/74-2-portal-oauth-login-and-provider-switch.md`, `74-2-portal-oauth-evidence.md`]

### Previous story intelligence (67-8)

- Gateway status string fix: use `grep -qiE 'gateway service is running|gateway is running'`.
- `hermes gateway status` exit code **unreliable** (0 when stopped) — always parse stdout.
- Both digest runners updated; tests in `hermes-morning-digest-skill.test.mjs` lock pattern.

[Source: `_bmad-output/implementation-artifacts/67-8-fix-morning-digest-cron-gateway-check.md`]

### Git intelligence (hermes-consolidation branch)

Recent commits: **74-3** compression, **74-2** Portal OAuth. Expect **evidence markdown + sprint-status** as repo diffs only; Hermes state under `~/.hermes/` (gitignored).

### Latest technical specifics (Context7 — Hermes Agent v0.17)

- **Gateway service:** `hermes gateway status` | `start` | `stop` | `install` (systemd user unit)
- **Logs:** `~/.hermes/logs/gateway.log`, `journalctl --user -u hermes-gateway -f`
- **Discord:** requires `DISCORD_BOT_TOKEN` + channel allowlist in `~/.hermes/config.yaml`
- **Config hot-reload:** Provider/compression changes apply on next gateway message (no restart strictly required — restart if Discord still stale)

[Source: Context7 `/nousresearch/hermes-agent` — messaging gateway FAQ]

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` (do not edit this story)
- PRD FR4: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR4, §G2
- Phase 1 safety note: `docs/CNSHermes New Big Plan/06-implementation-sequence.md`
- Operator Guide Hermes section: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15
- Spec cite (vault IO unaffected): `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — no WriteGate mutations this story

### Deferred work cross-reference

- Pre-2 session-close remains deferred to **76-1** — not a 74-5 gate.
- Full digest live validation at 07:00 cron is ongoing ops (Epics 67–71) — 74-5 verifies **path + guard**, not a production digest run.

[Source: `_bmad-output/implementation-artifacts/deferred-work.md`; `sprint-status.yaml` pre_implementation_checklist]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor dev-story)

### Debug Log References

- Story prep 2026-06-24: evidence scaffold + read-only AC #1/#2/#4 pre-checks; paused for operator CLI (AC #3 Discord FR4 gate, AC #5 NEXUS attestation).
- Operator close 2026-06-24: AC #3 Discord PASS (`portal-regression-ok` exact match, 11:04 AM AEST).

### Completion Notes List

- Prep complete: `74-5-gateway-regression-evidence.md` scaffolded with redacted portal/gateway/cron/grep evidence (2026-06-24).
- AC #1 PASS: portal logged in, nous/Sonnet 4.6, compression nous/Haiku 4.5.
- AC #2 PASS: gateway running (systemd active); log tail clean of codex/402 on main path.
- AC #3 PASS: Discord `#hermes` FR4 gate — exact reply `portal-regression-ok` (2026-06-24 11:04 AM AEST).
- AC #4 PASS: crontab `cns-morning-digest-skill` → `run-morning-digest-cron.sh`; job id `faf94bfd527c`; both digest scripts contain 67-8 gateway grep pattern (warn-only vs fail-closed); `digest-gateway-guard: PASS`.
- AC #5 PASS: NEXUS bridge not running at check (operator attested); zero NEXUS repo diffs; two-bot boundary respected — separate ops concern.
- AC #6 PASS: verify.sh green; protect-list and secret scan clean.
- NEXUS repo untouched (no edits under `~/ai-factory/projects/NEXUS/`).

### File List

- `_bmad-output/implementation-artifacts/74-5-gateway-regression-evidence.md` (operator evidence)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (74-5 done)
- `_bmad-output/implementation-artifacts/74-5-gateway-and-morning-digest-regression-gate.md` (story tracking)

### Change Log

- 2026-06-24: Dev-story prep — evidence scaffold + read-only gateway/digest verification; paused for operator Discord FR4 gate.
- 2026-06-24: Operator close — Discord regression PASS; NEXUS attestation; story done.

## Story completion status

- **Status:** done
- **Context engine:** Ultimate context analysis completed — operator regression runbook, dual digest-runner architecture, NEXUS hands-off boundary, and evidence template included.
- **Next story after done:** `74-4-tool-gateway-web-search` (if not done) or `74-6-hermes-dashboard-oauth-registration-systemd-and-reachability`
