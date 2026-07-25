---
baseline_commit: 2e4e056
---

# Story 82.4: SPIKE-OMNI-003 — Voice recall-status ground truth (degraded-chip fix)

Status: done

**Spike ID:** SPIKE-OMNI-003  
**Epic:** 82 — Local Nexus JARVIS Voice (Hermes Omniscient Phase D)  
**Zone/Repo:** Omnipotent.md (plugin sidecar) + cns-dashboard (proxy endpoint + VoiceDrawer chip)  
**Branch:** Omnipotent.md `hermes-consolidation` · cns-dashboard `master`  
**Working dirs:** `/home/christ/ai-factory/projects/Omnipotent.md` · `/home/christ/ai-factory/projects/cns-dashboard`

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As an **operator using Local Nexus voice**,
I want **the VoiceDrawer budget chip to reflect the actual recall pipeline outcome (resolved channel + whether vault context was injected)**,
so that **I am not misled by false-positive "degraded" states when recall worked but the assistant reply omitted visible citation strings (live smoke 2026-06-29 on 82-3)**.

## Problem (verified — do not re-derive)

| Layer | Current behavior | Failure |
|-------|------------------|---------|
| `src/lib/client/voice-budget-status.ts` (cns-dashboard) | `evaluateVoiceBudgetStatus` flags `degraded` when reply **>80 chars** and **no** vault-citation regex match | False-positives on most valid answers — recall may inject context the model does not echo as `[[wikilink]]` / `Knowledge-Vault` / `vault/` paths |
| `cns-brain-recall` plugin (`recall_hook` → `_run_prefetch`) | Already computes ground truth: `{ channel, citations, shadow, context }` | Only logs `channel`/`citations`; **never reaches the browser** |
| Hermes `PluginContext` | `pre_llm_call` hook may return **`{"context": ...}` only** | **No** client-event / WS-emit / broadcast API; `inject_message()` is CLI-only (no-op in gateway mode) |

**Locked constraint (session 9 source verification):** Emitting a `recall.injected` WS event from the plugin **requires forking `~/.hermes/hermes-agent/**`** — **PROHIBITED**. WS-event transport is **OFF THE TABLE**. This story must use a **non-core side channel**.

Reference: `HANDOFF-2026-06-29-session9-hermes-consolidation.md` §6; Story 82-3 D2 "Future hook" note.

## Acceptance Criteria

### AC0 — Spike gate (resolve transport before feature code)

**Given** WS-event transport is ruled out  
**When** dev begins implementation  
**Then** spike validates the recommended sidecar design **or** documents a superior non-core alternative with tradeoff table  
**And** spike notes explicitly address blockers:
- `session_id` / `turn_id` correlation (hook receives both; client knows `session_id` from `HermesVoiceGateway.currentSessionId`)
- Sidecar write contention (gateway concurrent turns on same session)
- `HERMES_HOME` discovery for dashboard server read vs plugin write (`profile_home` vs launch `HERMES_HOME` — see deferred-work.md)
- Atomic write pattern (write temp + rename) and stale-record TTL

**And** spike findings are recorded in **Findings § Transport** below before coding the endpoint/chip wiring  
**And** if spike rejects sidecar, document why and chosen alternative before proceeding

### AC1 — Plugin sidecar write (Omnipotent.md)

**Given** `recall_hook` completes `_run_prefetch` with payload `{ channel, citations, shadow, context }`  
**When** hook resolves for any turn (inject, shadow-empty, or fail-open)  
**Then** plugin writes an atomic JSON sidecar at:

```
{HERMES_HOME}/recall-status/{session_id}.json
```

**With schema (minimum fields):**

```json
{
  "session_id": "YYYYMMDD_HHMMSS_hex6",
  "turn_id": "<from hook kwargs when present>",
  "channel": "voice_pane|standard_text|yapped_text|unknown",
  "citations": ["vault/relative/path.md"],
  "injected": true,
  "shadow": false,
  "ts": "2026-06-29T10:15:22.123Z"
}
```

**And** `injected: true` iff non-shadow and non-empty `context` was returned to Hermes  
**And** write is atomic (`*.tmp` + `os.replace`) and fail-open (hook success must not depend on sidecar write)  
**And** plugin source lives in `scripts/hermes-plugin-examples/cns-brain-recall/` and deploys via existing install script to `~/.hermes/plugins/` — **no** Hermes core edits  
**And** non-voice / text recall path behavior unchanged except additive sidecar write

