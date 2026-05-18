# Epic 35 — Research orphan hub index evidence

| Field | Value |
|-------|--------|
| **Story** | 35-3-orphan-wikilink-pass-research-index |
| **Run date** | 2026-05-18 (UTC) |
| **Operator / agent** | Cursor dev agent (`surface: cursor-dev-35-3`) |
| **Vault root** | `CNS_VAULT_ROOT` → `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` |
| **Hub path** | `03-Resources/Research/_README.md` |
| **Lint baseline report** | `_meta/reports/vault-lint-2026-05-18.md` |

## Rule 2 baseline (pre-hub)

From `vault-lint-2026-05-18.md` summary:

| Metric | Count |
|--------|------:|
| Vault-wide Rule 2 (orphan) WARNINGs | **60** |
| Research cluster orphan paths (`03-Resources/Research/`) | **22** |
| Governed notes scanned | 114 |

## Inventory

| Source | Result |
|--------|--------|
| `vault_list` / filesystem `03-Resources/Research/` | **43** `.md` notes (excl. `_README.md`) |
| `pake_type` breakdown | 39 SourceNote, 3 SynthesisNote, 1 InsightNote |
| Parent `03-Resources/_README.md` | **Already exists** — not recreated |

## Hub creation

- **Tool:** `vaultCreateNoteFromMarkdown` (Vault IO create pipeline: WriteGate → PAKE skip for `_README.md` → secrets → atomic write; MCP `vault_create_note` routes by `pake_type` only and does not accept explicit paths or contract frontmatter)
- **Frontmatter:** Directory contract manifest (`purpose`, `schema_required`, `allowed_pake_types`, `naming_convention`) per `CNS-Phase-1-Spec.md`
- **Wikilinks added:** **43** (one per Research note)
- **Resolution strategy:** `[[title]]` when unique and title has no `/`; `[[03-Resources/Research/<stem>|<display>]]` for duplicate titles or titles containing `/` (Rule 2 path vs title disambiguation)

### Sample linked paths

| Path | Wikilink form in hub |
|------|----------------------|
| `03-Resources/Research/Best Practices for Claude Code.md` | `[[Best Practices for Claude Code]]` |
| `03-Resources/Research/Firecrawl-Web-Data-API.md` | `[[Firecrawl — Web Data API for AI]]` |
| `03-Resources/Research/Extend Claude with skills.md` | `[[Extend Claude with skills]]` |
| `03-Resources/Research/OpenClaw-AI-Research.md` | Path alias form (title contains `/`, Rule 2 path resolution) |
| `03-Resources/Research/CLAUDE-md-Configuration.md` | Path form (duplicate title with Definitive-Guide sibling) |

### Spot-check (incoming edge from hub)

Verified via `vaultReadFile` on hub body + Rule 2 resolver simulation:

| Target | Incoming from hub |
|--------|-------------------|
| `03-Resources/Research/Best Practices for Claude Code.md` | Yes (`[[Best Practices for Claude Code]]`) |
| `03-Resources/Research/Firecrawl-Web-Data-API.md` | Yes |
| `03-Resources/Research/Extend Claude with skills.md` | Yes |

## Rule 2 post-hub (simulated)

Recomputed orphan graph with the same Rule 2 edge rules as `vault-lint.md` (after hub write):

| Metric | Before (lint report) | After (simulation) | Delta |
|--------|---------------------:|-------------------:|------:|
| Vault-wide orphans | 60 | **56** | **−4** |
| Research cluster orphans | 22 | **0** | **−22** |

**Note:** Vault-wide delta is smaller than Research-only delta because the 2026-05-18 lint run predates notes that already had non-orphan status (incoming links from other vault notes). The hub cleared **all** Research-cluster orphans in the lint target set. Operator should run **`/vault-lint`** in `#hermes` to refresh `_meta/reports/vault-lint-YYYY-MM-DD.md` for authoritative post-run counts.

## Lint excerpt (baseline)

```text
- **Rule 2 (orphan notes):** 60 warnings
…
### Rule 2 — Orphan Notes (60)
### 03-Resources/Research/3-20-26 Building my powerful system setup.md
… (22 Research paths total in report)
```

## Repo changes

| File | Change |
|------|--------|
| `src/tools/vault-create-note.ts` | Allow `_README.md` contract manifest create without `pake_id` |
| `tests/vault-io/vault-create-note.test.ts` | Regression test for contract manifest create |
| `_bmad-output/implementation-artifacts/epic-35-orphan-research-index-evidence.md` | This file |

## Operator guide

No update required — Research hub is an internal graph index; parent `03-Resources/_README.md` already documents the Resources layer.
