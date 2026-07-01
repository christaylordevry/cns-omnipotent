---
baseline_commit: c7bc0292a716160a9cd6f702de4dd2b642aedbae
branch: hermes-consolidation
---

# Story 82.6: Voice-pane cold-turn embedder warm-keep + prefetch budget headroom

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As an **operator using Local Nexus voice (first PTT turn after idle)**,
I want **brain-recall prefetch to complete within the voice budget so the first turn writes a recall-status sidecar and VoiceDrawer shows `voice_pane`**,
so that **cold Portal embedder latency does not fail-open the plugin and degrade the chip when 82-5 already fixed PATH/env parity**.

**Zone/Repo:** Omnipotent.md (`config/brain-recall-policy.json`, warm-keep scripts, install scripts) → WSL `~/.hermes` (timer/cron, optional systemd drop-in) · **Branch:** `hermes-consolidation`

## Problem (verified 2026-06-30 — build on this, do not re-investigate)

Story **82-5** closed the dashboard **env/PATH** gap: prefetch subprocess launches, toolchain resolves, dashboard `CNS_*` vars present. **First voice turn still fail-opens** when the Portal embedder path is cold.

| Measurement | Value | Source |
|-------------|-------|--------|
| Voice prefetch **COLD** (live index + portal embedder via `hermes-proxy :8645`) | **4.95s** | Operator timed 2026-06-30 |
| Voice prefetch **WARM** (same stack) | **2.10s** | Operator timed 2026-06-30 |
| Policy `prefetch.voice_pane_timeout_seconds` | **3** | `config/brain-recall-policy.json` (no env override) |
| Standard `prefetch.timeout_seconds` | **5** | Same policy file |

**Failure chain (cold first turn):**

1. Voice turn → `pre_llm_call` → `cns-brain-recall` → `_run_prefetch` with `voice_pane` timeout (**3s**).
2. Prefetch → `buildRecallInjection` → `queryBrainIndex` → **PortalEmbedder** `POST http://127.0.0.1:8645/v1/embeddings`.
3. Cold embedder + index query **4.95s** > **3s** → `subprocess.TimeoutExpired` → plugin **fail-open** `{}`.
4. No `~/.hermes/recall-status/<sid>.json` → VoiceDrawer `GET /api/nexus/hermes/recall-status` → 404 → heuristic **`degraded`** chip (82-4 ground-truth path never reached).

**Root cause:** cold **embedding latency**, not env. Warm turn (2.10s) fits 3s budget with **~0.9s margin** — thin; any jitter re-triggers fail-open.

**Out of scope:** Re-opening 82-5 PATH/env work; protect-list adapters; Hermes core fork; VoiceDrawer UI changes (chip works once sidecar exists).

## Acceptance Criteria

### AC1 — Embedder warm-keep (config-gated, reversible, zero cost when voice unused)

**Given** `config/brain-recall-policy.json` gains a `embedder_warm_keep` block (or equivalent policy keys) defaulting **`enabled: false`**
**When** operator enables warm-keep via committed install script (mirrors 82-5 `install-hermes-brain-recall-env.sh` pattern)
**Then** a **lightweight** mechanism keeps the Portal embedder stack warm so typical voice prefetch stays under budget:

| Mechanism | Requirement |
|-----------|-------------|
| **Periodic warm ping** | Committed `scripts/run-brain-embedder-warm.sh` (+ `install-brain-embedder-warm-cron.sh` or systemd user timer) POSTs minimal embedding to `CNS_BRAIN_EMBED_BASE_URL` (default `http://127.0.0.1:8645/v1`) using same model/env as production (`CNS_BRAIN_EMBED_MODEL`, `brain-recall.env`) |
| **Dashboard startup warm-up** (optional second layer) | On `hermes-dashboard.service` start, **one** non-blocking warm ping (e.g. `ExecStartPost=` drop-in installed by script) **only when** `embedder_warm_keep.warm_on_dashboard_start` is true |
| **Config gate** | When `enabled: false`, install script does **not** register cron/timer; dashboard drop-in absent or no-op |
| **Cost control** | Ping uses fixed minimal input (e.g. `"warm"`), interval ≥ policy default (propose **10–15 min**), logs to `~/.hermes/logs/brain-embedder-warm.log`; no vault reads, no index rebuild |
| **Reversibility (NFR5)** | Disable = set `enabled: false` + run uninstall section of install script (remove crontab tag / disable timer / remove drop-in) |

