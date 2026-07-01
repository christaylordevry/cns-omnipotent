---
baseline_commit: cd57f06
branch: hermes-consolidation
---

# Story 82.5: Brain-recall prefetch bare-PATH hardening + dashboard voice-server env

Status: in-progress

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As an **operator using Local Nexus voice (PTT via VoiceDrawer → Hermes dashboard `:9119`)**,
I want **brain-recall prefetch to resolve `npx`/`tsx` without relying on ambient PATH, and the dashboard process to launch with the same brain-recall env as the Discord gateway**,
so that **voice-turn `pre_llm_call` writes ground-truth recall-status sidecars and the VoiceDrawer chip shows `voice_pane` instead of false `degraded`**.

## Problem (verified — build on this, do not re-investigate)

Two Hermes processes run with **divergent environment**:

| Process | Launch | Brain env |
|---------|--------|-----------|
| `hermes gateway run` (Discord) | systemd + **two** drop-ins: `brain-recall.conf` → `~/.hermes/brain-recall.env` **and** `env.conf` → `Environment=PATH=<nvm>/bin:…` | **HAS** `CNS_BRAIN_INDEX_PATH`, `CNS_NODE_BIN`, nvm `bin` on PATH |
| `hermes dashboard --port 9119` (voice WS `/api/ws`) | systemd `hermes-dashboard.service` loads only `~/.hermes/.env` | **MISSING** both drop-ins — bare PATH, no `npx`, no `CNS_BRAIN_INDEX_PATH` |

**Verified 2026-06-30 (live units):** `~/.hermes/brain-recall.env` contains **no** `PATH=` line. Gateway nvm/npx on PATH comes from a **separate** `hermes-gateway.service.d/env.conf`, not from `brain-recall.env`. Copying `brain-recall.conf` alone is **not** sufficient for dashboard parity.

**Failure chain (voice turn):**

1. `pre_llm_call` (`agent/turn_context.py` → `invoke_hook`) runs `cns-brain-recall` plugin → `_run_prefetch` → `scripts/brain-recall-prefetch.mjs`.
2. Plugin resolves `node` robustly (`_resolve_node_bin`: `CNS_NODE_BIN` / nvm glob / `which`).
3. `.mjs` wrapper does `spawnSync("npx", ["tsx", cliEntry, ...])` — **`npx` via ambient PATH**.
4. Dashboard bare PATH → `npx` ENOENT → silent exit 1 → plugin fail-open returns `{}` → **no** `~/.hermes/recall-status/<sid>.json`.
5. VoiceDrawer `GET /api/nexus/hermes/recall-status` → 404 → falls back to `evaluateVoiceBudgetStatus` heuristic → **`degraded`** chip on valid replies.

**Reproduced:**

```bash
# ENOENT (npx missing)
env -i PATH=/usr/bin:/bin node scripts/brain-recall-prefetch.mjs --query test
# → exit 1, no JSON stdout

# npx found but index missing
env -i PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/usr/bin:/bin" \
  node scripts/brain-recall-prefetch.mjs --query test
# → "Brain index path required" (CNS_BRAIN_INDEX_PATH absent)
```

`~/.hermes/brain-recall.env` exists with all vars but is **not sourced** by any committed wrapper for dashboard.

**Story 82-4 dependency:** Sidecar + VoiceDrawer ground-truth chip are **done** — this story fixes the **upstream prefetch env gap** that prevents sidecars from being written on dashboard voice turns.

## Acceptance Criteria

### AC1 — Prefetch resolves `npx`/`tsx` without ambient PATH (primary fix)

**Given** `scripts/brain-recall-prefetch.mjs` (and any extracted helper under `src/brain/` if needed)
**When** invoked under bare PATH with `CNS_NODE_BIN` set to a valid node binary
**Then** the wrapper resolves the **same directory's** `npx` (or invokes `tsx` directly via resolved path) instead of `spawnSync("npx", ...)` on bare PATH
**And** resolution mirrors plugin `_resolve_node_bin` fallback order: `CNS_NODE_BIN` → `NODE_BIN` → nvm `*/bin/node` glob (newest) → `which node`
**And** ambient PATH-based `npx`/`tsx` lookup remains **last-resort fallback** only
**And** stdout JSON contract unchanged: `{ context, citations, channel, shadow }`
**Note:** AC1 is **PATH-independent** — the fix must hold even if systemd PATH drop-in regresses.

