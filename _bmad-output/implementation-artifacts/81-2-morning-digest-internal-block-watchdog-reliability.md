---
story_id: 81-2
epic: 81
title: morning-digest-internal-block-watchdog-reliability
status: done
zone: Omnipotent.md (morning-digest skill, digest scripts, push-digest-watchdog)
branch: hermes-consolidation
prerequisite: 81-1b (commit 708a402 — `collectInternalDevState()` live)
ac2_gate: APPROVED 2026-07-05 — selective trends/newsapi refetch + NewsAPI fetchWithRetry implemented
---

# Story 81.2: Morning Digest Internal Block + Watchdog Reliability

Status: done

**Epic:** 81 — Morning Intelligence — Digest Enrichment + Discovery Surface  
**Normative spec:** `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Story 81-2 (line ~502)  
**Architecture:** `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` § FR20/FR21 — C1 digest consumer split  
**Prerequisite:** Story **81-1b** shipped `scripts/lib/collect-internal-dev-state.ts` + dashboard-sync Convex push (commit `708a402`). Story **81-3** reads Convex panel — **out of scope here**.

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. AC1 fully speced for immediate implementation. AC2 proposal documented below — STOP before implementing AC2 until operator review (same gate as 81-1b ranking heuristic). -->

## Story

As an **operator**,
I want **the 07:00 digest enriched with internal dev-state and hardened external trend reliability**,
so that **SM-2 proactive cockpit holds without manual triage skills (FR20)**.

## Acceptance Criteria

### AC1 — Internal block renderer (implement now — no review gate)

**Given** Story 81-1b `collectInternalDevState()` exists at `scripts/lib/collect-internal-dev-state.ts`  
**When** the morning-digest Hermes skill runs  
**Then** a new renderer calls **the same** `collectInternalDevState()` locally (read-only) and produces a Discord-safe markdown section  
**And** the section is **inform-only** — no Convex push, no vault writes, no skill invocation from the renderer (NFR-GOV-1)  
**And** `dashboard-sync.ts` / `ingestInternalDevState` path is **not** modified or duplicated (81-3 panel reads Convex via existing 3-min cron)

1. **New module** `scripts/hermes-skill-examples/morning-digest/scripts/render-internal-dev-state-section.mjs`:
   - Export `renderInternalDevStateSection(items, options?)` — pure markdown from `PrioritizedItem[]`
   - Export `runInternalDevStateDigestSection(env, options?)` — orchestrates collect + render + graceful failure (mirror `enrichPayloadWithEntityDigest` contract shape)
   - **CLI:** when invoked as main via `npx tsx …/render-internal-dev-state-section.mjs`, stdout JSON:
     ```json
     { "markdown": "## …", "status": "ok|empty|failed", "linesRendered": 3, "reason": null }
     ```
     Always exit **0** on failure (degrade, do not abort digest)

2. **Collector import:** call `collectInternalDevState({ repoRoot, vaultRoot, now? })` from the **same** TS module as dashboard-sync. Resolve paths like dashboard-sync:
   - `repoRoot` = `OMNIPOTENT_REPO` or `/home/christ/ai-factory/projects/Omnipotent.md`
   - `vaultRoot` = `CNS_VAULT_ROOT` or default `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`
   - **Must run via `npx tsx`** (not bare `node`) so the `.ts` import resolves — same toolchain as `scripts/dashboard-sync.ts`

3. **Markdown sanitization (mandatory):** import and reuse `sanitizeEntityDigestField()` from `render-digest-entity-section.mjs` for **every** user-facing field (`title`, `rationale`, `sourcePath`, category label). Do not duplicate sanitizer logic — Story 73-7 review locked this discipline for externally sourced text; deferred-work headings and sprint keys are equally untrusted for Discord.

4. **Line cap:** use `DIGEST_ENTITY_MAX_LINES_PER_LANE` (5) from `render-digest-entity-section.mjs` as the per-section row cap — export alias `DIGEST_INTERNAL_MAX_LINES = DIGEST_ENTITY_MAX_LINES_PER_LANE` if clearer. Render top-N by `rank` ascending (rank 1 first).

5. **Section grammar** (when items non-empty):
   ```markdown
   ## Internal work prioritized

   • **81-2-morning-digest-internal-block-watchdog-reliability** (sprint) — Sprint status: ready-for-dev (Epic 81)
   • **Hermes self-improvement ungoverned skill writes** (deferred) — **Surfaced by:** …
   …

   [Open discovery panel](/nexus)
   ```
   - Category display map: `sprint` → `sprint`, `deferred` → `deferred`, `agent_log` → `agent log`, `vault_scan` → `vault scan`
   - Omit section entirely when `items.length === 0` (no empty header)
   - Optional deep link `[Open discovery panel](/nexus)` (mirror entity cockpit link pattern)

6. **task-prompt.md integration:** add row to **Strict collection order** table and update the order string. **Placement:** after **Persist digest push artifact** (post-scoring artifact write) and **before** Discord Output contract post — internal block does not affect `digest_push_payload.signals[]`.

   | Step | Source | Required invocation |
   |------|--------|---------------------|
   | **20** | Internal dev-state | `terminal(command="npx tsx scripts/hermes-skill-examples/morning-digest/scripts/render-internal-dev-state-section.mjs", workdir=resolved_repo_root, timeout=30)` |

   Update order string to include **→ 20** before Discord:
   `… → artifact → **20** → Discord → §9 push → §10`

   Add **Output contract** block after **Recommended focus:** (or immediately before **Vault context** if operator prefers internal work above vault — **use after Recommended focus**, before entity sections if any manual entity block exists):

   ```markdown
   **Internal work prioritized**
   <markdown from step 20 stdout `markdown` field, or omit entire block when status is `empty` or `failed`>
   ```

   **After step 20 terminal returns:** parse stdout JSON; on `status === 'ok'` append `markdown` to Discord post; on `failed`/`empty` omit block and continue (stderr `[internal-dev-digest]` is observability only).

7. **Graceful degradation (mandatory):** match `enrichPayloadWithEntityDigest` in `render-digest-entity-section.mjs:321-365`:
   - try/catch around collect + render
   - stderr: `[internal-dev-digest] ${message}`
   - return unchanged payload / empty markdown — **never** throw to abort digest
   - missing files → collector returns `[]` → `status: 'empty'` (not failed)

8. **07:00 primary cron:** additive content only — do not change collection order for Sources 0–19, dedupe, score, artifact, §9, §10 control flow.

9. **Tests:** `tests/render-internal-dev-state-section.test.mjs`:
   - sanitization applied (markdown chars escaped, emoji stripped) — use fixture with `*` and emoji in title
   - line cap at 5
   - empty input → `''`
   - category labels + line grammar
   - `runInternalDevStateDigestSection` returns `status: 'failed'` on thrown collect (mock)

10. **Verify gate (NFR1):** `bash scripts/verify.sh` passes after AC1 only.

### AC2 — External trend reliability (INVESTIGATE FIRST — proposal only, STOP)

**Given** flaky external trend sources (news, reddit, google-trends) per epic spec  
**When** this story is created  
**Then** Dev Notes § **AC2 Watchdog Hardening Proposal** documents evidence + minimal hardening plan  
**And** **no AC2 code ships** in the first dev-story pass — operator must approve proposal before implementation (same gate as 81-1b ranking heuristic)

**Constraint:** extend **existing** watchdog crons at **07:15 / 13:00 / 18:30 Australia/Sydney** — do **not** add, duplicate, or replace crontab lines (`scripts/install-morning-digest-cron.sh` tags `cns-push-digest-watchdog*`).

**Confirmed live crontab (2026-07-05):**
```
15 7 * * * CRON_TZ=Australia/Sydney DIGEST_TRIGGER=watchdog-0715 … run-push-digest-watchdog-cron.sh
0 13 * * * CRON_TZ=Australia/Sydney DIGEST_TRIGGER=watchdog-1300 …
30 18 * * * CRON_TZ=Australia/Sydney DIGEST_TRIGGER=watchdog-1830 …
```

---

## Tasks / Subtasks

### AC1 — Implement now

- [x] **T1 — Renderer module** (AC: 1.1–1.5)
  - [x] T1.1 Create `render-internal-dev-state-section.mjs` with pure render + CLI main
  - [x] T1.2 Import `sanitizeEntityDigestField`, `DIGEST_ENTITY_MAX_LINES_PER_LANE` from entity renderer
  - [x] T1.3 Import `collectInternalDevState` from `scripts/lib/collect-internal-dev-state.ts` (tsx entry)
  - [x] T1.4 Export `runInternalDevStateDigestSection` with entity-style try/catch + stderr prefix

- [x] **T2 — task-prompt.md** (AC: 1.6–1.8)
  - [x] T2.1 Add Step 20 row to Strict collection order table
  - [x] T2.1b Update order string (`… → artifact → 20 → Discord → …`)
  - [x] T2.2 Add Output contract section for **Internal work prioritized**
  - [x] T2.3 Add Step 20 stdout threading instructions (mirror Source 5 HN stdout pattern)
  - [x] T2.4 Mirror change in installed skill path if `install-hermes-skill-morning-digest.sh` copies references (run install script or document operator sync)

- [ ] **T3 — Optional completion-path parity** (AC: 1.7 — only if low-cost)
  - [ ] T3.1 Consider appending internal block in `resolveDigestMarkdownFromPayload` via `internalDevDigestMarkdown` field for `run-digest-convex-completion.mjs` repair posts — **optional**; Hermes agent path (task-prompt Step 20) is v1 minimum. If skipped, note in Dev Agent Record.

- [x] **T4 — Tests + verify** (AC: 1.9–1.10)
  - [x] T4.1 `tests/render-internal-dev-state-section.test.mjs`
  - [x] T4.2 `bash scripts/verify.sh` green

### AC2 — After operator approval only

- [x] **T5 — Watchdog hardening** (AC: 2 — approved 2026-07-05)
  - [x] T5.1 Implement approved minimal retry / selective refetch in existing watchdog completion path
  - [x] T5.2 Extend tests in `tests/push-digest-watchdog.test.mjs` or `tests/run-digest-convex-completion.test.mjs`
  - [x] T5.3 Re-run verify gate

---

## Dev Notes

### Scope firewall (read before coding)

| In scope (AC1) | Out of scope |
|----------------|--------------|
| `render-internal-dev-state-section.mjs` | `dashboard-sync.ts` push path |
| `task-prompt.md` Step 20 + Output contract | `ingestInternalDevState` / Convex mutations |
| Unit tests for renderer | `DiscoveryWorkPanel.svelte` (81-3) |
| Read-only `collectInternalDevState()` | Duplicate collector or ranking changes |
| | **AC2 implementation** until operator approves proposal below |

### Prior art — entity digest section (Story 73-7)

Read **`scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs` in full** before implementing. Key patterns to mirror:

| Pattern | Entity (73-7) | Internal (81-2) |
|---------|---------------|-----------------|
| Data source | Convex HTTP `getEntityIntelligence` | Local `collectInternalDevState()` |
| Sanitizer | `sanitizeEntityDigestField()` | **Same function — import, don't copy** |
| Line cap | `DIGEST_ENTITY_MAX_LINES_PER_LANE = 5` | Same constant |
| Failure | `enrichPayloadWithEntityDigest` catch → stderr → omit | `runInternalDevStateDigestSection` identical semantics |
| Cron path | Wired in `run-digest-convex-completion.mjs` | Optional parity (T3); **task-prompt Step 20 is v1** |

Entity failure handler (copy this shape exactly):

```351:365:scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message)
        : 'entity-intelligence-fetch-failed';
    process.stderr.write(`[entity-digest] ${message}\n`);
    return {
      payload,
      entityDigestResult: {
        status: 'failed',
        linesRendered: 0,
        reason: message.slice(0, 120),
      },
    };
  }