### AC2 — Dashboard proxy endpoint (cns-dashboard)

**Given** `HERMES_LOCAL_PROXY_ENABLED=true` and operator Nexus session auth (mirror health/ws-ticket)  
**When** client `GET /api/nexus/hermes/recall-status?session_id=<id>`  
**Then** server reads sidecar from `{HERMES_HOME}/recall-status/{session_id}.json` using `$env/dynamic/private` (add `HERMES_LOCAL_HOME` or reuse documented `HERMES_HOME` var — **consistent with env-hardening** in `hermes-local-proxy.ts`)  
**And** returns `200` + JSON body on hit, `404` when missing/stale, `503` when proxy disabled  
**And** route follows existing pattern: `src/routes/api/nexus/hermes/recall-status/+server.ts` + `$lib/server/hermes-recall-status.ts` (or extend `hermes-local-proxy.ts` if minimal)  
**And** **never** exposes filesystem paths or raw sidecar directory listing to browser  
**And** flag-off (`HERMES_LOCAL_PROXY_ENABLED` unset/false) returns `{ enabled: false }` without reading disk

### AC3 — VoiceDrawer chip wiring (cns-dashboard)

**Given** VoiceDrawer receives `message.complete` from `HermesVoiceGateway`  
**When** `gateway.currentSessionId` is set  
**Then** client fetches `GET /api/nexus/hermes/recall-status?session_id=...` (same-origin credentials)  
**And** chip status derives from ground truth:

| Sidecar signal | Chip |
|----------------|------|
| `channel === "voice_pane"` && `injected === true` | `voice_pane` |
| `channel === "voice_pane"` && `injected === false` && !shadow | `degraded` (recall ran, no inject) |
| `channel !== "voice_pane"` on voice session | `degraded` |
| sidecar 404 / fetch error | fallback to `evaluateVoiceBudgetStatus` heuristic (retain function) |
| before first complete | `checking` |

**And** close-code / health-gate / WS error states remain as implemented in 82-3  
**And** Diagnostics row (DEV) shows last sidecar payload fields when present

### AC4 — Tests (both repos)

**Given** verify gate  
**When** story completes  
**Then**:

| Area | Requirement |
|------|-------------|
| Plugin sidecar | Omnipotent `tests/hermes/cns-brain-recall-plugin.test.ts` — isolated temp `HERMES_HOME`, assert sidecar file content after hook probe |
| Endpoint | cns-dashboard vitest — mock fs or inject `$lib/server` reader; 200/404/401/503 cases mirroring `health.test.ts` |
| Chip wiring | cns-dashboard vitest — map sidecar JSON → `VoiceBudgetStatus`; heuristic fallback when 404 |
| Heuristic retained | existing `voice-budget-status.test.ts` stays green as fallback |
| Brain/recall env | `CNS_BRAIN_EMBEDDER=stub`, isolated `HERMES_HOME`, own shadow policy — **never** inherit go-live `process.env` |

**And** `bash scripts/verify.sh` (Omnipotent) + `npm test` (cns-dashboard) pass for story-specific tests (pre-existing unrelated failures OK per handoff)

### AC5 — Constraints / protect-list

**Given** implementation complete  
**Then** zero edits to:
- `~/.hermes/hermes-agent/**`
- `src/agents/{synthesis,hook,boss}-adapter-llm.ts`, `run-chain.ts`, `scripts/run-chain.ts`
- Context7 consulted before any new library/API (`/nousresearch/hermes-agent` for hook contract confirmation)
- No npm/pip package **<14 days** old

### AC6 — Evidence + commits

**Given** spike + implementation done  
**When** operator smoke repeats 82-3 voice turn  
**Then** chip shows `voice_pane` when sidecar reports inject (even if reply text lacks citation regex)  
**And** one logical commit per repo; commit message leads with `repo + branch + cwd` instruction block in story Dev Agent Record

## Tasks / Subtasks

- [x] **Spike — transport validation** (AC: 0)
  - [x] Confirm hook kwargs include `turn_id` on live gateway turn (or document absence + use latest-write-wins per session)
  - [x] Prototype sidecar write in plugin behind env `CNS_BRAIN_RECALL_STATUS_SIDECAR=1` if needed for spike-only
  - [x] Verify dashboard can read `{HERMES_HOME}/recall-status/` from WSL path when SvelteKit dev runs on same host
  - [x] Document `profile_home` edge case + env override (`HERMES_LOCAL_HOME` must match plugin `HERMES_HOME`)
  - [x] Fill **Findings § Transport** below; get spike sign-off before AC1–3 production code

