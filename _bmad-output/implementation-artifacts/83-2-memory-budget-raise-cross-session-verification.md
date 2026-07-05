---
story_id: 83-2
epic: 83
title: memory-budget-raise-cross-session-verification
status: done
zone: WSL ~/.hermes/config.yaml (config-only)
branch: hermes-consolidation
evidence_file: _bmad-output/implementation-artifacts/83-2-memory-budget-evidence.md
depends_on: 83-1-honcho-dialectic-configuration (done)
baseline_hermes_version: v0.17.0 (2026.6.19)
context7_sources:
  - /nousresearch/hermes-agent — memory.md, configuration.md, memory_tool.py (MemoryStore)
operator_review_gate: APPROVED 2026-07-05 — memory_char_limit 4400, user_char_limit 2750
---

# Story 83.2: Memory budget raise + cross-session verification

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. PROPOSE-THEN-STOP: proposed ceilings and cost table in §Proposed Ceilings; operator must approve before dev-story writes ~/.hermes/config.yaml. -->

## Story

As an **operator**,
I want **sane `memory_char_limit` / `user_char_limit` and verified cross-session recall**,
so that **preferences persist without manual session-close every time (FR15)**.

## Acceptance Criteria

1. **Context7-first semantics (NFR7)**
   **Given** Hermes memory docs fetched via Context7 (`/nousresearch/hermes-agent`)
   **When** this story's proposed ceilings are reviewed
   **Then** implementation follows Context7 doc patterns for `memory_char_limit` / `user_char_limit`
   **And** evidence cites Context7 sections confirming caps govern injection/truncation of `~/.hermes/memories/MEMORY.md` and `USER.md`

2. **Operator-approved ceilings applied (OQ-7)**
   **Given** baseline caps `memory_char_limit: 2200`, `user_char_limit: 1375` (verified 2026-07-05)
   **When** operator approves §Proposed Ceilings and dev-story applies config
   **Then** `~/.hermes/config.yaml` reflects approved values for both keys only
   **And** `memory_enabled: true`, `user_profile_enabled: true`, `memory.provider: honcho` unchanged
   **And** backup exists: `~/.hermes/config.yaml.bak-$(date +%F)-83-2`

3. **Cross-session persistence — real two-session test**
   **Given** Honcho live (83-1) and native memory enabled
   **When** Session A: operator states a **durable preference** (non-secret, clearly attributable to operator identity)
   **Then** Hermes persists it via native memory tool to `MEMORY.md` and/or `USER.md` (confirm on disk; redact content in evidence)
   **When** Session B: **fresh** Hermes session (new gateway session / restart; not same in-memory turn)
   **Then** Hermes recalls the preference **without** operator re-stating it
   **And** evidence documents both sessions with redacted transcripts (NFR4)

4. **WriteGate unchanged (NFR8)**
   **Given** USER.md is vault-symlinked (`~/.hermes/memories/USER.md` → `AI-Context/USER.md`)
   **When** this story completes
   **Then** **no direct edits** to `AI-Context/AGENTS.md`, vault `MEMORY.md` body, or `USER.md` content by the dev agent
   **And** only the **config char-limit knob** changes; memory content changes only via Hermes memory tool during the operator-led cross-session test

5. **Reversibility (NFR5)**
   **Given** config backup taken before edits
   **When** operator needs to revert
   **Then** evidence documents restoring prior limits (`2200` / `1375`) from `config.yaml.bak-*-83-2` or:
   ```bash
   hermes config set memory.memory_char_limit 2200
   hermes config set memory.user_char_limit 1375
   # or: cp ~/.hermes/config.yaml.bak-*-83-2 ~/.hermes/config.yaml
   # restart gateway / new session
   ```