### AC2 — Dashboard launch mirrors gateway drop-ins (defense-in-depth + env parity)

**Given** operator runs Nexus voice server via Hermes `dashboard` on `:9119`
**When** story completes
**Then** a **committed, reversible** install mechanism creates **both** dashboard systemd drop-ins (mirroring live gateway units verified 2026-06-30):

| Drop-in | Purpose |
|---------|---------|
| `(a)` `hermes-dashboard.service.d/brain-recall.conf` | `EnvironmentFile=-%h/.hermes/brain-recall.env` — `CNS_BRAIN_*`, `CNS_NODE_BIN`, `CNS_OMNIPOTENT_ROOT`, `CNS_VAULT_ROOT` (no `PATH=` in this file) |
| `(b)` `hermes-dashboard.service.d/env.conf` | `Environment=PATH=<nvm bin dir>:<existing PATH>` — same pattern as gateway `hermes-gateway.service.d/env.conf` |

**And** `(a)` + `(b)` are **both required** — `brain-recall.conf` alone is **insufficient** (gateway PATH comes from separate `env.conf`, not `brain-recall.env`)
**And** AC1 + AC2 compose: AC1 survives bare PATH; AC2 ensures dashboard matches gateway if inner spawns still hit PATH
**And** committed install script writes/validates operator files under `~/.hermes` and `~/.config/systemd/user/` — **no secrets in git**
**And** script is idempotent; documents `systemctl --user daemon-reload && systemctl --user restart hermes-dashboard.service`
**And** optional manual wrapper (`hermes-dashboard-start.sh`) sources both env file + PATH prepend for non-systemd launches

### AC3 — Bare-PATH repro test passes

**Given** isolated test index + vault (stub embedder pattern from 79-5 tests)
**When**:

```bash
env -i HOME="$HOME" USER="$USER" \
  PATH=/usr/bin:/bin \
  CNS_NODE_BIN="$HOME/.nvm/versions/node/v24.14.0/bin/node" \
  CNS_BRAIN_INDEX_PATH="<temp-index>" \
  CNS_VAULT_ROOT="<temp-vault>" \
  CNS_BRAIN_EMBEDDER=stub \
  node scripts/brain-recall-prefetch.mjs --query "<anchor>" --index-path "<temp-index>" --vault-root "<temp-vault>"
```

**Then** exit 0 with valid JSON stdout (no `npx` ENOENT, no "Brain index path required")
**And** test is automated in `tests/hermes/cns-brain-recall-plugin.test.ts` (or dedicated `.mjs` runner test)

### AC4 — Unit coverage for npx-without-PATH

**Given** `bash scripts/verify.sh`
**When** story completes
**Then** `tests/hermes/cns-brain-recall-plugin.test.ts` includes a case asserting prefetch succeeds when `PATH=/usr/bin:/bin` but `CNS_NODE_BIN` points at real node
**And** existing 79-5 / 82-2 / 82-4 plugin tests remain green
**And** brain tests use isolated env (`CNS_BRAIN_EMBEDDER=stub`, temp index/vault) — never inherit go-live `process.env`

### AC5 — Live validation (evidence file)

**Given** dashboard relaunched with brain-recall env via AC2 mechanism
**When** operator performs one PTT voice turn on Local Nexus (`localhost:5173/nexus`)
**Then** `~/.hermes/recall-status/<session_id>.json` exists with `channel=voice_pane` and `injected=true` (or documented `shadow`/`injected:false` if policy shadow — live policy is `shadow_mode: false`)
**And** VoiceDrawer budget chip shows **`voice_pane`** (not `degraded`) for that turn
**And** evidence recorded in `_bmad-output/implementation-artifacts/82-5-brain-recall-prefetch-bare-path-evidence.md` with redacted env keys only

### AC6 — Protect-list + verify gate