**And** warm ping **requires** `hermes-proxy.service` reachable (or exits 0 with logged skip if proxy down — must not spam errors)
**And** no secrets committed; operator env from `~/.hermes/brain-recall.env` (+ existing embed model vars)

### AC2 — Budget headroom (voice timeout bump without slowing standard turns)

**Given** warm-keep (AC1) reduces cold-first-turn frequency but does not eliminate it
**When** policy is updated
**Then** `prefetch.voice_pane_timeout_seconds` is raised to **6** (operator true-cold 4.95s + ~1s margin; AC1 remains required for reliable cold-first)
**And** `prefetch.timeout_seconds` for **standard_text** stays **5** (unchanged — standard turns must not get slower)
**And** plugin `plugin.py` continues reading timeouts from policy + optional env overrides (`CNS_BRAIN_RECALL_VOICE_PREFETCH_TIMEOUT_S`) — no hardcode drift
**And** `references/config-snippet.md` documents latency trade-off: voice turn may block LLM up to new budget before fail-open; standard unchanged

**Policy rationale table (include in evidence):**

| Scenario | Timeout | Expected prefetch | Outcome |
|----------|---------|-------------------|---------|
| Warm voice | 6s | ~2.1s | Sidecar + inject |
| Cold voice (no warm-keep) | 6s | ~4.95s | Borderline — warm-keep required for reliability |
| Cold voice + warm-keep | 6s | ~2.1s | Reliable first turn |
| Standard text | 5s | (unchanged) | No regression |

### AC3 — Evidence: timed prefetch + sidecar + live PTT chip

**Given** AC1 enabled + AC2 applied + dashboard restarted
**When** operator (or dev evidence script) runs **timed** voice-channel prefetch twice:

```bash
# COLD: restart hermes-proxy OR wait >15m since last embed; then:
/usr/bin/time -f '%e' npm run brain:recall-prefetch -- \
  --query "<voice-smoke-anchor>" --recall-channel voice_pane

# WARM: repeat same command immediately
```

**Then** both complete **exit 0** within **voice_pane_timeout_seconds** with JSON `channel=voice_pane`, non-empty `context` (policy `shadow_mode: false`)
**And** simulated or live dashboard voice turn writes `~/.hermes/recall-status/<session_id>.json` with `channel=voice_pane`, `injected=true`
**And** operator validation remains as the live PTT gate: one **live PTT** on `localhost:5173/nexus` should show VoiceDrawer budget chip **`voice_pane`** (not `degraded`) on the **first** turn after cold proxy (document proxy restart procedure in evidence)
**And** evidence file `_bmad-output/implementation-artifacts/82-6-voice-pane-cold-turn-evidence.md` records cold/warm seconds, timeout policy version, warm-keep config, redacted env keys only

### AC4 — Tests + verify gate + protect-list

**Given** implementation complete
**Then** unit tests cover: warm-ping script success/skip-when-disabled; policy parse for new keys; voice timeout default **6** in policy test fixtures
**And** `bash scripts/verify.sh` passes (ignore pre-existing session-close parity drift)
**And** zero edits to: `src/agents/synthesis-adapter-llm.ts`, `hook-adapter-llm.ts`, `boss-adapter-llm.ts`, `run-chain.ts`, `scripts/run-chain.ts`, `~/.hermes/hermes-agent/**`
**And** Context7 consulted on `/nousresearch/hermes-agent` for `hermes proxy start`, subscription proxy embeddings path, and timer/cron patterns **before** implementing warm-keep or systemd hooks
**And** one logical commit

## Tasks / Subtasks

- [x] **Policy + documentation** (AC: 2)
  - [x] Add `embedder_warm_keep` block to `config/brain-recall-policy.json` (`enabled`, `ping_interval_minutes`, `warm_on_dashboard_start`)
  - [x] Bump `prefetch.voice_pane_timeout_seconds` to `6` (operator true-cold 4.95s + margin); document trade-off in `config-snippet.md`

- [x] **Warm-ping CLI** (AC: 1)
  - [x] Add `scripts/brain-embedder-warm.mjs` → thin TS (`src/brain/embedder-warm-cli.ts`) reusing `resolveBrainEmbedder()` + single minimal `embed()` call
  - [x] Read warm-keep policy from repo policy file; exit 0 fast when `enabled: false`

