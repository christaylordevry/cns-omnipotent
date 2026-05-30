---
baseline_commit: 3dc67e9b26033249020715d95321a749b983f839
---

# Story 49.6: Morning digest upgrade

Status: done

<!-- Operator brief 2026-05-29. Validation optional: validate-create-story before dev-story. -->

## Operator decisions (2026-05-29 — bind before dev)

1. **Timezone:** Machine local civil date only (`process.env.TZ` / OS default). **No** hardcoded `Australia/Sydney` in skill, task-prompt, cron snippets, or config examples.
2. **Story 26-7 migration:** Operator Guide must document that the **WSL crontab line** for `scripts/hermes-morning-digest.sh` (07:00 Mode B digest) should be **disabled (commented out)** when using 49-6 — **do not** remove 26-7 scripts (`hermes-morning-digest.sh`, `install-hermes-morning-digest-job.sh`, prompt/inject); they remain a manual fallback.

## Story

As a **CNS operator in `#hermes`**,  
I want **a daily morning digest that pulls Google Trends, NewsAPI headlines, and a Perplexity deep signal on the top trend**,  
so that **I start each day with a structured, source-backed briefing without vault writes or dashboard work**.

## Acceptance Criteria

1. **Manual trigger (Discord)**  
   **Given** the `morning-digest` skill is installed and `#hermes` is bound  
   **When** the operator posts `morning-digest` (case-insensitive, single line, trim whitespace)  
   **Then** Hermes queries all three sources in priority order (Google Trends → NewsAPI → Perplexity)  
   **And** posts the **exact output contract** below to `#hermes`  
   **And** performs **no vault writes**, no dashboard relay, no digest archive files.

2. **Cron trigger**  
   **Given** cron is configured per `references/cron-snippet.md` (default **08:00 local**)  
   **When** the schedule fires  
   **Then** the same digest pipeline runs and delivers to `#hermes`  
   **And** schedule is overridable via `MORNING_DIGEST_CRON` env and/or `~/.hermes/config.yaml` key documented in the skill.

3. **Source coverage**  
   **Given** credentials in `~/.hermes/trend-ingest.env` (`NEWSAPI_API_KEY`) and watchlist at `~/.hermes/trend-watchlist.yaml`  
   **When** sources are healthy  
   **Then** Google Trends supplies up to **5** items from `python3 scripts/trend-ingest.py --dry-run --sources google_trends` (parse JSON `events`, sort by `normalizedValue` desc, take top 5; display score as `round(normalizedValue * 100)` or integer `value`)  
   **And** NewsAPI supplies up to **5** headlines for CNS-relevant topics (AI, agents, automation)  
   **And** Perplexity runs **one** `mcp__perplexity__search` on the **top trending keyword** from source 1 (2–3 sentence summary).

4. **Contract tests**  
   **Given** `tests/hermes-morning-digest-skill.test.mjs`  
   **When** `npm test` / `bash scripts/verify.sh` runs  
   **Then** tests assert SKILL metadata, output format strings, all three source references, cron trigger pattern, and install script path.

5. **Verify gate**  
   **When** implementation is complete  
   **Then** `bash scripts/verify.sh` is green.

## Out of scope

- Dashboard widget, Convex ingest changes, vault writes (`00-Inbox/`, `vault_append_daily`, `vault_log_action`)
- Historical digest archive / JSONL retention
- Replacing Epic 44 trend-ingest cron (news/reddit/google_trends push) — digest **reads** trends via dry-run only

## Output contract (normative — post to `#hermes`)

```text
🌅 **Morning Digest** — <YYYY-MM-DD>

**Trending Now** (Google Trends)
- <keyword 1> · <score>
- <keyword 2> · <score>
- ...up to 5

**Headlines** (NewsAPI)
- <headline 1>
- <headline 2>
- ...up to 5

**Deep Signal** (Perplexity — top trend: "<keyword>")
<2–3 sentence sweep summary>

**Recommended focus:** <top keyword to watch today>
```

**Date line:** Use operator-local civil date from machine timezone (`process.env.TZ` if set, else OS default). No hardcoded region in repo artifacts.

**Partial failure:** If a source fails, keep section headers and insert one bullet: `- (source unavailable: <short reason>)`. Still post digest; do not invent headlines or trends.

## Tasks / Subtasks

