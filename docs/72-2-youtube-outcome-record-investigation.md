# Investigation Brief: YouTube Missing From Digest Outcome Record

**Status:** investigation-first — root cause **confirmed** (Hypothesis A: pre-deploy cron). Fix Path B observability patches applied; see `_bmad-output/implementation-artifacts/72-2-youtube-outcome-record-investigation.md`.

**Context:** Story 72-1 (YouTube Data API adapter, Source 13) shipped, code
reviewed, all patches applied, `verify.sh` green, live curl-validated against
the real API key. This is the **first live production cron run since
shipping** — and the result is ambiguous, not a clean pass or a clean fail.

---

## The Symptom

The 07:00 AEST cron ran successfully on 2026-06-19. Outcome record:
`~/.hermes/digest-outcomes/2026-06-19.json`

```json
{
  "overall": "success",
  "sources": {
    "google_trends": { "status": "ok", "count": 14 },
    "newsapi": { "status": "ok", "count": 5 },
    "arxiv": { "status": "ok", "count": 9 },
    "hackernews": { "status": "ok", "count": 5 },
    "github": { "status": "ok", "count": 5 },
    "reddit": { "status": "error", "count": 0 },
    "rss": { "status": "ok", "count": 10 },
    "producthunt": { "status": "ok", "count": 5 },
    "twitter": { "status": "ok", "count": 14 },
    "bluesky": { "status": "ok", "count": 5 }
  }
}
```

**`youtube` is not a key in this object at all.** Not `status: error`. Not
`status: ok, count: 0`. Absent entirely — as if Source 13 doesn't exist from
the outcome-record writer's point of view.

This is meaningfully different from how Reddit fails. Reddit reports
`{"status":"error","count":0}` — a known, classified, reported failure. The
YouTube key being **missing** rather than **error** points at a different
class of bug: either (a) the adapter never ran, or (b) the adapter ran but
something downstream doesn't know YouTube exists as a reportable source.

The actual cron execution: `runId: "md714jkzrbe7fkfr2d41w5a7v588wcmf"`,
timestamp `2026-06-18T21:01:24.549Z` UTC (= 2026-06-19 07:01 AEST),
`trigger: "cron"`, `recoveryPath: "full-pipeline"`, `signalsWritten: 72`,
`overall: success`. This is the run that matters — all later watchdog
triggers (`0715`, `1300`, `1830`) correctly skipped re-running
(`action: "skipped-already-pushed"`).

---

## Two Competing Hypotheses

### Hypothesis A — Adapter didn't run / failed silently before producing output
Possible causes:
- Cron environment doesn't source `~/.hermes/trend-ingest.env` the same way
  the interactive shell does (this exact bug bit Reddit's env wiring earlier
  — `MORNING_DIGEST_REDDIT_SUBREDDITS` wasn't sourced into cron's environment
  at first). If `MORNING_DIGEST_YOUTUBE_API_KEY` /
  `MORNING_DIGEST_YOUTUBE_QUERIES` aren't visible to the cron process, the
  adapter likely exits early — check whether that early-exit path even
  *writes* a `{"error": "missing-key"}` JSON, or just throws/exits without
  producing parseable stdout at all. If it exits without valid JSON on
  stdout, `collectAdapterOutputs` may silently drop it rather than recording
  an error.
- `hermes-run-youtube.sh` (the terminal wrapper created in 72-1) may not be
  wired into the cron orchestration sequence at all — i.e., it was added to
  the Hermes skill task-prompt (agent-driven invocation) but the **Node
  orchestrator** (`run-digest-convex-completion.mjs`, the actual Epic 70
  deterministic path that cron calls) may not have a corresponding call to
  `fetch-youtube-signals.mjs`. Epic 70 replaced the old Hermes-agent-driven
  cron with a deterministic Node collector — if 72-1 only wired YouTube into
  the *Hermes skill* path (task-prompt.md, SKILL.md) and not the *Node
  orchestrator* path, it would work in manual/agent-invoked testing but
  silently never fire from the real cron.

### Hypothesis B — Adapter ran fine, but the outcome-record writer doesn't know YouTube exists
Possible cause:
- Story 71-3 (`structured-run-outcome-record-observability-gate`) built the
  schema/logic that produces this exact JSON file. If that script has an
  enumerated/hardcoded list of known source keys (likely, given it predates
  72-1 by a week), YouTube would never appear in `sources{}` regardless of
  whether the adapter ran successfully and pushed signals to Convex. This is
  the same *class* of bug as the `ADAPTER_DATA_KEYS` gap just patched in
  72-1's own code review — a fixed list silently not knowing about a new
  member.
