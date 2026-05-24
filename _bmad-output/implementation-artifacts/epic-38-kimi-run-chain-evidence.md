# Epic 38 — Kimi K2.6 run-chain evaluation evidence

Date: 2026-05-24  
Story: 38-2-kimi-k2-6-evaluation-run-chain  
Brief topic: `freelance consulting day rate calculation methodology 2026` (DEFAULT_BRIEF_TOPIC)

## Model target (AC1)

Verified live via OpenRouter catalog API on 2026-05-24:

| Field | Value |
|-------|-------|
| Provider | OpenRouter |
| Model slug | `moonshotai/kimi-k2.6` |
| Display name | MoonshotAI: Kimi K2.6 |
| Context window | 262144 tokens |

Related catalog entries (not used): `moonshotai/kimi-k2.5`, `moonshotai/kimi-k2`, `moonshotai/kimi-k2-thinking`.

## Env contract (AC3)

| Key | Role |
|-----|------|
| `FIRECRAWL_API_KEY` | Research tier (required) |
| `APIFY_API_TOKEN` or `APIFY_TOKEN` | Research tier (required) |
| `PERPLEXITY_API_KEY` | Research tier (optional) |
| `ANTHROPIC_API_KEY` | Hook + weapons-check stages (required today) |
| `OPENROUTER_API_KEY` | Synthesis when `CNS_SYNTHESIS_PROVIDER=openrouter` |
| `CNS_SYNTHESIS_PROVIDER` | Set to `openrouter` to swap synthesis adapter |
| `CNS_SYNTHESIS_MODEL` | Required with OpenRouter provider (e.g. `moonshotai/kimi-k2.6`) |
| `CNS_VAULT_ROOT` | Active vault path |

No secrets are recorded in this file.

## Smoke runs (AC2)

### Sonnet baseline (default synthesis provider)

```bash
source .env.live-chain
export CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"
npx tsx scripts/run-chain.ts \
  --topic "freelance consulting day rate calculation methodology 2026" \
  --evidence-file /tmp/run-chain-sonnet-38-2.md \
  --operator-note "Story 38.2 Sonnet baseline for Kimi eval"
```

| Metric | Value |
|--------|-------|
| Date | 2026-05-24T04:16:01Z |
| Wall clock | 75,180 ms (~1.3 min) |
| Outcome | **Aborted at synthesis** |
| Fatal error | Anthropic API HTTP 400 — credit balance too low |
| PAKE++ validation | UNKNOWN (chain did not persist synthesis) |

### Kimi K2.6 synthesis via OpenRouter

```bash
source .env.live-chain
export CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"
export CNS_SYNTHESIS_PROVIDER=openrouter
export CNS_SYNTHESIS_MODEL=moonshotai/kimi-k2.6
npx tsx scripts/run-chain.ts \
  --topic "freelance consulting day rate calculation methodology 2026" \
  --evidence-file /tmp/run-chain-kimi-38-2.md \
  --operator-note "Story 38.2 Kimi K2.6 synthesis eval via OpenRouter"
```

| Metric | Value |
|--------|-------|
| Date | 2026-05-24T04:21:42Z |
| Wall clock | 331,117 ms (~5.5 min) |
| Outcome | **Aborted at hook** (Anthropic credits depleted) |
| Harness stage table | All stages `unknown` — run aborted before `ChainRunResult` |
| Raw smoke PAKE++ | **UNKNOWN** — persisted-note validation not run (`/tmp/run-chain-kimi-38-2.md`) |
| Operator observation | OpenRouter synthesis path invoked; hook failed before chain completion |

Hook/boss remained on Sonnet (`claude-sonnet-4-6`) per story isolation plan.

> **Full PAKE++ validation deferred** — re-run required after Anthropic credits restored. Prior PASS claim was from ad-hoc read-back, not harness smoke output; authoritative compact evidence reports UNKNOWN.

## Quality comparison (AC5)

| Dimension | Sonnet (this topic) | Kimi K2.6 (this topic) | Sonnet reference (21-1, different topic) |
|-----------|---------------------|------------------------|------------------------------------------|
| Full chain complete | No | No (hook blocked) | Yes |
| PAKE++ (harness smoke) | UNKNOWN | UNKNOWN | PASS |
| Wall clock | 75 s (aborted) | 331 s (aborted at hook) | 257 s (full chain) |
| Token/cost visible | N/A | Not surfaced in harness output | N/A |
| Frontmatter + abstract | N/A | Not validated in smoke | Present |
| PAKE++ sections | N/A | Not validated in smoke | PASS |
| Operator personalization | N/A | Not validated in smoke | PASS |

### AC5 — same-topic Sonnet comparison: **DEFERRED**

Blocked on Anthropic API credits. Sonnet baseline smoke on this brief aborted at synthesis (HTTP 400 credit balance). No apples-to-apples Sonnet vs Kimi table until credits restored and both smokes complete with harness PAKE++ PASS.

Qualitative Kimi notes (informal, not smoke-gated): prior ad-hoc inspection suggested operator-specific output; **not** counted toward AC4/AC5 until full re-run with harness validation.

## Decision record (AC6)

**Recommendation: DEFER**

Kimi K2.6 via OpenRouter synthesis path is worth re-evaluating after a clean smoke run. Harness evidence today reports PAKE++ UNKNOWN (chain aborted at hook). Adoption is blocked until:

1. **Anthropic API credits restored** — required for Sonnet baseline on the same brief topic and for hook/boss stages (still Anthropic-direct).
2. **Full-chain green smoke** — need end-to-end PASS with Kimi synthesis + Sonnet hook/boss (or future OpenRouter hook/boss spike) before switching default provider.

**Blocking issue:** Depleted `ANTHROPIC_API_KEY` credit balance prevents apples-to-apples Sonnet comparison and downstream stage validation.

## Code changes (AC7)

Implemented env-driven OpenRouter synthesis path (default remains Anthropic):

- `src/agents/synthesis-adapter-llm.ts` — `CNS_SYNTHESIS_PROVIDER`, `CNS_SYNTHESIS_MODEL`, OpenRouter chat-completions branch
- `scripts/run-chain.ts` — env validation + service banner for synthesis provider/model
- Tests added in `tests/vault-io/synthesis-adapter-llm.test.ts`, `tests/vault-io/run-chain-live-harness.test.ts`
