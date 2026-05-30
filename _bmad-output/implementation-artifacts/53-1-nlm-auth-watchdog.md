---
baseline_commit: fbf7820
---

# Story 53.1: nlm auth watchdog

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **53** (NotebookLM operational resilience)
Tracked in sprint-status as: **`53-1-nlm-auth-watchdog`**

**Operator intent:** During `/session-close`, after the NotebookLM fan-out step, run an `nlm` authentication check (`nlm login --check`, or a local equivalent if the CLI changes). If the check fails, times out, or reports unauthenticated, post a warning to `#hermes`. This warning is non-blocking: session-close must still complete and must not downgrade successful export, Section 8, MEMORY, fast-scan, daily rhythm, or NotebookLM fan-out results.

## Story

As the **CNS operator**,
I want **session-close to warn me when the local `nlm` NotebookLM CLI auth has expired**,
so that **I can run `nlm login` before the next NotebookLM query or sync flow silently degrades**.

## Acceptance Criteria

1. **Watchdog runs after NotebookLM fan-out (AC: order)**
   **Given** `/session-close` runs in real mode
   **When** the skill has finished its NotebookLM `source_add` fan-out loop, including partial or failed target results
   **Then** it runs the auth watchdog after fan-out and before the final operator-visible close result is complete
   **And** dry-run mode skips the watchdog and reports `nlm_auth: skipped in dry-run`.

2. **Auth check command (AC: check)**
   **Given** the local CLI exposes `nlm login --check`
   **When** the watchdog runs
   **Then** it invokes `nlm login --check` with a short timeout
   **And** treats exit code `0` as authenticated
   **And** treats non-zero exit, timeout, missing `nlm`, or stdout/stderr indicating unauthenticated auth state as unauthenticated
   **And** if a future `nlm whoami` command exists, the implementation may use it only if tests preserve the same success/failure contract.

3. **Discord warning to #hermes (AC: warning)**
   **Given** the watchdog result is unauthenticated or unknown
   **When** session-close reaches the final reply phase
   **Then** `#hermes` receives a warning containing:
   - `nlm auth warning`
   - the short reason class: `missing-cli`, `timeout`, `unauthenticated`, or `check-failed`
   - the operator action: `run nlm login`
   **And** the warning does not include Google account email, cookies, tokens, raw CLI debug output, or raw env values.

4. **Non-blocking close semantics (AC: non-blocking)**
   **When** the auth watchdog fails or reports unauthenticated
   **Then** `/session-close` still completes with the existing close-report status from export, Section 8, MEMORY, fast-scan, tests, daily rhythm, Convex health push, and NotebookLM fan-out
   **And** `failure_class` is not changed to `notebooklm`, `pipeline`, or a new blocking value solely because of the auth watchdog
   **And** the close report includes a separate `nlm_auth` object or final reply field so the warning is auditable without masking the main close status.

5. **Hermes/runtime path compatibility (AC: runtime)**
   **Given** Hermes gateway sessions may have a reduced `PATH`
   **When** the watchdog resolves the CLI
   **Then** it uses a deterministic lookup order:
   - `NLM_BIN` env override when set
   - `nlm` from `PATH`
   - known operator-local path `/home/christ/.local/bin/nlm` when present
   **And** the implementation must not invoke `uvx` during session-close as a fallback because that can add network/install latency to a close path.

6. **Tests and verify (AC: tests)**
   **Then** tests cover:
   - authenticated exit `0`
   - non-zero unauthenticated result
   - missing CLI
   - timeout
   - warning text redacts account/email-like output
   - dry-run skips the watchdog
   - watchdog result does not change `failure_class`
   **And** `bash scripts/verify.sh` passes.

7. **Scope boundaries (AC: non-goals)**
   **Then** this story does **not**:
   - Change Vault IO, WriteGate, MCP tool signatures, or audit log behavior
   - Change NotebookLM routing, scoring, watched notebook selection, registry merge semantics, or `source_add` payload shape
   - Add new npm packages
   - Trigger `nlm login` automatically
   - Print raw `nlm doctor` output to Discord
   - Require a Hermes gateway restart for tests, unless the implementation changes live installed skill files and needs an operator smoke