- If this is the cause, **signals may have been pushed to Convex
  successfully** even though the local outcome record doesn't reflect it —
  meaning the actual digest worked, just the observability layer is blind to
  Source 13.

These two hypotheses are not mutually exclusive with "the adapter half-
worked" — investigate in the order below to disambiguate cleanly.

---

## Diagnostic Sequence (run in order, don't skip ahead)

### Step 1 — Did YouTube signals actually reach Convex?
This is the fastest way to split Hypothesis A from B.

```bash
cd ~/ai-factory/projects/cns-dashboard
npx convex run digest:getDigestSignalsForRun \
  '{"runId":"md714jkzrbe7fkfr2d41w5a7v588wcmf"}' --prod 2>/dev/null \
  | grep -i youtube
```

- **If this returns YouTube signal rows** → Hypothesis B confirmed. Adapter
  ran fine, signals pushed, the outcome-record writer just doesn't report
  Source 13. Skip to "Fix Path B" below.
- **If this returns nothing** → Hypothesis A. The adapter didn't produce
  signals in the real cron run. Continue to Step 2.

### Step 2 — Is YouTube wired into the deterministic Node orchestrator?
Check whether `fetch-youtube-signals.mjs` is actually called by the script
cron invokes, not just referenced in the Hermes skill files.

```bash
grep -n "youtube" ~/ai-factory/projects/Omnipotent.md/scripts/run-digest-convex-completion.mjs
grep -rn "fetch-youtube-signals" ~/ai-factory/projects/Omnipotent.md/scripts/ --include="*.mjs"
```

Compare against how Bluesky (Source 12, last cleanly-added source before
YouTube) is wired — it should appear in the same orchestrator call list:

```bash
grep -n "bluesky\|fetch-bluesky" ~/ai-factory/projects/Omnipotent.md/scripts/run-digest-convex-completion.mjs
```

- **If `youtube`/`fetch-youtube-signals` is absent from
  `run-digest-convex-completion.mjs` but present in Bluesky's equivalent
  wiring** → confirmed: 72-1 wired the Hermes-agent skill path
  (task-prompt.md/SKILL.md) but missed the deterministic orchestrator path
  that Epic 70 made the actual cron entrypoint. This is a real gap in 72-1's
  scope — Epic 70 predates 72-1 by a week and the dev/code-review pass may
  not have cross-checked both invocation paths.

### Step 3 — Manually run the orchestrator's YouTube call path directly
If Step 2 shows it *is* wired in, run the actual orchestrator function (not
the adapter script directly — we already proved the adapter script itself
works via curl/manual run) to see if something in the orchestrator's
env-loading or argument-passing breaks it:

