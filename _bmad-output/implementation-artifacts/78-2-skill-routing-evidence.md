# Story 78-2 — Per-skill Hermes Model Routing Evidence

**Story:** `78-2-per-skill-hermes-model-routing-activation`  
**Operator:** Chris  
**Date:** 2026-06-25  
**Hermes WSL version:** v0.17.0 (2026.6.19)  
**Branch:** `hermes-consolidation`  
**Baseline commit:** `8d4ea80`

> **Redaction policy (NFR4):** No tokens, passwords, API keys, or OAuth client secrets below.

---

## AC #1 — WSL + Portal + gateway preflight — PASS

| Check | Result |
|-------|--------|
| `hermes --version` | **v0.17.0** (2026.6.19) |
| `hermes portal info` logged in | **Yes** — Nous inference provider |
| `model.provider` / `model.default` | **nous** / **anthropic/claude-sonnet-4.6** |
| `auxiliary.compression.model` | **anthropic/claude-haiku-4.5** on **nous** |
| Discord gateway PID | **Yes** — `hermes_cli.main gateway run` |
| `voice.auto_tts` (78-1 unchanged) | **true** |

---

## AC #2 — Context7 + Hermes source discovery — PASS

**Context7 library:** `/nousresearch/hermes-agent`

**Queries run:**
1. `resolve-library-id` → `/nousresearch/hermes-agent`
2. `query-docs` → `smart_model_routing config.yaml schema enabled tiers skills per-skill model override gateway restart`
3. `query-docs` → `smart_model_routing configuration section tiers skills enabled YAML example`

**Context7 findings:** Documented per-channel skill bindings, auxiliary task overrides, delegation model override — **no published YAML schema for `smart_model_routing` tiers/skills map**. Contributor `AGENTS.md` lists `smart_model_routing` as a top-level config section alongside `delegation`, `memory`, etc.

**Source audit (v0.17.0, upstream 2ab09a6c):**

| Location | `smart_model_routing` consumer? |
|----------|--------------------------------|
| `hermes_cli/config.py` → `DEFAULT_CONFIG` | **No** — key absent |
| `gateway/` | **No matches** |
| `agent/coding_context.py` | **`model_hint` extension seam only** — comment: "not yet consumed by the router" |
| `AGENTS.md` | **Listed** as valid top-level section name |

**Chosen config schema:** Story AC #3 example shape (`smart_model_routing.enabled`, `tiers.{fast,standard}`, `skills.{skill:tier}`) stored via `_deep_merge` in `load_config()`.

---

## AC #3 — Routing block in `~/.hermes/config.yaml` — PASS

**Backup:** `~/.hermes/config.yaml.bak-2026-06-25-78-2`

**Added block:** `smart_model_routing` with 9 fast-tier skills + 4 standard-tier skills (13 CNS skills total).

**Global primary unchanged:**

```text
model.provider: nous
model.default: anthropic/claude-sonnet-4.6
auxiliary.compression.model: anthropic/claude-haiku-4.5
```

**Config load verification:**

```text
smart_model_routing present: True
enabled: True
skills.triage: fast
skills.vault-think: standard
```

**Gateway restart:** `hermes gateway restart` → new PID **2248111** (`hermes_cli.main gateway run`).

---

## AC #4 — Two-skill smoke + model resolution — PARTIAL (consumer-pending)

**Expected when consumer ships:**

| Skill | Tier | CNS alias | Target Portal model |
|-------|------|-----------|---------------------|
| `triage` | fast | `fast` | `anthropic/claude-haiku-4.5` |
| `vault-think` | standard | `default-coding` | `anthropic/claude-sonnet-4.6` |

**Actual (2026-06-25):** Hermes v0.17.0 **does not read** `smart_model_routing` at gateway runtime. All Discord / gateway skill invocations still inherit **`model.default`** (Sonnet) until upstream implements the router. **No fake log lines** — runtime differentiation not observable today.

**Follow-up:** Re-run two-skill smoke in `#hermes` (`/triage` vs `/challenge`) after Hermes release notes confirm `smart_model_routing` consumer; grep `gateway.log` or Portal usage for distinct model IDs.

---

## AC #5 — `routing.md` governance — PASS

**Updated files (identical):**
- `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md`

**Verification:** `diff -q` → **clean**

**Added:** §Hermes per-skill routing (Epic 78 / FR14) — tier table, skill→tier map, Epic 15 crosswalk, run-chain FR11 note, consumer-pending status, rollback.

**Preserved:** Epic 74 global Hermes surface table + Epic 15 IDE routing references.

---

## AC #6 — Protect-list + scope boundary — PASS

| Path | Changed? |
|------|----------|
| `src/agents/synthesis-adapter-llm.ts` | **No** |
| `src/agents/hook-adapter-llm.ts` | **No** |
| `src/agents/boss-adapter-llm.ts` | **No** |
| `src/agents/run-chain.ts` | **No** |
| `scripts/run-chain.ts` | **No** |
| `src/**`, `dist/**` | **No** |

Config-only: `~/.hermes/config.yaml` (outside git).

---

## AC #7 — Verify gate + deferred-work — PASS

| Check | Result |
|-------|--------|
| `bash scripts/verify.sh` | **PASS** (see run log below) |
| `deferred-work.md` §Per-skill Hermes model routing | **Updated** — config done; consumer-pending note |
| Secrets in git | **None added** |

---

## Verify run

```text
bash scripts/verify.sh → exit 0 (2026-06-25)
```
