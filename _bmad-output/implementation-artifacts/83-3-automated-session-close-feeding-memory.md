---
story_id: 83-3
epic: 83
title: automated-memory-feeding-verify-and-resolve-oq8
display_title: "Automated memory feeding — verify existing automation, resolve OQ-8"
status: done
zone: Omnipotent.md evidence + vault operator guide (03-Resources)
branch: hermes-consolidation
evidence_file: _bmad-output/implementation-artifacts/83-3-automated-memory-feed-evidence.md
depends_on:
  - 83-1-honcho-dialectic-configuration (done)
  - 83-2-memory-budget-raise-cross-session-verification (done)
baseline_hermes_version: v0.17.0 (2026.6.19)
operator_decision_date: 2026-07-06
closes_epic: 83
baseline_commit: 6af2b4405ce93c5e2dcc9b13494a55580cafbd9f
---

# Story 83.3: Automated memory feeding — verify existing automation, resolve OQ-8

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. LEAN / NO BUILD: operator decision 2026-07-06 — do NOT create auto session-close cron; verify + document existing FR15 automation only. -->

## Story

As an **operator**,
I want **verified documentation that memory compounds automatically without scheduled session-close**,
so that **FR15 is satisfied at $0 recurring cost and OQ-8 is closed with a clear manual vs automatic trigger split (FR15, OQ-8)**.

## Acceptance Criteria

1. **Evidence file — live automation proof (NFR4)**
   **Given** Stories 83-1/83-2 complete and operator-verified facts dated **2026-07-06** (§Live Evidence — do not re-derive)
   **When** dev-story completes
   **Then** `_bmad-output/implementation-artifacts/83-3-automated-memory-feed-evidence.md` exists with:
   - Redacted `hermes honcho status` showing User peer card **24 facts** for peer `chris` (was **0** on 2026-07-05) + AI-peer representation
   - Honcho config excerpt: `dialecticCadence: 3`, observation on, `sessionStrategy: global`
   - Redacted native-flush log excerpt from `~/.hermes/logs/agent.log` showing memory shutdown hook on session exit (per-session flush)
   - Config excerpt: `flush_min_turns: 6`, `nudge_interval: 10`, `creation_nudge_interval: 15`, `memory_enabled: true`, `user_char_limit: 2750`, `memory_char_limit: 4400`
   - **OQ-8 resolution table:** automated memory feed = Honcho (per-turn) + native flush (per-session exit); **no** scheduled/cron session-close; full `/session-close` operator-triggered only for AGENTS.md §8 / vault synthesis / NotebookLM fan-out (~$3–5/run, ~$90–150/mo if cronned — rejected)
   - Cross-reference to 83-1 and 83-2 evidence files
   **And** git diff contains no secrets, API keys, or unredacted peer fact content

2. **Operator guide — trigger definition (OQ-8)**
   **Given** `03-Resources/` is **not** WriteGate-protected (unlike `AI-Context/AGENTS.md`)
   **When** dev-story completes
   **Then** a short new subsection is added to `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (canonical vault path: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`) stating:
   - Memory compounds **automatically** via Honcho (per-turn dialectic) + native Hermes flush (per-session exit)
   - Run full `/session-close` **manually only** when AGENTS.md §8 regen, vault synthesis, or NotebookLM fan-out is genuinely needed (~$3–5 each)
   - **No** scheduled session-close cron (operator cost decision 2026-07-06)
   **And** if repo mirror exists at `{project-root}/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`, keep it in sync with canonical vault copy (same edit operation)
   **And** **zero edits** to `AI-Context/AGENTS.md` or any WriteGate-protected path (NFR8)

3. **Scope boundary — verification only, no build (NFR2)**
   **Given** operator decision: LEAN, NO BUILD
   **When** implementation completes
   **Then** **zero** creation of:
   - Cron jobs, systemd timers, or Hermes scheduled tasks for session-close
   - New scripts, skills, or automation wiring
   **And** **zero diffs** in:
   - `~/.hermes/config.yaml`, `~/.hermes/honcho.json`, `config/brain-recall-policy.json`
   - `src/agents/*`, `scripts/run-chain.ts`, protect-list paths
   - `AI-Context/**`, vault `AGENTS.md`, `MEMORY.md`, `USER.md` (WriteGate — NFR8)
   - Protect-list entries or `specs/cns-vault-contract/modules/memory-pillars-verification.md` (separate follow-up)
   **And** no git commit (operator review)

