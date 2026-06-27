---
baseline_commit: a5e36f2
---

# Story 74.3: Auxiliary compression on Portal

Status: done

<!-- Operator-first story: WSL Hermes CLI + routing governance append. NO src/ code changes. Protect-list forbidden. -->

## Story

As an **operator**,
I want **`auxiliary.compression` routed to Portal Haiku**,
so that **the exhausted OpenRouter dependency is removed from context compression (FR2)** while main chat stays on Portal Sonnet from 74-2.

## Acceptance Criteria

1. **Prerequisite — Portal login from 74-2**
   **Given** story **74-2** is **done** (`model.provider: nous`, Portal OAuth active)
   **When** this story begins
   **Then** `hermes portal info` shows **logged in** with **Nous inference provider**
   **And** if Portal auth is missing, **stop** — re-run 74-2 OAuth before continuing

2. **Switch compression provider + model**
   **Given** Portal login from AC #1
   **When** operator runs:
   ```bash
   hermes config set auxiliary.compression.provider nous
   hermes config set auxiliary.compression.model anthropic/claude-haiku-4.5
   ```
   **And** clears stale OpenRouter overrides on the compression block (see Dev Notes — live baseline has inline `base_url` + `api_key` that must not remain):
   ```bash
   hermes config set auxiliary.compression.base_url ""
   hermes config set auxiliary.compression.api_key ""
   ```
   **Then** `grep -A8 'auxiliary:' -A20 ~/.hermes/config.yaml | grep -A6 'compression:'` (or `hermes config show`) shows:
   ```yaml
   auxiliary:
     compression:
       provider: nous
       model: anthropic/claude-haiku-4.5
       base_url: ''
       api_key: ''
   ```
   **And** `hermes config show` **Context Compression** section reports model **`anthropic/claude-haiku-4.5`** (not `openai/gpt-4o-mini` or OpenRouter)

3. **OpenRouter removed from active compression config (FR2)**
   **Given** compression switch from AC #2
   **When** config is inspected
   **Then** `auxiliary.compression.provider` is **`nous`**, not `openrouter`
   **And** no OpenRouter `base_url` or inline `api_key` remains on the compression block
   **And** completion artifact documents that OpenRouter may still exist in `auth.json` / top-level `openrouter:` registry — **only compression must be off OpenRouter** (full account drain is post-Epic-74 ops, see `06-implementation-sequence.md` Phase 1 step 8 note)

4. **Compression smoke — Portal path verified**
   **Given** compression config from AC #2
   **When** operator runs **at least one** verification path:
   - **A (preferred):** Gateway long-context smoke — send a message in Discord `#hermes` or `hermes -z` with a pasted block ≥8k tokens (or multi-turn until `hermes config show` threshold would fire); confirm gateway stays up and **no 402 OpenRouter errors** in recent `~/.hermes/logs/agent.log` (or request dump) for compression/summary calls
   - **B (minimal):** `hermes config show` shows compression model `anthropic/claude-haiku-4.5` + `hermes portal info` still logged in; paste both outputs into evidence file with note "config-only smoke — long-context deferred to 74-5"
   **Then** evidence is captured in `_bmad-output/implementation-artifacts/74-3-compression-portal-evidence.md`
   **And** if compression provider was broken (OpenRouter 402), post-switch logs show **Nous/Portal inference** for summary calls, not `openrouter.ai/api/v1`

5. **Governance — routing.md compression row (NFR5 partial)**
   **Given** compression now on Portal
   **When** `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` Hermes surface subsection (added in 74-2) is updated
   **Then** a **Context compression** row documents:
   - Task: `auxiliary.compression`
   - Provider: `nous`
   - Model: `anthropic/claude-haiku-4.5`
   - Rollback: restore `openrouter` + prior model only if Portal compression fails (reversible)
   **And** existing Epic 15 IDE routing + 74-2 Portal primary rows are **not removed**

6. **No secrets committed (NFR4)**
   **Given** config edits touch `~/.hermes/config.yaml`
   **When** story completes
   **Then** git diff contains **no** `.env`, `auth.json`, or API key material
   **And** evidence file redacts any token/key strings
   **And** inline `api_key` is **removed** from compression block (never copy into repo)

7. **Scope boundary — no code / protect-list changes (NFR2)**
   **Given** this story is operator CLI + governance only
   **When** implementation completes
   **Then** **zero diffs** in protect-list paths:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** no Tool Gateway config — that is **74-4**
   **And** no dashboard/systemd/Desktop work — **74-6+**
   **And** `bash scripts/verify.sh` passes unchanged (NFR1)