- [x] **Install / operator wiring** (AC: 1, 4)
  - [x] Add `scripts/run-brain-embedder-warm.sh` (NVM PATH + source `brain-recall.env`, mirror `run-awareness-pull-cron.sh`)
  - [x] Add `scripts/install-brain-embedder-warm-cron.sh` — idempotent crontab tag `cns-brain-embedder-warm` **or** systemd user timer+service (document choice; prefer same crontab idiom as awareness-pull unless operator prefers timer)
  - [x] Extend `install-hermes-brain-recall-env.sh` (or sibling) to optionally install `hermes-dashboard.service.d/embedder-warm-post.conf` with `ExecStartPost=` when `warm_on_dashboard_start` enabled
  - [x] Uninstall/disable path documented in install script header

- [x] **Tests** (AC: 4)
  - [x] `tests/brain/embedder-warm.test.ts` — stub embedder mode, policy gate, mock fetch for portal ping
  - [x] Update `tests/hermes/cns-brain-recall-plugin.test.ts` if policy timeout fixtures assert 3s → 6s for voice (no fixture change required — plugin reads live policy)

- [x] **Evidence** (AC: 3)
  - [x] Run cold/warm timed prefetch; document accepted operator live PTT validation gate; write `82-6-voice-pane-cold-turn-evidence.md`

- [x] **Verify + commit** (AC: 4)
  - [x] `npm test` 766 pass; `verify.sh` blocked only by pre-existing session-close parity drift

### Review Findings

- [x] [Review][Decision] Live PTT chip evidence is missing: accepted as operator validation gate; story and evidence now state dev did not run live PTT in this pass.
- [x] [Review][Patch] Dashboard warm-up is synchronous despite non-blocking wording [`scripts/install-brain-embedder-warm-cron.sh:74`]
- [x] [Review][Patch] Warm runner can skip exit logging and propagate non-zero to cron [`scripts/run-brain-embedder-warm.sh:27`]
- [x] [Review][Patch] NVM discovery can abort before PATH fallback when no NVM node directory exists [`scripts/run-brain-embedder-warm.sh:9`]
- [x] [Review][Patch] Installer accepts cron intervals that can produce invalid minute syntax [`scripts/install-brain-embedder-warm-cron.sh:98`]
- [x] [Review][Patch] Voice timeout acceptance text still describes 5s while implementation and evidence use 6s [`_bmad-output/implementation-artifacts/82-6-voice-pane-cold-turn-embedder-warm-keep.md:67`]

## Dev Notes

### Verified facts — DO NOT REBUILD

| Fact | Source | Dev rule |
|------|--------|----------|
| 82-5 env fix done | `82-5-brain-recall-prefetch-bare-path-evidence.md` | Do not re-fix PATH/npx |
| Cold 4.95s / warm 2.10s | Operator measurement 2026-06-30 | Use as acceptance targets |
| Voice timeout 3s | `config/brain-recall-policy.json` + `plugin.py:_prefetch_timeout_s` | Bump in policy, not plugin hardcode |
| Fail-open on timeout | `plugin.py:210-217` | Prefetch must finish < timeout |
| Portal embed URL | `resolve-embedder.ts` → `http://127.0.0.1:8645/v1` | Warm ping hits same endpoint |
| Proxy service | `hermes-proxy.service` on :8645 | Warm-keep depends on proxy up |
| Sidecar path | `{HERMES_HOME}/recall-status/{session_id}.json` | 82-4 — chip reads this |
| Plugin reads policy from repo | `_load_prefetch_timeouts()` uses `CNS_OMNIPOTENT_ROOT/config/brain-recall-policy.json` | Policy commit = behavior change |

### Recommended implementation

**AC1 — Warm ping (minimal):**

```typescript
// src/brain/embedder-warm-cli.ts — pseudo
const policy = await loadBrainRecallPolicyFromRepo(repoRoot);
if (!policy.embedder_warm_keep?.enabled) process.exit(0);
const embedder = resolveBrainEmbedder(); // portal when CNS_BRAIN_EMBEDDER=portal
await embedder.embed("warm"); // single minimal vector request
```

**Cron pattern** — copy `scripts/run-awareness-pull-cron.sh`:
- NVM `sort -V` bin on PATH
- `source ~/.hermes/brain-recall.env`
- `node scripts/brain-embedder-warm.mjs`
- Crontab tag: `cns-brain-embedder-warm` every `${ping_interval_minutes}` (default 10)

**Dashboard ExecStartPost** (optional, config-gated):