4. **Verify gate (NFR1)**
   **Given** documentation-only story
   **When** dev-story completes
   **Then** `bash scripts/verify.sh` passes (no new unit tests required unless operator guide edit breaks an existing doc contract test)

5. **Epic 83 closure**
   **Given** this is the final Epic 83 story (v1.5 FR15 tranche)
   **When** story marked done after code-review
   **Then** sprint tracker may set `epic-83: done` (SM/operator action at retrospective or code-review close)
   **And** evidence documents FR15 complete: Honcho (83-1) + memory budget (83-2) + automated feed verification (83-3) + OQ-8 closed

## Tasks / Subtasks

- [x] **AC #1 — Capture live evidence** (AC: #1)
  - [x] Run `hermes honcho status` — capture redacted output (24-fact user peer card, AI peer, dialectic cadence)
  - [x] Grep `~/.hermes/logs/agent.log` for memory shutdown / flush hook lines (redact message bodies)
  - [x] Grep `~/.hermes/config.yaml` memory block for flush/nudge keys + 4400/2750 caps (from 83-2)
  - [x] Write `83-3-automated-memory-feed-evidence.md` using §Live Evidence facts + fresh command output

- [x] **AC #2 — Operator guide subsection** (AC: #2)
  - [x] Add subsection near §15.4 Session close (logical placement: immediately before or after 15.4, or as **15.3.x Memory automation vs session-close**)
  - [x] Include cost rationale (~$3–5 manual session-close; no cron)
  - [x] Sync repo mirror if present

- [x] **AC #3–#4 — Scope check + verify** (AC: #3, #4)
  - [x] Confirm no cron/config/protect-list diffs
  - [x] `bash scripts/verify.sh` — PASS

- [x] **AC #5 — Epic closure note** (AC: #5)
  - [x] Add Epic 83 closure paragraph to evidence file
  - [x] Note OQ-8 resolved in evidence header

## Dev Notes

### Operator decision (2026-07-06) — BINDING

**Do NOT build auto session-close cron.** Full `/session-close` costs ~$3–5/run; daily cron ≈ $90–150/mo for capability that **already exists** via Honcho + native flush. This story **verifies and documents** — it does not implement new automation.

Epic 83-3 original AC ("auto session-close cron or equivalent") is **superseded** by this operator scope for v1.5 gate. OQ-8 resolves to: **no scheduled session-close**; memory automation is already live.

### Live Evidence (2026-07-06 — cite as-is, do not re-derive)

| Layer | Mechanism | Status | Evidence source |
|-------|-----------|--------|-----------------|
| **Honcho dialectic** (83-1) | Per-turn `MemoryProvider.prefetch_all` + async observation | **Live** | `hermes honcho status`: User peer `chris` = **24 facts** (was 0 on 2026-07-05); AI-peer representation; `dialecticCadence: 3`; observation on |
| **Native memory flush** | Session-exit shutdown hook in agent.log | **Live** | `flush_min_turns: 6`, `nudge_interval: 10`, `creation_nudge_interval: 15`; `memory_enabled` / `user_profile_enabled`: true |
| **Memory headroom** (83-2) | Raised caps | **Live** | `memory_char_limit: 4400`, `user_char_limit: 2750` |
| **Full session-close** | AGENTS §8 + vault synthesis + NotebookLM fan-out | **Manual only** | Not memory-critical; operator-triggered when governance refresh needed |

**FR15 learning loop (operational without session-close):** Honcho compounds operator model every turn (cadence 3); native memory persists across sessions via tool writes + session-exit flush. Session-close adds institutional **governance** artifacts (Section 8, fast-scan, NotebookLM) — orthogonal to per-turn memory compounding.

### OQ-8 resolution (document verbatim in evidence)

| Question | Resolution | Owner | Date |
|----------|------------|-------|------|
| OQ-8: Auto session-close trigger (idle / daily / hybrid)? | **None scheduled.** Automated memory feed = Honcho (per-turn) + native flush (per-session exit). Full `/session-close` = operator manual when AGENTS.md/vault/NotebookLM refresh needed. **$0 recurring** for memory automation. | Operator | 2026-07-06 |

