# Optional Hermes config snippet (operator-owned)

Copy skill to `~/.hermes/skills/cns/morning-digest/` via:

```bash
bash scripts/install-hermes-skill-morning-digest.sh
```

Automated daily run (Story 55-3):

```bash
bash scripts/install-morning-digest-cron.sh
```

## `#hermes` skill binding

In `~/.hermes/config.yaml`, add or extend `discord.channel_skill_bindings` for the `#hermes` channel ID (see Operator Guide §15.1).

If `#hermes` already binds other skills (`triage`, `session-close`, `investigate-trend`, …), **add** `morning-digest` per your Hermes version’s multi-skill routing — do **not** replace the whole binding with a single skill. Triggers must stay distinct (`morning-digest` line-1 token vs `investigate-trend keyword:`).

**Recommended binding order** (router scans in list order; Story 55-1):

```yaml
discord:
  channel_skill_bindings:
    # Example only — merge with your live bindings; do not wipe existing skills.
    "<hermes-channel-id>":
      - hermes-url-ingest-vault
      - triage
      - session-close
      - vault-lint
      - vault-think
      - vault-graduate
      - investigate-trend
      - morning-digest
      - notebook-query
```

Place **`morning-digest` immediately after `investigate-trend`** so prefix triggers stay unambiguous. After reordering bindings, run **`/new`** in `#hermes` or restart the gateway session so injected skill context refreshes.

Replace `<hermes-channel-id>` with your live `#hermes` id.

## `channel_prompts` — explicit routing line (Story 55-1)

Live `#hermes` prompts often list `/triage`, `/session-close`, and vault-* commands but omit skill triggers. Add a line so the model prioritizes `skill_view` + task-prompt for this skill:

```yaml
discord:
  channel_prompts:
    "<hermes-channel-id>": |
      …existing prompt lines…
      - For a daily trend briefing: when the operator posts single-line `morning-digest` or `morning-digest cron:<label>` (case-sensitive) in this channel, use the morning-digest skill. First call skill_view("morning-digest", "references/task-prompt.md"), then execute the full digest contract — do not summarize the skill or ask whether to proceed.
```

Merge with your existing `channel_prompts` block; do **not** replace the whole prompt.

## Optional schedule keys

Reference cron expression for `install-morning-digest-cron.sh` — **WSL line uses `CRON_TZ=Australia/Sydney`**:

```yaml
morning_digest:
  cron: "0 7 * * *"
```

Environment override (same 5-field cron; takes precedence over YAML when install runs):

```bash
export MORNING_DIGEST_CRON="0 7 * * *"
```

Changing YAML or env alone does **not** reschedule the Hermes job until you re-run `bash scripts/install-morning-digest-cron.sh`.

## Credentials (not in this repo)

| Secret / file | Purpose |
|---------------|---------|
| `~/.hermes/trend-ingest.env` | `NEWSAPI_API_KEY`; optional `MORNING_DIGEST_NEWSAPI_*`, `MORNING_DIGEST_ARXIV_*` keys |
| `~/.hermes/trend-watchlist.yaml` | Google Trends watchlist |
| `OMNIPOTENT_REPO` | Optional; defaults to clone path in task-prompt |
| `.env.live-chain` | `HERMES_DISCORD_TOKEN` for cron tick delivery |

## NewsAPI headlines (Story 64-6)

Requires `NEWSAPI_API_KEY` in `~/.hermes/trend-ingest.env`. Set tuning keys in the same file or shell environment.

| Variable | Purpose | Default |
|----------|---------|---------|
| `MORNING_DIGEST_NEWSAPI_WINDOW_HOURS` | Rolling `from` window (hours) | `48` |
| `MORNING_DIGEST_NEWSAPI_MAX_HEADLINES` | Max headlines after on-topic filter | `5` |
| `MORNING_DIGEST_NEWSAPI_PAGE_SIZE` | API fetch pool before filter | `20` |
| `MORNING_DIGEST_NEWSAPI_QUERY` | Optional full `q` override | built-in tightened default |
| `MORNING_DIGEST_NEWSAPI_ENABLED` | Set `0` or `false` to disable | enabled |