```ini
# ~/.config/systemd/user/hermes-dashboard.service.d/embedder-warm-post.conf
[Service]
ExecStartPost=/bin/bash -c 'if test -x %h/ai-factory/projects/Omnipotent.md/scripts/run-brain-embedder-warm.sh; then nohup %h/ai-factory/projects/Omnipotent.md/scripts/run-brain-embedder-warm.sh >/dev/null 2>&1 & fi'
```

Install script must use **operator-resolved** `CNS_OMNIPOTENT_ROOT` from `brain-recall.env`, not hardcoded path. `Type=oneshot` not required for Post — must not block dashboard bind >30s; warm script should use short embed timeout (e.g. 10s).

**AC2 — Policy bump:**

```json
"prefetch": {
  "timeout_seconds": 5,
  "voice_pane_timeout_seconds": 6
},
"embedder_warm_keep": {
  "enabled": false,
  "ping_interval_minutes": 10,
  "warm_on_dashboard_start": true
}
```

Operator enables after install: set `enabled: true` in policy (or env `CNS_BRAIN_EMBEDDER_WARM_KEEP=1` if dev adds override — prefer policy-only per FR19).

### Architecture compliance

| ADR / spec | Relevance |
|------------|-----------|
| ADR-HERMES-015 | Plugin subprocess contract unchanged; only prefetch duration + embedder latency |
| FR18 `voice_pane` | Channel budget + timeout are policy-tunable |
| FR19 | Policy numbers in config — calibrate/document, not PRD-hardcoded |
| NFR5 | Warm-keep fully disable-able; no vault mutation |
| Epic 82 FR10 | First-turn voice recall reliability |

### File structure requirements

| File | Action |
|------|--------|
| `config/brain-recall-policy.json` | **UPDATE** — `voice_pane_timeout_seconds`, `embedder_warm_keep` |
| `src/brain/embedder-warm-cli.ts` | **NEW** |
| `scripts/brain-embedder-warm.mjs` | **NEW** |
| `scripts/run-brain-embedder-warm.sh` | **NEW** |
| `scripts/install-brain-embedder-warm-cron.sh` | **NEW** |
| `scripts/install-hermes-brain-recall-env.sh` | **UPDATE** (optional) — dashboard warm Post drop-in |
| `scripts/hermes-plugin-examples/cns-brain-recall/references/config-snippet.md` | **UPDATE** — warm-keep + timeout docs |
| `tests/brain/embedder-warm.test.ts` | **NEW** |
| `tests/hermes/cns-brain-recall-plugin.test.ts` | **UPDATE** if timeout assertions |
| `_bmad-output/implementation-artifacts/82-6-voice-pane-cold-turn-evidence.md` | **NEW** (evidence) |

**Do NOT modify:** protect-list adapters; Hermes core; cns-dashboard (unless future story — warm-up is WSL-side).

### Previous story intelligence

**82-5 (in-progress / env closed):**
- Dashboard has `brain-recall.conf` + `env.conf`; prefetch runs under correct `CNS_*`
- Evidence noted **3s voice timeout** on live portal embedder — explicitly deferred to this story
- Install script idiom: `install-hermes-brain-recall-env.sh`, no secrets in git

**82-4 (done):**
- Sidecar + VoiceDrawer ground-truth chip — **downstream** of prefetch success
- Fail-open → no sidecar → false `degraded`

**79-5 (done):**
- Prefetch timeouts: 5s standard / 3s voice — voice bump is policy-only change
- Env overrides: `CNS_BRAIN_RECALL_VOICE_PREFETCH_TIMEOUT_S`

**67-11 / awareness-pull cron (done):**
- `run-awareness-pull-cron.sh` — NVM PATH + source `~/.hermes/*.env` — **reuse for warm cron**

### Context7 — Hermes Agent (required before implement)

**Library:** `/nousresearch/hermes-agent`

| Finding | Implication |
|---------|-------------|
| `hermes proxy start` listens `http://127.0.0.1:8645/v1` | Warm ping target; `hermes proxy status` optional health pre-check |
| Subscription proxy forwards `/embeddings` with operator credential | Bearer token in client can be dummy; proxy attaches real JWT |
| `hermes proxy start --host 0.0.0.0 --port 8645` | Match live `hermes-proxy.service` unit |
| systemd timer pattern exists in Hermes docs (Teams pipeline) | Acceptable alternative to crontab for periodic warm |
| `HERMES_API_TIMEOUT` is LLM API timeout, **not** prefetch subprocess | Do not conflate with `voice_pane_timeout_seconds` |

### Testing requirements