## Tasks / Subtasks

- [x] Add an auth-watchdog helper under `scripts/session-close/lib/` or directly in `run-deterministic.mjs` only if the helper would be overkill (AC: check, runtime)
- [x] Wire real `/session-close` to run the watchdog after NotebookLM fan-out and before final reply completion (AC: order)
- [x] Add `nlm_auth` to `.session-close/close-report.json` or the final reply rendering contract without changing blocking `failure_class` semantics (AC: non-blocking)
- [x] Update `scripts/hermes-skill-examples/session-close/SKILL.md` and `references/discord-reply-template.md` only as needed to surface the warning (AC: warning)
- [x] If the skill package changes, run `bash scripts/install-hermes-skill-session-close.sh` and prove repo/live parity with `cmp -s` or `diff -qr` (AC: runtime)
- [x] Extend `tests/session-close-pipeline.test.mjs` and/or `tests/hermes-session-close-skill.test.mjs` with fixture-only coverage (AC: tests)
- [x] Run `bash scripts/verify.sh` (AC: tests)

## Dev Notes

### Current implementation surface

`/session-close` is currently split into deterministic Phase A plus a slim Hermes router:

- `scripts/session-close/hermes-run-session-close.sh` sets the Node path and invokes `scripts/session-close/run-deterministic.mjs`.
- `scripts/session-close/run-deterministic.mjs` writes `.session-close/context-pack.json` and `.session-close/close-report.json`, performs export, fast-scan, tests, MEMORY, daily rhythm, and Convex notebook-health push.
- `scripts/hermes-skill-examples/session-close/SKILL.md` handles the bounded Section 8 pass, calls `gate-apply-section8.mjs`, renders the Discord reply, and performs NotebookLM `source_add` fan-out from report-provided IDs.
- `scripts/hermes-skill-examples/session-close/references/discord-reply-template.md` is the reply contract. Keep it report-driven and bounded.

Because NotebookLM fan-out is currently agent/MCP-side rather than inside `run-deterministic.mjs`, the implementer must choose the least risky hook:

1. Prefer adding the watchdog to the slim session-close skill immediately after the `source_add` loop, then include the result in the final Discord reply or post a separate warning message.
2. If moving fan-out into a script in this story, keep that script narrow and preserve existing `source_add` payload semantics. Do not broaden the story into a fan-out refactor.

### Auth command

Use `nlm login --check` as the `whoami` equivalent for this host. Local `nlm --help` and upstream docs show `login --check`; this install does not expose a `whoami` command.

Suggested result model:

```js
{
  status: "authenticated" | "unauthenticated" | "unknown",
  reason: "ok" | "missing-cli" | "timeout" | "unauthenticated" | "check-failed" | "skipped-dry-run",
  message: "short sanitized message"
}
```

Keep raw CLI output in stderr or tests only when sanitized. Discord output should be operator-actionable and tiny:

```text
nlm auth warning: unauthenticated. Run `nlm login` before the next NotebookLM query or sync.
```

### Timeout and command execution

Use `execFile` rather than shell string construction when implementing in Node. Suggested timeout: `10_000` ms. A shorter timeout is acceptable if tests make the behavior deterministic.

Do not call `nlm doctor` as the primary auth probe. It is useful for manual diagnostics but produces broader output and checks more than auth. If the implementation uses `doctor` as a fallback, it must sanitize output and keep the watchdog non-blocking.

### Warning delivery

The warning may be either:

- a separate Discord message after the final session-close reply, or
- a clearly labeled `nlm_auth` line in the final reply.

Use the separate message if that is the only reliable way for Hermes to "post a warning to #hermes" after an otherwise successful close. In either shape, tests should assert the text contract and no secret-like or email-like content appears.

### Testing requirements

Prefer fixture-only tests:

