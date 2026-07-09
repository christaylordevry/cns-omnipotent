# Investigation: Note-frontmatter schema conflict (confidence_score / verification_status / creation_method)

## Hand-off Brief

1. **What happened.** `pakeStandardFrontmatterSchema` requires three quality fields on every governed write, while `note-style-guide.md` prohibits them; Hermes (Vault IO) must add them, Nexus (direct FS) omits them, producing two canonical note shapes and blocking PAKE validation on sparse Nexus notes during triage moves/updates.
2. **Where the case stands.** Blast radius mapped across `src/`, scripts, tests, specs, and Hermes skills. Constitutional precedence favors AGENTS §3 over the style guide prohibition; pure "prohibition wins" would silently neuter brain confidence/verification ranking and break `/verify` semantics.
3. **What's needed next.** Implement **Quality Enrichment tier** (optional in Zod, populated by Hermes when known, never prohibited) via a scoped story: `schemas.ts` + `note-style-guide` + `vault-lint.md` + AGENTS §3 (session-close WriteGate, v2.1.53).

## Case Info

| Field            | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| Ticket           | hermes-consolidation / operator-scoped                                     |
| Date opened      | 2026-07-09                                                                 |
| Status           | Concluded                                                                  |
| System           | Omnipotent.md, branch `hermes-consolidation`, WSL2                         |
| Evidence sources | `src/pake/schemas.ts`, `note-style-guide.md`, `AGENTS.md`, grep blast radius, `quality-weighting.ts`, deferred-work.md |

## Problem Statement

Operator reports a confirmed conflict: Vault IO PAKE validation requires `confidence_score`, `verification_status`, and `creation_method`; `note-style-guide.md` prohibits those exact fields. Effect: Hermes writes full PAKE shape; Nexus writes Nexus shape. Investigation must determine consumer blast radius, evaluate inert-weighting trade-off, and recommend resolution without implementing.

## Evidence Inventory

| Source   | Status    | Notes     |
| -------- | --------- | --------- |
| `src/pake/schemas.ts:44-46` | Available | Three fields required (not `.optional()`) |
| `note-style-guide.md:39-45` | Available | Prohibited fields list |
| `specs/cns-vault-contract/AGENTS.md` §3 | Available | Lists three fields as required in PAKE Standard template |
| `src/brain/retrieval/quality-weighting.ts` | Available | Consumes confidence + verification; degrades on undefined |
| `deferred-work.md:12` | Available | Pre-existing tension documented in 87-1 review |
| Live vault note sampling | Missing | Not required for code-path blast radius |

## Confirmed Findings

### Finding 1: Zod schema requires all three fields on governed paths

**Evidence:** `src/pake/schemas.ts:44-46`, `src/pake/validate.ts:33-36`

**Detail:** `validatePakeForVaultPath` runs on every non-inbox, non-`_README.md` mutation merge (`vault_create_note`, `vault_update_frontmatter`, `vault_move`, `vault_append_daily`). Missing any of the three fields throws `SCHEMA_INVALID`.

### Finding 2: note-style-guide explicitly prohibits the same three fields

**Evidence:** `specs/cns-vault-contract/modules/note-style-guide.md:39-45`

**Detail:** Module states they "must never appear in note frontmatter." Module was reverse-engineered from Nexus-era vault (141 notes, Phases 1–4).

### Finding 3: Constitution subordinates modules to AGENTS §3

**Evidence:** `specs/cns-vault-contract/AGENTS.md` §7 ("If a module conflicts with AGENTS.md, AGENTS.md wins")

**Detail:** Style-guide prohibition is constitutionally invalid as written; §3 and §4 simultaneously require reading the style guide and require the three fields.

### Finding 4: Brain ranking degrades gracefully but uses defaults when fields absent

**Evidence:** `src/brain/retrieval/quality-weighting.ts:72-93`, `tests/brain/quality-weighting.test.ts:51-58`

**Detail:** Missing `confidence_score` → weight 0.5; missing `verification_status` → weight 0.6. `creation_method` is not read by brain code. Operator Guide documents intentional down-ranking of ungoverned captures (`CNS-Operator-Guide.md:519`).

### Finding 5: Hermes writers always stamp all three on governed creates

**Evidence:** `src/tools/vault-create-note.ts:239-241`, `src/tools/vault-append-daily.ts:96-98`

