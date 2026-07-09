---
story_id: 87-3
epic: 87
title: pake-quality-enrichment-frontmatter-reconcile
status: review
baseline_branch: hermes-consolidation
baseline_commit: 720e7238adeec11d8020b64a8fb0f65d91cbe586
zone: Omnipotent.md PAKE schema + constitution/spec alignment
predecessors: 87-1, 87-2
investigation: _bmad-output/implementation-artifacts/investigations/note-frontmatter-schema-conflict-investigation.md
related_deferred: deferred-work.md §note-style-guide vs AGENTS PAKE template (resolved by this story)
writegate_required: AGENTS.md §3 (v2.1.52 → 2.1.53)
---

# Story 87.3: PAKE quality enrichment tier — reconcile note-frontmatter two-bot conflict

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

Epic: **87** (Constitution mirror dedup — stop tracking stale `Knowledge-Vault-ACTIVE/AI-Context/` copies)  
Tracked in sprint-status as: **`87-3-pake-quality-enrichment-frontmatter-reconcile`**  
**Depends on:** `87-2-specs-modules-vault-sync-drift-gate` (module sync path for `note-style-guide.md`)

## Story

As a **CNS operator running Hermes Vault IO alongside Nexus direct-FS writes**,
I want **`confidence_score`, `verification_status`, and `creation_method` treated as an optional quality-enrichment tier** (not required by Zod/lint, not prohibited by style guide),
so that **Nexus-shaped notes can be triaged through `vault_move` / `vault_update_frontmatter` without `SCHEMA_INVALID`**, while Hermes continues stamping enrichment defaults on governed creates and brain ranking still benefits when fields are present.

## Problem statement (confirmed — do not re-investigate)

Investigation `note-frontmatter-schema-conflict-investigation.md` (2026-07-09) concluded with **high confidence**:

| Layer | Today | Conflict |
|-------|-------|----------|
| `src/pake/schemas.ts:44-46` | 3 fields **required** | Blocks Nexus-shaped notes on governed mutations |
| `note-style-guide.md:39-45` | 3 fields **prohibited** | Constitutionally subordinate to AGENTS §3 (§7 precedence) |
| `AGENTS.md` §3 + `CNS-Phase-1-Spec.md` §Frontmatter | 3 fields in **required** template | Incompatible with two-bot coexistence |
| Hermes writers | Always stamp all 3 | Must **keep** — "optional but populated when known" |
| Brain `quality-weighting.ts` | Degrades gracefully on missing | No code change required |

**Resolution:** Quality Enrichment tier — optional in validator/lint, populated by Hermes when known, never prohibited.

## Field / Lint Contract (NORMATIVE for implementation)

### Tier model

```text
PAKE Standard = Core (required) + Quality Enrichment (optional) + Passthrough extras
```

| Tier | Fields | Zod | Vault IO validation | Hermes writers | Brain | note-style-guide |
|------|--------|-----|---------------------|----------------|-------|------------------|
| **Core** | `pake_id`, `pake_type`, `title`, `created`, `modified`, `status`, `tags` | Required | Missing → `SCHEMA_INVALID` | Always stamped | Uses `status` | Required list |
| **Quality enrichment** | `confidence_score`, `verification_status`, `creation_method` | `.optional()` + validators | Absent → pass; present-invalid → `SCHEMA_INVALID` | **Keep defaults** | Missing → default weights | Allowed; document optional |
| **Prohibited** | `certainty`, `status_reason` | passthrough | N/A | Do not write | N/A | **Remain prohibited** |
| **Type optional** | `source_uri`, `cross_references`, `ai_summary` | Already optional | Unchanged | Per input | Unchanged | Unchanged |

### Per-field semantics (quality enrichment)

| Field | When present | Valid values | Missing | Present-but-invalid |
|-------|--------------|--------------|---------|---------------------|
| `confidence_score` | number | `[0.0, 1.0]` | Pass Zod; lint **WARNING** `missing_confidence_score` | Zod + lint **ERROR** |
| `verification_status` | enum string | `pending` \| `verified` \| `disputed` | Pass Zod; lint **WARNING** `missing_verification_status`; Rule 3 **skipped** | Zod + lint **ERROR** |
| `creation_method` | enum string | `human` \| `ai` \| `hybrid` | Pass Zod; lint **WARNING** `missing_creation_method` | Zod + lint **ERROR** (`invalid_creation_method` if missing handler) |