- [x] Create skill package `scripts/hermes-skill-examples/morning-digest/` (AC: 1, 3, 4)
  - [x] `SKILL.md` — frontmatter `name: morning-digest`, version, Hermes tags, tools policy, no-vault-writes
  - [x] `references/task-prompt.md` — source commands, parsing, Perplexity query, output template
  - [x] `references/trigger-pattern.md` — `morning-digest` manual + cron pseudo-trigger
  - [x] `references/config-snippet.md` — `#hermes` `channel_skill_bindings`, optional `morning_digest` schedule keys
  - [x] `references/cron-snippet.md` — Hermes cron + WSL crontab pattern (gateway must be up)
- [x] Add `scripts/install-hermes-skill-morning-digest.sh` (mirror `install-hermes-skill-investigate-trend.sh`) (AC: 4)
- [x] Add `tests/hermes-morning-digest-skill.test.mjs` (AC: 4, 5)
- [x] Operator Guide §15.x subsection: install, manual test, cron, migration note from Story 26-7 (AC: 2)
- [x] Run `bash scripts/verify.sh` (AC: 5)

### Review Findings

- [x] [Review][Patch] Manual trigger contract is contradictory across artifacts [`scripts/hermes-skill-examples/morning-digest/SKILL.md:19`]
- [x] [Review][Patch] Perplexity fallback and timeout formatting deviate from the top-trend and partial-failure contract [`scripts/hermes-skill-examples/morning-digest/references/task-prompt.md:72`]
- [x] [Review][Patch] Schedule override is documented but not wired to an executable cron setup path [`scripts/hermes-skill-examples/morning-digest/references/cron-snippet.md:28`]
- [x] [Review][Patch] Story 49-6 relies on runtime wrapper scripts that are absent from the story file list/scoped change inventory [`_bmad-output/implementation-artifacts/49-6-morning-digest-upgrade.md:287`]
- [x] [Review][Patch] Perplexity usage is omitted from Hermes tool metadata even though the skill requires `mcp__perplexity__search` [`scripts/hermes-skill-examples/morning-digest/SKILL.md:10`]
- [x] [Review][Patch] Config snippet exposes a concrete Discord channel id instead of a placeholder [`scripts/hermes-skill-examples/morning-digest/references/config-snippet.md:19`]
- [x] [Review][Patch] Skill version is inconsistent between Operator Guide and `SKILL.md` [`scripts/hermes-skill-examples/morning-digest/SKILL.md:4`]
- [x] [Review][Defer] Sprint status diff bundles unrelated Epic 38 and Epic 50 state changes into the 49-6 review scope [`_bmad-output/implementation-artifacts/sprint-status.yaml:290`] — deferred, legitimate completed Epic 38/Epic 50 sprint state; handle commit-splitting / sprint-status ownership separately

## Dev Notes

### Relationship to Story 26-7 (do not break silently)

Epic **26-7** installed a **different** morning digest:

| Aspect | Story 26-7 (legacy) | Story 49-6 (this story) |
|--------|---------------------|-------------------------|
| Entry | `scripts/hermes-morning-digest.sh` + `install-hermes-morning-digest-job.sh` | Hermes **skill** `morning-digest` |
| Time | 07:00 WSL cron (`CRON_TZ=Australia/Sydney` in guide) | Default **08:00 machine-local** (configurable via `MORNING_DIGEST_CRON` / `morning_digest.cron`) |
| Vault | **Mode B** required (`00-Inbox/hermes-morning-digest-*.md`) | **None** (explicit out of scope) |
| Content | Constitution / open loops briefing | Trends + NewsAPI + Perplexity |

**Migration (operator-facing, document in Operator Guide):**

1. Install new skill: `bash scripts/install-hermes-skill-morning-digest.sh`
2. Bind `#hermes` (see `references/config-snippet.md`) — ensure trigger `morning-digest` does not collide with `investigate-trend` (different prefixes).
3. **Disable (comment out)** the legacy WSL crontab line for `scripts/hermes-morning-digest.sh` in Operator Guide §15.2 — avoids duplicate Discord digests (~60 min apart from 49-6). **Keep** all 26-7 scripts in repo as manual fallback.
4. Optional: remove legacy Hermes cron job id in `~/.hermes/morning-digest-cron-job-id` via `hermes cron remove <id>` when retiring 26-7 Hermes job only.

Do **not** delete 26-7 scripts in this story; add deprecation cross-links only.

### Pattern to copy: Story 49-4 `investigate-trend`

Mirror structure and test style:

| Artifact | Reference |
|----------|-----------|
| Skill layout | `scripts/hermes-skill-examples/investigate-trend/` |
| Install script | `scripts/install-hermes-skill-investigate-trend.sh` |
| Contract tests | `tests/hermes-investigate-trend-skill.test.mjs` |
| Perplexity tool name | `mcp__perplexity__search` (single call, bounded output) |

