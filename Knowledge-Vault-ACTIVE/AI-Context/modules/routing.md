# Model Routing Module

CNS routing is the model-selection control plane. It covers three agent surfaces (Cursor, Claude Code, Gemini CLI) plus internal surfaces (vault-io, unknown). Policy defines default model aliases, deny/allow lists, and fallback chains per surface and task category. The routing decision engine is a pure function; adapters translate decisions into surface-specific config writes. Operator override bypasses deny rules but requires the alias to exist in the registry. Audit entries append to `AI-Context/agent-log.md`.

## References

- **Operator documentation and config:** `config/model-routing/_README.md`
- **Implementation:** `src/routing/`
- **Policy defaults:** `config/model-routing/policy.defaults.json`
- **Model alias registry:** `config/model-routing/model-alias-registry.json`
- **Reason codes:** `config/model-routing/reason-codes.json`