6. **Scope boundary — config only (NFR2)**
   **Given** protect-list and Honcho/Brain constraints
   **When** implementation completes
   **Then** **zero diffs** in:
   - `src/agents/*-adapter-llm.ts`, `scripts/run-chain.ts`, `src/agents/run-chain.ts`
   - `~/.hermes/honcho.json`, `config/brain-recall-policy.json`, `~/.hermes/plugins/cns-brain-recall/**`
   - `AI-Context/**`, vault `AGENTS.md`
   **And** `bash scripts/verify.sh` passes (NFR1)
   **And** no git commit (operator review)

7. **Operator review gate (PROPOSE-THEN-STOP)**
   **Given** §Proposed Ceilings and cost table below
   **When** dev-story begins
   **Then** dev agent presents proposal to operator and **waits for explicit approval** before writing `~/.hermes/config.yaml`
   **And** if operator requests different ceilings, update evidence draft — do not apply until re-approved

## Tasks / Subtasks

- [x] **AC #7 — Operator review** (AC: #7)
  - [x] Present §Proposed Ceilings + cost table to operator
  - [x] Record approval (or revision) in evidence file header
  - [x] **STOP until approved** — approved 2026-07-05 (4400/2750)

- [x] **AC #1 — Context7 preflight** (AC: #1)
  - [x] Re-fetch `/nousresearch/hermes-agent` memory docs if Hermes version changed
  - [x] Confirm `memory_char_limit` / `user_char_limit` semantics still match story

- [x] **AC #2 — Apply approved ceilings** (AC: #2, #5)
  - [x] `cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-$(date +%F)-83-2`
  - [x] Set approved `memory_char_limit` and `user_char_limit` (CLI or YAML edit)
  - [x] Verify: `grep -A10 '^memory:' ~/.hermes/config.yaml`

- [x] **AC #3 — Cross-session verification** (AC: #3, #4)
  - [x] **Session A:** CLI `hermes chat -Q` with explicit memory tool add to user store
  - [x] Confirm Hermes `memory` tool write → USER.md 1056→1148 chars; marker on disk (see evidence §flush point)
  - [x] **Session B:** Fresh session `20260705_234251_5bdc2b`; recall probe without re-stating preference — PASS
  - [x] Capture redacted evidence: session IDs, timestamps, recall success/failure

- [x] **AC #5–#6 — Evidence + verify** (AC: #5, #6)
  - [x] Write `83-2-memory-budget-evidence.md` (redacted)
  - [x] Document rollback table with prior values (`2200` / `1375`)
  - [x] `bash scripts/verify.sh` — PASS

## Dev Notes

### Verified baseline (2026-07-05 — do not re-derive)

| Item | Value |
|------|-------|
| `memory_char_limit` | 2200 |
| `user_char_limit` | 1375 |
| `memory_enabled` / `user_profile_enabled` | true / true |
| `memory.provider` | honcho (83-1 live) |
| `~/.hermes/memories/MEMORY.md` | **984 chars** (45% of cap) |
| `~/.hermes/memories/USER.md` | **1056 chars** (77% of cap; symlink → vault `AI-Context/USER.md`) |
| Honcho `contextTokens` | 1200 |
| Brain recall channel (Discord text) | `standard_text`: up to **1500 tokens**, max 4 chunks |

**Key cost insight:** Per-turn native injection = `min(file_size, cap)` for each file. Both files are **under current caps** → raising caps has **zero immediate injection cost**. Cost only rises as files grow toward the new ceiling.

### Context7 semantics (Hermes v0.17.0)

From `/nousresearch/hermes-agent` (`memory.md`, `configuration.md`, `memory_tool.py`):