- [x] **Plugin sidecar** (AC: 1) — Omnipotent.md
  - [x] Add `_write_recall_status_sidecar(session_id, turn_id, payload, injected)` in `plugin.py`
  - [x] Call from `recall_hook` after `_run_prefetch` (all branches including shadow/empty)
  - [x] Bump `plugin.yaml` version; run install script; `diff -rq` deployed parity
  - [x] Extend `tests/hermes/cns-brain-recall-plugin.test.ts`

- [x] **Server proxy** (AC: 2) — cns-dashboard
  - [x] Add `HERMES_LOCAL_HOME` (or document reuse) to `.env.example` + `tests/mocks/env-dynamic-private.ts`
  - [x] Implement `$lib/server/hermes-recall-status.ts` reader + staleness guard (optional max age e.g. 5 min)
  - [x] Add `src/routes/api/nexus/hermes/recall-status/+server.ts` with `assertNexusHermesProxyAuth`
  - [x] Add `tests/routes/api/nexus/hermes/recall-status.test.ts`

- [x] **VoiceDrawer chip** (AC: 3) — cns-dashboard
  - [x] Add client fetch helper `fetchRecallStatus(sessionId)` in `$lib/client/` (or gateway module)
  - [x] On `message.complete`, fetch sidecar → `mapRecallStatusToChip()` → set `budgetStatus`
  - [x] Keep `evaluateVoiceBudgetStatus` as fallback only
  - [x] Extend tests for mapping + fallback

- [x] **Verify + evidence** (AC: 4–6)
  - [x] Live smoke: voice turn where heuristic would say `degraded` but sidecar says `voice_pane` + `injected: true`
  - [x] `bash scripts/verify.sh` + `npm test`
  - [x] Update Dev Agent Record + File List

### Review Findings

- [x] [Review][Patch] Shared recall-status temp file is not safe for same-session concurrent writes [`scripts/hermes-plugin-examples/cns-brain-recall/plugin.py:297`]
- [x] [Review][Patch] Recall-status endpoint returns 200 when proxy is disabled despite AC2/AC4 requiring 503 [`src/routes/api/nexus/hermes/recall-status/+server.ts:14`]
- [x] [Review][Patch] Recall-status reader returns unvalidated raw sidecar JSON to the browser [`src/lib/server/hermes-recall-status.ts:56`]
- [x] [Review][Patch] VoiceDrawer recall-status fetch can apply an older turn result after a newer completion [`src/lib/components/nexus/VoiceDrawer.svelte:174`]
- [x] [Review][Patch] Required Context7 Hermes hook evidence is missing from the story record [`_bmad-output/implementation-artifacts/82-4-spike-omni-003-voice-recall-status-ground-truth.md:130`]

## Dev Notes

### Verified facts — DO NOT REBUILD

| Fact | Source | Dev rule |
|------|--------|----------|
| Prefetch payload shape | `plugin.py:277-280` — `channel`, `citations`, `shadow`, `context` | Sidecar mirrors these fields |
| Hook kwargs | `recall_hook(session_id, user_message, platform, **kwargs)` — `turn_id`, `task_id` in kwargs | Pass `turn_id` to sidecar when present |
| WS emit impossible | `PluginContext` — no broadcast API; handoff session 9 | **Do not** attempt `recall.injected` WS event |
| Voice session source | Path C: `session.create { source: "nexus-voice" }` → `voice_pane` channel | Chip `degraded` if sidecar channel ≠ `voice_pane` on voice drawer session |
| Client session id | `HermesVoiceGateway.currentSessionId` after `session.create` | Query param for recall-status endpoint |
| Heuristic today | `voice-budget-status.ts:11-24` — >80 chars, no regex → `degraded` | **Fallback only** after this story |
| Proxy env pattern | `hermes-local-proxy.ts` uses `$env/dynamic/private` + `HERMES_LOCAL_*` | Add home path var same pattern |
| Epic 82-3 smoke | Session `20260629_101522_ec20fc`, `source=nexus-voice`, recall at source | Reproduce chip false-positive on long uncited reply |

### Recommended transport (spike default — validate first)