## Tasks / Subtasks

- [x] **AC #1 — Verify 74-2 prerequisite** (AC: #1)
  - [x] `hermes portal info` → logged in, Nous inference provider
  - [x] `grep -A4 '^model:' ~/.hermes/config.yaml` → `provider: nous`, `default: anthropic/claude-sonnet-4.6`

- [x] **AC #2 — Switch compression to Portal Haiku** (AC: #2)
  - [x] Back up `~/.hermes/config.yaml` (date suffix copy)
  - [x] Run `hermes config set auxiliary.compression.provider nous`
  - [x] Run `hermes config set auxiliary.compression.model anthropic/claude-haiku-4.5`
  - [x] Clear stale overrides: `base_url ""`, `api_key ""`
  - [x] Verify via `hermes config show` Context Compression section

- [x] **AC #3 — Confirm OpenRouter off compression** (AC: #3)
  - [x] Grep `auxiliary:` → `compression:` block — no `openrouter`, no `openrouter.ai` URL
  - [x] Document in evidence: other OpenRouter references (auth registry) intentionally unchanged

- [x] **AC #4 — Compression smoke + evidence** (AC: #4)
  - [x] Run smoke path A or B; capture logs if path A
  - [x] Create `74-3-compression-portal-evidence.md`

- [x] **AC #5 — routing.md update** (AC: #5)
  - [x] Append compression row to Hermes surface subsection in `routing.md`

- [x] **AC #6–#7 — Scope + verify** (AC: #6, #7)
  - [x] `git status` / `git diff` — no secret files
  - [x] Protect-list paths untouched
  - [x] `bash scripts/verify.sh` — must pass

## Dev Notes

### Epic and sequencing context

- **Epic 74 (Hermes on Portal + Desktop)** — story **74-3** implements **FR2** (auxiliary compression → Portal).
- **Prerequisite done:** **74-2** Portal OAuth + `model.provider: nous` + Sonnet 4.6 default.
- **Blocks:** Nothing critical — **74-4** (Tool Gateway web search) and **74-5** (full Discord/digest regression) can proceed in parallel after 74-2; 74-3 should land **before** declaring OpenRouter fully drained.
- **Out of scope:** Other `auxiliary.*` tasks (`session_search`, `skills_hub`, `vision`, etc.) — only `compression` per FR2/epic AC.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Story 74-3, §FR Coverage FR2]

### Live baseline (verify at story start — do not assume)

| Property | Expected at 74-3 start (post-74-2) | Verify with |
|----------|-----------------------------------|-------------|
| Portal auth | Logged in | `hermes portal info` |
| Main provider | `nous` / `anthropic/claude-sonnet-4.6` | `grep -A4 '^model:' ~/.hermes/config.yaml` |
| **Compression provider** | **`openrouter`** (stale — must change) | `grep -A6 'compression:' ~/.hermes/config.yaml` under `auxiliary:` |
| **Compression model** | **`openai/gpt-4o-mini`** (not Haiku — differs from epic target and from 34-1 intent) | `hermes config show` → Context Compression |
| Compression auth | Inline `api_key` + OpenRouter `base_url` on block (**remove**) | config.yaml — **never paste keys into repo** |
| OpenRouter account | **402 exhausted** — compression summaries fail or fall back | `docs/CNSHermes New Big Plan/01-ground-truth-system-state.md` |
| Compression thresholds | `enabled: true`, `threshold: 0.2`, `protect_last_n: 20` | top-level `compression:` block (unchanged this story) |
| verify.sh | Green on `hermes-consolidation` | `bash scripts/verify.sh` |

**Why this matters:** With OpenRouter 402, context compression is either failing silently (middle turns dropped without summary per Hermes docs) or erroring in logs. Moving compression to Portal is **operational reliability**, not just cost cleanup.

### Operator CLI runbook (canonical sequence)

