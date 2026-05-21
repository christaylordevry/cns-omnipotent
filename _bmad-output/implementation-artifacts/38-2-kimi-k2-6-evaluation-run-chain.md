---
story_id: 38-2
epic: 38
title: kimi-k2-6-evaluation-run-chain
status: ready-for-dev
---

# Story 38.2: Kimi K2.6 evaluation for run-chain

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **operator**,
I want **`scripts/run-chain.ts` synthesis (and optionally hook/boss) stages evaluated against Kimi K2.6** via a controlled smoke run,
so that **we know whether a cheaper model can replace Claude Sonnet for chain inference** without breaking PAKE++ validation or vault writes.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 38: Cost + Provider Optimization |
| **Phase** | 7 |
| **Baseline** | `src/agents/synthesis-adapter-llm.ts` hard-codes **`claude-sonnet-4-6`** + **`ANTHROPIC_API_KEY`** |
| **Hermes** | Migrated to Codex OAuth (38-1); **run-chain remains Anthropic-direct** today |
| **Default chain topic** | `CNS_BRIEF_TOPIC` or built-in freelance consulting day-rate brief (Operator Guide § run-chain) |
| **Vault footprint** | Default run persists only synthesis + hook + weapons-check under `03-Resources/` (Story 25-1) |

## Acceptance Criteria

1. **Model target documented:** Record the exact OpenRouter (or vendor) model slug used for Kimi K2.6 (e.g. `moonshotai/kimi-k2.5` or current `kimi-k2*` id from OpenRouter catalog at run time — verify live; do not guess from training data).
2. **Evaluation harness:** One live `npx tsx scripts/run-chain.ts` run with Kimi driving **at minimum the synthesis adapter**; hook/boss may stay on Sonnet for pass/fail isolation unless a single-provider run is feasible.
3. **Env contract:** Document required keys (`OPENROUTER_API_KEY` or vendor equivalent, existing `FIRECRAWL_API_KEY`, `APIFY_API_TOKEN`, `PERPLEXITY_API_KEY`). **Do not** paste secrets into story artifacts or commits.
4. **PAKE++ gate:** Read-back validation must report **`PAKE++ validation: PASS`** in smoke evidence (same contract as Operator Guide / `chain-smoke-evidence.ts`).
5. **Quality comparison:** Capture side-by-side notes: latency (wall clock), token/cost if visible, output structure (frontmatter + `[!abstract]` + sections), and any regression vs last Sonnet baseline run on the **same brief topic**.
6. **Decision record:** End with explicit recommendation: **adopt**, **defer**, or **reject** for run-chain synthesis, with one blocking issue if defer/reject.
7. **If adopt requires code:** Limit repo diff to adapter/env wiring (e.g. optional `CNS_SYNTHESIS_MODEL` / provider flag); **no** MCP tool signature changes; run `npm test` + `bash scripts/verify.sh` before marking done.
8. **If evaluation-only:** No repo commit required; evidence file at `_bmad-output/implementation-artifacts/epic-38-kimi-run-chain-evidence.md` is sufficient to mark done.
9. Standing task: Operator guide — update **only if** run-chain usage or env vars change for operators.

## Tasks / Subtasks

- [ ] Resolve live Kimi K2.6 model id (OpenRouter `hermes models` / catalog or provider docs).
- [ ] Spike adapter path: env-driven model on `createLlmSynthesisAdapter` **or** parallel `synthesis-adapter-openrouter.ts` (prefer smallest diff).
- [ ] Run baseline Sonnet smoke (same topic) if no recent evidence on disk.
- [ ] Run Kimi smoke; save compact evidence markdown (no secrets).
- [ ] Compare PAKE++ PASS/FAIL, latency, qualitative output.
- [ ] Write recommendation (adopt / defer / reject) in evidence file + Dev Agent Record.
- [ ] If adopt: implement flag, tests if touching adapter contracts, `verify.sh`, commit.
- [ ] Standing task: Operator guide per AC9.

## Dev Notes

### Code touchpoints (likely)

| File | Role |
|------|------|
| `src/agents/synthesis-adapter-llm.ts` | `MODEL` constant, Anthropic URL — primary swap point |
| `src/agents/hook-adapter-llm.ts` | Hook stage (optional same flag) |
| `src/agents/boss-adapter-llm.ts` | Weapons-check stage (optional) |
| `scripts/run-chain.ts` | Env validation (`ANTHROPIC_API_KEY` today); extend for OpenRouter path |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | § run-chain env table if changed |

### Implementation options (pick one in dev)

**A — Env-only OpenRouter synthesis (recommended spike)**  
Add `CNS_SYNTHESIS_PROVIDER=openrouter` + `CNS_SYNTHESIS_MODEL=<kimi-slug>` + `OPENROUTER_API_KEY`. Branch in adapter factory to call OpenRouter chat-completions compatible endpoint. Keeps Sonnet as default when unset.

**B — Hermes-delegated chain**  
Not in scope — run-chain is repo TypeScript, not Hermes gateway.

### Smoke commands (secret-safe)

```bash
cd /home/christ/ai-factory/projects/Omnipotent.md
set -a && source .env.live-chain && set +a
export CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"
# Baseline (existing):
# npx tsx scripts/run-chain.ts --topic "<fixed-topic>" 2>&1 | tee /tmp/run-chain-sonnet.log
# Kimi eval (after adapter flag exists):
# CNS_SYNTHESIS_MODEL=<verified-kimi-slug> CNS_SYNTHESIS_PROVIDER=openrouter \
#   npx tsx scripts/run-chain.ts --topic "<same-topic>" 2>&1 | tee /tmp/run-chain-kimi.log
```

### Anti-patterns

- Do **not** change Hermes `~/.hermes/config.yaml` for this story unless testing gateway-side Kimi (out of scope).
- Do **not** weaken PAKE validation to force PASS.
- Do **not** commit `.env.live-chain` or API keys.
- Do **not** conflate Kimi eval with Discord `#hermes` skills.

### Previous story intelligence (38-1)

- Hermes primary/auxiliary now on **Codex OAuth** — run-chain cost win is independent; Kimi eval targets **batch research synthesis**, not gateway chat.

### References

- [Source: `scripts/run-chain.ts` — header, env validation, default memory-only acquisition]
- [Source: `src/agents/synthesis-adapter-llm.ts` — `MODEL = claude-sonnet-4-6`]
- [Source: `_bmad-output/implementation-artifacts/30-2-run-chain-invocation-and-synthesisNote-verification-status-stamp.md` — triage post-move chain (if present)]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` — run-chain section]
- [Source: `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` — policy dimensions]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — per-skill Hermes routing still blocked; run-chain is repo-side]
- [Source: Context7 `/nousresearch/hermes-agent` — provider config patterns (analogy only)]

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If run-chain env or operator steps change: update `03-Resources/CNS-Operator-Guide.md` via vault MCP; bump Version History.
- [ ] If evaluation-only with no operator-facing change: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

(pending dev-story)

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-05-22: Story created for Epic 38 — Cost + Provider Optimization.