### Hermes writer contract (UNCHANGED)

`vault_create_note` (`src/tools/vault-create-note.ts:239-241`):

```yaml
confidence_score: <input.confidence_score ?? 0.5>
verification_status: pending
creation_method: ai
```

`vault_append_daily` (`src/tools/vault-append-daily.ts:96-98`): same three fields with `0.5` / `pending` / `ai`.

### vault-lint Rule 4 contract

**Rule 3 (stale pending): UNCHANGED** — fires only when `verification_status == pending` AND valid `created` AND `days_pending > 14`.

**Rule 4 severity split:**

| Condition | Severity | Bucket |
|-----------|----------|--------|
| Missing **core** field | ERROR | `errors_r4` |
| Missing **quality enrichment** field | WARNING | **`warnings_r4_missing_quality`** (new, distinct from `warnings_r4_uuid`) |
| Present-but-invalid any field | ERROR | `errors_r4` |
| `pake_id` not UUID v4 | WARNING | `warnings_r4_uuid` (unchanged) |

**`bulk_scan.py` implementation:**

- `CORE_REQUIRED_FIELDS` = 7 core fields (excludes enrichment trio)
- `QUALITY_ENRICHMENT_FIELDS` = `confidence_score`, `verification_status`, `creation_method`
- Missing core → `note_errors`; missing enrichment → `note_warnings` → `warnings_r4_missing_quality`
- Invalid enrichment when key exists → `note_errors`
- Update summary print line to report `R4(missing_quality)=…` count

### AGENTS.md §3 contract (WriteGate ONLY)

**Baseline:** live constitution **v2.1.52** (2026-07-09 changelog). **Bump target: v2.1.53.**

**Build the §3 diff against the CANONICAL vault copy at session-close time** (`/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`), **not** the repo mirror alone.

Changes:

1. Remove the 3 enrichment lines from the **required** frontmatter template block.
2. Add subsection `### Optional Quality Enrichment` with population guidance (Hermes defaults, `/verify` stamps `verification_status`, Nexus may omit until triage).
3. Changelog row for this story.
4. Session-close WriteGate applies to all constitution copies (vault SSOT, `specs/cns-vault-contract/AGENTS.md`, planning mirror per `constitution.test.mjs` parity rules).

**Never** direct IDE edit of vault `AI-Context/AGENTS.md`.

### CNS-Phase-1-Spec.md §Frontmatter contract

**Lines ~155-161:** Move `confidence_score`, `verification_status`, `creation_method` from the required PAKE Standard YAML block into a new **optional quality enrichment** subsection — parallel wording to AGENTS §3.

**Lines ~300-302 (`vault_create_note` spec):** **Keep as-is** — `confidence_score (float, default 0.5)` and implicit always-pending-on-create behavior remain accurate writer contract.

**Do NOT edit:** `CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md` lines 101-103 (pipeline writer contract; already correct).

### note-style-guide.md contract (Epic 87 module sync)

1. Remove prohibition of `confidence_score`, `verification_status`, `creation_method` (`modules/note-style-guide.md:39-45`).
2. **Keep** prohibition of `certainty` and `status_reason`.
3. Add brief optional-enrichment paragraph referencing AGENTS §3.
4. Edit **canonical vault** `AI-Context/modules/note-style-guide.md` → session-close module sync → `specs/cns-vault-contract/modules/note-style-guide.md` (87-2 path). **Not** protect-list files.

## Acceptance Criteria

### AC1 — Zod schema optionality

- [x] `src/pake/schemas.ts:44-46`: `confidence_score`, `verification_status`, `creation_method` are `.optional()` with existing type constraints preserved.
- [x] `.passthrough()` retained; fields **not** deleted from schema object.