**Given** implementation complete
**Then** zero edits to:
- `src/agents/synthesis-adapter-llm.ts`, `hook-adapter-llm.ts`, `boss-adapter-llm.ts`, `run-chain.ts`, `scripts/run-chain.ts`
- `~/.hermes/hermes-agent/**` (no Hermes core fork)
**And** Context7 consulted on `/nousresearch/hermes-agent` for dashboard/systemd launch before implementing AC2
**And** `bash scripts/verify.sh` passes (ignore pre-existing session-close skill parity drift)
**And** one logical commit per repo

## Tasks / Subtasks

- [x] **Prefetch runner hardening** (AC: 1, 3)
  - [x] Add `resolveNodeToolchain()` in `scripts/brain-recall-prefetch.mjs` or `src/brain/resolve-node-toolchain.ts` (prefer small shared module if reused)
  - [x] Replace bare `spawnSync("npx", ["tsx", ...])` with resolved `npx` path or direct `tsx` spawn from node bin dir
  - [x] Keep PATH fallback for dev shells that already have nvm on PATH

- [x] **Dashboard env install script** (AC: 2)
  - [x] Add `scripts/install-hermes-brain-recall-env.sh`: writes/validates `~/.hermes/brain-recall.env` (no `PATH=` line); creates dashboard drop-ins **(a)** `brain-recall.conf` + **(b)** `env.conf`
  - [x] `(b)` must mirror live `hermes-gateway.service.d/env.conf` — resolve nvm bin via `sort -V` glob (67-11 idiom); prepend to existing PATH in unit
  - [x] If gateway drop-ins missing, install/refresh gateway copies too (idempotent)
  - [x] Optional: `scripts/hermes-dashboard-start.sh` — source `brain-recall.env` + `export PATH="$NVM_BIN:$PATH"` for manual launches
  - [x] Update `config-snippet.md` — document two-drop-in pattern; `brain-recall.env` ≠ PATH source

- [x] **Tests** (AC: 3, 4)
  - [x] Add bare-PATH prefetch test with `CNS_NODE_BIN` + stub index
  - [x] Regression: normal PATH test (`brain-recall-prefetch.mjs wrapper prints JSON`) still passes

- [x] **Operator apply + evidence** (AC: 5)
  - [x] Run install script; restart `hermes-dashboard.service`
  - [x] Verify `/proc/<dashboard-pid>/environ` contains `CNS_BRAIN_INDEX_PATH`, `CNS_NODE_BIN`, **and** nvm `bin` on `PATH` (from `env.conf`, not `brain-recall.env`)
  - [ ] Live PTT smoke + sidecar + chip screenshot/note in evidence file (operator follow-up; simulated recall-hook sidecar path passed)

- [x] **Verify + commit** (AC: 6)
  - [x] `bash scripts/verify.sh`
  - [x] Update Dev Agent Record + File List

### Review Findings

- [x] [Review][Patch] Live PTT validation remains pending despite AC5 completion claim [_bmad-output/implementation-artifacts/82-5-brain-recall-prefetch-bare-path-evidence.md:49]: fixed by unchecking AC5 PTT task and recording operator follow-up
- [x] [Review][Patch] Installer skips existing env/drop-in files instead of validating required brain env and PATH contents [scripts/install-hermes-brain-recall-env.sh:25]
- [x] [Review][Patch] Generated `brain-recall.env` cannot be sourced when `CNS_VAULT_ROOT` contains spaces [scripts/install-hermes-brain-recall-env.sh:38]
- [x] [Review][Patch] NVM fallback sorts versions lexicographically instead of selecting newest version [scripts/lib/resolve-node-toolchain.mjs:42]
- [x] [Review][Patch] Last-resort node resolution can prepend `.` to child PATH [scripts/lib/resolve-node-toolchain.mjs:50]
- [x] [Review][Patch] PATH containment check uses substring matching instead of path components [scripts/brain-recall-prefetch.mjs:19]
- [x] [Review][Patch] Install-script test depends on the real operator NVM installation [tests/hermes/cns-brain-recall-plugin.test.ts:996]

## Dev Notes

### Verified facts — DO NOT REBUILD