- Mock `execFile` or inject a `runNlmAuthCheck` function so CI never calls live `nlm`.
- Use fake stdout/stderr containing an email address and ensure the formatted warning excludes it.
- For `run-deterministic.mjs` close-report tests, assert `failure_class` stays `null` or the pre-existing failure value when `nlm_auth.status !== "authenticated"`.
- For `SKILL.md` contract tests, assert the watchdog is ordered after NotebookLM fan-out and described as non-blocking.

### Architecture compliance

- **Spec-first:** No `specs/cns-vault-contract/` change required; this is Hermes session-close operator behavior, not a Vault IO MCP surface.
- **WriteGate:** N/A; no vault mutation added.
- **Security:** Do not post raw CLI output. Do not post Google account email. Do not read or print token/cache files under `~/.notebooklm-mcp-cli/`.
- **Verify gate:** `bash scripts/verify.sh` is mandatory before marking done.
- **Live parity:** If the session-close skill mirror changes, update `~/.hermes/skills/cns/session-close/` via install script and prove parity.

### Latest technical reference

- Context7 ID: `/jacob-bd/notebooklm-mcp-cli`
- Current upstream docs list `nlm login --check` for auth status and `nlm doctor` for diagnostics.
- Upstream README notes the package provides both `nlm` and `notebooklm-mcp`; avoid adding another dependency or invoking `uvx` at session-close time.

### Previous story intelligence

- **50-1:** Established `nlm list notebooks --json` sync and failure handling. Do not corrupt registry files or call live `nlm` in CI.
- **50-8:** Established best-effort Discord warning behavior for notebook staleness. Keep this watchdog similarly best-effort, sequential, and non-blocking.
- **51-1 / 52-1:** Notebook query and morning digest use the CLI path for NotebookLM reads. Expired `nlm` auth affects those flows even when `/session-close` source_add fan-out has its own MCP behavior.
- **48-series / session-close architecture:** Keep LLM input bounded. Do not reintroduce monolithic `task-prompt.md` behavior or export-body reads.

### Project Structure Notes

Likely touched paths:

| Path | Expected action |
|------|-----------------|
| `scripts/hermes-skill-examples/session-close/SKILL.md` | Update if watchdog lives in the skill router |
| `scripts/hermes-skill-examples/session-close/references/discord-reply-template.md` | Update reply/warning contract if report-driven |
| `scripts/session-close/run-deterministic.mjs` | Update only if watchdog result belongs in close-report generation |
| `scripts/session-close/lib/nlm-auth-watchdog.mjs` | New helper if scripting the watchdog |
| `tests/session-close-pipeline.test.mjs` | Add close-report/non-blocking tests |
| `tests/hermes-session-close-skill.test.mjs` | Add skill ordering and warning contract tests |

Do not touch:

- `src/` Vault IO MCP tools
- `src/write-gate.ts`
- `_meta/logs` audit behavior
- `scripts/session-close/lib/notebook-scorer.mjs`
- `scripts/session-close/lib/notebook-disambiguate.mjs`
- `scripts/session-close/lib/sync-notebook-registry.mjs`
- `scripts/session-close/lib/notebook-registry.json` unless a test fixture explicitly needs a temp copy

## References

- [Source: operator brief: "53-1: nlm auth watchdog"]
- [Source: `scripts/hermes-skill-examples/session-close/SKILL.md`: current slim router, NotebookLM fan-out instruction, non-retry pitfall]
- [Source: `scripts/session-close/run-deterministic.mjs`: close-report shape, failure_class handling]
- [Source: `scripts/session-close/lib/read-sources.mjs`: NotebookLM target routing sources]
- [Source: `tests/session-close-pipeline.test.mjs`: fixture patterns and close-report assertions]
- [Source: `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md`: two-phase session-close architecture and bounded context contract]
- [Source: `_bmad-output/implementation-artifacts/50-1-notebook-registry-sync.md`: `nlm` CLI usage and CI mocking precedent]
- [Source: `_bmad-output/implementation-artifacts/50-8-watched-notebook-staleness-alerts.md`: best-effort Discord warning precedent]
- [Source: Context7 `/jacob-bd/notebooklm-mcp-cli` and upstream GitHub CLI guide: `nlm login --check`, `nlm doctor`, install/auth commands]

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### Debug Log References