### AC2 — Validation pass/fail matrix

- [x] Governed path + core-only frontmatter (no enrichment fields) → `validatePakeForVaultPath` does **not** throw.
- [x] Governed path + `confidence_score: 2` or invalid enum → **`SCHEMA_INVALID`**.
- [x] Inbox / `_README.md` skip behavior unchanged (`src/pake/validate.ts` needs no logic change beyond schema).

### AC3 — Hermes writers unchanged

- [x] `vault_create_note` output still contains all 3 enrichment fields with existing defaults.
- [x] `vault_append_daily` output still contains all 3 enrichment fields.
- [x] `tests/vault-io/ingest-pipeline.test.ts` assertions on stamped fields still pass.

### AC4 — Nexus-shaped triage E2E

- [x] New fixture: Nexus-shaped note (core PAKE fields, **no** enrichment tier) under `03-Resources/`.
- [x] `vault_move` to governed destination → **success** (no `SCHEMA_INVALID`).
- [x] `vault_update_frontmatter` with `{ modified: <today> }` only → **success**.

### AC5 — Test suite hunt-and-flip

- [x] Add explicit pass cases in `tests/vault-io/pake-validation.test.ts` for core-only frontmatter per `pake_type`.
- [x] Grep `tests/` for assertions that **reject missing** enrichment fields; flip to **pass** (or narrow to invalid-when-present only).
- [x] Assertions rejecting **invalid values when present** remain unchanged.
- [x] Empty `{}` frontmatter on governed path still throws `SCHEMA_INVALID` (core fields missing).

### AC6 — vault-lint Rule 4 severity

- [x] `specs/cns-vault-contract/vault-lint.md` Rule 4 documents enrichment fields as **WARNING if missing**, **ERROR if present-but-invalid**; core fields remain ERROR if missing.
- [x] `scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py` implements `warnings_r4_missing_quality` bucket **distinct from** `warnings_r4_uuid`.
- [x] Rule 3 behavior unchanged.

### AC7 — note-style-guide

- [x] Prohibition of 3 enrichment fields removed; `certainty` + `status_reason` prohibition retained.
- [x] Canonical vault module synced to specs via Epic 87 module sync (not protect-list).

### AC8 — AGENTS.md constitution (WriteGate)

- [ ] §3 moves 3 fields to "Optional Quality Enrichment" with population guidance.
- [ ] Version bumped **2.1.52 → 2.1.53** with changelog row.
- [ ] Diff authored against **canonical vault AGENTS** at session-close; applied via WriteGate only.
- [ ] All constitution copies byte-identical post session-close (`constitution.test.mjs` green).

### AC9 — Verify gate

- [x] `bash scripts/verify.sh` passes.

### AC10 — Explicit non-goals

- [x] No edits to protect-list: `src/agents/{synthesis,hook,boss}-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`.
- [x] No change to `CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md`.
- [x] No resolution of separate divergences: `date`/`created`, `reference`/`reviewed`, `pake_type` enum gaps (follow-up).

### AC11 — CNS-Phase-1-Spec.md frontmatter alignment