| Fact | Source | Dev rule |
|------|--------|----------|
| Plugin calls `.mjs` with explicit `node` | `plugin.py:193-198` — `cmd = [node_bin, str(script), ...]` | Fix is **inside** `.mjs`, not plugin |
| `.mjs` spawns `npx` on PATH | `brain-recall-prefetch.mjs:15` | **Primary fix target** |
| Plugin `_resolve_node_bin` | `plugin.py:46-70` | Mirror logic in TS for toolchain resolution |
| Index path resolution | `recall-prefetch-cli.ts:37-49` — `CNS_BRAIN_INDEX_PATH` or `--index-path` | Dashboard must pass env to subprocess chain |
| Fail-open plugin | `plugin.py:371-373` | No sidecar on prefetch failure — env fix is the product fix |
| Gateway brain vars | `hermes-gateway.service.d/brain-recall.conf` → `brain-recall.env` | Dashboard needs **same** `(a)` drop-in |
| Gateway PATH | `hermes-gateway.service.d/env.conf` → `Environment=PATH=<nvm>/bin:…` | Dashboard needs **same** `(b)` drop-in — **not** in `brain-recall.env` |
| `brain-recall.env` has no PATH | Verified live 2026-06-30 | Do **not** add `PATH=` to env file; use separate `env.conf` |
| Dashboard systemd unit | `74-6` template — `EnvironmentFile=%h/.hermes/.env` only | Add drop-ins under `.service.d/`; don't edit OAuth `.env` |
| Voice hook fires on dashboard | `HANDOFF-2026-06-29-session9` — `pre_llm_call` on WS turns, `platform=tui` | Path C uses `state.db` `source=nexus-voice` → `voice_pane` |
| 82-4 sidecar path | `{HERMES_HOME}/recall-status/{session_id}.json` | This story makes sidecar **appear** on voice turns |

### Recommended implementation

**AC1 — Toolchain resolution (TypeScript):**

```typescript
// Resolve node bin dir from CNS_NODE_BIN (file path) or nvm glob — same order as plugin.py
function resolveNodeBinDir(): string {
  const nodePath = resolveNodeExecutable(); // file path to node
  return dirname(nodePath);
}

function resolveTsxRunner(nodeBinDir: string): { cmd: string; args: string[] } {
  const npx = join(nodeBinDir, "npx");
  const tsx = join(nodeBinDir, "tsx"); // global tsx if installed in same prefix
  if (existsSync(npx)) return { cmd: npx, args: ["tsx", cliEntry, ...argv] };
  // fallback: node with tsx/register or project node_modules/.bin/tsx
  ...
}
```

Prefer **`join(nodeBinDir, "npx")`** over bare `"npx"` — matches how `run-dashboard-sync-cron.sh` prepends NVM bin to PATH but works even when PATH is stripped.

**AC2 — Systemd drop-ins (operator home, installed by script):**

Two files required per service — mirror live gateway layout:

```ini
# ~/.config/systemd/user/hermes-dashboard.service.d/brain-recall.conf  — (a)
[Service]
EnvironmentFile=-%h/.hermes/brain-recall.env
```

```ini
# ~/.config/systemd/user/hermes-dashboard.service.d/env.conf  — (b)
[Service]
Environment=PATH=/home/christ/.nvm/versions/node/v24.14.0/bin:/usr/local/sbin:/usr/local/bin:...
```

Install script should:
1. Ensure `~/.hermes/brain-recall.env` exists with `CNS_*` vars only — **no `PATH=`** (mode `0600`)
2. Resolve nvm bin dir dynamically (`sort -V` glob) for `(b)` — same as gateway `env.conf`
3. Install **both** drop-ins for `hermes-dashboard.service`; refresh gateway drop-ins if missing
4. Print `daemon-reload` + `restart` instructions

**Defense-in-depth:** AC1 (resolved `npx` path) + AC2(b) (PATH) — fix holds if either layer regresses.

**Do NOT** commit `brain-recall.env` contents — only a `.example` or heredoc template with **non-secret** default paths.

### Architecture compliance

| ADR / spec | Relevance |
|------------|-----------|
| ADR-HERMES-015 | Plugin-only recall inject; prefetch CLI subprocess contract unchanged |
| ADR-HERMES-013 | Voice proxy unchanged; dashboard env fix is WSL-side only |
| `architecture-hermes-omniscient.md` §WSL zone | Brain index + plugin on WSL; dashboard `:9119` must share brain env |
| Epic 82 FR10/FR18 | Voice pane recall budget requires working prefetch on dashboard process |
| Story 67-11 pattern | NVM PATH bootstrap in cron wrappers — reuse `sort -V` nvm glob idiom |