1. **Policy gate:** warm CLI exits 0 immediately when `embedder_warm_keep.enabled: false` (no network)
2. **Stub embedder:** warm CLI calls embed once when enabled + `CNS_BRAIN_EMBEDDER=stub`
3. **Portal mock:** fetch mock receives POST `/embeddings` with minimal input
4. **Timeout regression:** plugin test still loads voice timeout from policy (updated to 6)
5. **Never** hit live Portal in unit tests

### Verify gate

```bash
cd /home/christ/ai-factory/projects/Omnipotent.md
git checkout hermes-consolidation
bash scripts/verify.sh
```

### Live validation commands (evidence)

```bash
# Proxy cold reset (operator)
systemctl --user restart hermes-proxy.service
sleep 2

# Timed prefetch (voice channel)
/usr/bin/time -f 'elapsed=%e' npm run brain:recall-prefetch -- \
  --query "CNS daily rhythm" --recall-channel voice_pane

# Enable warm-keep + install cron
# edit config/brain-recall-policy.json embedder_warm_keep.enabled → true
bash scripts/install-brain-embedder-warm-cron.sh
bash scripts/run-brain-embedder-warm.sh

# After voice PTT
jq '{channel,injected,shadow}' ~/.hermes/recall-status/<session_id>.json
```

### Commit instruction template

```
cd /home/christ/ai-factory/projects/Omnipotent.md
git checkout hermes-consolidation
bash scripts/verify.sh && git commit -m "fix(voice-recall): embedder warm-keep + voice prefetch budget headroom"
```

### References

- [Source: `config/brain-recall-policy.json` — `prefetch.voice_pane_timeout_seconds`]
- [Source: `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py:84-108,152-158,200-217`]
- [Source: `src/brain/resolve-embedder.ts` — `DEFAULT_PORTAL_EMBED_BASE_URL`]
- [Source: `src/brain/embedder-portal.ts` — `POST .../embeddings`]
- [Source: `src/brain/recall-prefetch-cli.ts` — prefetch → `buildRecallInjection`]
- [Source: `_bmad-output/implementation-artifacts/82-5-brain-recall-prefetch-bare-path-evidence.md` §AC5 timeout note]
- [Source: `_bmad-output/implementation-artifacts/82-4-spike-omni-003-voice-recall-status-ground-truth.md`]
- [Source: `scripts/run-awareness-pull-cron.sh` — cron env pattern]
- [Source: `HANDOFF-2026-06-28-session8-hermes-consolidation.md` — `hermes-proxy.service`]
- [Source: Context7 `/nousresearch/hermes-agent` — subscription proxy, `hermes proxy start`]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- True-cold ≥3× measurement before budget lock: 3.51s, 2.71s, 2.73s; operator prior 4.95s → chose **6s** voice budget
- Post-impl cold/warm: 4.30s / 1.65s

### Completion Notes List

- **AC1:** `embedder_warm_keep` policy block (default disabled), `embedder-warm-cli.ts`, cron runner + install script with uninstall path; dashboard `ExecStartPost` via install script when enabled
- **AC2:** `voice_pane_timeout_seconds` **6** (not 5) per operator true-cold 4.95s + margin; standard timeout stays 5
- **AC3:** Evidence in `82-6-voice-pane-cold-turn-evidence.md`; live PTT chip left for operator (plugin sidecar path covered by existing tests)
- **AC4:** `tests/brain/embedder-warm.test.ts` added; `npm test` 766 pass; `verify.sh` fails only on pre-existing session-close skill parity drift

### File List

- `config/brain-recall-policy.json` (modified)
- `src/brain/recall-policy.ts` (modified)
- `src/brain/embedder-warm-cli.ts` (new)
- `scripts/brain-embedder-warm.mjs` (new)
- `scripts/run-brain-embedder-warm.sh` (new)
- `scripts/install-brain-embedder-warm-cron.sh` (new)
- `scripts/install-hermes-brain-recall-env.sh` (modified)
- `scripts/hermes-plugin-examples/cns-brain-recall/references/config-snippet.md` (modified)
- `tests/brain/embedder-warm.test.ts` (new)
- `_bmad-output/implementation-artifacts/82-6-voice-pane-cold-turn-evidence.md` (new)

### Change Log

- 2026-06-30: Story created — cold embed 4.95s vs 3s voice budget; dual-layer fix (warm-keep + 6s voice timeout); builds on 82-5 env closure.
- 2026-06-30: Implemented warm-keep CLI + install wiring; voice budget **6s** after true-cold measurement; policy 0.2.1; evidence recorded.