### Source 1 — Google Trends (Story 49-2 dependency)

Operator reports **49-2** fixed ingest: **`google_trends` dry-run returns 5 events per run** (watchlist-sized). Use:

```bash
cd "${OMNIPOTENT_REPO:-$HOME/ai-factory/projects/Omnipotent.md}"
python3 scripts/trend-ingest.py --dry-run --sources google_trends
```

- stdout: JSON with `events[]` entries containing `keyword`, `normalizedValue` (0–1), `value` (0–100 interest).
- **Do not** push to Convex from the digest skill (no `--dry-run` omission).
- Requires `pip install pytrends` and `~/.hermes/trend-watchlist.yaml` (see Operator Guide §16.5).
- Repo root: resolve via `OMNIPOTENT_REPO` env in task-prompt (same pattern as session-close).

### Source 2 — NewsAPI

- Key: `NEWSAPI_API_KEY` in `~/.hermes/trend-ingest.env` (see `scripts/trend-ingest.env.example`).
- **Not** the watchlist article-count path used by trend-ingest `news` collector — digest needs **headline titles** for topic sweep.
- Recommended: NewsAPI `v2/everything` with query covering CNS topics, e.g.  
  `q=("artificial intelligence" OR "AI agents" OR automation) AND NOT sports`  
  `sortBy=publishedAt`, `pageSize=5`, `language=en` (adjust if operator guide specifies otherwise).
- Load key via shell `source` / `python3` dotenv read — **never** print key in Discord.
- Free tier ~100 req/day — one digest run = one request; acceptable.

### Source 3 — Perplexity

- One `mcp__perplexity__search` call on **top keyword** from Source 1 (after sort).
- Suggested query: `<keyword> — latest news and developments last 24 hours — CNS operator brief`
- Target **2–3 sentences** in Deep Signal section; no bullet list in that section.
- Optional **45s** soft cap (investigate-trend uses 30s; digest has more work — document in task-prompt).

### Allowed tools (task-prompt must list explicitly)

| Tool | Use |
|------|-----|
| Shell / `run_terminal_cmd` | Run `trend-ingest.py --dry-run`; optional small inline Python for NewsAPI |
| `mcp__perplexity__search` | Deep signal only |
| Discord reply | Final formatted digest |

**Forbidden:** Vault IO mutators, `vault_write`, filesystem writes under `Knowledge-Vault-ACTIVE/`, NotebookLM, Firecrawl, dashboard APIs.

### Cron wiring (Hermes + gateway)

From Context7 `/nousresearch/hermes-agent` cron docs:

```bash
hermes cron create "0 8 * * *" \
  "Run morning-digest skill: collect Google Trends, NewsAPI, Perplexity; post Morning Digest contract to Discord." \
  --name morning-digest \
  --deliver discord
```

**Configurable schedule:**

- Env: `MORNING_DIGEST_CRON` — standard 5-field cron expression (document in `references/cron-snippet.md`).
- Config: document YAML keys under `morning_digest:` (example):

```yaml
morning_digest:
  cron: "0 8 * * *"      # default 08:00 machine-local (WSL uses system TZ / process.env.TZ)
```

Install helper may create Hermes cron job id file (pattern: `~/.hermes/morning-digest-skill-cron-job-id`) **or** document WSL crontab calling `hermes cron run <id>` like 26-7 — pick one approach and document in Operator Guide.

**Gateway:** Reuse 26-7 posture — if gateway down, launcher exits non-zero; do not claim delivery (see `scripts/hermes-morning-digest.sh` gateway check for pattern).

### `#hermes` config snippet

```yaml
discord:
  channel_skill_bindings:
    "<hermes-channel-id>": "morning-digest"
```

If multiple skills share `#hermes`, bindings may be skill-router specific — document that **`morning-digest`** and **`investigate-trend`** coexist because triggers differ (`morning-digest` vs `investigate-trend keyword:`). Follow `references/config-snippet.md` in investigate-trend for channel id placeholder.

### Project structure (files to create)

```
scripts/hermes-skill-examples/morning-digest/
  SKILL.md
  references/
    task-prompt.md
    trigger-pattern.md
    config-snippet.md
    cron-snippet.md
scripts/install-hermes-skill-morning-digest.sh
tests/hermes-morning-digest-skill.test.mjs
```