```
Plugin (pre_llm_call)                Dashboard server              VoiceDrawer
      |                                     |                            |
      | write atomic JSON                   |                            |
      v                                     |                            |
 ~/.hermes/recall-status/{session_id}.json  |                            |
      |                                     |                            |
      |                                     |  GET recall-status?session_id
      |                                     |<---------------------------|
      |                                     | read sidecar (HERMES_LOCAL_HOME)
      |                                     |--------------------------->|
      |                                     |   { channel, injected, ... }
      |                                     |                            v
      |                                     |                   set budget chip
```

**Alternatives (spike must reject or select):**

| Option | Verdict |
|--------|---------|
| A. Sidecar JSON under `HERMES_HOME/recall-status/` | **Recommended** — no core fork; plugin already has session + payload |
| B. Append structured line to `~/.hermes/logs/brain-recall.log` | Parse fragility; avoid unless sidecar blocked |
| C. WS `recall.injected` event | **Rejected** — requires Hermes core fork |
| D. Convex push from plugin | Out of scope; adds network + auth surface |
| E. Poll `state.db` only | Insufficient — DB has session source, not inject outcome |

### Sidecar implementation sketch (plugin)

```python
def _recall_status_dir() -> Path:
    hermes_home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")).expanduser()
    d = hermes_home / "recall-status"
    d.mkdir(parents=True, exist_ok=True)
    return d

def _write_recall_status_sidecar(*, session_id, turn_id, channel, citations, shadow, injected):
    # atomic write; swallow exceptions (fail-open)
    ...
```

Call site: end of `recall_hook` after computing `injected = bool(context.strip()) and not shadow`.

### Dashboard server reader sketch

Mirror `probeHermesHealth` / `mintHermesWsTicket` module layout:

- `getHermesHomePath(): string` from `env.HERMES_LOCAL_HOME || env.HERMES_HOME || '~/.hermes'` (expand user — use `node:os` homedir in tests)
- `readRecallStatus(sessionId): RecallStatus | null`
- Route: auth via `assertNexusHermesProxyAuth` identical to health route

### Chip mapping function (new — `$lib/client/voice-recall-status.ts` suggested)

Keep `evaluateVoiceBudgetStatus` in `voice-budget-status.ts` unchanged for fallback tests.

```typescript
export function mapRecallSidecarToBudgetStatus(
  sidecar: { channel: string; injected: boolean; shadow?: boolean } | null,
  assistantText: string,
  prior: VoiceBudgetStatus
): VoiceBudgetStatus {
  if (!sidecar) {
    return evaluateVoiceBudgetStatus(assistantText, prior);
  }
  if (sidecar.channel === 'voice_pane' && sidecar.injected) return 'voice_pane';
  if (sidecar.channel === 'voice_pane' && !sidecar.injected && !sidecar.shadow) return 'degraded';
  if (sidecar.channel !== 'voice_pane') return 'degraded';
  return 'unknown';
}
```

Adjust after spike if operator prefers different semantics for shadow mode.

### Architecture compliance

| ADR / spec | Relevance |
|------------|-----------|
| ADR-HERMES-013 | No browser secrets; recall-status is server-read sidecar |
| ADR-HERMES-014 | Unrelated to TTS; no change |
| ADR-HERMES-015 | Plugin-only recall inject; sidecar is additive |
| `architecture-hermes-omniscient.md` FR10/FR18 | Voice drawer observability for recall budget |
| `epic-46-ui-spec.md` | Nexus local-only components — chip is operator feedback |

### File structure requirements

**Omnipotent.md (`hermes-consolidation`):**

| File | Action |
|------|--------|
| `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` | UPDATE — sidecar write |
| `scripts/hermes-plugin-examples/cns-brain-recall/plugin.yaml` | UPDATE — version bump |
| `scripts/install-hermes-plugin-cns-brain-recall.sh` | READ — deploy unchanged unless path added |
| `tests/hermes/cns-brain-recall-plugin.test.ts` | UPDATE — sidecar tests |

**cns-dashboard (`master`):**

| File | Action |
|------|--------|
| `src/lib/server/hermes-recall-status.ts` | NEW |
| `src/routes/api/nexus/hermes/recall-status/+server.ts` | NEW |
| `src/lib/client/voice-recall-status.ts` (or extend voice-budget-status) | NEW/UPDATE |
| `src/lib/components/nexus/VoiceDrawer.svelte` | UPDATE — fetch on message.complete |
| `tests/routes/api/nexus/hermes/recall-status.test.ts` | NEW |
| `tests/lib/voice-recall-status.test.ts` (or extend existing) | NEW |
| `.env.example` | UPDATE — `HERMES_LOCAL_HOME` |
| `tests/mocks/env-dynamic-private.ts` | UPDATE |