Example operator setup:

```bash
# In ~/.hermes/trend-ingest.env
NEWSAPI_API_KEY=your-key-here
MORNING_DIGEST_NEWSAPI_WINDOW_HOURS=48
MORNING_DIGEST_NEWSAPI_MAX_HEADLINES=5
MORNING_DIGEST_NEWSAPI_PAGE_SIZE=20
MORNING_DIGEST_NEWSAPI_ENABLED=1
```

When disabled, the fetch script returns `{"error":"newsapi disabled"}` without a network call.

## arXiv preprints (Story 61-1, defaults Story 64-7)

Public RSS — no API key. Set in the shell environment or in `~/.hermes/trend-ingest.env` (same file as NewsAPI is fine).

| Variable | Purpose | Default |
|----------|---------|---------|
| `MORNING_DIGEST_ARXIV_CATEGORIES` | Comma-separated arXiv category codes | `cs.AI,cs.LG,stat.ML` when unset |
| `MORNING_DIGEST_ARXIV_MAX_PER_CATEGORY` | Max papers per feed (newest first) | `3` |
| `MORNING_DIGEST_ARXIV_ENABLED` | Set `0` or `false` to disable without unsetting categories | enabled |
| `MORNING_DIGEST_ARXIV_USE_DEFAULTS` | Set `0` or `false` to require explicit categories | enabled |

Only the **first three** valid category codes are fetched (45s Hermes `terminal` timeout; 15s per feed).

Example operator setup:

```bash
# In ~/.hermes/trend-ingest.env
MORNING_DIGEST_ARXIV_CATEGORIES=cs.AI,cs.LG,stat.ML
MORNING_DIGEST_ARXIV_MAX_PER_CATEGORY=3
MORNING_DIGEST_ARXIV_ENABLED=1
```

When categories are unset or empty, the fetch script applies documented defaults (`cs.AI,cs.LG,stat.ML`). Set `MORNING_DIGEST_ARXIV_USE_DEFAULTS=0` with empty categories to get `{"error":"categories not configured"}`. When disabled, returns `{"error":"arxiv disabled"}`.

## HackerNews top stories (Story 61-4)

Public RSS — no API key. Set in the shell environment or in `~/.hermes/trend-ingest.env` (same file as NewsAPI is fine).

| Variable | Purpose | Default |
|----------|---------|---------|
| `MORNING_DIGEST_HN_MAX_STORIES` | Max stories to return (after fetch) | `5` |
| `MORNING_DIGEST_HN_ENABLED` | Set `0` or `false` to disable without code change | enabled |

Example operator setup:

```bash
# In ~/.hermes/trend-ingest.env
MORNING_DIGEST_HN_MAX_STORIES=5
MORNING_DIGEST_HN_ENABLED=1
```

When disabled, the fetch script returns `{"error":"hackernews disabled"}`.

## NotebookLM title map (Story 61-2)

When `NOTEBOOKLM_NOTEBOOK_IDS` is set for session-close fan-out, registry rows may carry UUID-only titles. Morning digest signal scoring uses **human-readable** titles from this map so Vault context can ROUTED-match watched notebooks.

| Variable | Purpose |
|----------|---------|
| `NOTEBOOKLM_NOTEBOOK_TITLES` | Comma-separated `prefix:Title` pairs; prefix is the first 8 hex chars of the notebook UUID |

Load order: values from `$HOME/.hermes/trend-ingest.env` first, then process environment overrides (same merge as arXiv keys).

Example (production prefixes):

```bash
# In ~/.hermes/trend-ingest.env
NOTEBOOKLM_NOTEBOOK_TITLES=981466f0:CNS Vault Architecture,dc6abf1a:AI Factory Blueprint,f037c741:Nexus Discord Bridge
```

Unmapped notebook IDs keep their existing registry title (UUID if unset — safe degradation).

## Coexistence

- **investigate-trend**: bound to same channel with different trigger prefix — OK.
- **Legacy 26-7**: comment out WSL crontab line in Operator Guide §15.2 when this skill cron is active.
