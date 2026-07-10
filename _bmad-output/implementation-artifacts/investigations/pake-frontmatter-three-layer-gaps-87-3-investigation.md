# Investigation: PAKE frontmatter three-layer consistency gaps (87-3 defers)

## Hand-off Brief

1. **What happened.** Story 87-3 resolved the CORE vs quality-enrichment conflict (Zod `.optional()` on `confidence_score` / `verification_status` / `creation_method`; bulk_scan WARNING tier). Six pre-existing cross-layer drifts remain among Zod (`src/pake/schemas.ts`), vault-lint (`bulk_scan.py`, `task-prompt.md`, `vault-lint.md`), and spec (`CNS-Phase-1-Spec.md`, `note-style-guide.md`, `AGENTS.md` §3).
2. **Where the case stands.** All five gap classes are **scoped and diagnosed**; canonical winner per gap is proposed below with exact edit lists. Nothing is broken in production; the risk is lint-pass / mutation-fail asymmetry and doc drift.
3. **What's needed next.** Operator sign-off on the five decisions, then a single follow-up story (`bmad-quick-dev` or `bmad-create-story`) to apply code/spec edits. Constitution / `AGENTS.md` routing-table edits remain **WriteGate — session-close only**.

## Case Info

| Field            | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Ticket           | 87-3 defers (`deferred-work.md` §Deferred from 87-3, 2026-07-09)     |
| Date opened      | 2026-07-10                                                            |
| Status           | Active — awaiting operator sign-off on proposed canonical decisions   |
| System           | Omnipotent.md @ `hermes-consolidation`; WSL2; vault `Knowledge-Vault-ACTIVE` |
| Evidence sources | `schemas.ts`, `bulk_scan.py`, `vault-lint.md`, `task-prompt.md`, `vault-lint-remediate-34-2.ts`, `quality-weighting.ts`, `AGENTS.md`, `note-style-guide.md`, story 87-3, deferred-work.md |

## Problem Statement

After 87-3, governed notes with **core-only** frontmatter pass Zod validation and `vault_move` / `vault_update_frontmatter`. Six deferred items document residual mismatches across the three enforcement layers (Zod mutation gate, vault-lint bulk scan, normative spec). Goal: one canonical decision per gap and mechanical sync — **not urgent**, no runtime breakage today.

**User premise (confirmed):** CORE conflict is resolved at `src/pake/schemas.ts:44-46`.

## Evidence Inventory

| Source | Status | Notes |
| ------ | ------ | ----- |
| `src/pake/schemas.ts` | Available | Zod SSOT for MCP mutations; 4 statuses; 7 `pake_type`; scalar `tags` coerce |
| `scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py` | Available | 5 statuses + `stable`; 7 types; scalar `tags` ERROR; enrichment WARNING |
| `specs/cns-vault-contract/vault-lint.md` | Available | Post-87-3: 5 types, 4 statuses, enrichment WARNING — **aligned with intent, not with Zod types** |
| `scripts/hermes-skill-examples/vault-lint/references/task-prompt.md` | Available | §8 still lists enrichment in ERROR-critical set |
| `scripts/vault-lint-remediate-34-2.ts` | Available | `rule4Findings()` treats enrichment as ERROR class |
| `specs/cns-vault-contract/CNS-Phase-1-Spec.md` | Available | 5 types, 4 statuses; enrichment optional block present |
| `specs/cns-vault-contract/AGENTS.md` §3 | Available | 5 types in template; enrichment optional (v2.1.54) |
| `specs/cns-vault-contract/modules/note-style-guide.md` | Available | Nexus-era keys (`date`, `reference`, `source`); 5 types |
| `src/brain/retrieval/quality-weighting.ts` | Available | Consumes `status`, `confidence_score`, `verification_status`, `pake_type` only |
| Live vault notes with `status: stable` | Partial | At least 2 paths in repo stub: `CNS-Operator-Guide.md`, `Vault-Intelligence-Discovery-Workflow.md` (34-2 claimed coercion; stubs may be stale) |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Vault-wide `status: stable` count | Low | Open | Confirm live vault cardinality before migration |
| 2 | Vault-wide scalar `tags:` count | Low | Open | Grep governed dirs on operator machine |
| 3 | Hermes deployed `bulk_scan.py` vs repo copy | Medium | Open | Ensure `~/.hermes/skills/cns/vault-lint/` synced after edits |

