# Memory pillars verification (Hermes native)

Operator checklist confirming which JARVIS memory layers are **active**, **fed by session-close**, or **gated** with remediation. No new memory infrastructure in Epic 76.

**Verified:** 2026-07-05 (Story 76-6)

## Summary

| Pillar | Status | Fed by session-close? | Remediation if inactive |
|--------|--------|---------------------|-------------------------|
| 3-layer memory (SQLite FTS + summarization) | **ACTIVE** | Yes (MEMORY.md + SQLite session store) | — |
| Skill-learning loop (curator + skill capture) | **ACTIVE** | Indirect (skills git SSOT; session-close does not write skills) | — |
| Honcho dialectic user-modeling | **GATED** | No | Epic 83 (v1.5 tranche) |

## 1. Three-layer memory — ACTIVE

Hermes native memory per `~/.hermes/config.yaml`:

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: false
  memory_char_limit: 2200
  provider: ''   # built-in file + SQLite, not external provider
```

### Layer A — Curated files (`MEMORY.md`, `USER.md`)

- `MEMORY.md`: CNS State block auto-updated by session-close (`scripts/session-close/lib/update-memory-cns-state.mjs`). Budget ≤2,200 chars (AGENTS §6.5).
- `USER.md`: operator identity; symlink `~/.hermes/memories/USER.md` → vault `AI-Context/USER.md`.
- Vault copy: `AI-Context/MEMORY.md` written by `scripts/session-close/write-memory.mjs`.

### Layer B — SQLite FTS (`~/.hermes/state.db`)

- Tables present (2026-07-05): `sessions`, `messages`, `messages_fts` (+ trigram FTS aux tables).
- Full-text search over conversation history for recall within Hermes gateway sessions.
- `state.db` size ~132 MB; last accessed during session-close window 2026-07-05 ~13:41 AEDT.

### Layer C — LLM summarization / compression

- `context.engine: compressor` in Hermes config (Portal-backed auxiliary per Epic 74).
- Long sessions compress via Hermes built-in context engine before window overflow.
- Distinct from Brain recall (`cns-brain-recall` plugin, Epic 79): brain injects vault corpus citations; this layer compresses **transcript** history.

## 2. Skill-learning loop — ACTIVE

| Mechanism | Config / path | Role |
|-----------|---------------|------|
| Skill capture workflow | Epic 26-8; git SSOT under `~/.hermes/skills/cns/` | Promote repeated operator patterns into skills |
| Curator | `curator.enabled: true` (interval 168h) | Prune/archive stale skills |
| Skill write gate | `skills.write_approval: false` | Agent may propose skill edits; operator reviews via git |
| Skill install gate | Epic 54-1 verify parity | Reinstall does not drop CNS skills |

Session-close does **not** auto-write skills. It **does** refresh orientation artifacts that skills consume (`MEMORY.md`, fast-scan index, AGENTS §8).

## 3. Honcho dialectic — GATED

```yaml
honcho: {}
```

Honcho has been empty since Hermes consolidation session 7 (intentional deferral). **Do not claim Honcho is active.**

**Remediation:** Epic 83 — Operator Learning Loop (v1.5 tranche). Configure `honcho:` block per Context7 Hermes docs; evidence artifact `83-1-honcho-config-evidence.md`. [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` Epic 83]

## Session-close → memory feed (live evidence)

**Run:** 2026-07-05 ~13:38–13:41 Sydney (Discord `#hermes` `/session-close`)

| Signal | Evidence |
|--------|----------|
| Gateway inbound | `gateway.log`: `2026-07-05 13:38:24` session-close skill auto-loaded |
| AGENTS §8 sync | `gate-apply-section8.mjs` → `agents_sync: synced` (reported in Discord close summary) |
| MEMORY.md patch | `~/.hermes/memories/MEMORY.md` mtime **Jul 5 13:39**; header `Closed: 2026-07-05T03:39:25.210Z \| AGENTS v2.1.48 \| failure_class: none` |
| SQLite touch | `state.db` access **13:41:05** same window |
| CNS State content | Epics 76/78/81 in-progress; vault lint line; fan-out `3/3 ok` prior |

**Spot-check diff class:** Session-close replaced `## CNS State` region with fresh sprint-derived bullets (57-2/57-3 pattern). No manual MEMORY edit required.

## Operator verification commands

```bash
# Config flags
grep -A6 '^memory:' ~/.hermes/config.yaml
grep '^honcho:' ~/.hermes/config.yaml

# SQLite FTS tables
python3 -c "import sqlite3; c=sqlite3.connect('$HOME/.hermes/state.db'); print([r[0] for r in c.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%fts%'\")])"

# Last MEMORY close stamp
head -5 ~/.hermes/memories/MEMORY.md
```

## See also

- `docs/research/57-4-external-memory-provider-eval.md` (Honcho eval)
- `_bmad-output/implementation-artifacts/57-2-session-close-memory-md-auto-update.md`
- `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` FR15
- `AGENTS.md` §6.5 token budgets