**Detail:** `vault_create_note` accepts optional `confidence_score` input but always writes `verification_status: pending` and `creation_method: ai`.

### Finding 6: verification_status is operationally critical for Epic 30/33 workflows

**Evidence:** `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`, `specs/cns-vault-contract/vault-lint.md` Rule 3

**Detail:** `/verify` stamps `verification_status` + `modified` only. Stale-pending lint scans `verification_status: pending`. Prohibiting the field breaks the quality loop.

### Finding 7: creation_method consumed only outside brain (run-chain stale cleanup)

**Evidence:** `scripts/run-chain.ts:459,498` (not under `src/`)

**Detail:** Used to identify AI-generated chain artifacts for cleanup. No `src/` reader.

## Deduced Conclusions

### Deduction 1: Sparse Nexus notes cannot pass Vault IO mutations today

**Based on:** Findings 1, 2

**Reasoning:** `vault_move` and `vault_update_frontmatter` validate merged frontmatter at destination. A Nexus-shaped note in `03-Resources/` lacking the three fields fails PAKE even for a `modified`-only update.

**Conclusion:** Schema optionality is required for two-bot coexistence, not merely cosmetic.

### Deduction 2: Pure prohibition + optional schema is unacceptable

**Based on:** Findings 4, 5, 6

**Reasoning:** If fields are prohibited and Hermes stops writing them, confidence/verification weighting becomes uniformly default-weighted whenever status/pake_type exist; `/verify` cannot stamp prohibited fields; vault-lint Rule 3 becomes inert.

**Conclusion:** Resolution must be **optional but populated when known**, not prohibited.

## Hypothesized Paths

### Hypothesis 1: Make three fields optional so note-style-guide wins outright

**Status:** Refuted

**Theory:** Drop required constraint; align with Nexus prohibition.

**Would refute:** `/verify` and vault-lint depend on `verification_status`; Operator Guide expects Hermes to enrich quality signals.

**Resolution:** Refuted by Findings 5–6 and constitutional precedence (AGENTS §3 > module).

### Hypothesis 2: AGENTS §3 wins; delete style-guide prohibition only

**Status:** Open → partial

**Theory:** Keep fields required in schema; update style guide to allow them.

**Would refute:** Nexus notes still fail validation until backfilled; two-bot shape split persists.

**Resolution:** Insufficient alone; need optionality in Zod plus writer conventions.

### Hypothesis 3: Quality Enrichment tier (optional in validator, populated by Hermes)

**Status:** Confirmed (recommended)

**Theory:** Core PAKE minimum + optional quality enrichment fields documented in AGENTS and style guide.

**Supporting indicators:** Brain already optional-aware; MCP `vault_create_note` already optional input for confidence; deferred-work acknowledges tension.

## Source Code Trace

| Element       | Detail                                      |
| ------------- | ------------------------------------------- |
| Error origin  | `src/pake/validate.ts:33-36`                |
| Trigger       | Any governed Vault IO mutation              |
| Condition     | Merged frontmatter missing required quality fields |
| Related files | `schemas.ts`, `vault-create-note.ts`, `vault-update-frontmatter.ts`, `vault-move.ts`, `build-index.ts`, `quality-weighting.ts` |

## Conclusion

**Confidence:** High

The conflict is real and blocks triage of Nexus-shaped notes through Vault IO. Constitutionally AGENTS §3 currently requires the fields; the style-guide prohibition is subordinate and incompatible with `/verify`, vault-lint, and brain enrichment. Recommended fix: **Quality Enrichment tier** — make the three fields optional in `pakeStandardFrontmatterSchema`, move them from required to optional in AGENTS §3 with population guidance, replace style-guide prohibition with optional enrichment documentation, relax vault-lint Rule 4 missing-field severity to WARNING, keep Hermes writers populating defaults on governed creates.

## Recommended Next Steps

### Fix direction

Implement story scoped to schema/spec alignment (not protect-list). Route AGENTS edits through session-close WriteGate.

### Diagnostic

After implementation: create Nexus-shaped fixture note without three fields; assert `vault_move` and `vault_update_frontmatter` succeed; assert `vault_create_note` still stamps them; run `npm test` and vault-lint bulk_scan on mixed corpus.

## Status

Concluded