```bash
cd ~/ai-factory/projects/Omnipotent.md
node scripts/run-digest-convex-completion.mjs --dry-run --source=youtube 2>&1 | head -50
```//
(If `--dry-run`/`--source` flags don't exist, check the script's actual CLI
surface first — don't invent flags, read the file.)

### Step 4 — Check cron's actual environment vs. interactive shell
Same class of bug Reddit hit. Confirm `trend-ingest.env` is sourced
identically in both contexts:

```bash
crontab -l | grep morning-digest
cat ~/ai-factory/projects/Omnipotent.md/scripts/run-morning-digest-cron.sh | grep -A2 "trend-ingest"
```

Confirm the YouTube env vars are present at the point the cron script
actually executes (not just present in the file):

```bash
bash -c 'source ~/.hermes/trend-ingest.env && env | grep YOUTUBE'
```

---

## Fix Paths (do not implement until diagnosis above is complete)

### Fix Path A — Orchestrator wiring gap
If Step 2 confirms `fetch-youtube-signals.mjs` isn't called by
`run-digest-convex-completion.mjs`:
- Add the YouTube fetch call to the orchestrator's source collection list,
  following the exact pattern used for Bluesky (Source 12) — same error
  handling, same stdout-parsing contract, same position in execution order
  per the task-prompt's documented sequence (`… → 12 → 13 → 3 → 6`).
- Re-run `bash scripts/verify.sh` — this should NOT have been caught by
  existing tests if the orchestrator-level wiring was the gap, which is
  itself worth noting in the story file as a coverage hole: was there an
  integration test asserting every adapter file under
  `morning-digest/scripts/` is referenced in
  `run-digest-convex-completion.mjs`? If not, consider adding one — this
  exact bug class will recur for Source 14 if not caught structurally.

### Fix Path B — Outcome-record writer doesn't enumerate YouTube
If Step 1 confirms signals reached Convex but the local outcome record is
silent on Source 13:
- Locate the source-key enumeration in the 71-3 structured-run-outcome-record
  script (likely `scripts/run-digest-convex-completion.mjs` or a dedicated
  outcome-writer module — confirm exact file via:
  `grep -rln "google_trends.*newsapi\|sources\[.*=.*status" scripts/`)
- Add `youtube` to whatever list/map drives the `sources{}` object in the
  JSON output, following the exact pattern of the most recently added source
  (Bluesky) so the new entry's shape matches (`{status, count}`).
- This is almost certainly a one-line-per-list-site fix, similar in spirit
  to the `ADAPTER_DATA_KEYS` patch from 72-1's own code review — flag this
  explicitly in the story file as "same bug class as Epic 70/71
  ADAPTER_DATA_KEYS, now found in the outcome-record source-enumeration
  list" so future source additions (Source 14+) get checked against *both*
  lists as a standard part of the dev-story checklist.

### Fix Path C — Both
If Steps 1 AND 2 both come back negative (no Convex signals, AND
orchestrator wiring looks correct), the bug is inside
`fetch-youtube-signals.mjs` itself failing silently under the cron
environment specifically — likely an env-var sourcing gap (Step 4). This
would mean the adapter's "always exit 0, return `{error: ...}` on failure"
contract (verified working via manual curl + manual script run) is somehow
not surfacing that error JSON through to the orchestrator's stdout capture
in the actual cron context. Check for stdout buffering / subprocess capture
differences between manual invocation and cron's child-process spawning.

---

## What NOT To Do

- Don't assume this is "blocked" the way Reddit was. YouTube's API is
  confirmed live and working (manual curl test returned valid JSON results
  this session). Any failure here is a real, fixable bug in our code or
  wiring — debug it fully per the Reddit-lesson framing already established
  for this epic.
- Don't patch the outcome-record writer (Fix Path B) without first
  confirming via Step 1 whether signals actually reached Convex. Patching
  the report without checking the underlying data risks masking a real
  Hypothesis-A failure as a cosmetic Hypothesis-B issue.
- Don't skip Step 2's comparison against Bluesky's wiring — it's the fastest
  way to spot a structural omission instead of guessing.

---

## Acceptance Criteria for Closing This Investigation

1. Root cause is identified and stated explicitly in the story file as
   Hypothesis A, B, or C (not "probably" — confirmed via the diagnostic
   steps above).
2. Fix is implemented per the matching Fix Path.
3. `bash scripts/verify.sh` passes.
4. A **second** live cron cycle (next 07:00 AEST run, or a manually
   triggered full-pipeline run if waiting isn't practical) shows:
   - `sources.youtube` present in the outcome record with `status: ok` and
     `count > 0`, AND
   - Convex query confirms youtube-typed signals exist for that run.
5. If Fix Path A or C applies, add or note the absence of an integration
   test that would have caught "adapter file exists but isn't called by the
   orchestrator" — file as a follow-up story if not addressed directly here.
6. Update `deferred-work.md` with the closure, same format as the Reddit
   closure entry — root cause stated plainly, no euphemisms.

---

## Reference: What Already Works (don't re-investigate)

- `fetch-youtube-signals.mjs` itself is correct — manually verified twice
  this session: once via direct curl against the YouTube API (returned valid
  JSON), once via the adapter script logic in code review (18/18 tests
  passing, 5 patches applied for quota/batching/error-classification edge
  cases).
- The API key is valid and correctly stored in
  `~/.hermes/trend-ingest.env` as of this session (verified length = 39
  chars, verified via raw curl call returning real search results).
- `ADAPTER_DATA_KEYS` was already patched in 72-1 code review to include
  `videos` — that fix is unrelated to this investigation and should not be
  re-touched unless directly implicated by the diagnostic steps above.