- [x] `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §Frontmatter Schema (~155-161): 3 fields reclassified to optional quality-enrichment tier (parallel to AGENTS §3); **no field deleted** from spec.
- [x] `vault_create_note` spec (~300-302) `confidence_score (float, default 0.5)` note **retained unchanged**.

## Tasks / Subtasks

- [x] **Task 1 — Schema** (AC1–2): `src/pake/schemas.ts` — `.optional()` on 3 fields only.
- [x] **Task 2 — Tests: validation** (AC2, AC5): `tests/vault-io/pake-validation.test.ts` — core-only pass cases; grep-flip hunt across `tests/`.
- [x] **Task 3 — Tests: triage E2E** (AC4): `tests/vault-io/vault-move.test.ts` (+ `vault-update-frontmatter.test.ts` if needed) — Nexus-shaped fixture.
- [x] **Task 4 — vault-lint** (AC6): `vault-lint.md` + `bulk_scan.py` — `warnings_r4_missing_quality` bucket; update summary counters.
- [x] **Task 5 — note-style-guide** (AC7): canonical vault module edit → `npm run sync-vault-modules` or session-close sync → verify drift gate.
- [x] **Task 6 — CNS-Phase-1-Spec** (AC11): reclassify §Frontmatter; leave `vault_create_note` default note intact.
- [x] **Task 7 — AGENTS §3** (AC8): prepare WriteGate diff text for operator session-close; **do not** direct-edit vault AGENTS in IDE.
- [x] **Task 8 — Verify** (AC9): `npm test` + `bash scripts/verify.sh`.

## Dev Notes

### Architecture compliance

- **Single source of truth for Zod:** `src/pake/schemas.ts` — Epic 9 shared module; all governed mutators call `validatePakeForVaultPath` (`vault_create_note`, `vault_update_frontmatter`, `vault_move`, `vault_append_daily`).
- **Brain unchanged:** `src/brain/retrieval/quality-weighting.ts:72-93` already optional-aware; `creation_method` not read by brain.
- **Epic 30/33 `/verify`:** stamps `verification_status` + `modified` only — requires field to be **allowed**, not required.

### Nexus-shaped fixture (reference)

Minimal governed note **without** enrichment tier (adjust `pake_type` / paths per test):

```yaml
---
pake_id: "550e8400-e29b-41d4-a716-446655440000"
pake_type: SourceNote
title: "Nexus capture"
created: "2026-04-02"
modified: "2026-04-02"
status: draft
tags:
  - nexus
---
```

### Files in scope

| File | Action |
|------|--------|
| `src/pake/schemas.ts` | Make 3 fields `.optional()` |
| `specs/cns-vault-contract/CNS-Phase-1-Spec.md` | §Frontmatter reclassify (AC11) |
| `specs/cns-vault-contract/vault-lint.md` | Rule 4 severity split |
| `scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py` | `warnings_r4_missing_quality` |
| `AI-Context/modules/note-style-guide.md` (canonical vault) | Remove 3-field prohibition |
| `specs/cns-vault-contract/modules/note-style-guide.md` | Via 87-2 sync |
| `specs/cns-vault-contract/AGENTS.md` | Via WriteGate only |
| `tests/vault-io/pake-validation.test.ts` | Pass cases + flip hunt |
| `tests/vault-io/vault-move.test.ts` | Nexus-shaped fixture |

### Files explicitly OUT of scope

- `src/agents/{synthesis,hook,boss}-adapter-llm.ts`
- `src/agents/run-chain.ts`, `scripts/run-chain.ts`
- `specs/cns-vault-contract/CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md`
- `src/tools/vault-create-note.ts`, `src/tools/vault-append-daily.ts` (behavior unchanged; tests verify only)

### Previous story intelligence (87-2)

- Module sync direction: **vault → specs only** (`scripts/session-close/lib/sync-vault-modules.mjs`).
- Sync **skips** on `usingRepoVaultFallback` — edit canonical vault module on operator machine with real mount, or test with explicit vault path.
- `vault-lint.md` lives at spec root, not under `modules/`.

### WriteGate / operator approval

- **AGENTS.md §3** mutation requires session-close WriteGate — flag operator before claiming story done if WriteGate not yet run.
- Dev agent may implement code + spec mirror edits; constitution version bump lands via operator `/session-close`.

### Testing standards

- Run `npm test` after schema change — primary suite: `tests/vault-io/pake-validation.test.ts`.
- `tests/hermes-vault-lint-skill.test.mjs` only checks `bulk_scan.py` exists; consider adding assertion for `warnings_r4_missing_quality` if bulk_scan structure changes materially.
- Gate: `bash scripts/verify.sh` (CNS + sibling `cns-dashboard` when present).

### Project context reference

- Investigation: `_bmad-output/implementation-artifacts/investigations/note-frontmatter-schema-conflict-investigation.md`
- Deferred tension: `deferred-work.md` line 12 (note-style-guide vs AGENTS) — **closed by this story**
- Constitution: `specs/cns-vault-contract/AGENTS.md` v2.1.52
- Phase 1 spec: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §3 Frontmatter Schema

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- `npm test` — PASS
- `bash scripts/verify.sh` — PASS (exit 0)
- `npm run sync-vault-modules` — updated 1 file (real `/mnt/c` mount, not repo fallback)

### Completion Notes List

- AC1–AC7, AC9–AC11 implemented. AC8 **pending** operator `/session-close` WriteGate — proposed §3 diff at `_bmad-output/implementation-artifacts/87-3-agents-section3-writegate-diff.md`.
- **AC5 hunt-and-flip:** Grep across `tests/` found **no** explicit assertions that reject *missing* enrichment fields (rejection was enforced solely by required Zod fields). Added new core-only pass cases per `pake_type` plus invalid-when-present tests; existing invalid-value tests (`confidence_score: 2`, `confidence_score: 99`, append-daily bad score) left unchanged. Empty `{}` governed-path test unchanged.
- Hermes writers (`vault-create-note.ts`, `vault-append-daily.ts`) **not edited**; AC3 proven via existing `ingest-pipeline.test.ts` / create / append tests still green.
- `bulk_scan.py`: split `CORE_REQUIRED_FIELDS` vs `QUALITY_ENRICHMENT_FIELDS`; added `warnings_r4_missing_quality`, `invalid_creation_method` handler, updated summary line `R4(missing_quality)=…`.
- Canonical vault `note-style-guide.md` edited on `/mnt/c` mount; `npm run sync-vault-modules` propagated to specs mirror.

### File List

- `src/pake/schemas.ts`
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- `specs/cns-vault-contract/vault-lint.md`
- `specs/cns-vault-contract/modules/note-style-guide.md`
- `scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py`
- `tests/vault-io/pake-validation.test.ts`
- `tests/vault-io/vault-move.test.ts`
- `tests/vault-io/vault-update-frontmatter.test.ts`
- `tests/hermes-vault-lint-skill.test.mjs`
- `_bmad-output/implementation-artifacts/87-3-agents-section3-writegate-diff.md`
- `_bmad-output/implementation-artifacts/87-3-pake-quality-enrichment-frontmatter-reconcile.md`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/note-style-guide.md` (canonical vault; not git-tracked in repo)