- **`memory_char_limit`** / **`user_char_limit`** are **character limits** on the curated memory stores (`MEMORY.md`, `USER.md`).
- Defaults: **2200** (~800 tokens) and **1375** (~500 tokens) per Hermes docs.
- **Injection model:** At session start, `MemoryStore.load_from_disk()` reads both files, builds a **frozen system-prompt snapshot** (`_system_prompt_snapshot`). Mid-session tool writes persist to disk but **do not mutate the injected snapshot until the next session** (prefix-cache stability).
- **Capacity enforcement:** The `memory` tool rejects adds that would exceed the store limit; agent must consolidate (`replace`/`remove`) when near cap.
- **No documented hard maximum** above defaults in Context7 — limits are operator-configurable YAML scalars.
- **Truncation:** Store limits bound **entry accumulation**, not head/tail file truncation like context-files (20k char files). When at cap, new entries fail until consolidation.

**Implication for 83-2:** Raising caps increases **headroom for future writes** and **future per-session injection ceiling**; it does not change today's injection while files stay small.

### Per-turn context stack (orthogonal layers)

```
Turn lifecycle (memory-related injection only):
  1. Native MEMORY.md + USER.md  ← memory_char_limit / user_char_limit (THIS STORY)
  2. Honcho prefetch_all           ← contextTokens: 1200 (83-1; unchanged)
  3. cns-brain-recall pre_llm_call ← standard_text up to 1500 tok / 4 chunks (unchanged)
```

Honcho and Brain are **not** governed by `memory_char_limit`. Do not conflate stacks when estimating cost.

---

## Proposed Ceilings

> **OPERATOR REVIEW REQUIRED.** Dev-story must not apply until you approve this block (or annotate revisions). Resolves **OQ-7** at v1.5 gate.

### Recommendation: ~2× headroom (modest, cost-sensitive)

| Key | Current | Proposed | Rationale |
|-----|---------|----------|-----------|
| `memory_char_limit` | 2200 | **4400** | 2× default/current; MEMORY at 984 chars today (~45% of cap). Headroom for session-close CNS State growth + learned facts without consolidation churn. |
| `user_char_limit` | 1375 | **2750** | 2× default/current; USER at 1056 chars today (**77% of cap** — closest pressure point). Prevents near-term write rejections as operator profile grows. |

**Not recommended:** 5× raise (11000/6875) — max theoretical native injection +~3575 chars (~894 tok) vs current cap max with no near-term file-size justification; operator is Portal cost-sensitive (session-close ~$3–5/run).

**AGENTS §6.5 note:** Constitution lists softer targets (MEMORY ≤2000, USER ≤1200 chars). Hermes config caps are the **runtime enforcement** surface; session-close scripts target AGENTS budgets independently. This story adjusts Hermes knobs only — no AGENTS.md edit (WriteGate).

### Per-turn token + cost comparison

Token estimates use **chars ÷ 4** (Epic 29 audit convention). Honcho/recall use configured token budgets directly.

| Layer | **Now — actual injection** | **Now — if files hit current cap** | **Proposed — actual today** | **Proposed — if files hit new cap** |
|-------|---------------------------|-------------------------------------|----------------------------|-------------------------------------|
| Native MEMORY | 984 chars ≈ **246 tok** | 2200 ≈ **550 tok** | 984 ≈ **246 tok** *(unchanged)* | 4400 ≈ **1100 tok** |
| Native USER | 1056 chars ≈ **264 tok** | 1375 ≈ **344 tok** | 1056 ≈ **264 tok** *(unchanged)* | 2750 ≈ **688 tok** |
| **Native subtotal** | **≈ 510 tok** | **≈ 894 tok** | **≈ 510 tok** | **≈ 1788 tok** |
| Honcho (`contextTokens`) | 1200 tok | 1200 tok | 1200 tok | 1200 tok |
| Brain recall (`standard_text`) | up to 1500 tok | up to 1500 tok | up to 1500 tok | up to 1500 tok |
| **Stack total (injection layers)** | **≈ 3210 tok** | **≈ 3594 tok** | **≈ 3210 tok** | **≈ 4488 tok** |

**Marginal cost summary:**

