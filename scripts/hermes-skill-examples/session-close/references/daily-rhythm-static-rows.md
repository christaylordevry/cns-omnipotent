# CNS-Daily-Rhythm static supplements (Story 43.1)

Hermes `/session-close` Step 6.7 merges these rows into `AUTO:ACTIVE_PROJECTS` after sprint-derived rows.  
Skip any static row whose **Project** name already appears in a sprint row (case-insensitive).

## Active projects — operator business rows

| Project | Status | Next action |
|---|---|---|
| Lead-Gen Directory Sydney | parked | Resume after LinkedIn live |
| LinkedIn Profile System | ready | Deploy — 18 notes drafted |
| Operator System Synthesis | active | Challenge confirmed unified system |

## Roadmap — epic theme fallbacks

Use when `epics.md` has no `### Epic N:` heading or sprint-status lacks `epic-N`.

| Epic key | Theme fallback | Status fallback |
|---|---|---|
| epic-38 | Cost + Provider Optimization | in-progress |
| epic-39 | VPS Deployment (always-on gateway) | deferred — vault-on-Linux first |
| epic-40 | Brain Production Embedder | deferred — NotebookLM covers it |
| epic-41 | Content + Business Intelligence | planned |
| epic-42 | CNS Dashboard Web App | planned |

**Roadmap table shape** (one row per epic key in range `epic-38` … highest `epic-N` present in sprint-status, minimum through `epic-42`):

```markdown
| Epic | Theme | Status |
|---|---|---|
| 38 | <theme> | <development_status value or fallback> |
```

**Epic title lookup:** Read `<resolved_repo_root>/_bmad-output/planning-artifacts/epics.md`. For epic number `N`, use the first `### Epic N:` heading text after the colon (strip prefix `Epic N: `). Example: `### Epic 38: Cost + Provider Optimization` → theme `Cost + Provider Optimization`.