PRD FR15 consequence "Automate session-close feeding memory" is satisfied by **existing Hermes + Honcho mechanisms**, not by cronning session-close.

### Architecture: three memory layers vs session-close

```
Per-turn (automatic, $0 cron):
  1. Native MEMORY.md + USER.md injection  ← session-start snapshot (83-2 caps)
  2. Honcho prefetch_all + dialectic       ← every 3 turns (83-1)
  3. cns-brain-recall pre_llm_call         ← Epic 79 (unchanged)

Per-session exit (automatic):
  4. Native memory shutdown flush hook     ← agent.log; flush_min_turns: 6

On-demand only (manual /session-close, ~$3–5):
  5. AGENTS.md §8 regen + vault synthesis + NotebookLM fan-out
  6. MEMORY.md CNS State block refresh (session-close script — not required for Honcho/native compounding)
```

Honcho and Brain recall remain **orthogonal** per ADR-HERMES-015. This story touches neither seam.

### Operator guide — proposed subsection (draft for dev agent)

Insert near **§15.4 Session close** in `CNS-Operator-Guide.md`:

```markdown
### 15.x Memory automation vs session-close (Epic 83, FR15)

**Memory compounds automatically — no scheduled session-close required.**

| What | Trigger | Cost |
|------|---------|------|
| Honcho operator modeling | Every turn (dialectic cadence 3) | Honcho API (see 83-1 evidence) |
| Native MEMORY.md / USER.md | Per-session exit flush + memory tool during chat | $0 |
| Brain vault recall (`cns-brain-recall`) | Every turn (pre_llm_call) | Portal inference tokens |

**Run `/session-close` manually only** when you need AGENTS.md Section 8 regen, vault synthesis, CNS-Daily-Rhythm AUTO blocks, fast-scan index, or NotebookLM fan-out — typically end of a BMAD story session. Each real close costs roughly **$3–5** in LLM usage; do **not** cron it for memory — automated memory feeding is already live via Honcho + native flush.

See evidence: `_bmad-output/implementation-artifacts/83-3-automated-memory-feed-evidence.md` (OQ-8 closed 2026-07-06).
```

Adjust section numbering to fit existing guide structure; add changelog row per guide convention.

### Evidence capture commands (redact in file)

```bash
hermes honcho status
grep -A10 '^memory:' ~/.hermes/config.yaml
grep -i 'memory\|flush\|shutdown' ~/.hermes/logs/agent.log | tail -20
# Optional: confirm 24 facts count in status output — redact fact text bodies
```

**Redaction rules:** Peer names may appear (`chris`, `hermes`); fact **content** must be redacted or summarized as count only. No API keys, no HONCHO_API_KEY presence strings with values.

### Epic spec delta (83-3 original vs this story)

Original epic AC (`epics-hermes-omniscient.md` §648–662) assumed cron/session-close automation. Operator scope **2026-07-06** reframes to verification-only. Dev agent must **not** implement original cron AC — operator decision and this story file supersede epic wording for implementation.

## Technical Requirements

- Hermes v0.17.0+ with Honcho live (83-1) and memory caps 4400/2750 (83-2) — **read-only verification**, no config writes
- Access: `hermes honcho status`, `~/.hermes/logs/agent.log`, `~/.hermes/config.yaml` (grep only)
- Operator guide edit: markdown only in `03-Resources/` (not WriteGate)

## Architecture Compliance

- **FR15:** Progressive operator learning — closed by verify+document (Honcho + native + manual session-close split)
- **OQ-8:** Closed — no scheduled session-close; trigger definition in operator guide
- **ADR-HERMES-015:** No changes to Brain recall or Honcho slots
- **NFR2:** protect-list zero edits; no new automation
- **NFR5:** N/A (no config changes); document reversibility of operator guide edit only
- **NFR7:** No new library implementation — optional Context7 refresh if evidence capture commands fail
- **NFR8:** no `AI-Context/AGENTS.md` edit
- **NFR-GOV-1:** documentation-only; no silent vault mutation

## Library / Framework Requirements

| Source | Context7 ID | Used for |
|--------|-------------|----------|
| Hermes Agent | `/nousresearch/hermes-agent` | Only if log grep semantics unclear — memory flush, shutdown hook, flush_min_turns |

