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

## Hermes per-skill routing (Epic 78 / FR14)

Per-skill inference tiers live in `~/.hermes/config.yaml` → `smart_model_routing`. Global primary (`model.default`) stays Sonnet; cheap Hermes skills are mapped to Haiku when the Hermes gateway consumes this block.

**Runtime status (2026-06-25):** Config **activated** (Story 78-2). Hermes **v0.17.0** lists `smart_model_routing` as a top-level config section in contributor docs but **does not yet read it at gateway runtime** (no matches in `gateway/` or `DEFAULT_CONFIG`; `agent/coding_context.py` exposes `model_hint` as an extension seam only). Treat as **config-ready / consumer-pending** until upstream ships the router. Rollback: set `smart_model_routing.enabled: false` or remove the block; global Sonnet default unchanged.

**Run-chain note (FR11 Option A):** The `run-chain` **Hermes skill** is mapped to the **standard** tier here, but **run-chain LLM stages** inside Omnipotent.md (`src/agents/*-adapter-llm.ts`, `scripts/run-chain.ts`) remain on **`ANTHROPIC_API_KEY`** / protect-list adapters. This story routes **Hermes skill invocations** only.

### Tier table (CNS alias → Portal model)

| CNS alias (Epic 15) | Tier key | Portal provider | Portal model ID | Cost posture |
|---------------------|----------|-----------------|-----------------|--------------|
| `fast` | `fast` | `nous` | `anthropic/claude-haiku-4.5` | Cheap — triage, lint, inbox, bounded scripts |
| `default-coding` | `standard` | `nous` | `anthropic/claude-sonnet-4.6` | Standard — reasoning skills, ingest, digest |
| `default-reasoning` | (same Sonnet class) | `nous` | `anthropic/claude-sonnet-4.6` | Reserved; v1 maps reasoning skills to `standard` |

Crosswalk registry: `config/model-routing/model-alias-registry.json` (`fast`, `default-coding`, `default-reasoning`).

### Skill → tier map (`~/.hermes/skills/cns/`)

| Skill | Tier | CNS alias |
|-------|------|-----------|
| `triage` | **fast** | `fast` |
| `vault-lint` | fast | `fast` |
| `vault-graduate` | fast | `fast` |
| `session-close` | fast | `fast` |
| `hermes-url-auto-capture-inbox` | fast | `fast` |
| `notebook-query` | fast | `fast` |
| `investigate-trend` | fast | `fast` |
| `awareness-sync` | fast | `fast` |
| `hermes-cns-verify-gate-summary` | fast | `fast` |
| `vault-think` | **standard** | `default-coding` |
| `run-chain` | **standard** | `default-coding` |
| `hermes-url-ingest-vault` | standard | `default-coding` |
| `morning-digest` | standard | `default-coding` |

**Highlighted pairs:** `triage` (fast / Haiku) vs `vault-think` or `run-chain` (standard / Sonnet).

**Gateway restart after routing edits:**

```bash
hermes gateway restart
pgrep -af 'hermes_cli.main gateway'
```

**Reconciled:** 2026-06-25 — Hermes v0.17.0 (2026.6.19) — Story 78-2 — `smart_model_routing` block in live `~/.hermes/config.yaml`; consumer-pending per source audit.