```

### Collector contract (81-1b — do not reimplement)

```424:476:scripts/lib/collect-internal-dev-state.ts
export async function collectInternalDevState(
  opts: CollectInternalDevStateOptions,
): Promise<PrioritizedItem[]> {
  // … reads deferred-work, sprint-status, agent-log, vault-fast-scan …
  // returns ≤20 PrioritizedItem with rank, rankScore, title, category, rationale, sourcePath
}
```

**Hand-mirrored types** — do not add fields. Renderer consumes `PrioritizedItem[]` as-is.

### task-prompt.md — Strict collection order (current)

Line 17 today:
`0 → 1 → 2 → 4 → 5 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → **14** → **15** → **16** → **17** → **18** → **19** → 3 → 6 → §9 map → dedup → score → artifact → Discord → §9 push → §10`

**Insert Step 20** between `artifact` and `Discord`. Internal block is **not** a Convex signal source — do not add to §9 signal mapping table.

**Install path:** repo canonical = `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`; Hermes runtime = `$HOME/.hermes/skills/cns/morning-digest/references/task-prompt.md` — run `bash scripts/install-hermes-skill-morning-digest.sh` after edit (or note in completion for operator).

### CLI env for Step 20

| Env | Purpose |
|-----|---------|
| `OMNIPOTENT_REPO` | Repo root (Hermes sets via task-prompt `resolved_repo_root`) |
| `CNS_VAULT_ROOT` | Vault root for agent-log + vault-scan paths |
| `DIGEST_RUN_AT` | Optional — pass `digest_start_ms` as `now` for consistent ranking with collector tests |

### Files to read before editing (mandatory)

| File | Why |
|------|-----|
| `render-digest-entity-section.mjs` | Sanitizer, line cap, failure pattern, trim helper if needed |
| `collect-internal-dev-state.ts` | DTO shape, path resolution |
| `references/task-prompt.md` | Strict collection order table + Output contract |
| `81-1b-internal-dev-state-collector-dashboard-sync-push.md` | Ranking locked — renderer must not rescore |
| `parse-digest-source-outcomes.mjs` | How `entityDigestMarkdown` appends — reference if doing T3 |

### Previous story intelligence (81-1b)

- Collector + Convex push **done**; ranking operator-approved 2026-07-05.
- `dashboard-sync.ts` pushes dev-state independently every 3 min — **this story must not touch that path**.
- Tests live in `tests/vault-io/collect-internal-dev-state.test.ts` — renderer tests are separate `.mjs` file (vitest node:test pattern from `tests/render-digest-entity-section.test.mjs`).

---

## AC2 Watchdog Hardening Proposal (evidence + minimal plan — AWAITING OPERATOR APPROVAL)

> **Dev-story instruction:** Implement **AC1 only**. Do **not** start T5 until Chris replies to approve, amend, or reject this proposal.

### What `push-digest-watchdog.mjs` actually does today

Read in full — scope is **run-level Convex push recovery**, not per-source fetch retry:

| Behavior | Evidence |
|----------|----------|
| Query Convex `digest:getRecentDigestRuns` (3 HTTP retries) | `push-digest-watchdog.mjs:101-118` |
| If today's run missing/failed → replay `push-digest-convex.mjs` from `~/.hermes/digest-push-YYYY-MM-DD.json` | `tryRecoverFromArtifact()` :272-310 |
| **Does not** re-run NewsAPI, Reddit, or Google Trends adapters | No import of `fetch-newsapi-headlines.mjs`, `fetch-reddit-signals.mjs`, or `hermes-run-trend-ingest.sh` |
| **Does not** patch partial artifacts | Artifact replay pushes as-is |

Watchdog crons invoke `scripts/run-push-digest-watchdog-cron.sh` → **`run-digest-convex-completion.mjs`**, which calls `runPushDigestWatchdog` first, then may run **`collectAdapterOutputs`** (full adapter refetch) only when bucket is `full-pipeline` / no artifact (`run-digest-convex-completion.mjs:1090-1094`).

### Per-source fetch retry evidence (news / reddit / google-trends)

| Source | Adapter | Retry today? | Flakiness evidence |
|--------|---------|--------------|-------------------|
| **Google Trends** | `hermes-run-trend-ingest.sh` → `trend-ingest.py --dry-run --sources google_trends` | **No** digest-level retry. Ingest path aborts entire watchlist on first `TrendsRateLimitError` (429/403) | `trend-ingest.py:827-831` — `aborted = True; break`. pytrends rate limits are intermittent at 07:00. |
| **NewsAPI** | `fetch-newsapi-headlines.mjs` | **Single fetch**, 20s timeout, no retry on `http-429` / `http-503` | `fetch-newsapi-headlines.mjs:246-273` — one `fetchFn()` call. Transient API errors → `{ error: "http-429" }` → digest `(source unavailable)`. |
| **Reddit** | `fetch-reddit-signals.mjs` | **Single fetch** per subreddit; **fails entire source** on first subreddit HTTP error | `fetch-reddit-signals.mjs:222-236` — returns `{ error }` on first failed subreddit. **Platform closure:** `deferred-work.md` § "Story 67-2 Reddit Source 8 — platform-level closure" — 403/429 is policy, not flake. **Recommendation: exclude Reddit from retry hardening.** |

**Other evidence:**
- `run-digest-convex-completion.mjs` `collectAdapterOutputs` — one exec per adapter, no inner retry (`:172-216`); timeout → `{ error: 'timeout' }`.
- `deferred-work.md` Epic 68 live validation notes intermittent Product Hunt / §9 gaps — push watchdog covers **push skip**, not source fetch.
- deferred-work § "Terminal timeout budget vs 8 default actors" — serial source collection can exceed Hermes terminal budget; unrelated to watchdog but explains occasional `(source unavailable: timeout)` at Source 2/1.

### What is actually flaky vs permanently degraded

| Source | Verdict |
|--------|---------|
| Google Trends | **Flaky** — rate limits / partial watchlist abort |
| NewsAPI | **Flaky** — transient HTTP errors, quota |
| Reddit | **Not flaky — degraded by platform policy** — retry work is wasted (deferred-work 2026-06-19 closure) |

### Minimal proposal (extend existing 07:15 / 13:00 / 18:30 watchdog path)

**Goal:** When primary 07:00 digest posted with `(source unavailable)` for Trends or NewsAPI but artifact exists, watchdog tick **selectively refetches only failed primary trend sources** and **patches artifact signals** before push/Discord repair — without new crons.

**Proposed behavior** (in `run-digest-convex-completion.mjs`, before `runPushDigestWatchdog` artifact replay OR as new bucket in `classifyDigestRetryBucket`):

1. **Detect:** Read artifact `run.sourceOutcomes` (populated by `parse-digest-source-outcomes.mjs`) or infer from missing `signals[]` sections where `google_trends` / `newsapi` signals absent despite other sources ok.
2. **Selective refetch:** Re-run **only** failed adapters:
   - `hermes-run-trend-ingest.sh` (trends)
   - `hermes-run-newsapi.sh` (newsapi)
   - **Skip reddit** (platform closure)
3. **Adapter-level retry (shared helper):** Extract tiny `fetchWithRetry(fn, { maxAttempts: 3, baseDelayMs: 1000, retryable: /^http-(429|503|502)|timeout|AbortError/i })` used by:
   - `fetch-newsapi-headlines.mjs` `fetchNewsapi()` only (smallest diff, highest ROI)
   - Optional: one retry wrapper in `collectAdapterOutputs` when invoked from watchdog path only (env `DIGEST_WATCHDOG_REFETCH=1`)
4. **Merge:** Rebuild affected `digest_push_payload.signals` slice via existing `buildDigestPushPayload` section mappers → re-dedupe → re-score → rewrite artifact → existing push/Discord repair flow.
5. **Cap:** Max **one** selective refetch pass per watchdog invocation (avoid hammering NewsAPI/pytrends at 13:00 and 18:30 if still failing).
6. **Logging:** New watchdog log action `selective-source-refetch` with `{ sources: ['google_trends','newsapi'], refetched: N }` in `~/.hermes/logs/push-digest-watchdog.log`.

**Explicit non-goals (AC2):**
- No new crontab lines
- No Reddit OAuth / proxy retry
- No changes to `collectInternalDevState` or internal dev-state Convex push
- No duplicate of full `collectAdapterOutputs` unless artifact missing entirely (existing behavior preserved)

### Operator decision requested

Reply with one of:
- **Approve** proposal as written → unblock T5 in follow-up dev-story pass
- **Amend** (e.g. NewsAPI-only retry, skip Trends) → update this section then implement
- **Reject** → close AC2 as wont-fix; document rationale in sprint retrospective

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- `bash scripts/verify.sh` — VERIFY PASSED (1358 tests, 2026-07-05)

### Completion Notes List

- AC1: `render-internal-dev-state-section.mjs` + task-prompt Step 20 + Hermes skill install; T3 optional completion-path parity skipped (Hermes Step 20 is v1 minimum per story).
- AC2: Operator approved proposal as written — Reddit excluded; selective trends/newsapi refetch with one-pass cap via `selective-source-refetch` log action; `fetchWithRetry` on NewsAPI only; hooked in `run-digest-convex-completion.mjs` before watchdog push replay.
- Code review (2026-07-05): fixed partial-refetch merge bug (scope signal strip to successful refetches); regression test added; AGENTS.md CRLF churn reverted. Live 07:00 validation deferred to next natural cron.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/render-internal-dev-state-section.mjs` (new)
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-with-retry.mjs` (new)
- `scripts/lib/selective-digest-source-refetch.mjs` (new)
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-newsapi-headlines.mjs` (modified — fetchWithRetry)
- `scripts/lib/digest-retry-eligibility.mjs` (modified — new log actions)
- `scripts/run-digest-convex-completion.mjs` (modified — selective refetch hook)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` (modified — Step 20)
- `tests/render-internal-dev-state-section.test.mjs` (new)
- `tests/selective-digest-source-refetch.test.mjs` (new)
- `tests/fetch-with-retry.test.mjs` (new)

### Review Findings

- [x] [Review][Patch] Partial refetch merge drops unaffected source signals [`scripts/lib/selective-digest-source-refetch.mjs:217-223`] — fixed: strip/replace scoped to successfully refetched source types only.
- [x] [Review][Patch] Add regression test for partial selective refetch merge [`tests/selective-digest-source-refetch.test.mjs`] — trends-only refetch preserves existing newsapi signals.
- [x] [Review][Patch] Revert unrelated AGENTS.md line-ending churn [`specs/cns-vault-contract/AGENTS.md`] — reverted (CRLF-only diff).
- [x] [Review][Defer] `DIGEST_WATCHDOG_REFETCH=1` env set but no consumer reads it [`scripts/lib/selective-digest-source-refetch.mjs:66`] — deferred, pre-existing proposal hook; selective wrapper re-exec is sufficient for v1.
- [x] [Review][Defer] Skip-path watchdog log actions registered but not emitted [`scripts/lib/digest-retry-eligibility.mjs:43-44`] — deferred, pre-existing; `skipped-already-refetched` / `skipped-no-refetch-needed` in allowlist but `trySelectiveSourceRefetch` returns without logging skip paths.

**Live validation note (operator):** Skip out-of-band 07:00 digest run; validate internal block + selective refetch on next natural cron cycle after commit.

## References

- Epic spec: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Story 81-2
- Architecture C1 digest: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` § FR20/FR21 (lines ~1011-1063)
- Collector (81-1b): `scripts/lib/collect-internal-dev-state.ts`, commit `708a402`
- Entity renderer precedent: `scripts/hermes-skill-examples/morning-digest/scripts/render-digest-entity-section.mjs`
- Watchdog: `scripts/push-digest-watchdog.mjs`, `scripts/run-digest-convex-completion.mjs`
- Cron installer: `scripts/install-morning-digest-cron.sh` (07:15/13:00/18:30 Sydney)
- Reddit platform closure: `_bmad-output/implementation-artifacts/deferred-work.md` § Story 67-2
- NFR-GOV-1: digest informs only — no autonomous vault writes
