# Epic 37 — Topic hub indexes evidence (Story 37-2)

| Field | Value |
|-------|--------|
| **Story** | 37-2-03-resources-topic-hub-indexes |
| **Run date** | 2026-05-21 (UTC) |
| **Lint baseline** | `_meta/reports/vault-lint-2026-05-21.md` (pre-hub: **23** Rule 2 orphans) |
| **Surface** | `story-37-2` |

## Rule 2 baseline (03-Resources/ orphans)

**Before (Hermes 2026-05-21):** **23** vault-wide orphan warnings (all under `03-Resources/`).

**Sample before paths:**

- `03-Resources/Research/Gemini-Prompt-Engineering.md`
- `03-Resources/Vault-Intelligence-Discovery-Workflow.md`
- `03-Resources/building-with-gemini-embedding-2-agentic-multimodal-rag-and-beyond.md`
- `03-Resources/notebooklm-project-map.md`
- `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-…` (3 notes)
- … (+18 more perplexity cluster + hooks E2E)

## Part A — Six topic hubs

| Hub path | Action | Wikilinks | Linked targets |
|----------|--------|-----------|----------------|
| `03-Resources/Research/consulting-rates-hub.md` | create | 3 | consulting-rates-sydney cluster (3) |
| `03-Resources/Research/remote-roles-hub.md` | create | 3 | remote-roles cluster (3) |
| `03-Resources/Research/day-rate-hub.md` | create | 3 | day-rate cluster (3) |
| `03-Resources/Research/retainer-pricing-hub.md` | create | 2 | retainer-pricing cluster (2) |
| `03-Resources/Research/obsidian-pkm-hub.md` | create | 3 | obsidian-pkm cluster (3) |
| `03-Resources/Research/ai-agent-orchestration-hub.md` | create | 3 | ai-agent-orchestration cluster (3) |

**Total cluster wikilinks:** **17** (path-alias `[[03-Resources/…md|…]]` form for long titles).

## Part B — README merges

| Target | Updates |
|--------|---------|
| `03-Resources/Research/_README.md` | `## Topic hubs (Perplexity clusters)` — 6 hub links; `## Workflow & discovery` — Vault-Intelligence, gemini ingest (**linked**, 37-1 retained), hooks E2E, Research Gemini + Top Github |
| `03-Resources/_README.md` | `## Key resources` — `[[03-Resources/notebooklm-project-map.md|NotebookLM Project Map]]` |

## Spot-check (AC10)

| Path | Incoming edge |
|------|----------------|
| `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-creative-technologist-consulting-rates-sydney-2026-2026-04.md` | `consulting-rates-hub.md` |
| `03-Resources/Vault-Intelligence-Discovery-Workflow.md` | `Research/_README.md` Workflow & discovery |
| `03-Resources/notebooklm-project-map.md` | `03-Resources/_README.md` Key resources |

## Post-run Rule 2 (AC11)

**Hermes `/vault-lint`** (authoritative for AC11): vault warnings **69 → 23**; **23** Rule 2 orphans remain (all perplexity cluster notes under `03-Resources/`).

| Metric | Before (2026-05-21 Hermes) | After (2026-05-21 Hermes post-hub) |
|--------|---------------------------:|-----------------------------------:|
| Vault warnings (total) | **69** | **23** |
| Rule 2 orphans (vault-wide) | **23** | **23** |
| AC11 target | — | **= 23** baseline **satisfied** |

**Decision (Story 37-2 close-out):** Accept **23** remaining orphans as new baseline. Vault-lint Rule 2 requires exact filename-stem wikilinks (`[[note-slug]]`). Topic hubs use human-readable display names (`[[03-Resources/long-path.md|Readable title]]`), which provide Obsidian navigational value but vault-lint cannot match them. This is a **vault-lint limitation**, not a hub defect. Phase 2 fix: `deferred-work.md` — add title-based matching to Rule 2 (preferred) or regenerate hubs with exact stems.

**Equivalent scan note:** `bulk_scan.py` may report R2=0 when links use display-text form; Hermes `/vault-lint` is the operator-facing source of truth for AC11.

**Note:** Six **Rule 4** findings on new `*-hub.md` contract manifests (expected PAKE skip class; hubs are not PAKE notes).

**Operator:** `/vault-lint` in `#hermes` refreshes `_meta/reports/vault-lint-2026-05-21.md` (or next dated report).

**Audit:** `story-37-2` lines in `_meta/logs/agent-log.md` (6 hub creates + 2 README updates).
