---
title: '70-hotfix people bonus scoring path'
type: 'bugfix'
created: '2026-06-12'
status: 'done'
route: 'one-shot'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/68-3-personal-relevance-v3-people-bonus.md'
---

## Intent

**Problem:** Epic 70 Node orchestrator scored signals with `personalRelevance: 0` for watchlisted handles (e.g. emollick) because `loadNexusPeople` returned an empty array: operator `nexus-people.yaml` used unquoted inline flow arrays (`tags: [ai, education]`, `twitter: [emollick]`) that the line-safe parser flagged as malformed and discarded all people. Scoring child processes also lacked a resolved operator `HOME` when forked under Hermes profile isolation.

**Approach:** Harden `parseInlineTagArray` / handle flow-array parsing, salvage valid people entries when partial malformations remain, and resolve operator home via `resolveOperatorHome()` before forking dedupe/score child processes.

## Suggested Review Order

1. [score-digest-signals.mjs](../../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs) — inline array parsing + salvage load path
2. [run-digest-convex-completion.mjs](../../scripts/run-digest-convex-completion.mjs) — `buildDigestPipelineChildEnv` HOME resolution for child scoring
3. [morning-digest-score-signals.test.mjs](../../tests/morning-digest-score-signals.test.mjs) — unquoted array + salvage expectations
4. [run-digest-convex-completion.test.mjs](../../tests/run-digest-convex-completion.test.mjs) — Hermes-isolated HOME force-rescore integration

## Verification

**Commands:**
- `bash scripts/verify.sh` — expected: VERIFY PASSED
- `node scripts/validate-epic-68-digest.mjs --latest --json --people-done` — expected: C6 pass, overall pass (after `--force-rescore`)
