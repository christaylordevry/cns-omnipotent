# CNS Epic / JARVIS Project Status — Investigation Pattern

## JARVIS is not a standalone project

"JARVIS project" questions map to the **Hermes Consolidation** epic set (Epics 74–82). Epic aliases from planning SSOT (`_bmad-output/planning-artifacts/epics-hermes-consolidation.md`):

| Alias | Epic | Title |
|-------|------|-------|
| Pre   | —    | Portal Paid Tier gate (FR-GATE) |
| A     | 74   | Portal + Desktop migration |
| B     | 75   | run-chain revival |
| C     | 76   | Orientation/governance (FR17) |
| D1    | 77   | JARVIS Awareness in Nexus |
| D2    | 78   | JARVIS Voice + Per-Skill Routing |
| —     | 80   | Auxiliary routing (Haiku pin + smart_model_routing retirement) |
| —     | 82   | Voice Channel (Local Nexus / Hermes bridge) |

**Do not maintain hardcoded story-status tables in this file.** Static tables drift within days. Always read live sources (below).

---

## Story-status investigation pattern

When the awareness snapshot lacks story-level granularity, use this sequence:

### 1. Sprint status (authoritative for all epics, including 77+)

```bash
# Epic-level status (Hermes Consolidation / JARVIS scope: 74–82)
grep -E '^  epic-(74|75|76|77|78|79|80|82):' \
  _bmad-output/implementation-artifacts/sprint-status.yaml

# Story-level status for an epic (example: Epic 77)
grep -E '^  77-[0-9]+-' \
  _bmad-output/implementation-artifacts/sprint-status.yaml
```

`sprint-status.yaml` is the **single authoritative source** for epic and story status across the entire program (Epics 1–82+). Prefer it over hand-copied tables or narrative summaries.

### 2. Vault search (optional — often empty for active-dev epics)

```
vault_search scope="01-Projects/" query="<project name>"
vault_search scope="03-Resources/" query="<project name>"
```

### 3. Cross-repo overview (may lag sprint-status)

```bash
grep -n "JARVIS\|Epic 77\|Epic 78\|Epic 82" project-context.md
```

Treat `project-context.md` as orientation context only — when it disagrees with `sprint-status.yaml`, **sprint-status wins**.

### 4. Story artifact frontmatter (per-story detail)

```bash
# List artifacts for an epic
ls _bmad-output/implementation-artifacts/ | grep '^77-\|^78-\|^82-'

# Batch Status grep — fastest per-file check
grep -h "^Status:" \
  _bmad-output/implementation-artifacts/77-*.md \
  _bmad-output/implementation-artifacts/78-*.md \
  _bmad-output/implementation-artifacts/82-*.md \
  2>/dev/null
```

`Status:` values: `done`, `review`, `in-progress`, `ready-for-dev`, `backlog`, `cancelled`, `spike complete`.

---

## Key ADRs (JARVIS topology)

| ADR | Decision |
|-----|----------|
| HERMES-001 | Desktop/Discord = chat+voice; Vercel `/nexus` = awareness panels + async ask (NOT embedded WSL chat) |
| HERMES-002 | FR12 pull via `GET /hermes/awareness` bearer `HERMES_CONVEX_READ_KEY`; not Convex MCP at runtime |
| HERMES-013 | Local Nexus JARVIS voice proxy (WS-ticket pattern, Story 82-1) |
