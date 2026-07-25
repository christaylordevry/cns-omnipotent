# Story 80-2 — Retire `smart_model_routing` + Operator Guide Evidence

**Story:** `80-2-retire-inert-smart-model-routing-operator-guide`  
**Operator:** Chris  
**Date completed:** 2026-07-03  
**Hermes version:** v0.17.0 (2026.6.19)  
**Branch:** `hermes-consolidation`  
**Baseline commit:** `68531e6e34d2a1f4bf11535a4bbbb18046908847`

> **Redaction policy (NFR4):** No tokens, passwords, API keys, OAuth client secrets, or `auth.json` contents below.

---

## AC #1 — Story 80-1 prerequisite — PASS

| Check | Result |
|-------|--------|
| Six auxiliary tasks on Haiku | **PASS** — per `80-1-auxiliary-haiku-evidence.md` |
| `model.default` / `model.provider` | **nous** / **anthropic/claude-sonnet-4.6** |

```text
grep -A2 'compression:' ~/.hermes/config.yaml → provider: nous, model: anthropic/claude-haiku-4.5
grep -A2 'triage_specifier:' ~/.hermes/config.yaml → provider: nous, model: anthropic/claude-haiku-4.5
```

---

## AC #2 — Source audit — PASS

| Audit | Finding |
|-------|---------|
| **78-2** (`78-2-skill-routing-evidence.md` §AC #2) | No `DEFAULT_CONFIG` entry; no `gateway/` reader; `model_hint` seam only |
| **Fresh 2026-07-03** | `rg 'smart_model_routing' ~/.hermes/hermes-agent --glob '!**/tests/**' --glob '!**/AGENTS.md'` → **0 matches**, exit **1** |

```bash
rg 'smart_model_routing' ~/.hermes/hermes-agent --glob '!**/tests/**' --glob '!**/AGENTS.md'
# exit 1 (no matches)
```

---

## AC #3 — Config backup — PASS

**Backup path:** `~/.hermes/config.yaml.bak-2026-07-03-80-2`

---

## AC #4 — Comment out block — PASS

**Before (active key):**
```yaml
smart_model_routing:
  enabled: true
  tiers:
    fast:
      provider: nous
      model: anthropic/claude-haiku-4.5
    standard:
      provider: nous
      model: anthropic/claude-sonnet-4.6
  skills:
    triage: fast
    # ... 13 skills
```

**After (retired, commented):**
```yaml
# RETIRED 2026-07-03 — Story 80-2: smart_model_routing has zero consumers in Hermes v0.17.0.
# Sole routing lever: auxiliary: block (Story 80-1). Do not re-enable or extend.
# Evidence: _bmad-output/implementation-artifacts/80-2-retire-smart-model-routing-evidence.md
# smart_model_routing:
#   enabled: true
#   ...
plugins:
  enabled:
  - cns-brain-recall
```

- `plugins:` section **unchanged**
- `auxiliary:` six-task pins from 80-1 **unchanged** (diff vs 80-1 backup: only `smart_model_routing` section)
- `python3 -c "import yaml; yaml.safe_load(...)"` → **YAML_OK**
- `hermes gateway restart` → **OK** (PID 481664)

---

## AC #5 — Scope boundary — PASS

| Path | Changed |
|------|---------|
| `src/agents/synthesis-adapter-llm.ts` | **NO** |
| `src/agents/hook-adapter-llm.ts` | **NO** |
| `src/agents/boss-adapter-llm.ts` | **NO** |
| `src/agents/run-chain.ts` | **NO** |
| `scripts/run-chain.ts` | **NO** |
| `src/**` | **NO** |
| `~/.hermes/hermes-agent` core | **NO** |

---

## AC #6 — Documentation via session-close — PASS

**Session-close executed:** 2026-07-03 (real close, not dry-run)

| Step | Result |
|------|--------|
| Phase A (`hermes-run-session-close.sh`) | **OK** — 766 tests passing |
| Section 8 gate (`gate-apply-section8.mjs`) | **OK** — v2.1.48 applied |
| `routing.md` retirement + Epic 80 auxiliary section | **APPLIED** — both copies `diff -q` clean |
| `CNS-Operator-Guide.md` §15.14 + version 1.40.0 | **APPLIED** — canonical vault |
| `deferred-work.md` §Per-skill Hermes model routing | **CLOSED** — direct repo edit |
| Phase C NotebookLM fan-out | **3/3 ok** (drive-sync) |
| Discord #hermes reply | **POSTED** via `hermes send --to discord:1500733488897462382` |

**Close report:** `.session-close/close-report.json` — `failure_class: null`, `agents_sync: synced via gate-apply-section8`

**Discord reply excerpt:**
```markdown
## Session close complete
- **mode:** real
- **agents_sync:** synced via gate-apply-section8
- **failure_class:** none
```

---

## AC #7 — Evidence file — PASS

This file.

---

## AC #8 — Verify gate — PASS

```bash
bash scripts/verify.sh
# exit 0 (2026-07-03)
```

---

## AC #9 — No future-story pollution — PASS

**Explicit:** No backlog stories should re-open `smart_model_routing`. FR14 satisfied by `auxiliary:` (80-1) + retirement (80-2). If Hermes upstream later adds a consumer, treat as **new discovery epic** — not automatic uncomment of 78-2 tier map.

---

## Rollback

```bash
cp ~/.hermes/config.yaml.bak-2026-07-03-80-2 ~/.hermes/config.yaml
hermes gateway restart
```

Or uncomment the `smart_model_routing:` block manually (not recommended — zero consumers).

---

## auxiliary: unchanged vs 80-1

Confirmed: six tasks (`compression`, `approval`, `skills_hub`, `mcp`, `title_generation`, `triage_specifier`) remain `nous` / `anthropic/claude-haiku-4.5`.