**Do NOT modify:** `src/routes/api/nexus/hermes/ws/+server.ts` (501 stub stays); protect-list files.

### Previous story intelligence

**82-3 VoiceDrawer (done, smoke 2026-06-29):**

- D2 explicitly added citation-regex heuristic as **temporary** until explicit recall metadata
- `message.complete` handler at `VoiceDrawer.svelte:153-171` calls `evaluateVoiceBudgetStatus` — **replace primary path** with sidecar fetch; keep heuristic on 404
- Close codes 4401/4403 and health gate unchanged
- Commit on cns-dashboard `master` at `05a7d60`

**82-2 Path C (done):**

- Plugin reads `state.db` for `nexus-voice` → `--recall-channel voice_pane`
- Tests **must** isolate `HERMES_HOME` — copy pattern from Path C tests
- `profile_home` vs launch `HERMES_HOME` split documented — sidecar must use same home as plugin

**82-1 WS proxy (done):**

- Auth pattern for new route: `assertNexusHermesProxyAuth` + `TRENDS_API_RESPONSE_HEADERS`
- `HERMES_LOCAL_PROXY_ENABLED` gate

### Git intelligence (recent Epic 82 work)

| Repo | HEAD (session 9) | Pattern |
|------|------------------|---------|
| Omnipotent.md | `2e4e056` on `hermes-consolidation` | Plugin + tests in one commit; install to `~/.hermes/plugins/` |
| cns-dashboard | `05a7d60` on `master` | Server `$lib/server` + route + client component + vitest |

### Testing requirements

1. **Plugin:** temp `HERMES_HOME`, invoke hook/recall subprocess stub, assert `{HERMES_HOME}/recall-status/{session_id}.json` exists with expected fields
2. **Endpoint:** mock reader — enabled/disabled, auth 401, 404 missing file, 200 payload
3. **Chip:** unit-test mapping table; integration optional
4. **Regression:** discord/non-voice hook still injects same bytes; sidecar write is additive
5. **Env isolation:** never run brain tests against operator go-live embedder index

### Verify gates

```bash
# Omnipotent.md — from repo root on hermes-consolidation
bash scripts/verify.sh

# cns-dashboard — from sibling repo on master
npm test
```

### Commit instruction template

```
# Omnipotent.md @ hermes-consolidation
cd /home/christ/ai-factory/projects/Omnipotent.md
git checkout hermes-consolidation
# ... changes ...
bash scripts/verify.sh && git commit -m "feat(hermes-recall): SPIKE-OMNI-003 plugin recall-status sidecar"

# cns-dashboard @ master
cd /home/christ/ai-factory/projects/cns-dashboard
git checkout master
# ... changes ...
npm test && git commit -m "feat(nexus-voice): SPIKE-OMNI-003 recall-status endpoint + chip ground truth"
```

Push/PR for Omnipotent.md must run in **WSL**.

### References

- [Source: HANDOFF-2026-06-29-session9-hermes-consolidation.md §4 item 2, §6]
- [Source: cns-dashboard/src/lib/client/voice-budget-status.ts]
- [Source: cns-dashboard/src/lib/components/nexus/VoiceDrawer.svelte:153-171]
- [Source: Omnipotent.md/scripts/hermes-plugin-examples/cns-brain-recall/plugin.py:243-296]
- [Source: _bmad-output/implementation-artifacts/82-3-voice-drawer-local-nexus-jarvis-push-to-talk.md §D2]
- [Source: _bmad-output/implementation-artifacts/82-2-spike-omni-002-voice-channel.md §Channel Resolution Contract]
- [Source: _bmad-output/planning-artifacts/epics-hermes-omniscient.md Epic 82]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — profile_home state.db split]

---

## Findings § Transport

<!-- Dev agent fills during AC0 spike BEFORE feature implementation -->