```bash
# 0. Preconditions
hermes --version          # expect v0.17.x+
hermes portal info        # logged in, Nous inference provider

# 1. Baseline capture (redact secrets in evidence file)
hermes config show | sed -n '/Context Compression/,/^$/p'
grep -A6 'compression:' ~/.hermes/config.yaml | head -20

# 2. Backup config
cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-$(date +%Y%m%d)

# 3. Switch compression to Portal Haiku
hermes config set auxiliary.compression.provider nous
hermes config set auxiliary.compression.model anthropic/claude-haiku-4.5
hermes config set auxiliary.compression.base_url ""
hermes config set auxiliary.compression.api_key ""

# 4. Verify
hermes config show | sed -n '/Context Compression/,/^$/p'
grep -A6 'compression:' ~/.hermes/config.yaml

# 5. Smoke (pick one)
# A — long context (triggers summarization):
hermes -z "$(python3 -c 'print("word " * 12000)')"
# OR paste large text in Discord #hermes after gateway picks up config hot-reload

# B — config-only (minimal):
hermes portal info && hermes config show

# 6. Check logs for OpenRouter 402 (should be absent post-switch)
tail -100 ~/.hermes/logs/agent.log | grep -iE '402|openrouter|compression' || true
```

**Config hot-reload:** Hermes v0.17 reloads `compression.*` and `auxiliary.compression.*` on the **next gateway message** without restart (per Hermes configuration docs). Discord gateway restart is optional unless config doesn't apply.

[Source: `~/.hermes/hermes-agent/website/docs/user-guide/configuration.md` §Context Compression, §Gateway hot-reload]

### Model ID — Portal catalog string

| Context | Model string | Use |
|---------|--------------|-----|
| Portal / Nous (this story) | `anthropic/claude-haiku-4.5` | Epic AC + `06-implementation-sequence.md` Phase 1 step 8 |
| Legacy Anthropic API (run-chain, **not this story**) | `claude-haiku-4-5-20251001` | Story 34-1 auxiliary cost note — **different namespace** |
| Stale live value | `openai/gpt-4o-mini` via OpenRouter | Replace — do not keep |

**Summary model context window:** Haiku 4.5 context must be ≥ main model (Sonnet 4.6). Portal catalog Haiku meets this; if summarization fails with context-length errors, check `hermes config show` and consider `abort_on_summary_failure` behavior in logs.

[Source: Hermes configuration.md §Summary model context length requirement]

### Governance artifact — routing.md compression row template

Append under the **Hermes agent surface (Epic 74)** subsection in `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md`:

```markdown
| Context compression | `nous` (Portal OAuth) | `anthropic/claude-haiku-4.5` | `auxiliary.compression.*` |

**Compression rollback (reversible):**
```bash
hermes config set auxiliary.compression.provider openrouter
hermes config set auxiliary.compression.model openai/gpt-4o-mini
# Only if OpenRouter credits restored — prefer fixing Portal path first
```
```

**WriteGate:** Do **not** edit `AI-Context/AGENTS.md`. Full routing reconcile is **74-8**.

### Explicitly out of scope (defer)

| Action | Story |
|--------|-------|
| `hermes tools` → Web search = Nous Subscription | 74-4 |
| Discord + morning-digest full regression checklist | 74-5 |
| `hermes dashboard register`, systemd, Desktop | 74-6, 74-7 |
| Other auxiliary blocks (`session_search`, `skills_hub`, `vision`) | Not FR2 |
| Remove OpenRouter from `auth.json` entirely | Post-Epic-74 ops (`06-implementation-sequence.md` Phase 1 wrap-up) |
| Run-chain / synthesis OpenRouter path (`CNS_SYNTHESIS_PROVIDER`) | Epic 75 / protect-list |
| Brain Portal `/embeddings` | FR16 stretch (74-1 audit) |

### Architecture compliance

- **NFR2 protect-list:** Zero edits to run-chain adapters/orchestrator.
- **NFR4:** Remove inline compression `api_key`; OAuth/JWT via `nous` provider — no keys in repo.
- **NFR5:** Partial — compression rollback in `routing.md`; full reversibility in 74-8.
- **FR11 Option A:** Unaffected — run-chain still uses `ANTHROPIC_API_KEY`.
- **Untouched:** NEXUS bridge, morning-digest cron, Vault IO MCP, Brain index, main `model.provider` (already nous from 74-2).

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §operatorConstraints.untouched]

### Testing requirements

| Layer | Expectation |
|-------|-------------|
| Automated | `bash scripts/verify.sh` — must pass; **no new tests** (no repo code changes) |
| Manual | AC #4 compression smoke + evidence file |
| Git | No staged secret files; protect-list paths clean |
| Logs | Post-switch: no OpenRouter 402 on compression/summary calls |

### Completion deliverables