- Context7 docs fetched for `/jacob-bd/notebooklm-mcp-cli`: confirmed `nlm login --check` and `nlm login`.
- Pre-change `npm test`: passed.
- Focused red/green test: `node --test tests/session-close-pipeline.test.mjs tests/hermes-session-close-skill.test.mjs`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Post-change `npm test`: passed.
- Review patch focused test: `node --test tests/session-close-pipeline.test.mjs tests/hermes-session-close-skill.test.mjs`: passed.
- `bash scripts/install-hermes-skill-session-close.sh`: passed.
- `cmp -s` repo/live parity checks for `SKILL.md` and `references/discord-reply-template.md`: passed.
- `bash scripts/verify.sh`: passed, including sibling `cns-dashboard` tests.

### Completion Notes List

- Added `scripts/session-close/lib/nlm-auth-watchdog.mjs` with deterministic `NLM_BIN` / `PATH` / `/home/christ/.local/bin/nlm` resolution, `execFile` invocation of `nlm login --check`, 10 second timeout, sanitized result messages, warning formatting, dry-run skip, and close-report merge.
- Wired the session-close skill contract so the watchdog runs after NotebookLM `source_add` fan-out and before final reply rendering; warning delivery stays non-blocking and report-driven.
- Extended the Discord reply template with an `nlm_auth` line and warning redaction rules.
- Added fixture-only tests for authenticated, unauthenticated, missing CLI, timeout, warning redaction, dry-run skip, failure_class preservation, command resolution order, and skill ordering.
- Installed the updated session-close skill to `~/.hermes/skills/cns/session-close` and proved repo/live parity.
- Code review patches made watchdog CLI failures best-effort, removed raw check diagnostics from persisted results, validated stale `NLM_BIN` fallback behavior, narrowed stale-auth detection, added a short Hermes watchdog wrapper, and made the skill contract explicit about dry-run and partial fan-out behavior.

### File List

- `_bmad-output/implementation-artifacts/53-1-nlm-auth-watchdog.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `scripts/hermes-skill-examples/session-close/SKILL.md`
- `scripts/hermes-skill-examples/session-close/references/discord-reply-template.md`
- `scripts/session-close/hermes-run-nlm-auth-watchdog.sh`
- `scripts/session-close/lib/nlm-auth-watchdog.mjs`
- `tests/hermes-session-close-skill.test.mjs`
- `tests/session-close-pipeline.test.mjs`

### Review Findings

- [x] [Review][Patch] Watchdog command can lose the repo-root fallback [scripts/hermes-skill-examples/session-close/SKILL.md:66]
- [x] [Review][Patch] Dry-run prompt can still trigger NotebookLM source_add [scripts/hermes-skill-examples/session-close/SKILL.md:61]
- [x] [Review][Patch] Watchdog is not guaranteed after partial or failed NotebookLM fan-out [scripts/hermes-skill-examples/session-close/SKILL.md:61]
- [x] [Review][Patch] Watchdog helper can still block session-close on report merge or internal failure [scripts/session-close/lib/nlm-auth-watchdog.mjs:228]
- [x] [Review][Patch] Check-failed result persists and prints semi-raw CLI diagnostics [scripts/session-close/lib/nlm-auth-watchdog.mjs:180]
- [x] [Review][Patch] Stale NLM_BIN masks valid fallback paths [scripts/session-close/lib/nlm-auth-watchdog.mjs:67]
- [x] [Review][Patch] Bare stale auth regex can false-fail an authenticated exit 0 check [scripts/session-close/lib/nlm-auth-watchdog.mjs:12]

## Change Log

- 2026-05-31: Story authored for nlm auth watchdog during session-close.
- 2026-05-31: Implemented non-blocking `nlm` auth watchdog, warning contract, tests, live skill parity, and verify gate.
- 2026-05-31: Applied code review patches, reran focused/full gates, and closed story.

## Story completion status

- Ultimate context engine analysis completed - comprehensive developer guide created
- Status: **done**