### Change Log

- 2026-07-09: Story 87-3 — quality enrichment tier optional in Zod/lint; Nexus triage E2E; spec + module sync; AGENTS §3 WriteGate diff prepared (AC8 pending session-close).
- 2026-07-09: Code review patches applied — bulk_scan enrichment loop guards non-string/empty-list values with ERROR instead of crash.

### Review Findings

- [x] [Review][Patch] bulk_scan enrichment enum fields call `.strip()` without `isinstance(val, str)` guard [`scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py:200-203`]
- [x] [Review][Patch] bulk_scan present-but-invalid enrichment scalars (empty list, non-string) crash instead of `errors_r4` [`scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py:195-210`]

- [x] [Review][Defer] `status: stable` accepted by bulk_scan `STATUSES` but rejected by Zod/vault-lint spec [`bulk_scan.py:38`, `schemas.ts:43`] — deferred, pre-existing
- [x] [Review][Defer] vault-lint Rule 4 `pake_type` table omits `HookSetNote`/`WeaponsCheckNote` while bulk_scan and Zod accept them [`vault-lint.md:167`] — deferred, pre-existing
- [x] [Review][Defer] bulk_scan ERROR on scalar `tags:` string; Zod coerces string→array [`bulk_scan.py:190`, `schemas.ts:27-30`] — deferred, pre-existing
- [x] [Review][Defer] Hermes `task-prompt.md` still documents enrichment missing as ERROR (not updated in 87-3 scope) — deferred, follow-up lint-skill doc sync
- [x] [Review][Defer] `vault-lint-remediate-34-2.ts` `rule4Findings()` still treats absent enrichment as ERROR class — deferred, remediate script out of scope
- [x] [Review][Defer] note-style-guide legacy `date`/`reference` required list vs PAKE `created`/`modified` — deferred, pre-existing module drift (deferred-work §note-style-guide)
