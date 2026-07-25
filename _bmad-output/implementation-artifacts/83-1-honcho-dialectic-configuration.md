---
story_id: 83-1
epic: 83
title: honcho-dialectic-configuration
status: done
zone: WSL ~/.hermes/ (config.yaml, honcho.json, .env)
branch: hermes-consolidation
evidence_file: _bmad-output/implementation-artifacts/83-1-honcho-config-evidence.md
baseline_hermes_version: v0.17.0 (2026.6.19)
context7_sources:
  - /nousresearch/hermes-agent — memory-providers.md, honcho.md, plugins/memory/honcho/README.md
  - /plastic-labs/honcho — Hermes integration guide
operator_review_gate: APPROVED 2026-07-05 — dialecticCadence 3; managed-first + self-host migration doc in evidence
---

# Story 83.1: Honcho dialectic configuration

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. PROPOSE-THEN-STOP: proposed Honcho config is in §Proposed Configuration; operator must approve before dev-story applies any ~/.hermes changes. -->

## Story

As an **operator**,
I want **Honcho user-modeling configured in Hermes**,
so that **dialectic memory complements native memory without occupying Brain's `pre_llm_call` slot (FR15)**.

## Acceptance Criteria

1. **Context7-first configuration (NFR7)**
   **Given** Hermes Honcho memory-provider docs fetched via Context7 (`/nousresearch/hermes-agent`, `/plastic-labs/honcho`)
   **When** this story's proposed config is reviewed
   **Then** implementation follows Context7 doc patterns — not training-data guesses
   **And** evidence cites Context7 doc sections used

2. **Honcho live as external MemoryProvider**
   **Given** current baseline: `memory.provider: ''`, `honcho: {}`, no `~/.hermes/honcho.json`
   **When** operator-approved config is applied
   **Then** `memory.provider: honcho` in `~/.hermes/config.yaml`
   **And** `~/.hermes/honcho.json` exists with active `hosts.hermes` block per Context7 minimal cloud pattern
   **And** `HONCHO_API_KEY` set in `~/.hermes/.env` only (never in git, never in evidence)
   **And** `hermes honcho status` (post-activation) or `hermes memory setup honcho` wizard output shows connected / ready
   **And** Hermes gateway starts without Honcho init errors in `~/.hermes/logs/gateway.log`

3. **Epic 79 Brain recall UNCHANGED (CRITICAL)**
   **Given** `cns-brain-recall` plugin is enabled with `shadow_mode: false` in `config/brain-recall-policy.json`
   **When** Honcho is activated
   **Then** `plugins.enabled` still includes `cns-brain-recall` — do not disable, remove, or reorder
   **And** **zero edits** to:
   - `~/.hermes/plugins/cns-brain-recall/` (installed plugin)
   - `scripts/hermes-plugin-examples/cns-brain-recall/`
   - `scripts/install-hermes-plugin-cns-brain-recall.sh`
   - `config/brain-recall-policy.json` (unless operator explicitly requests — out of scope)
   - `CNS_*` env vars for Brain recall
   **And** post-activation smoke: one Discord or CLI turn shows Brain recall injection still fires (log line with `cns-brain-recall` or cited vault block — not shadow-only)
   **And** architecture invariant preserved: Honcho uses `MemoryProvider.prefetch_all`; Brain uses `pre_llm_call` plugin — orthogonal seams per ADR-HERMES-015

4. **Native memory preserved alongside Honcho**
   **Given** built-in memory is ACTIVE per `memory-pillars-verification.md`
   **When** Honcho activates
   **Then** `memory.memory_enabled: true` and `memory.user_profile_enabled: true` remain unchanged
   **And** `MEMORY.md` / `USER.md` / SQLite FTS continue operating (Honcho **adds** dialectic layer; does not replace native files in 83-1)
   **And** memory char limits unchanged in 83-1 (Story 83-2 owns limit raises)

