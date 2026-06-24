# Model Routing Module

CNS routing is the model-selection control plane. It covers three agent surfaces (Cursor, Claude Code, Gemini CLI) plus internal surfaces (vault-io, unknown). Policy defines default model aliases, deny/allow lists, and fallback chains per surface and task category. The routing decision engine is a pure function; adapters translate decisions into surface-specific config writes. Operator override bypasses deny rules but requires the alias to exist in the registry. Audit entries append to `AI-Context/agent-log.md`.

## References

- **Operator documentation and config:** `config/model-routing/_README.md`
- **Implementation:** `src/routing/`
- **Policy defaults:** `config/model-routing/policy.defaults.json`
- **Model alias registry:** `config/model-routing/model-alias-registry.json`
- **Reason codes:** `config/model-routing/reason-codes.json`

## Hermes agent surface (Epic 74 — Portal primary)

| Role | Provider | Default model | Config path |
|------|----------|---------------|-------------|
| Hermes gateway / Discord / Desktop chat | `nous` (Nous Portal OAuth) | `anthropic/claude-sonnet-4.6` | `~/.hermes/config.yaml` → `model.*` |
| Context compression | `nous` (Portal OAuth) | `anthropic/claude-haiku-4.5` | `~/.hermes/config.yaml` → `auxiliary.compression.*` |
| Last-resort fallback | `openai-codex` | `gpt-5.4-mini` (pinned — may drift) | Hermes provider fallback chain; **not primary** |

**Portal login:** `hermes auth add nous --type oauth --manual-paste` · **Inspect:** `hermes portal info`

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

**Fragility note:** openai-codex relies on undocumented Cloudflare allowlisting; residential IP only. See `docs/CNSHermes New Big Plan/05-openai-codex-assessment.md`. Full Portal governance: story **74-8**.