## Timeline of Events

| Time | Event | Source | Confidence |
| ---- | ----- | ------ | ---------- |
| 2026-05-17 | Story 34-2 remediate coerced `stable` on operator docs | `34-2-vault-lint-remediation-critical-issues.md` | Confirmed |
| Epic 17 | `HookSetNote`, `WeaponsCheckNote` added to `PAKE_TYPE_VALUES` | `17-4`, `17-5` story artifacts | Confirmed |
| 2026-07-09 | 87-3 ships optional enrichment; 6 defers logged | `87-3-pake-quality-enrichment-frontmatter-reconcile.md` | Confirmed |
| 2026-07-10 | AGENTS §3 enrichment reclassified v2.1.54 | `AGENTS.md` changelog | Confirmed |

## Confirmed Findings

### Finding 1: `status: stable` is lint-allowed, mutation-rejected

**Evidence:** `bulk_scan.py:38` `STATUSES` includes `stable`; `schemas.ts:43` enum excludes it; `vault-lint.md:171` lists four statuses only; `vault-lint-remediate-34-2.ts:37` `VALID_STATUSES` excludes `stable`.

**Detail:** Notes with `status: stable` pass Rule 4 in bulk_scan but fail `validatePakeForVaultPath` on governed mutations. `mapStatus()` in remediate has no `stable` entry → coerces to `draft` (not `reviewed`), so re-running remediate on stable notes would **downgrade** them incorrectly.

**Ranking impact (`quality-weighting.ts`):** If `stable` were added to Zod without a `STATUS_WEIGHT` entry, `stable` notes would get `MISSING_STATUS_WEIGHT` (0.5) via line 86 fallback — semantically undocumented. If dropped from lint, existing stable notes should migrate to `reviewed` (weight 1.0) for correct ranking.

### Finding 2: `pake_type` 7 in code, 5 in spec prose

**Evidence:** `schemas.ts:11-18` and `bulk_scan.py:36-37` list 7 types; `vault-lint.md:167`, `CNS-Phase-1-Spec.md:153`, `AGENTS.md:112` list 5; `HookSetNote` / `WeaponsCheckNote` actively produced by run-chain (`hook-agent.ts`, `boss-agent.ts`).

**Ranking impact:** Both extra types have explicit weights at 0.8 (`quality-weighting.ts:22-23`). Deprecating them would break ingest pipelines and collapse type weight to `MISSING_PAKE_TYPE_WEIGHT` (0.7) if notes were retyped.

### Finding 3: Scalar `tags` — Zod tolerates, lint rejects

**Evidence:** `schemas.ts:27-30` `tagsSchema` coerces `string → [string]`; `bulk_scan.py:190-191` `tags_not_list` ERROR; `vault-lint.md:172` requires YAML list; `vault-lint-remediate-34-2.ts:98-106` `normalizeTags` accepts scalar.

**Ranking impact:** **None.** `quality-weighting.ts` does not read `tags`.

### Finding 4: Enrichment severity — bulk_scan/spec vs Hermes prompt + remediate script

**Evidence:** `bulk_scan.py:195-233` missing enrichment → `warnings_r4_missing_quality`; `vault-lint.md:174-182` WARNING; `task-prompt.md:142-144` still ERROR for missing enrichment; `vault-lint-remediate-34-2.ts:234-241` ERROR class for absent enrichment.