| Scenario | Δ vs today (actual) | Δ vs today (current cap max) |
|----------|---------------------|------------------------------|
| Apply proposed caps **today** | **$0 / 0 tok** — files under both old and new caps | n/a |
| Files grow to **new cap max** | +894 native tok vs current cap max (+25% on injection stack) | Only when MEMORY+USER actually fill |

Honcho dialectic API cost (83-1) is **unchanged** by this story — separate billing per turn cadence.

### CLI apply path (after approval)

```bash
cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-$(date +%F)-83-2
hermes config set memory.memory_char_limit 4400
hermes config set memory.user_char_limit 2750
grep -A10 '^memory:' ~/.hermes/config.yaml
# restart gateway or start fresh session for snapshot reload
```

---

## Cross-Session Verification Protocol

**Goal:** Prove **native** Hermes memory persists across sessions (FR15), distinct from Honcho dialectic recall.

### Test preference (operator chooses; examples)

Use a **non-secret**, **durable**, **easily verifiable** preference, e.g.:
- "For CNS status updates, prefer bullet lists over paragraphs."
- "When I ask for research summaries, default to 3 bullet takeaways."

Avoid secrets, API keys, or WriteGate-sensitive constitution edits.

### Session A procedure

1. Operator states preference naturally in #hermes (or CLI).
2. Confirm Hermes invokes `memory` tool (`add`/`replace` on `memory` or `user` store).
3. Verify on disk:
   ```bash
   wc -c ~/.hermes/memories/MEMORY.md ~/.hermes/memories/USER.md
   # note mtime; grep -i '<keyword>' redacted in evidence only
   ```
4. Record session ID / timestamp from gateway log (redact message body in evidence).

### Session B procedure

1. **Fresh session:** restart Hermes gateway **or** explicit new session boundary (not continuation of Session A transcript in same snapshot).
2. Operator asks recall probe **without** re-stating preference, e.g. "What format do I prefer for status updates?"
3. **Pass:** Hermes answer reflects Session A preference citing native memory (not guesswork).
4. **Fail:** Document failure mode; do not mark story done.

### Honcho vs native disambiguation

- Native recall → content traceable to `MEMORY.md`/`USER.md` entries written in Session A.
- Honcho may also contribute — evidence should note which layer surfaced the preference (gateway log memory block vs Honcho dialectic block).
- Primary AC is **native file-backed memory** persistence.

---

## Technical Requirements

- Hermes v0.17.0+ with native memory + Honcho provider (83-1 baseline)
- Operator-led Session A/B (dev agent documents; operator performs preference statement)
- Gateway log access: `~/.hermes/logs/gateway.log` (redact in evidence)

## Architecture Compliance

- **FR15:** Progressive operator learning — memory budget + cross-session verification tranche
- **ADR-HERMES-015:** Brain recall on `pre_llm_call` unchanged; Honcho on MemoryProvider unchanged
- **NFR2:** protect-list zero edits
- **NFR5:** documented rollback to 2200/1375
- **NFR6:** injection cost bounded — marginal native cost zero until files grow
- **NFR7:** Context7 before config
- **NFR8:** no direct AI-Context/AGENTS.md edit
- **OQ-7:** resolved when operator approves §Proposed Ceilings

## Library / Framework Requirements

| Source | Context7 ID | Used for |
|--------|-------------|----------|
| Hermes Agent | `/nousresearch/hermes-agent` | `memory_char_limit`, `user_char_limit`, MemoryStore snapshot injection, capacity errors |

## File Structure Requirements

| Path | Action | Notes |
|------|--------|-------|
| `~/.hermes/config.yaml` | UPDATE | **Two keys only:** `memory.memory_char_limit`, `memory.user_char_limit` |
| `~/.hermes/config.yaml.bak-*-83-2` | CREATE | Pre-change backup |
| `_bmad-output/implementation-artifacts/83-2-memory-budget-evidence.md` | CREATE | Redacted Session A/B evidence |
| `~/.hermes/honcho.json` | **NO TOUCH** | 83-1 config frozen |
| `config/brain-recall-policy.json` | **NO TOUCH** | Epic 79 recall policy |
| `~/.hermes/memories/USER.md` | **NO DIRECT EDIT** | Content may change via Hermes memory tool during operator test only |
| `specs/.../memory-pillars-verification.md` | **NO TOUCH** | Separate constitution follow-up |