### File structure requirements

| File | Action |
|------|--------|
| `scripts/brain-recall-prefetch.mjs` | **UPDATE** — resolve npx/tsx from node bin dir |
| `src/brain/resolve-node-toolchain.ts` | **NEW** (optional) — shared resolver if keeps `.mjs` thin |
| `scripts/install-hermes-brain-recall-env.sh` | **NEW** — brain-recall.env template + systemd drop-ins |
| `scripts/hermes-dashboard-start.sh` | **NEW** (optional) — manual launch wrapper sourcing env |
| `scripts/hermes-plugin-examples/cns-brain-recall/references/config-snippet.md` | **UPDATE** — dashboard systemd note |
| `tests/hermes/cns-brain-recall-plugin.test.ts` | **UPDATE** — bare-PATH prefetch test |
| `_bmad-output/implementation-artifacts/82-5-brain-recall-prefetch-bare-path-evidence.md` | **NEW** (operator/dev) — live validation |

**Do NOT modify:** protect-list adapter files; `src/agents/run-chain.ts`; Hermes core; cns-dashboard (no UI changes — chip works once sidecar exists).

### Previous story intelligence

**82-4 SPIKE-OMNI-003 (done):**
- Sidecar write is fail-open in `plugin.py:_write_recall_status_sidecar`
- VoiceDrawer fetches sidecar on `message.complete`; 404 → heuristic `degraded`
- **Root cause of 404 on voice:** dashboard prefetch never succeeds → this story

**82-2 Path C (done):**
- `nexus-voice` session source → `--recall-channel voice_pane`
- Tests isolate `HERMES_HOME` — copy pattern for new tests

**79-5 prefetch CLI (done):**
- Wrapper test at `cns-brain-recall-plugin.test.ts:317` uses full `process.env` PATH — add **contrasting** bare-PATH test
- `npm run brain:recall-prefetch` delegates to same `.mjs`

**67-11 cron PATH (done):**
- `NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"` — reuse in install script for default `CNS_NODE_BIN`

### Git intelligence

| Commit | Relevance |
|--------|-----------|
| `cd57f06` | Latest on `hermes-consolidation` — 79-8 recall budget |
| `9a968db` / `81ff9f4` | 82-4 sidecar implementation |
| `2e4e056` | Epic 82-3 VoiceDrawer done |

### Context7 — Hermes dashboard launch (required for AC2)

**Library:** `/nousresearch/hermes-agent`

| Finding | Implication |
|---------|-------------|
| `hermes dashboard --host 0.0.0.0 --port 9119 --no-open` | Match live systemd `ExecStart` |
| `EnvironmentFile=%h/.hermes/.env` | OAuth secrets stay in `.env`; brain vars in **separate** `brain-recall.env` drop-in |
| `HERMES_DASHBOARD_*` env vars for OAuth | Do not conflate with `CNS_BRAIN_*` |
| Dashboard and gateway are separate processes | Each needs **both** `(a)` brain-recall + `(b)` env.conf drop-ins |

### Testing requirements

1. **Bare PATH prefetch:** `spawnSync` with `env: { PATH: '/usr/bin:/bin', CNS_NODE_BIN, CNS_BRAIN_INDEX_PATH, CNS_BRAIN_EMBEDDER: 'stub' }` → JSON stdout, exit 0
2. **Regression:** existing wrapper test with normal env still green
3. **Install script:** optional smoke test that generated drop-ins contain `EnvironmentFile=-%h/.hermes/brain-recall.env` **and** `Environment=PATH=` with nvm bin (no systemd invoke in CI)
4. **Never** run against live `~/.hermes/brain/brain-index.json` in unit tests

### Verify gate

```bash
cd /home/christ/ai-factory/projects/Omnipotent.md
git checkout hermes-consolidation
bash scripts/verify.sh
```

### Live validation commands (evidence)