| Item | Status | Notes |
|------|--------|-------|
| Sidecar path writable from gateway plugin | **pass** | Spike wrote `{HERMES_HOME}/recall-status/{session_id}.json` via `*.tmp` + `mv`; plugin uses same `HERMES_HOME` resolver as `state.db` (`plugin.py:_recall_status_dir`). |
| Dashboard server can read same path | **pass** | WSL spike: plugin write under temp `HERMES_HOME`, Node reader with `HERMES_LOCAL_HOME` set to same path returned JSON. Default operator path: `~/.hermes/recall-status/` when env unset. |
| turn_id correlation | **pass** | Hook kwargs include `turn_id` (82-2 test: `{session_key}:task-uuid:abc12345`). Sidecar stores `turn_id` when present; chip correlates by `session_id` query (client `currentSessionId`). Per-turn disambiguation optional — file is per-session. |
| Concurrent turn / last-write-wins | **accepted** | One sidecar file per `session_id`; concurrent turns on same session overwrite atomically (last prefetch wins). Acceptable: chip reflects latest recall outcome for voice drawer session. |
| HERMES_HOME / profile_home alignment | **documented** | Plugin + sidecar use launch `HERMES_HOME` (default `~/.hermes`). Remote `profile_home` sessions may use a different `state.db` (deferred-work.md) — operator must set `HERMES_LOCAL_HOME` on cns-dashboard to match gateway launch home. Sidecar co-locates with plugin writes, not profile DB path. |
| Transport decision | **sidecar (A)** | WS-event rejected (no core fork). Log-parse (B) and state.db-only (E) insufficient. Prefetch CLI channels verified in source: `voice_pane`, `standard_text`, `yapped_text` (`recall-policy.ts` RECALL_CHANNEL_KEYS + `detectRecallChannel`); plugin fallback `"unknown"` only on missing payload field. |

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (dev-story)

### Debug Log References

- AC0 spike: temp `HERMES_HOME` atomic write/read validated in WSL before feature code
- Context7 `/nousresearch/hermes-agent`: `pre_llm_call` callback includes `session_id`, `user_message`, `platform`, `**kwargs`; return `{"context": "..."}` injects context and `None` / no return skips injection
- `verify.sh`: story tests pass; gate exits 1 on pre-existing `session-close` skill parity drift (unrelated)
- `npm test` cns-dashboard: 663/663 pass including new recall-status tests

### Completion Notes List

- AC0: Sidecar transport validated; prefetch CLI channels confirmed from source (`voice_pane`, `standard_text`, `yapped_text`)
- AC1: Plugin writes atomic `{HERMES_HOME}/recall-status/{session_id}.json` fail-open; v0.2.2 installed to `~/.hermes/plugins/`
- AC2: `GET /api/nexus/hermes/recall-status?session_id=` with auth + 5min staleness TTL
- AC3: VoiceDrawer fetches sidecar on `message.complete`; heuristic fallback on 404; DEV diagnostics show sidecar fields
- Unit tests prove long uncited reply + `injected:true` sidecar → `voice_pane` chip (heuristic would say `degraded`)
- Review patches: sidecar temp files now use per-write unique names; dashboard rejects disabled proxy as 503; sidecar reader/client validate payload shape and session match; VoiceDrawer ignores stale fetch completions; Context7 hook evidence recorded.

### File List

**Omnipotent.md**
- `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py`
- `scripts/hermes-plugin-examples/cns-brain-recall/plugin.yaml`
- `tests/hermes/cns-brain-recall-plugin.test.ts`
- `_bmad-output/implementation-artifacts/82-4-spike-omni-003-voice-recall-status-ground-truth.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**cns-dashboard**
- `src/lib/server/hermes-recall-status.ts`
- `src/routes/api/nexus/hermes/recall-status/+server.ts`
- `src/lib/client/voice-recall-status.ts`
- `src/lib/components/nexus/VoiceDrawer.svelte`
- `tests/lib/server/hermes-recall-status.test.ts`
- `tests/lib/voice-recall-status.test.ts`
- `tests/routes/api/nexus/hermes/recall-status.test.ts`
- `tests/mocks/env-dynamic-private.ts`
- `.env.example`

### Change Log

- 2026-06-29: SPIKE-OMNI-003 — recall-status sidecar + dashboard proxy + VoiceDrawer ground-truth chip (transport spike → implementation)

### Commit instruction template

```
# Omnipotent.md @ hermes-consolidation
cd /home/christ/ai-factory/projects/Omnipotent.md
git checkout hermes-consolidation
bash scripts/verify.sh && git commit -m "feat(hermes-recall): SPIKE-OMNI-003 plugin recall-status sidecar"

# cns-dashboard @ master
cd /home/christ/ai-factory/projects/cns-dashboard
git checkout master
npm test && git commit -m "feat(nexus-voice): SPIKE-OMNI-003 recall-status endpoint + chip ground truth"
```