## Testing Requirements

- `bash scripts/verify.sh` — mandatory pass (no new unit tests; config + manual cross-session story)
- Manual: Session A/B cross-session recall (AC #3)
- Regression: confirm `plugins.enabled` still includes `cns-brain-recall`; Honcho still connected (`hermes honcho status`)

## Previous Story Intelligence

**Story 83-1** (done 2026-07-05):
- Honcho live: `memory.provider: honcho`, `contextTokens: 1200`, `dialecticCadence: 3` (top-level in honcho.json)
- Explicitly deferred char-limit raises to **this story**
- First Honcho session uploaded MEMORY.md + USER.md to managed cloud
- Brain recall orthogonal — verified same turn as Honcho activation
- PROPOSE-THEN-STOP pattern worked — replicate for ceiling approval

**Story 76-6:**
- Native 3-layer memory ACTIVE; caps documented at 2200/1375
- Honcho was GATED — now live per 83-1

**Story 29-0 audit:**
- Established chars÷4 token estimation for MEMORY/USER upper bounds
- Confirmed caps come from config, not file size alone

## Latest Tech Information (Context7, 2026-07-05)

- `memory_char_limit` / `user_char_limit` are YAML-configurable character budgets for MEMORY.md / USER.md stores
- Injection uses **frozen session-start snapshot** — mid-session writes visible next session
- At-cap behavior: memory tool returns capacity error prompting consolidation (not silent truncation)
- Defaults in docs: 2200 / 1375 — proposed 4400 / 2750 are operator overrides, not framework hard limits
- External MemoryProvider (Honcho) uses separate token budget (`contextTokens` in honcho.json)

## Project Context Reference

- Constitution §6.5 token budgets: `specs/cns-vault-contract/AGENTS.md`
- Memory pillars: `specs/cns-vault-contract/modules/memory-pillars-verification.md`
- Epic spec: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §630–644
- PRD FR15 / OQ-7: `_bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/prd.md` §4.6
- Prior story: `_bmad-output/implementation-artifacts/83-1-honcho-dialectic-configuration.md`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Config backup: `~/.hermes/config.yaml.bak-2026-07-05-83-2`
- Session A: `20260705_234227_192363` — memory tool add, USER 1147/2750 reported
- Session B: `20260705_234251_5bdc2b` — recall cited `83-2-CS-TEST` from user profile

### Completion Notes List

- Operator approved 4400/2750; caps applied via `hermes config set`.
- Cross-session test used **explicit memory tool flush** (1 turn, below `flush_min_turns: 6`) — disk char delta confirms persist before Session B.
- Test marker `83-2-CS-TEST` remains in USER.md; operator may remove via memory tool when desired.
- `bash scripts/verify.sh` PASS. No git commit per operator instruction.

### File List

- `~/.hermes/config.yaml` (modified — two memory cap keys)
- `~/.hermes/config.yaml.bak-2026-07-05-83-2` (backup)
- `~/.hermes/memories/USER.md` (modified via Hermes memory tool — test entry)
- `_bmad-output/implementation-artifacts/83-2-memory-budget-evidence.md` (created)
- `_bmad-output/implementation-artifacts/83-2-memory-budget-raise-cross-session-verification.md` (updated)

### Change Log

- 2026-07-05: Applied memory_char_limit 4400, user_char_limit 2750; cross-session recall PASS; evidence + verify gate; status → review.

---

**Story completion status:** review — all ACs satisfied; awaiting code-review. No commit (operator review).