```bash
# After install + restart
systemctl --user is-active hermes-dashboard.service
tr '\0' '\n' < /proc/$(systemctl --user show hermes-dashboard.service -p MainPID --value)/environ | grep -E 'CNS_BRAIN_INDEX_PATH|CNS_NODE_BIN|^PATH='
# PATH must include ~/.nvm/versions/node/*/bin (from env.conf, not brain-recall.env)

# Sidecar after voice turn
ls -la ~/.hermes/recall-status/
jq '{channel,injected,shadow}' ~/.hermes/recall-status/<session_id>.json

# Dashboard recall-status API (from cns-dashboard dev)
curl -s "http://localhost:5173/api/nexus/hermes/recall-status?session_id=<id>" -b "<session-cookie>"
```

### Commit instruction template

```
# Omnipotent.md @ hermes-consolidation
cd /home/christ/ai-factory/projects/Omnipotent.md
git checkout hermes-consolidation
bash scripts/verify.sh && git commit -m "fix(hermes-recall): bare-PATH prefetch + dashboard brain-recall env"
```

Push/PR auth: run in **WSL** as `christaylordevry`.

### References

- [Source: `scripts/brain-recall-prefetch.mjs:15-19`]
- [Source: `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py:46-70,186-220`]
- [Source: `src/brain/recall-prefetch-cli.ts:37-49`]
- [Source: `HANDOFF-2026-06-28-session8-hermes-consolidation.md` §3 gateway brain-recall.conf]
- [Source: `HANDOFF-2026-06-29-session9-hermes-consolidation.md` §4 item 2, §7 voice hook facts]
- [Source: `_bmad-output/implementation-artifacts/82-4-spike-omni-003-voice-recall-status-ground-truth.md`]
- [Source: `_bmad-output/implementation-artifacts/74-6-hermes-dashboard-oauth-registration-systemd-and-reachability.md` §systemd template]
- [Source: `_bmad-output/implementation-artifacts/67-11-fix-cron-environment-path.md` §NVM bootstrap]
- [Source: Context7 `/nousresearch/hermes-agent` — `hermes dashboard`, web-dashboard EnvironmentFile pattern]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Bare-PATH test initially failed: `spawnSync("node")` not on `/usr/bin:/bin`; fixed to use `process.execPath` (matches plugin).
- `npx` shebang needs node on PATH even with absolute npx path; resolver prefers `node + node_modules/.bin/tsx` and prepends `nodeBinDir` to child PATH.

### Completion Notes List

- AC1: `scripts/lib/resolve-node-toolchain.mjs` + `src/brain/resolve-node-toolchain.ts` resolve node/npx/tsx; `brain-recall-prefetch.mjs` no longer calls bare `"npx"`.
- AC2: `install-hermes-brain-recall-env.sh` installed dashboard `brain-recall.conf` + `env.conf`; gateway drop-ins preserved (already present).
- AC3/AC4: bare-PATH vitest + install drop-in smoke; all 22 cns-brain-recall tests green after review hardening.
- AC5: dashboard `/proc` environ verified post-restart; evidence file records simulated voice sidecar write; operator PTT chip smoke remains a manual follow-up before story closeout.
- AC6: `verify.sh` unit tests pass; session-close skill parity drift pre-existing (story waiver).

### File List

- `scripts/lib/resolve-node-toolchain.mjs` (new)
- `src/brain/resolve-node-toolchain.ts` (new)
- `scripts/brain-recall-prefetch.mjs` (updated)
- `scripts/install-hermes-brain-recall-env.sh` (new)
- `scripts/hermes-dashboard-start.sh` (new)
- `scripts/hermes-plugin-examples/cns-brain-recall/references/config-snippet.md` (updated)
- `tests/hermes/cns-brain-recall-plugin.test.ts` (updated)
- `_bmad-output/implementation-artifacts/82-5-brain-recall-prefetch-bare-path-evidence.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)

### Change Log

- 2026-06-30: AC2 clarified — gateway uses two drop-ins (`brain-recall.conf` + `env.conf`); `brain-recall.env` has no PATH; dashboard must install both; AC1 primary + AC2(b) defense-in-depth.
- 2026-06-30: Implemented bare-PATH prefetch resolver, dashboard/gateway env install script, tests, live environ evidence.