**Ranking impact:** **None on field removal.** Optional enrichment already degrades to `MISSING_CONFIDENCE_WEIGHT` (0.5), `MISSING_VERIFICATION_WEIGHT` (0.6), and flat-penalty only when **all four** quality signals absent (`quality-weighting.ts:70-84`). Downgrading lint/remediate to WARNING does not change ranking math.

### Finding 5: `note-style-guide.md` is Nexus-era, contradicts AGENTS §3

**Evidence:** `note-style-guide.md:22-30` requires `date` (not `created`), `reference` status (not in PAKE enum), `source` (not `source_uri`), omits `pake_id` / `modified` / enrichment tier; PAKE Type Guide lists 5 types only. Enrichment optional paragraph (lines 44-46) was added in 87-3 but header list not reconciled.

**Ranking impact:** Doc-only drift; no direct ranking effect unless operators follow stale keys and omit `created`/`pake_id` (would fail core validation, not ranking).

## Hypothesized Paths

### Hypothesis 1: `stable` was a Nexus-era synonym for `reviewed`

**Status:** Open (high confidence)

**Theory:** Story 34-2 explicitly fixed `stable` on operator guides; canonical PAKE lifecycle uses `reviewed` for finished reference material.

**Would confirm:** Vault grep shows `stable` only on legacy hub docs; no agent emits `stable` on create.

**Would refute:** Active writer (Hermes skill, run-chain) stamps `stable` on new notes.

### Hypothesis 2: Scalar `tags` are rare in governed vault

**Status:** Open

**Theory:** Nexus one-liner `tags: foo` may exist in edge captures; Zod coerce exists precisely for triage.

**Would confirm:** Governed-dir grep on live vault.

## Per-Gap Canonical Decisions (PROPOSE — await sign-off)

### Gap 1 — `status: stable`

| Layer | Decision |
| ----- | -------- |
| **Winner** | **Zod + spec (4-value enum)** — `stable` is **not** a PAKE status |
| **Rationale** | Semantic equivalent is `reviewed`. Keeping `stable` in lint only perpetuates mutation failures. Adding it to Zod would require new `STATUS_WEIGHT` and constitution churn for a duplicate lifecycle state. |

**Exact edits (after approval):**

1. `scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py:38` — remove `'stable'` from `STATUSES`.
2. `scripts/vault-lint-remediate-34-2.ts` — add to `STATUS_MAP`: `stable: "reviewed"` (safe coercion if remediate re-run).
3. **Vault data (operator):** migrate any governed note with `status: stable` → `reviewed` (at minimum the two known operator-guide paths).
4. **No change** to `src/pake/schemas.ts:43` or `quality-weighting.ts` (unless vault notes remain on `stable` without migration — then they rank at 0.5 missing weight until fixed).

**Ranking impact:** Migrating `stable` → `reviewed` raises `statusWeight` from 0.5 (unknown fallback) to 1.0 for affected notes.

---

### Gap 2 — `pake_type` 5 vs 7

| Layer | Decision |
| ----- | -------- |
| **Winner** | **Zod (`PAKE_TYPE_VALUES`) — 7 types** |
| **Rationale** | `HookSetNote` and `WeaponsCheckNote` are production run-chain outputs (Epic 17). Deprecation would break ingest and under-rank existing notes. |

**Exact edits (after approval):**

1. `specs/cns-vault-contract/vault-lint.md:167` — extend enum: add `HookSetNote`, `WeaponsCheckNote`.
2. `specs/cns-vault-contract/CNS-Phase-1-Spec.md:153` — same.
3. `specs/cns-vault-contract/modules/note-style-guide.md` §PAKE Type Guide — add both types with one-line definitions (hook iteration artifact; weapons-check rubric artifact).
4. `specs/cns-vault-contract/AGENTS.md` §2 routing table + §3 template `pake_type` line — add both types with default route `03-Resources/`. **WriteGate:** session-close / operator-direct vault sync only; do not edit live `AI-Context/AGENTS.md` from IDE alone.
5. **No change** to `bulk_scan.py` or `schemas.ts` (already correct).