**UPDATE (docs only):** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` — new §15 subsection + version history row.

### Testing requirements

`tests/hermes-morning-digest-skill.test.mjs` minimum assertions (mirror 49-4):

- `name: morning-digest` in SKILL frontmatter
- Trigger strings: `morning-digest`, cron pattern (`0 8` or `MORNING_DIGEST_CRON` / `morning_digest.cron`)
- Output contract strings: `🌅 **Morning Digest**`, `**Trending Now**`, `**Headlines**`, `**Deep Signal**`, `**Recommended focus:**`
- Source references: `trend-ingest.py`, `--sources google_trends`, `NEWSAPI`, `mcp__perplexity__search`
- Policy: `No vault writes` (or equivalent)
- `scripts/install-hermes-skill-morning-digest.sh` exists

Run: `node --test tests/hermes-morning-digest-skill.test.mjs` then `bash scripts/verify.sh`.

### Architecture compliance

- **No WriteGate / constitution edits** in this story.
- **No `src/` Vault IO changes** unless a shared test helper is needed (unlikely).
- **Spec-first:** Hermes behavior is operator-runtime; repo mirror is normative via skill + Operator Guide.
- **Context7** was used for Hermes cron CLI (`hermes cron create`, `--deliver discord`, schedule syntax).

### Previous story intelligence (49-5)

- Phase B token gate touched **session-close** only; no conflict with morning-digest.
- Recent epic work: **49-4** established Hermes skill mirror + install script + contract test pattern — **reuse exactly**.

### Git intelligence

Recent commits on `main`:

- `3dc67e9` — feat(49-4): investigate-trend Hermes skill
- `e74e15f` / `287b448` / `6d43379` — session-close env (49-3)

Follow **one logical commit** for 49-6 implementation.

### Latest technical specifics (Hermes cron)

- Schedules: `"every 1d at 08:00"`, `"0 8 * * *"`, or env-driven 5-field cron.
- Delivery: `--deliver discord` for `#hermes` posting.
- Script-only cron (`--no-agent`) is **out of scope** — digest requires agent for Perplexity + formatting.

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

- Contract tests assert skill mirror excludes hardcoded region timezone strings (machine-local only).

### Review Findings (2026-05-29, reply 1 — all patches applied)

- [x] [Review][Patch] Task-prompt: explicit `--dry-run` no Convex + cross-source continue-on-failure [`references/task-prompt.md`]
- [x] [Review][Patch] NewsAPI env via `$HOME/.hermes/trend-ingest.env` only (not cwd-relative) [`references/task-prompt.md`]
- [x] [Review][Patch] Config snippet: multi-skill coexistence example (do not wipe bindings) [`references/config-snippet.md`]
- [x] [Review][Patch] Operator Guide §15.11: dry-run / partial-failure operator note [`CNS-Operator-Guide.md`]
- [x] [Review][Patch] Contract tests for new policy strings [`tests/hermes-morning-digest-skill.test.mjs`]

### Completion Notes List

- Implemented `morning-digest` Hermes skill mirror (49-4 pattern): SKILL + task-prompt, trigger, config, cron references.
- Added dedicated Hermes runtime wrappers for Google Trends dry-run and NewsAPI headline fetch.
- Timezone: machine-local (`process.env.TZ` / OS default); no region hardcoding in skill artifacts.
- Operator Guide §15.11 (v1.36.0): install, smoke test, 08:00 local cron; §15.2 WSL line commented as DISABLED; 26-7 scripts retained.
- `bash scripts/verify.sh` green (includes `tests/hermes-morning-digest-skill.test.mjs`).

### File List

- `scripts/hermes-skill-examples/morning-digest/SKILL.md` (new)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` (new)
- `scripts/hermes-skill-examples/morning-digest/references/trigger-pattern.md` (new)
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` (new)
- `scripts/hermes-skill-examples/morning-digest/references/cron-snippet.md` (new)
- `scripts/session-close/hermes-run-trend-ingest.sh` (new)
- `scripts/session-close/hermes-run-newsapi.sh` (new)
- `scripts/install-hermes-skill-morning-digest.sh` (new)
- `tests/hermes-morning-digest-skill.test.mjs` (new)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (updated §15.2, §15.11, v1.36.0)
- `_bmad-output/implementation-artifacts/49-6-morning-digest-upgrade.md` (updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (in-progress → review)

## Story completion status

- Implementation complete; operator decisions (2026-05-29) applied.
- Code review patches applied; sprint-status scope drift deferred by operator decision because Epic 38 and Epic 50 statuses are legitimate completed work.
- Status: **done**
