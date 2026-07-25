# Model Routing Module

CNS routing is the model-selection control plane. It covers three agent surfaces (Cursor, Claude Code, Gemini CLI) plus internal surfaces (vault-io, unknown). Policy defines default model aliases, deny/allow lists, and fallback chains per surface and task category. The routing decision engine is a pure function; adapters translate decisions into surface-specific config writes. Operator override bypasses deny rules but requires the alias to exist in the registry. Audit entries append to `AI-Context/agent-log.md`.

## References

- **Operator documentation and config:** `config/model-routing/_README.md`
- **Implementation:** `src/routing/`
- **Policy defaults:** `config/model-routing/policy.defaults.json`
- **Model alias registry:** `config/model-routing/model-alias-registry.json`
- **Reason codes:** `config/model-routing/reason-codes.json`

## Hermes agent surface (Epic 74 — Portal primary)

| Role | Provider | Model | Config path |
|------|----------|-------|-------------|
| Gateway / Discord / browser chat | `nous` | `anthropic/claude-sonnet-4.6` | `~/.hermes/config.yaml` → `model.*` |
| Context compression | `nous` | `anthropic/claude-haiku-4.5` | `~/.hermes/config.yaml` → `auxiliary.compression.*` |
| Last-resort fallback | `openai-codex` | `gpt-5.4-mini` (pinned — may drift) | fallback chain; **not primary** |
| Web search (Tool Gateway) | `nous` / Nous Subscription | — | `hermes portal info` → Web tools via Nous Portal; formal Hermes web-search config **pending-74-4** (FR-GATE tier confirmed Pre-4) |

**Portal login:** `hermes auth add nous --type oauth --manual-paste` · **Inspect:** `hermes portal info`  
**Desktop / browser chat:** `http://localhost:9119` — see `AI-Context/modules/hermes-desktop.md`

**Rollback to openai-codex primary (reversible):**

```bash
hermes config set model.provider openai-codex
hermes config set model.default gpt-5.4-mini
hermes config set model.base_url https://chatgpt.com/backend-api/codex
hermes gateway restart   # or watchdog cycle
```

Verify: `hermes portal info` may still show Portal logged in — openai-codex uses separate device_code creds in `auth.json`.

**Compression rollback (reversible — only if Portal compression fails):**

```bash
hermes config set auxiliary.compression.provider openrouter
hermes config set auxiliary.compression.model openai/gpt-4o-mini
# Only if OpenRouter credits restored — prefer fixing Portal path first
```

**Fragility note:** openai-codex relies on undocumented Cloudflare allowlisting; residential IP only. See `docs/CNSHermes New Big Plan/05-openai-codex-assessment.md`. Full Portal + Desktop governance: `AI-Context/modules/hermes-desktop.md` (Story 74-8).

**Reconciled:** 2026-06-24 — Hermes v0.17.0 (2026.6.19) — Story 74-8 — matches live `~/.hermes/config.yaml` (`grep` model + auxiliary.compression; `hermes config show` compression provider nous / Haiku 4.5).

## Hermes auxiliary routing (Epic 80 / FR14) — sole cost lever

Hermes **v0.17.0** routes side-work inference through `~/.hermes/config.yaml` → `auxiliary.<task>.*` only (`agent/auxiliary_client.py`). This is the **only** consumed cost-routing surface for auxiliary tasks. Main operator turns (gateway, Discord, browser chat) use `model.default` (Sonnet on Portal).

### Auxiliary task table (Story 80-1 pins)

| Task | Provider | Model | Config path |
|------|----------|-------|-------------|
| `compression` | `nous` | `anthropic/claude-haiku-4.5` | `auxiliary.compression.*` |
| `approval` | `nous` | `anthropic/claude-haiku-4.5` | `auxiliary.approval.*` |
| `skills_hub` | `nous` | `anthropic/claude-haiku-4.5` | `auxiliary.skills_hub.*` |
| `mcp` | `nous` | `anthropic/claude-haiku-4.5` | `auxiliary.mcp.*` |
| `title_generation` | `nous` | `anthropic/claude-haiku-4.5` | `auxiliary.title_generation.*` |
| `triage_specifier` | `nous` | `anthropic/claude-haiku-4.5` | `auxiliary.triage_specifier.*` |

**Tune cost routing here only.** Do not change `model.default` to Haiku for main operator turns.

**Reconciled:** 2026-07-03 — Hermes v0.17.0 (2026.6.19) — Story 80-1 — six auxiliary tasks on Portal Haiku.

## Hermes per-skill routing (Epic 78 / FR14) — RETIRED

> [!warning] **Retired Story 80-2 (2026-07-03).** `smart_model_routing` had **zero consumers** in Hermes v0.17.0 (confirmed Story 78-2 audit + fresh `rg` 2026-07-03). The block is **YAML-commented out** in `~/.hermes/config.yaml` — not deleted (NFR5 reversibility). **Do not re-enable, extend, or file stories to "implement" it** unless Hermes upstream ships a documented gateway consumer (then treat as a **new epic**, not resurrection of the 78-2 tier map).

**Historical context:** Story 78-2 activated a tier + skill map (`fast` / Haiku vs `standard` / Sonnet) but Hermes never read it at runtime. All Discord skill invocations used `model.default` (Sonnet) unless an auxiliary path fired. Cost control is **`auxiliary:`** only (Epic 80).

**Rollback (if ever needed):** Restore from `~/.hermes/config.yaml.bak-*-80-2` or uncomment the block. Global Sonnet default unchanged.

### Historical tier table (archaeological record — not active)

| CNS alias (Epic 15) | Tier key | Portal provider | Portal model ID | Cost posture |
|---------------------|----------|-----------------|-----------------|--------------|
| `fast` | `fast` | `nous` | `anthropic/claude-haiku-4.5` | Cheap — triage, lint, inbox, bounded scripts |
| `default-coding` | `standard` | `nous` | `anthropic/claude-sonnet-4.6` | Standard — reasoning skills, ingest, digest |

**Run-chain note (FR11 Option A):** Omnipotent.md `src/agents/*-adapter-llm.ts` and `scripts/run-chain.ts` remain on **`ANTHROPIC_API_KEY`** protect-list adapters — unchanged by Epic 80.

**Reconciled:** 2026-07-03 — Hermes v0.17.0 (2026.6.19) — Story 80-2 — `smart_model_routing` retired; `auxiliary:` sole lever per `80-2-retire-smart-model-routing-evidence.md`.