5. **Evidence file — redacted (NFR4)**
   **Given** config-only operator story
   **When** story completes
   **Then** `_bmad-output/implementation-artifacts/83-1-honcho-config-evidence.md` exists with:
   - Hermes version + Portal login status (no tokens)
   - Redacted `memory.provider` + `honcho.json` excerpt (peerName/workspace/recallMode/dialectic knobs — no apiKey)
   - `hermes honcho status` output (redacted)
   - Brain recall unchanged proof: `plugins.enabled` grep + one recall smoke log excerpt
   - **Cost lever:** dialectic cost range (~$0.001–$0.50/query per Story 57-4 eval) and active knobs (`dialecticCadence: 3`, `dialecticReasoningLevel: low`, `dialecticDynamic: true`)
   - **Managed → self-host migration** subsection (first-class deliverable): exact steps to later point `hosts.hermes` at self-hosted `baseUrl` (e.g. `http://localhost:8000`), what changes (`baseUrl`, swap/remove `HONCHO_API_KEY`, optional local JWT in host block), and what stays identical (`peerName`, `workspace`, dialectic knobs, `plugins.enabled`). Actual self-host deployment is a future story — documented path only.
   - Rollback procedure (AC #6)
   - Explicit note: `memory-pillars-verification.md` Honcho status update is **out of scope** (operator constitution follow-up)
   **And** git diff contains no `.env`, `auth.json`, API keys, or OAuth secrets

6. **Reversibility (NFR5)**
   **Given** config backup taken before edits (`~/.hermes/config.yaml.bak-YYYY-MM-DD-83-1`, `~/.hermes/honcho.json.bak-*` if created)
   **When** operator needs to disable Honcho
   **Then** evidence documents rollback:
   ```bash
   hermes config set memory.provider ""
   # optional: hermes honcho disable  (when honcho subcommand available)
   # remove or rename ~/.hermes/honcho.json
   # remove HONCHO_API_KEY line from ~/.hermes/.env (or comment out)
   # restart Hermes gateway / new session
   ```
   **And** `cns-brain-recall` remains enabled throughout rollback — Brain recall unaffected

7. **Scope boundary — config only (NFR2)**
   **Given** protect-list and WriteGate constraints
   **When** implementation completes
   **Then** **zero diffs** in:
   - `src/agents/*-adapter-llm.ts`, `scripts/run-chain.ts`, `src/agents/run-chain.ts`
   - `AI-Context/**`, vault `AGENTS.md`, `MEMORY.md` (WriteGate — NFR8)
   - `specs/cns-vault-contract/modules/memory-pillars-verification.md` (separate operator follow-up)
   **And** no edits to `~/.hermes/hermes-agent` core fork
   **And** `bash scripts/verify.sh` passes (NFR1)

8. **Operator review gate (PROPOSE-THEN-STOP)**
   **Given** this story file §Proposed Configuration
   **When** dev-story begins
   **Then** dev agent presents proposed config to operator and **waits for explicit approval** before writing any `~/.hermes` files
   **And** if operator requests changes, update proposal in evidence draft — do not apply until re-approved

## Tasks / Subtasks

- [x] **AC #8 — Operator review** (AC: #8)
  - [x] Present §Proposed Configuration to operator
  - [x] Record approval (or revision notes) in evidence file header
  - [x] **STOP until approved** — approved 2026-07-05 (dialecticCadence 3; self-host migration doc)

- [x] **AC #1 — Context7 preflight** (AC: #1)
  - [x] Re-fetch `/nousresearch/hermes-agent` + `/plastic-labs/honcho` if Hermes version changed since story creation
  - [x] Confirm `memory.provider` + `honcho.json` pattern still matches docs

- [x] **AC #2 — Preflight backup** (AC: #2, #6)
  - [x] `cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-$(date +%F)-83-1`
  - [x] Confirm `HONCHO_API_KEY` available in operator vault/secrets (do not echo) — **commented placeholder only; operator must set before Honcho connects**
  - [x] Confirm Honcho account at https://app.honcho.dev (operator action if missing)

- [x] **AC #2 — Apply approved config** (AC: #2)
  - [x] Manual path applied (see §Proposed Configuration)
  - [x] Verify `grep -A2 '^memory:' ~/.hermes/config.yaml` shows `provider: honcho`

- [x] **AC #3 — Brain recall regression gate** (AC: #3)
  - [x] Before + after: `grep -A3 '^plugins:' ~/.hermes/config.yaml` — `cns-brain-recall` present
  - [x] Confirm `config/brain-recall-policy.json` → `shadow_mode: false` unchanged
  - [x] Plugin contract smoke via vitest e2e (22/22 PASS)
  - [x] Live gateway turn `20260705_230038_7b625e1e`: Honcho activated + `cns-brain-recall` on `pre_llm_call` same turn + Honcho session created (see evidence §AC #3)

- [x] **AC #5–#6 — Evidence + rollback** (AC: #5, #6)
  - [x] Write `83-1-honcho-config-evidence.md` (redacted)
  - [x] Document rollback table with prior `memory.provider` value (`''`)

- [x] **AC #7 — Verify gate** (AC: #7)
  - [x] `npm test` Omnipotent.md — 781/781 PASS
  - [x] `bash scripts/verify.sh` — PASS (781/781 + 702/702; `notebookQueries.test.ts` 11/11)

## Dev Notes

### Architecture: two orthogonal memory seams

Per `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` ADR-HERMES-015:

| Layer | Mechanism | Slot | Story |
|-------|-----------|------|-------|
| Vault corpus recall (Brain) | `pre_llm_call` plugin `cns-brain-recall` | Plugin hook — **not** MemoryProvider | Epic 79 (live) |
| Dialectic user modeling (Honcho) | External `MemoryProvider` (`memory.provider: honcho`) | Single external provider slot | **This story** |
| Native curated memory | Built-in (`MEMORY.md`, `USER.md`, SQLite FTS) | Always on when `memory_enabled: true` | Epic 57 / session-close |

Honcho `prefetch_all` injects dialectic context; Brain plugin injects cited vault chunks via `pre_llm_call`. **No slot conflict.**

### Current baseline (2026-07-05, Story 76-6 verified)

```yaml
# ~/.hermes/config.yaml (excerpt)
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: false
  memory_char_limit: 2200
  user_char_limit: 1375
  provider: ''          # ← change to honcho
honcho: {}              # ← may remain {} (advanced timeout overrides only)
plugins:
  enabled:
  - cns-brain-recall    # ← MUST stay
  disabled: []
```

```json
// config/brain-recall-policy.json
"shadow_mode": false    // production recall ON — do not change in 83-1
```

No `~/.hermes/honcho.json` exists today. Honcho pillar status: **GATED** in `specs/cns-vault-contract/modules/memory-pillars-verification.md`.

### Context7 activation model (NOT just `honcho: {}`)

Hermes v0.17.0 Honcho integration uses **three coordinated artifacts** (Context7: `memory-providers.md`, `plugins/memory/honcho/README.md`):

1. **`memory.provider: honcho`** in `config.yaml` — selects Honcho as the single external MemoryProvider
2. **`~/.hermes/honcho.json`** — Honcho-specific settings (hosts, dialectic, observation, session strategy)
3. **`HONCHO_API_KEY`** in `~/.hermes/.env` — auth (falls back from env; do not commit apiKey in honcho.json)

The YAML `honcho: {}` block is **optional** advanced overrides (e.g. `request_timeout`) — **not** the primary activation surface. Epic wording "`honcho: {}` → live" means the **inert Honcho subsystem** becomes active via the trio above; `honcho: {}` may remain empty.

**Config resolution order for honcho.json:** `$HERMES_HOME/honcho.json` > `~/.hermes/honcho.json` > `~/.honcho/config.json`

### Privacy / operator awareness (Story 57-4)

Honcho cloud sends conversation content to `api.honcho.dev` for dialectic reasoning. CNS deferred commercial memory SaaS until v1.5 gate — operator explicitly un-gates here. Do **not** route raw vault bodies or AGENTS.md content through Honcho tools manually. Session-close → Honcho feeding is Story 83-3.

---

## Proposed Configuration

> **OPERATOR REVIEW REQUIRED.** Dev-story must not apply until you approve this block (or annotate revisions).

### Recommended path: setup wizard

```bash
hermes memory setup honcho
# Select: cloud
# Paste API key from https://app.honcho.dev (goes to ~/.hermes/.env)
# Follow prompts for peerName, workspace, gateway identity (single-operator → pinUserPeer)
```

Wizard writes `honcho.json` and sets `memory.provider: honcho`. Then tune dialectic knobs via `hermes honcho peer`, `hermes honcho tokens`, `hermes honcho mode` if defaults need adjustment.

### Manual path (if wizard skipped)

**Step 1 — `~/.hermes/config.yaml`**

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: false
  memory_char_limit: 2200      # unchanged — 83-2 raises
  user_char_limit: 1375        # unchanged — 83-2 raises
  provider: honcho             # was ''
  nudge_interval: 10
  flush_min_turns: 6
honcho: {}                     # optional; leave empty unless timeout overrides needed
plugins:
  enabled:
  - cns-brain-recall           # DO NOT REMOVE
  disabled: []
```

CLI equivalent:
```bash
hermes config set memory.provider honcho
```

**Step 2 — `~/.hermes/.env`** (operator-only, never commit)

```bash
# Append if not present — operator supplies real key
HONCHO_API_KEY=<from app.honcho.dev>
```

**Step 3 — `~/.hermes/honcho.json`** (proposed CNS defaults)

Derived from Context7 minimal cloud config + CNS single-operator Discord gateway + token budget alignment:

```json
{
  "hosts": {
    "hermes": {
      "enabled": true,
      "aiPeer": "hermes",
      "peerName": "chris",
      "workspace": "cns-jarvis",
      "recallMode": "hybrid",
      "writeFrequency": "async",
      "sessionStrategy": "global",
      "contextCadence": 1,
      "contextTokens": 1200,
      "dialecticCadence": 3,
      "dialecticDepth": 1,
      "dialecticReasoningLevel": "low",
      "dialecticDynamic": true,
      "dialecticMaxChars": 600,
      "saveMessages": true,
      "pinUserPeer": true,
      "observation": {
        "user": { "observeMe": true, "observeOthers": true },
        "ai": { "observeMe": true, "observeOthers": true }
      }
    }
  }
}
```

**Rationale for proposed knobs:**

| Knob | Value | Why |
|------|-------|-----|
| `workspace` | `cns-jarvis` | Isolated Honcho workspace for CNS operator (operator may prefer `hermes` default) |
| `peerName` | `chris` | Matches vault `USER.md` operator identity |
| `pinUserPeer` | `true` | Single-operator Discord gateway — all platform IDs collapse to one peer (Honcho setup tree: "just me") |
| `sessionStrategy` | `global` | Cross-session dialectic continuity (FR15); Discord has no cwd |
| `recallMode` | `hybrid` | Auto-inject + `honcho_*` tools (Context7 default) |
| `contextTokens` | `1200` | Caps Honcho injection ~AGENTS §6.5 spirit; separate from MEMORY.md 2200 char cap |
| `dialecticCadence` | `3` | Cheaper v1.5 start (operator-approved over default 2); `dialecticDynamic: true` allows per-call tuning; raise cadence later if freshness insufficient |
| `dialecticDepth` | `1` | Conservative v1.5 start; raise in 83-2 if operator wants deeper reasoning |
| `dialecticReasoningLevel` | `low` | Cost control on managed API (~$0.001–$0.50/query per 57-4 eval) |
| `writeFrequency` | `async` | Non-blocking gateway turns |

**NOT in honcho.json:** `apiKey` — use `HONCHO_API_KEY` env per Hermes docs (resolution: env > honcho.json root).

### How Honcho registers alongside cns-brain-recall

```
Turn lifecycle (simplified):
  1. MemoryProvider.prefetch_all()  ← Honcho base + dialectic context (system/user assembly)
  2. pre_llm_call plugins           ← cns-brain-recall appends vault citations to user message
  3. LLM API call
```

No `plugins.enabled` entry needed for Honcho — activation is solely `memory.provider: honcho`. Do **not** add Honcho to `plugins.enabled` (memory providers use `kind: exclusive`, routed via `memory.provider` per Hermes plugin docs).

### Post-activation verification commands

```bash
grep -A8 '^memory:' ~/.hermes/config.yaml
grep -A3 '^plugins:' ~/.hermes/config.yaml
test -f ~/.hermes/honcho.json && python3 -m json.tool ~/.hermes/honcho.json | head -30
hermes honcho status          # after provider=honcho
# Brain recall smoke — one turn in #hermes, then:
grep -i 'cns-brain-recall\|brain-recall' ~/.hermes/logs/gateway.log | tail -5
```

### Reversibility (full rollback)

```bash
cp ~/.hermes/config.yaml.bak-*-83-1 ~/.hermes/config.yaml   # or:
hermes config set memory.provider ""
mv ~/.hermes/honcho.json ~/.hermes/honcho.json.disabled-83-1
# Comment out HONCHO_API_KEY in ~/.hermes/.env
# Restart gateway / new Hermes session
# Confirm: grep cns-brain-recall still in plugins.enabled; recall smoke still passes
```

---

## Technical Requirements

- Hermes v0.17.0+ with Honcho memory provider plugin bundled (`plugins/memory/honcho/`)
- Python dep: `pip install honcho-ai` (if `hermes doctor` reports missing — operator installs in WSL venv Hermes uses)
- Portal OAuth still required for main model (`provider: nous`) — unchanged from Epic 74
- Operator must hold Honcho cloud API key before dev-story execution

## Architecture Compliance

- ADR-HERMES-015: Brain recall stays on `pre_llm_call`; Honcho occupies external MemoryProvider slot only
- FR15: dialectic user modeling via Honcho — v1.5 tranche un-gate
- NFR2: no protect-list edits
- NFR5: documented rollback
- NFR7: Context7 before config
- NFR8: no direct AI-Context/AGENTS.md/MEMORY.md edits
- NFR-GOV-1: config-only; no silent vault mutation

## Library / Framework Requirements

| Source | Context7 ID | Used for |
|--------|-------------|----------|
| Hermes Agent | `/nousresearch/hermes-agent` | `memory.provider`, `hermes memory setup honcho`, honcho.json schema, prefetch vs pre_llm_call |
| Honcho | `/plastic-labs/honcho` | Peer/workspace model, cloud API auth, integration guide |

## File Structure Requirements

| Path | Action | Notes |
|------|--------|-------|
| `~/.hermes/config.yaml` | UPDATE | `memory.provider: honcho` only (+ optional honcho: timeouts) |
| `~/.hermes/honcho.json` | CREATE | Proposed block above |
| `~/.hermes/.env` | UPDATE | `HONCHO_API_KEY` — operator secret |
| `_bmad-output/implementation-artifacts/83-1-honcho-config-evidence.md` | CREATE | Redacted evidence |
| `config/brain-recall-policy.json` | **NO TOUCH** | shadow_mode must stay false |
| `~/.hermes/plugins/cns-brain-recall/**` | **NO TOUCH** | Epic 79 production plugin |
| `specs/.../memory-pillars-verification.md` | **NO TOUCH** | Separate constitution follow-up |

## Testing Requirements

- `bash scripts/verify.sh` — mandatory pass (no new unit tests required; config-only story)
- Manual smoke: Honcho status connected + Brain recall log on one turn
- Regression: `npm run test:vitest -- tests/hermes/cns-brain-recall-plugin.test.ts` still passes (repo-side plugin contract unchanged)

## Previous Story Intelligence

**Story 76-6** (`76-6-memory-pillars-and-honcho-verification.md`):
- Documented Honcho as **GATED** with `honcho: {}`; remediation = Epic 83
- Verified native 3-layer memory ACTIVE; session-close feeds MEMORY.md + SQLite
- Explicitly did **not** activate Honcho — this story is the authorized un-gate

**Story 57-4** (`docs/research/57-4-external-memory-provider-eval.md`):
- Honcho fit score 4/5; deferred until measurable gates
- Cloud pricing: ~$2/M tokens ingest; dialectic queries tiered by reasoning level
- Privacy: conversation excerpts egress to Honcho SaaS — operator accepts at v1.5 gate

**Epic 79 (79-5 evidence)**:
- `cns-brain-recall` v0.2.0 enabled; `shadow_mode: false` after calibration
- Install path: `bash scripts/install-hermes-plugin-cns-brain-recall.sh`
- Env: `CNS_OMNIPOTENT_ROOT`, `CNS_BRAIN_INDEX_PATH`, `CNS_VAULT_ROOT`

## Latest Tech Information (Context7, 2026-07-05)

- Honcho is a **Memory Provider plugin** (`kind: exclusive`), not a `plugins.enabled` entry
- Activation: `hermes memory setup honcho` OR `hermes config set memory.provider honcho` + env key
- `hermes honcho *` subcommands register **only after** `memory.provider: honcho`
- Honcho injects via `MemoryProvider.prefetch_all` (user-message assembly); preserves system prompt cache
- `pre_llm_call` plugin context merges separately — Brain recall unaffected
- OAuth sign-in also supported for Honcho cloud (wizard); API key in `.env` is manual alternative
- Managed Honcho cloud for v1.5 activation; **self-host escape hatch documented** in evidence §Managed → self-host migration (future story deploys server; this story documents the config path only)

## Project Context Reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` §6.5 token budgets
- Memory pillars: `specs/cns-vault-contract/modules/memory-pillars-verification.md` (Honcho row → update in separate follow-up)
- Architecture: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` § ADR-HERMES-015, FR15 defer table
- Epic spec: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §611–627
- Deferred: `_bmad-output/implementation-artifacts/deferred-work.md` (check for Honcho-related items)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Config backup: `~/.hermes/config.yaml.bak-2026-07-05-83-1`
- `hermes config set memory.provider honcho`
- `~/.hermes/honcho.json` created with operator-approved knobs; **cadence fix:** `dialecticCadence: 3` hoisted to top level (runtime reads `cfg.raw.get('dialecticCadence')`, not `hosts.hermes`)
- Live turn `20260705_230038_7b625e1e`: Honcho session + Brain recall same turn

### Completion Notes List

- Story amended per operator revisions: dialecticCadence 3; AC #5 self-host migration deliverable; managed-first posture in Latest Tech Information.
- Honcho config applied and live; `HONCHO_API_KEY` set; gateway connected to managed cloud.
- **Cadence placement fix:** top-level `dialecticCadence: 3` required — nested-only value was inert (runtime defaulted to every-turn dialectic). Verified: `hermes honcho status` → `Dialectic cad: every 3 turns`.
- `cns-brain-recall` plugin untouched; `shadow_mode: false` unchanged. AC #3 live-verified on turn `20260705_230038_7b625e1e` (Honcho + Brain recall same turn; prefetch failure unrelated Portal-embeddings issue).
- First-session data egress: `MEMORY.md` + `USER.md` uploaded to `api.honcho.dev` (user peer).
- `bash scripts/verify.sh` PASS (781/781 + 702/702; `notebookQueries.test.ts` 11/11). Evidence corrected 2026-07-05 post operator live verification.

### File List

- `~/.hermes/config.yaml` (modified — memory.provider)
- `~/.hermes/honcho.json` (created; top-level `dialecticCadence: 3`)
- `~/.hermes/config.yaml.bak-2026-07-05-83-1` (backup)
- `_bmad-output/implementation-artifacts/83-1-honcho-config-evidence.md` (created; corrected post-live)
- `_bmad-output/implementation-artifacts/83-1-honcho-dialectic-configuration.md` (amended)

### Change Log

- 2026-07-05: Evidence correction — removed false CLI display-label claim; documented top-level `dialecticCadence` root cause; verify.sh PASS; AC #3 live verification + data egress note; status → done.

---

**Story completion status:** done — Honcho live on managed cloud; Brain recall seam verified; verify gate PASS. No commit (operator review).