**Ranking impact:** **None** if docs catch up. Deprecation would drop type weight from 0.8 → 0.7 (missing) for affected notes — **reject that path**.

---

### Gap 3 — scalar `tags`

| Layer | Decision |
| ----- | -------- |
| **Winner** | **Canonical shape = YAML array** (spec); **Zod coercion = ingress tolerance** (keep) |
| **Rationale** | MCP `vault_create_note` already requires `z.array(z.string())`. Array is the authoring standard. Zod coerce prevents triage failures on legacy scalar notes. Lint should not ERROR on scalars if mutations accept them. |

**Exact edits (after approval):**

1. `bulk_scan.py:190-191` — replace strict list check with:
   - Accept non-empty `str` (valid) **or** non-empty `list`.
   - Optionally append WARNING `tags_scalar_string` when `isinstance(val, str)` (quality debt, not ERROR).
2. `vault-lint.md:172` — add footnote: "Canonical YAML list; scalar string accepted at Vault IO boundary (coerced to single-element array). Lint may WARN on scalar."
3. `task-prompt.md` §8 — mirror WARNING language for scalar tags.
4. **Keep** `schemas.ts:27-30` coerce unchanged.

**Ranking impact:** **None.**

---

### Gap 4 — missing enrichment severity (task-prompt + remediate)

| Layer | Decision |
| ----- | -------- |
| **Winner** | **bulk_scan + `vault-lint.md` (87-3)** — missing enrichment = WARNING |
| **Rationale** | Mechanical sync of stale ERROR docs/scripts to post-87-3 truth. |

**Exact edits (after approval):**

1. `task-prompt.md:140-145` — split bullet list:
   - **ERROR:** core 7 fields only (`pake_id`, `pake_type`, `title`, `created`, `modified`, `status`, `tags`).
   - **WARNING:** missing `confidence_score`, `verification_status`, `creation_method`; invalid-when-present remains ERROR.
2. `vault-lint-remediate-34-2.ts:221-245` — refactor `rule4Findings()`:
   - Core fields → `findings` (ERROR class).
   - Missing enrichment → new `qualityWarnings` array (or separate function); do not push `missing_confidence_score` etc. into ERROR `findings`.
   - Keep invalid-when-present checks as ERROR (match bulk_scan).
3. **No change** to `bulk_scan.py` or `schemas.ts`.

**Ranking impact:** **None** (severity metadata only).

---

### Gap 5 — `note-style-guide` legacy required-key list

| Layer | Decision |
| ----- | -------- |
| **Winner** | **AGENTS.md §3 PAKE Standard** (post-87-3) |
| **Rationale** | Style guide is a module under constitution; it must not contradict §3. Nexus-era `date` / `reference` / `source` keys are obsolete. |

**Exact edits (after approval):**

Replace `note-style-guide.md` lines 20-37 with PAKE-aligned required/optional lists:

**Required (core 7):** `pake_id`, `pake_type`, `title`, `created`, `modified`, `status`, `tags`

**Status enum:** `draft | in-progress | reviewed | archived` (drop `reference`; map old Nexus `reference` → `reviewed` in prose)

**Optional enrichment:** `confidence_score`, `verification_status`, `creation_method` (pointer to §3)

**Optional by type:** `source_uri` (SourceNote), `cross_references`, `ai_summary`

**PAKE types:** all 7 from `PAKE_TYPE_VALUES`

**Status-by-location table:** update `03-Resources: reference` → `reviewed` (or `in-progress` for active project resources — keep location guidance, fix enum token)

**Prohibited fields:** retain `certainty`, `status_reason`; add deprecated Nexus aliases `date`, `source`, `source_url` (use `created`/`modified`, `source_uri`)

Sync path: `specs/cns-vault-contract/modules/note-style-guide.md` in repo; vault runtime copy via existing module sync / session-close (not IDE WriteGate on `AI-Context/` alone).

**Ranking impact:** **None** (documentation). Correct keys ensure `created`/`status`/`pake_type` reach index for ranking.

