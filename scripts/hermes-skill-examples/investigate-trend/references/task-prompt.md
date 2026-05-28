# Task: `investigate-trend` (Story 49-4)

## Hard constraints (must follow)

1. **Channel**: Discord `#hermes` only (via operator config binding).
2. **Tools**: `mcp__perplexity__search` only.
3. **No vault writes**: do not call any Vault IO mutators or create notes.
4. **Timeout**: **30s hard cap**. If Perplexity does not return within 30 seconds, post a timeout notice (template below) and stop.
5. **Bounded output**: use the response format template exactly; keep **Signals** to 3 bullets.

## Inputs (parse)

Let **`raw`** be the incoming Discord message text.

### 1) Match trigger

The first non-empty line must start with:

`investigate-trend keyword:`

If not, do not run this skill.

### 2) Parse the 4-line payload

Parse these four fields from the message:

- **`keyword`**: from the first line, must be a **single ASCII double-quoted** string after `investigate-trend keyword:`  
  Example: `investigate-trend keyword: "AI agent orchestration"`
- **`topicSlug`**: from the line starting with `topicSlug:` (bare token; trim)
- **`context`**: from the line starting with `context:` (freeform; trim; preserve verbatim for reply)
- **`request`**: from the line starting with `request:` (freeform; trim)

Notes:

- Lines 2–4 may be indented; ignore leading whitespace before the label.
- Do not accept missing fields. Do not infer defaults.

### 3) On parse error (no tools run)

Reply exactly:

```text
investigate-trend: bad-payload (expected 4 lines: keyword/topicSlug/context/request)
```

Then stop.

## Perplexity sweep (single call)

### Query framing

Call `mcp__perplexity__search` once with a query that combines:

- **keyword** (primary)
- **context** (as current signal)
- **request** (as intent)

Suggested query string (single line):

`<keyword> — <context> — <request>`

### Timeout handling (30s hard cap)

If the Perplexity call does not complete within **30 seconds**, reply exactly:

```text
⏱️ investigate-trend timeout (30s) — Perplexity search did not complete in time. Try again or narrow the keyword.
```

Then stop.

## Response format (post to #hermes)

Format the response as:

```text
🔍 **investigate-trend: "<keyword>"**
**Context:** <context line verbatim>

**Signals:**
- <signal 1>
- <signal 2>
- <signal 3>

**Momentum:** <1-sentence assessment>
**Recommendation:** WATCH | IGNORE | ESCALATE
```

## Signal extraction guidance (from Perplexity results)

- Produce **exactly 3** signals.
- Prefer **concrete** signals, e.g.:
  - repeated references across multiple sources
  - new releases / docs / repos activity
  - conference talks / announcements
  - hiring patterns / job posts
  - funding / acquisitions
  - search interest spikes (if sources cite it)
- If sources are thin/low-confidence, signals should say so (no invention).

## Recommendation rubric

- **WATCH**: multiple independent sources or clear acceleration, but not yet urgent.
- **IGNORE**: low signal, recycled narratives, or no recent credible movement.
- **ESCALATE**: strong and time-sensitive (e.g. major launch, wide adoption, or clear strategic impact).
