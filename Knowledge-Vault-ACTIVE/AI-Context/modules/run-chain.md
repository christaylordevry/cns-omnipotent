# Run-Chain Pipeline (Epic 75 / FR7)

Governance for the CNS research chain: **Research → Synthesis → Hook → Boss**. Engine code is **protect-listed** — revival is knowledge, environment, and Hermes trigger only (no adapter edits in Epic 75).

## Status

**Dormant** — `ANTHROPIC_API_KEY` returning HTTP 401 since ~2026-05-24 until Story **75-4** validates/rotates the key. Hermes Portal OAuth inference is separate and does **not** replace run-chain LLM calls (ADR-HERMES-004 / FR11 Option A).

## What it does

Four-stage research pipeline that turns a **ResearchBrief** into governed vault notes:

| Stage | Agent | Output |
|-------|-------|--------|
| Research | `runResearchAgent` | Multi-tier acquisition sweep (Firecrawl, Apify, Scrapling, Perplexity) |
| Synthesis | `runSynthesisAgent` | InsightNote under `03-Resources/` |
| Hook | `runHookAgent` | HookSetNote under `03-Resources/` |
| Boss / Weapons | `runBossAgent` | WeaponsCheckNote under `03-Resources/` |

**Story 25.1 vault footprint:** By default (no `--save-sources`), acquisition-tier outputs (SourceNotes, filed Perplexity Insight/SynthesisNotes) stay **in memory**. Only synthesis, hook-set, and weapons-check notes persist under `03-Resources/`. Pass `--save-sources` to restore pre-25.1 behavior and write every acquisition-tier note to the vault.

## Entry points

| Entry | Path | Role |
|-------|------|------|
| CLI (operator) | `scripts/run-chain.ts` | Live smoke runner: env assert, adapters, evidence, read-back validation |
| Orchestrator | `src/agents/run-chain.ts` → `runChain()` | Sequential stage chain; default LLM adapters wired in CLI |

```
scripts/run-chain.ts  ──calls──▶  runChain()  in  src/agents/run-chain.ts
                                        │
                    Research → Synthesis → Hook → Boss
```

## Stage sequence

Exact order in `runChain()` (`src/agents/run-chain.ts`):

1. **Research** — `runResearchAgent(vaultRoot, brief, opts.research)`
   - Tiers (when configured): **Firecrawl** (search/scrape) and **Apify** (social / RAG web browser) run concurrently with social-domain queries routed to Apify; then **Scrapling** runs for URL-shaped queries; then **Perplexity** files optional answers.
2. **Synthesis** — `runSynthesisAgent(vaultRoot, sweep, { adapters, operator_context, vault_context_packet })`
3. **Hook** — `runHookAgent(vaultRoot, synthesis, { adapters })`
4. **Boss / Weapons** — `runBossAgent(vaultRoot, hooks, { adapters })`

Returns `{ sweep, synthesis, hooks, weapons }`.

## Environment (`.env.live-chain`)

Operator pattern: gitignored `.env.live-chain` at repo root, then `source .env.live-chain` before invoking the CLI (same pattern as gateway, digest, and triage skill examples).

### Required (`assertChainLiveRequiredEnv`)

| Variable | Stage / service |
|----------|-----------------|
| `FIRECRAWL_API_KEY` | Research — Firecrawl adapter |
| `ANTHROPIC_API_KEY` | Synthesis (default Anthropic provider), Hook, Boss |
| `APIFY_API_TOKEN` | Research — Apify canonical token |
| `APIFY_TOKEN` | Deprecated Apify alias; accepted only when `APIFY_API_TOKEN` is unset |

### Conditional (OpenRouter synthesis only)

When `CNS_SYNTHESIS_PROVIDER=openrouter`:

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Synthesis adapter |
| `CNS_SYNTHESIS_MODEL` | e.g. `moonshotai/kimi-k2.6` |

Default synthesis provider is **Anthropic** (`claude-sonnet-4-6`) when `CNS_SYNTHESIS_PROVIDER` is unset. **Hook and Boss always use Anthropic** regardless of synthesis provider.

### Optional / runtime

| Variable | Default / behavior |
|----------|-------------------|
| `CNS_VAULT_ROOT` | Active vault path; CLI fallback `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` |
| `CNS_BRIEF_TOPIC` | Default topic when no `--topic` / `--brief-file` |
| `PERPLEXITY_API_KEY` | Not in required assert — Perplexity slot may report `available: false` |
| `SCRAPLING_COMMAND` | Default `scrapling`; tier disabled if command not on PATH |
| `CHAIN_VAULT_ROOT_CLASS` | `staging` \| `active` \| `unknown` for smoke evidence |
| `CNS_SYNTHESIS_PROVIDER` | `anthropic` (default) or `openrouter` |

## Operator procedure (manual v1)

Hermes skill trigger is Story **75-3** — not this module.

```bash
cd /path/to/Omnipotent.md
source .env.live-chain

# Minimal (uses CNS_BRIEF_TOPIC or built-in default topic)
npx tsx scripts/run-chain.ts

# With explicit brief
npx tsx scripts/run-chain.ts \
  --topic "your research topic" \
  --query "primary query" \
  --query "reddit.com your topic" \
  --depth deep \
  --evidence-file _bmad-output/run-chain-smoke.md
```

Pre-run: CLI calls `assertChainLiveRequiredEnv()` and prints `Env validation: OK`. Stale chain notes under `03-Resources/` may be cleaned automatically before the run.

## CLI reference

From `parseArgs` / `printHelp` in `scripts/run-chain.ts`:

