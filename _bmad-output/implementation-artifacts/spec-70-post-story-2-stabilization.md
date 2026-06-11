---
title: 'Epic 70 post-Story-2 stabilization'
type: 'bugfix'
created: '2026-06-12'
status: 'done'
baseline_commit: 'f9477d108370b075f92b57665e82461b42e9709c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-70-1-wire-node-orchestrator-cron.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The Node morning-digest path pushes valid scored signals to Convex but skips Discord because its payload has only `run` and `signals`, while the Discord poster expects pre-rendered markdown. The watchdog runner also initializes the NVM path after strict shell mode, and the cron contract test still asserts the removed Hermes-agent entrypoint.

**Approach:** Add a deterministic payload fallback renderer at the existing markdown-resolution boundary, move the watchdog Node bootstrap before strict shell mode, and update the stale cron assertion to the Node orchestrator contract.

## Boundaries & Constraints

**Always:** Preserve pre-rendered markdown precedence; render a date header, top trend, and source-grouped signal links from the existing signal fields; keep generated markdown at or below 4000 characters and at most two Discord messages; preserve `resolveOperatorHome()`; keep Discord posting non-fatal after Convex push.

**Ask First:** Any change to Discord credentials, channel configuration, Convex ordering, cron schedules, or MCP/tool signatures.

**Never:** Modify `scripts/run-morning-digest-cron.sh`; add packages; reintroduce a Hermes agent session; use `os.homedir()` for operator-home resolution; make Discord failure fail the completion run.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Node payload | Scored `signals[]`, no markdown | Dated digest with source headings and ranked title/URL links | Skip malformed signals; remain within 4000 chars |
| Hermes payload | Existing `digestMarkdown`, `outputContract`, or `markdown` | Existing pre-rendered text is returned unchanged | No fallback rendering |
| Partial payload | Missing top trend or some signal fields | Render available header/groups without `undefined` text | Return no markdown only when no useful digest content exists |
| Discord failure | Missing token, timeout, or non-2xx response | Convex completion remains successful and logs `discord-post-failed` | Do not throw into the primary push result |

</frozen-after-approval>

## Code Map

- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` - payload markdown resolver and source registry.
- `scripts/hermes-skill-examples/morning-digest/scripts/post-digest-discord.mjs` - chunks resolved markdown and posts it.
- `scripts/run-digest-convex-completion.mjs` - Convex-first ordering and non-fatal Discord logging.
- `scripts/run-push-digest-watchdog-cron.sh` - WSL cron PATH bootstrap ordering.
- `tests/parse-digest-source-outcomes.test.mjs` - fallback rendering, ranking, grouping, and size-limit coverage.
- `tests/post-digest-discord.test.mjs` - Node payload posting and message-count coverage.
- `tests/hermes-morning-digest-skill.test.mjs` - cron entrypoint contract.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` - render fallback markdown when no pre-rendered candidate exists; group by source, sort by descending `rankScore`, and admit bullets only within 4000 characters.
- [x] `tests/parse-digest-source-outcomes.test.mjs` and `tests/post-digest-discord.test.mjs` - prove pre-rendered precedence, live-shape fallback output, malformed-row handling, rank ordering, hard size bound, and at most two Discord posts.
- [x] `scripts/run-push-digest-watchdog-cron.sh` - place the existing NVM Node bootstrap immediately after the shebang and before `set -euo pipefail`.
- [x] `tests/hermes-morning-digest-skill.test.mjs` - replace Hermes cron assertions with `run-digest-convex-completion.mjs`.

**Acceptance Criteria:**
- Given a Node-collected artifact with no markdown field, when `postDigestToDiscord()` resolves content, then it posts a non-empty dated digest containing the top trend and grouped title/URL signals.
- Given a large scored payload, when fallback markdown is rendered, then output is no more than 4000 characters and splits into no more than two Discord messages.
- Given Discord posting fails, when completion has already pushed Convex data, then the run logs the Discord failure and still records the completion push action.
- Given a cron-like PATH, when the watchdog runner starts, then its NVM Node path is exported before strict shell mode and the script reaches the Node orchestrator.
- Given the focused test command, when it completes, then all requested suites pass.

## Spec Change Log

## Design Notes

Keep rendering at `resolveDigestMarkdownFromPayload()` because source-outcome parsing and Discord delivery already use it. Existing Hermes markdown remains authoritative. For Node payloads, use canonical source order, descending `rankScore`, and bounded round-robin admission so one source cannot consume the Discord budget.

## Verification

**Commands:**
- `node --test tests/parse-digest-source-outcomes.test.mjs` - fallback renderer edge cases pass.
- `node --test tests/post-digest-discord.test.mjs tests/run-digest-convex-completion.test.mjs tests/hermes-morning-digest-skill.test.mjs` - all focused suites pass.
- `bash scripts/run-push-digest-watchdog-cron.sh` - exits 0 without `node: not found`.
- `set -a && source .env.live-chain && set +a && node scripts/run-digest-convex-completion.mjs --force-rescore` - watchdog log records `action=discord-post-ok`.
- `rm -f ~/.hermes/digest-push-$(date +%Y-%m-%d).json && set -a && source .env.live-chain && set +a && bash scripts/run-morning-digest-cron.sh` - fresh Node collection posts Discord and logs `discord-post-ok` before `completion-backfill-push`.
- `bash scripts/verify.sh` - full repository gate passes.

**Manual checks (if no CLI):**
- Inspect Discord `#hermes` for the dated digest messages and confirm no Hermes agent session or context-compaction message appeared.

## Suggested Review Order

**Node Payload Rendering**

- Generates bounded, ranked, source-grouped markdown at the existing resolution boundary.
  [`parse-digest-source-outcomes.mjs:214`](../../scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs#L214)

- Packs generated markdown into at most two Discord-sized chunks.
  [`parse-digest-source-outcomes.mjs:150`](../../scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs#L150)

- Normalizes source identity, URLs, labels, and untrusted inline text.
  [`parse-digest-source-outcomes.mjs:44`](../../scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs#L44)

**Discord Delivery**

- Disables mention parsing while preserving the existing non-fatal REST path.
  [`post-digest-discord.mjs:119`](../../scripts/hermes-skill-examples/morning-digest/scripts/post-digest-discord.mjs#L119)

**Cron Runtime**

- Bootstraps the newest NVM Node before strict shell mode.
  [`run-push-digest-watchdog-cron.sh:1`](../../scripts/run-push-digest-watchdog-cron.sh#L1)

**Verification**

- Covers fallback precedence, ranking, malformed rows, and output bounds.
  [`parse-digest-source-outcomes.test.mjs:96`](../../tests/parse-digest-source-outcomes.test.mjs#L96)

- Proves Node payloads post in no more than two messages.
  [`post-digest-discord.test.mjs:149`](../../tests/post-digest-discord.test.mjs#L149)

- Locks the Node orchestrator and watchdog bootstrap contracts.
  [`hermes-morning-digest-skill.test.mjs:268`](../../tests/hermes-morning-digest-skill.test.mjs#L268)

- Confirms Discord failure remains non-fatal after completion push.
  [`run-digest-convex-completion.test.mjs:62`](../../tests/run-digest-convex-completion.test.mjs#L62)
