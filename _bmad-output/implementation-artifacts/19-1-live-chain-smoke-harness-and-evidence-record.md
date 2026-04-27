# Story 19.1: Live Chain Smoke Harness and Evidence Record

Status: in-progress (live smoke executed; provider credentials rejected)

Epic: 19 (Live chain context confidence)

## Story

As an **operator**,
I want **a repeatable live smoke procedure for `scripts/run-chain.ts` with safe evidence capture**,
so that **we can prove the Epic 18 chain works under real credentials without converting live calls into CI requirements**.

## Acceptance Criteria

1. Given a staging vault and valid Firecrawl, Perplexity, and Anthropic keys, when the operator runs the live chain smoke, then Research, Synthesis, Hook, and Boss each complete or fail with a documented external-service reason.
2. The smoke record captures date, command shape, vault root class (staging vs active), brief topic, stage statuses, generated vault paths, model/service errors, retry/rate-limit observations, and operator notes with no secrets.
3. `scripts/run-chain.ts` either supports or documents a safe evidence mode that avoids dumping full raw payloads by default.
4. Tests remain mocked and `scripts/verify.sh` does not require network access.

## Implementation Summary

- Added compact smoke evidence formatting in `src/agents/chain-smoke-evidence.ts`.
- Updated `scripts/run-chain.ts` so default output is compact, secret-safe Markdown evidence instead of full raw JSON.
- Kept full `ChainRunResult` JSON available only through explicit `--raw-json`.
- Added `--evidence-file`, `--operator-note`, and `--vault-root-class` options for operator-run evidence capture.
- Added mocked tests in `tests/vault-io/chain-smoke-evidence.test.ts` for redaction, compact formatting, fatal error summaries, and vault-root classification.

## Safe Smoke Procedure

Use a staging vault, not the active vault. A fixture-backed staging vault is acceptable for the baseline live smoke:

```bash
STAGING_VAULT="$(mktemp -d /tmp/cns-live-smoke-vault-XXXXXX)"
cp -R tests/fixtures/minimal-vault/. "$STAGING_VAULT"/

CNS_VAULT_ROOT="$STAGING_VAULT" \
CHAIN_VAULT_ROOT_CLASS=staging \
FIRECRAWL_API_KEY="$FIRECRAWL_API_KEY" \
PERPLEXITY_API_KEY="$PERPLEXITY_API_KEY" \
ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
tsx scripts/run-chain.ts \
  --evidence-file _bmad-output/implementation-artifacts/19-1-live-chain-smoke-evidence.md \
  --operator-note "Baseline Epic 19.1 live smoke against fixture-backed staging vault."
```

Secret-safety rules:

- Paste or save only the compact evidence Markdown.
- Do not use `--raw-json` for story evidence.
- Do not paste shell history containing literal key values.
- Do not record the active vault root path; record only the vault root class.
- If a provider fails, keep the sanitized fatal/error summary and do not paste full provider response bodies.

## Live Smoke Evidence

Live smoke executed on 2026-04-22 against a fixture-backed staging vault. Rerun after Firecrawl/Perplexity key update still returned provider HTTP 401 responses.

Evidence file:

- `_bmad-output/implementation-artifacts/19-1-live-chain-smoke-evidence.md`

Safe evidence summary:

```text
Research: failed
- Firecrawl search HTTP 401: Unauthorized: Invalid token
- Perplexity search HTTP 401: invalid_api_key

Synthesis: skipped (no-source-notes)
Hook: skipped (synthesis-skipped)
Boss: skipped (hook-skipped)
Retry/rate-limit observations: none
```

Anthropic-backed synthesis/hook/boss adapters were configured but not exercised because the Research stage created no source notes after Firecrawl and Perplexity rejected the supplied credentials.

## Acceptance Status

- AC1: partially complete; live smoke executed and each reached stage has a documented outcome, but provider credentials were rejected before a source-backed Anthropic path could run.
- AC2: done for failed-run evidence; compact evidence captures date, command shape, staging vault class, brief topic, stage statuses, generated paths/counts, service errors, retry/rate-limit observations, and operator notes with no secrets.
- AC3: done; compact safe evidence is default, raw JSON requires `--raw-json`.
- AC4: done; tests are mocked and `bash scripts/verify.sh` passed without network requirements.

## Debug Log References

- `npm run -s test:vitest -- tests/vault-io/chain-smoke-evidence.test.ts` - PASSED (4 tests)
- `npm run -s lint -- scripts/run-chain.ts src/agents/chain-smoke-evidence.ts tests/vault-io/chain-smoke-evidence.test.ts` - PASSED
- `bash scripts/verify.sh` - PASSED (22 TAP tests, 510 Vitest tests, lint, typecheck, build)
- Live key presence check - PASSED (`FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`, and `ANTHROPIC_API_KEY` set via ignored `.env.live-chain`)
- `npx tsx scripts/run-chain.ts --evidence-file _bmad-output/implementation-artifacts/19-1-live-chain-smoke-evidence.md --operator-note ...` - completed with compact safe evidence; Firecrawl and Perplexity returned HTTP 401 invalid-key responses.
- Rerun after key update - same HTTP 401 provider responses; evidence file overwritten with latest compact safe output.

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### File List

- Added: `src/agents/chain-smoke-evidence.ts`
- Edited: `scripts/run-chain.ts`
- Added: `tests/vault-io/chain-smoke-evidence.test.ts`
- Added: `_bmad-output/implementation-artifacts/19-1-live-chain-smoke-harness-and-evidence-record.md`
- Added: `_bmad-output/implementation-artifacts/19-1-live-chain-smoke-evidence.md`