No new dependencies. No npm/pip installs.

## File Structure Requirements

| Path | Action | Notes |
|------|--------|-------|
| `_bmad-output/implementation-artifacts/83-3-automated-memory-feed-evidence.md` | **CREATE** | Primary deliverable |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | **UPDATE** | Short subsection; sync canonical + repo mirror |
| `~/.hermes/config.yaml` | **NO TOUCH** | Read-only grep for evidence |
| `~/.hermes/honcho.json` | **NO TOUCH** | 83-1 frozen |
| `AI-Context/AGENTS.md` | **NO TOUCH** | WriteGate |
| Cron/systemd/Hermes scheduler | **DO NOT CREATE** | Explicit operator rejection |

## Testing Requirements

- `bash scripts/verify.sh` — mandatory pass
- No new unit tests unless verify exposes operator-guide contract test — fix minimally if so
- Manual: evidence file contains all AC #1 bullets; operator guide subsection readable and correctly placed

## Previous Story Intelligence

**Story 83-1** (done 2026-07-05):
- Honcho live on managed cloud; `dialecticCadence: 3` must be **top-level** in honcho.json
- First session: 0 facts → compounding expected by 83-3
- Brain recall verified same turn; `cns-brain-recall` untouched
- Evidence: `83-1-honcho-config-evidence.md`

**Story 83-2** (done 2026-07-05):
- Caps raised to 4400/2750; cross-session native recall PASS
- Explicit memory tool flush used for test (below flush_min_turns) — session-exit flush is separate automatic path documented here
- Evidence: `83-2-memory-budget-evidence.md`

**Story 76-6:**
- Documented session-close feeds MEMORY.md — true for CNS State block, but **not** the same as Honcho per-turn compounding or native flush hook

**Epic 48 session-close:**
- Full pipeline documented in operator guide §15.4 — this story clarifies it is **governance refresh**, not the memory automation trigger

## Latest Tech Information

- Hermes native memory: mid-session tool writes persist immediately; injection snapshot refreshes next session; session-exit flush hook supplements automatic persistence (`flush_min_turns`, nudge intervals)
- Honcho: facts accumulate on user peer via observation + dialectic without session-close
- Cost: session-close LLM path ~$3–5/run (operator estimate); cronning rejected at v1.5 gate

## Project Context Reference

- Epic spec: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §607–662 (Epic 83)
- PRD FR15 / OQ-8: `_bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/prd.md` §4.6, §8
- Architecture: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` ADR-HERMES-015, FR15 defer table
- Prior evidence: `83-1-honcho-config-evidence.md`, `83-2-memory-budget-evidence.md`
- Operator guide session-close: `03-Resources/CNS-Operator-Guide.md` §15.4
- Constitution WriteGate: `specs/cns-vault-contract/AGENTS.md` — do not edit

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Fresh `hermes honcho status` 2026-07-06: 24 user peer facts, dialectic cadence 3, sessionStrategy global
- Native flush lines: `CLI cleanup calling memory shutdown` in agent.log (2026-07-04, 2026-07-05)
- Config grep: memory caps 4400/2750, flush_min_turns 6, session_reset idle_minutes 60 / at_hour 21

### Completion Notes List

- Created `83-3-automated-memory-feed-evidence.md` with redacted Honcho status (24-fact count preserved), native flush log excerpt, config keys, OQ-8 table, Epic 83 closure
- Added operator guide §15.3.1 to repo mirror and canonical vault (`/mnt/c/.../CNS-Operator-Guide.md`); v1.41.0 changelog row
- Documented native flush fires on session exit (CLI) or session reset (Discord) — not per-turn
- Scope: zero config/cron/WriteGate edits; verify.sh PASS; no commit per operator instruction

### File List

- `_bmad-output/implementation-artifacts/83-3-automated-memory-feed-evidence.md` (created)
- `_bmad-output/implementation-artifacts/83-3-automated-session-close-feeding-memory.md` (updated)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (updated)
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (updated — canonical sync)

### Change Log

- 2026-07-06: Story 83-3 LEAN verify+document — evidence file, operator guide §15.3.1, OQ-8 closed, Epic 83 evidence complete

---

**Story completion status:** review — LEAN verify+document complete; OQ-8 closed 2026-07-06; Epic 83 final story ready for code-review.