---

## Source Code Trace

| Element | Detail |
| ------- | ------ |
| Zod gate | `src/pake/schemas.ts` → `pakeStandardFrontmatterSchema` → `validatePakeForVaultPath` |
| Lint engine | `bulk_scan.py` Rule 4 → `errors_r4` / `warnings_r4_missing_quality` |
| Ranking consumer | `src/brain/retrieval/quality-weighting.ts:59-114` — fields: `status`, `confidence_score`, `verification_status`, `pake_type` |
| SSOT for types | `PAKE_TYPE_VALUES` in `schemas.ts` (imported by `build-index.ts`, `vault-list.ts`) |

## Conclusion

**Confidence:** **High** on gap taxonomy and layer winners; **Medium** on live vault counts for `stable` / scalar `tags` (stubs suggest low cardinality).

**Summary:** Treat **`src/pake/schemas.ts` + `PAKE_TYPE_VALUES`** as the code SSOT for enums; treat **`AGENTS.md` §3 + `vault-lint.md`** as normative SSOT for required vs optional tiers. The six 87-3 defers collapse to **five decisions**: (1) drop `stable`, (2) doc catch-up to 7 types, (3) array-canonical + lint tolerance for scalar tags, (4) enrichment WARNING sync in prompt/remediate, (5) note-style-guide realign to §3. No Zod changes required unless operator chooses alternate path for gap 1 or 3.

**Constitution / WriteGate:** Only gap 2 item 4 (`AGENTS.md` routing + template) requires session-close or operator-direct vault edit. Gap 5 vault module copy ditto.

## Recommended Next Steps

### Fix direction (post sign-off)

| Gap | Mechanism | Est. files |
| --- | --------- | ---------- |
| 1 stable | Lint enum + vault migration | 2 code + N notes |
| 2 pake_type | Spec/doc catch-up | 3-4 spec (+ AGENTS WriteGate) |
| 3 tags | Lint WARN-not-ERROR | 2-3 lint files |
| 4 enrichment | Prompt + remediate sync | 2 scripts |
| 5 style guide | Module rewrite | 1 spec module (+ vault sync) |

### Diagnostic (optional before implementation)

```bash
# Live vault counts (operator machine)
rg -l '^status:\s*stable' "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"/{01-Projects,02-Areas,03-Resources} --glob '*.md'
rg -l '^tags:\s+[^[\-]' "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"/{01-Projects,02-Areas,03-Resources} --glob '*.md'
```

### Workflow routing

- **After sign-off:** `bmad-create-story` — "87-4 PAKE frontmatter three-layer sync" (or append to deferred-work epic).
- **Implementation:** `bmad-quick-dev` with verify gate.
- **Not in scope:** Changing `quality-weighting.ts` weights (no decision requires it).

## Reproduction Plan

**Asymmetry repro (gap 1):**

1. Create governed note with `status: stable` + valid core fields, no enrichment.
2. Run bulk_scan → Rule 4 passes.
3. Call `vault_update_frontmatter` → `SCHEMA_INVALID` on `status`.

**Expected after fix:** bulk_scan flags `invalid_status: stable`; migration to `reviewed` clears both paths.

## Side Findings

- `vault-lint-remediate-34-2.ts` `mapStatus()` lacks `stable` mapping; if gap-1 vault migration is skipped, remediate could silently set `stable` → `draft` (**Deduced** from `STATUS_MAP` + `mapStatus` at lines 16-22, 109-114).
- `note-style-guide.md` exists only under `specs/cns-vault-contract/modules/` in this repo clone; vault runtime module path is `AI-Context/modules/note-style-guide.md` (sync discipline applies).

## Follow-up: 2026-07-10

### New Evidence

Investigation opened from operator request on `hermes-consolidation` branch. CORE 87-3 fix confirmed at `schemas.ts:44-46`.

### Updated Conclusion

Awaiting operator sign-off on five proposed canonical decisions before any code or spec edits.