| Deliverable | Path |
|-------------|------|
| Operator evidence | `_bmad-output/implementation-artifacts/74-3-compression-portal-evidence.md` (new) |
| Governance | `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (append compression row) |
| Tracker | `sprint-status.yaml` — story `done` |
| This story | Dev Agent Record + status `done` after dev-story |

### Previous story intelligence (74-2)

- Portal OAuth complete 2026-06-24; `model.provider: nous`, default `anthropic/claude-sonnet-4.6`.
- v0.17 uses `hermes config show` (not `config get`); smoke via `hermes -z`.
- Pre-4 paid tier + Tool Gateway confirmed at 74-2.
- `routing.md` Hermes surface subsection exists — **append** compression row, do not replace 74-2 content.
- Evidence pattern: `_bmad-output/implementation-artifacts/74-2-portal-oauth-evidence.md`.

[Source: `_bmad-output/implementation-artifacts/74-2-portal-oauth-login-and-provider-switch.md`]

### Previous story intelligence (74-1)

- Brain **StubEmbedder only** — compression switch does **not** affect Brain index/query.
- Portal inference switch (74-2) and compression switch (74-3) are independent of `src/brain/`.

[Source: `_bmad-output/implementation-artifacts/74-1-brain-embedder-audit-before-portal-switch.md`]

### Git intelligence (hermes-consolidation branch)

Latest commit: `a5e36f2` — 74-2 Portal OAuth done. Expect **routing.md + evidence markdown + sprint-status** as repo-tracked diffs; Hermes state under `~/.hermes/` (gitignored).

### Latest technical specifics (Hermes Agent v0.17 — local docs)

- **Config keys:** `auxiliary.compression.provider`, `.model`, `.base_url`, `.api_key`
- **CLI:** `hermes config set auxiliary.compression.provider nous` (dot-path keys)
- **Provider `nous`:** Uses Portal OAuth from `auth.json` — no inline API key needed
- **Inspect:** `hermes config show` → "Context Compression" section lists effective model
- **Failure mode:** If compression provider unavailable, Hermes **drops middle turns without summary** (silent context loss) — verify Portal path actually works
- **Legacy migration:** Old `compression.summary_*` keys auto-migrate to `auxiliary.compression.*` (config v17)

[Source: `~/.hermes/hermes-agent/website/docs/user-guide/configuration.md`; `docs/CNSHermes New Big Plan/06-implementation-sequence.md` §Phase 1 step 8]

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` (do not edit this story)
- PRD FR2: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR2
- Ground truth OpenRouter 402: `docs/CNSHermes New Big Plan/01-ground-truth-system-state.md`
- Portal integration: `docs/CNSHermes New Big Plan/04-nous-portal-integration.md` §OpenRouter auxiliary compression
- Deferred Pre-2 session-close → **76-1** (Portal provider from 74-2 unblocks LLM steps)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor dev-story)

### Debug Log References

- Story prep 2026-06-24: evidence scaffold + routing.md compression row; paused for operator CLI (AC #1–#4).

### Completion Notes List

- Prep complete: evidence scaffold + routing.md compression row (2026-06-24).
- Operator CLI: compression switched openrouter/gpt-4o-mini → nous/Haiku 4.5; stale base_url + inline api_key cleared.
- Pre-switch baseline had inline OpenRouter api_key on compression block — removed (redacted in evidence).
- Smoke: `hermes -z` with 12k-word prompt → response via Portal; config confirms Haiku 4.5 / nous provider.
- OpenRouter remains in Hermes API Keys registry only (intentional; full drain post-Epic-74).
- verify.sh green; no secrets or protect-list diffs.

### File List

- `_bmad-output/implementation-artifacts/74-3-compression-portal-evidence.md` (operator evidence)
- `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (compression row + rollback)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (74-3 done)
- `_bmad-output/implementation-artifacts/74-3-auxiliary-compression-on-portal.md` (story tracking)

### Change Log

- 2026-06-24: Dev-story prep — evidence scaffold + routing.md compression governance; paused for operator CLI.
- 2026-06-24: Operator CLI complete — compression on Portal Haiku; story done.

## Story completion status

- **Status:** done
- **Context engine:** Ultimate context analysis completed — operator CLI runbook, live baseline, scope guards, and governance template included.
- **Next story after done:** `74-4-tool-gateway-web-search` (FR-GATE) or `74-5-gateway-and-morning-digest-regression-gate`