| Flag | Purpose |
|------|---------|
| `--brief-file path` | ResearchBrief JSON: `topic`, `queries`, `depth`, optional `tags` (exclusive with `--topic`/`--query`/`--depth`) |
| `--topic text` | Override brief topic |
| `--query text` | Add query (repeatable) |
| `--depth value` | `shallow`, `standard`, or `deep` (default `deep`) |
| `--save-sources` | Persist acquisition-tier notes to vault (default: memory-only) |
| `--evidence-file path` | Write compact secret-safe smoke evidence markdown |
| `--operator-note text` | Add sanitized operator note to evidence |
| `--vault-root-class value` | `staging`, `active`, or `unknown` (overrides auto-detect) |
| `--verbose-cleanup` | Print removed/skipped paths for pre-run cleanup |
| `--raw-json` | Also print full `ChainRunResult` JSON (local debugging only) |
| `--help`, `-h` | Show usage |

Exit code: `0` when read-back validation and PAKE validation pass; `1` otherwise.

## Known failure modes

| Failure | Symptom | Operator action |
|---------|---------|-----------------|
| Missing required env / parse failure | Throws before chain catch: `Missing required environment variables: …`, invalid provider, invalid args, or invalid brief. Compact fatal evidence and `--evidence-file` are not written for these preflight failures. | Fix `.env.live-chain` or CLI input; `source .env.live-chain`; rerun |
| Dead `ANTHROPIC_API_KEY` | HTTP 401 on Synthesis/Hook/Boss | Story **75-4** validate/rotate key; do **not** edit adapters |
| Firecrawl / Apify HTTP error | Recorded in smoke evidence `externalServiceErrors` | Check keys, quotas, network |
| Scrapling not on PATH | Log: `Scrapling=disabled`; operator note in evidence | Install CLI or set `SCRAPLING_COMMAND` |
| Perplexity unavailable | Research continues; `Perplexity=disabled` in startup log | Optional — configure MCP/slot if needed |
| Zero-source sweep | Research returns zero created sources; Synthesis receives an empty sweep; chain can continue but output quality degrades and downstream notes may be weak or skipped. | Fix acquisition keys/routing/queries before treating it as a read-back defect |
| Synthesis PAKE validation fail | Summary `PAKE++ validation: FAIL` | Review synthesis body vs operator context |
| Output read-back fail | Summary `Result: FAIL` on synthesis/hooks/weapons paths | Check vault write permissions, WriteGate on target paths |
| Invalid brief JSON | `Expected ResearchBrief JSON shape: …` | Fix `--brief-file` or CLI topic/query args |
| Fatal uncaught error | Compact fatal evidence markdown to stderr | Read evidence file; check brief shape and env |

**Current production blocker:** `ANTHROPIC_API_KEY` **401 dead** since ~2026-05-24 — chain dormant until **75-4**.

## FR11 Option A / credential posture (ADR-HERMES-004)

- Keep **one** `ANTHROPIC_API_KEY` in `.env.live-chain`.
- **All three** LLM stages (Synthesis default, Hook, Boss) use Anthropic Messages API via existing adapters.
- **Zero** edits to protect-list adapter files in Epic 75 unless operator explicitly authorizes FR11-B.
- Portal `nous` OAuth replaces Hermes **inference** only — **not** run-chain LLM calls.

### Key validation and rotation

Use this procedure when `ANTHROPIC_API_KEY` returns HTTP **401**, before attempting run-chain (Story **75-5**).

1. **Validate (smoke):** From the Omnipotent.md repo root, run `npx tsx scripts/validate-anthropic-key.ts`. Exit **0** is required before run-chain. The script loads `ANTHROPIC_API_KEY` from `.env.live-chain` (or respects an already-exported env var), POSTs a minimal Messages API ping (`claude-haiku-4-5`, `max_tokens: 1`), and prints only a masked key prefix — never the full secret.
2. **Obtain a new key:** Anthropic Console → API Keys → create key ([https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)).
3. **Update local env:** Edit gitignored `.env.live-chain` at repo root — replace the `ANTHROPIC_API_KEY=…` line only. Never commit `.env.*`.
4. **Operator approval:** FR11-A revival is operator-approved (architecture gate 2026-06-24). Do not mint or rotate keys ad hoc without explicit approval; see `_bmad-output/implementation-artifacts/deferred-work.md` § LLM provider consolidation.
5. **Revoke old key:** After validate exits 0, revoke the previous key at the provider.
6. **Post-incident hygiene:** If a key was exposed (chat, logs, screenshot, or commit), follow `specs/cns-vault-contract/modules/mcp-operator-runbook.md` § Key rotation hygiene.
7. **Next step:** Story **75-5** — E2E revival via Hermes `run-chain` skill after validate passes.

## Forbidden edits (protect-list / NFR2)

| Path | Reason |
|------|--------|
| `src/agents/synthesis-adapter-llm.ts` | Synthesis LLM adapter |
| `src/agents/hook-adapter-llm.ts` | Hook LLM adapter |
| `src/agents/boss-adapter-llm.ts` | Boss LLM adapter |
| `src/agents/run-chain.ts` | Orchestrator |
| `scripts/run-chain.ts` | CLI entry |

Epic 75 revival = documentation + env + Hermes skill (**75-3**) + key validation (**75-4**) + E2E proof (**75-5**). No engine changes without explicit operator approval.

## References

- **Project stub:** `AI-Context/projects/run-chain/README.md`
- **ADR-HERMES-004** — FR11 Option A (Anthropic key for all run-chain stages)
- **Deferred work:** `_bmad-output/implementation-artifacts/deferred-work.md` §LLM provider consolidation
- **Epic 75 stories:** 75-3 (Hermes skill), 75-4 (key validation), 75-5 (E2E revival)
- **Related module:** `AI-Context/modules/hermes-desktop.md` (Portal vs run-chain credential split)
- **Architecture:** `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Protect-list
