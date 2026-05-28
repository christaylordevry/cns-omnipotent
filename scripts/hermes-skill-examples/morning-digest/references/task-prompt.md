# Task: `morning-digest` (Story 49-6)

## Hard constraints (must follow)

1. **Channel**: Discord `#hermes` only.
2. **No vault writes**: no Vault IO mutators, no files under `Knowledge-Vault-ACTIVE/`, no `00-Inbox/` captures.
3. **No dashboard relay**, no NotebookLM fan-out, no digest archive JSONL.
4. **Google Trends**: call the Hermes `terminal` tool with command `python3 scripts/trend-ingest.py --dry-run --sources google_trends` (never omit `--dry-run`). Dry-run prints JSON only — **no Convex push**, no norm-cache write.
5. **Secrets**: never echo `NEWSAPI_API_KEY` in Discord. Load credentials from **`$HOME/.hermes/trend-ingest.env`** only (never cwd-relative `.hermes/` or `./trend-ingest.env`).
6. **Date line**: `YYYY-MM-DD` from **machine-local** civil date (`process.env.TZ` if set, else OS default). Do not hardcode a region timezone in commands or config.
7. **Cross-source failures**: run all three sources independently. A failed source must not abort the digest — always post the full contract with `(source unavailable: …)` in the affected section(s).

## Tool-call rule

Do not treat shell snippets as instructions for the model to summarize. For every local command below, actually invoke the Hermes `terminal` tool using the explicit `terminal(command="...", workdir="...", timeout=<seconds>)` shape.

Resolve **`resolved_repo_root`** as:

- `OMNIPOTENT_REPO` when that environment variable is set to a non-empty absolute path.
- Otherwise `/home/christ/ai-factory/projects/Omnipotent.md`.

Use `resolved_repo_root` as the `workdir` argument for every `terminal(...)` call in this task.

Before source collection, call `terminal` once to get the machine-local date:

`terminal(command="node -e \"const d=new Date(); const p=n=>String(n).padStart(2,'0'); console.log(d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()))\"", workdir=resolved_repo_root, timeout=10)`

Use that stdout value for `<YYYY-MM-DD>`.

## Source 1 — Google Trends

Call `terminal` exactly once for Google Trends:

`terminal(command="python3 scripts/trend-ingest.py --dry-run --sources google_trends", workdir=resolved_repo_root, timeout=60)`

`--dry-run` is mandatory: stdout JSON only; ingest does **not** call Convex or persist norm-cache updates.

If the command exits non-zero or stdout is not valid JSON, treat Source 1 as failed and **continue** to Source 2.

Parse stdout JSON:

- `events[]` with `keyword`, `normalizedValue` (0–1), `value` (0–100).
- Sort by `normalizedValue` descending; take top **5**.
- Display score: `round(normalizedValue * 100)` or integer `value`.

On failure: section header + `- (source unavailable: <short reason>)`.

Requires `~/.hermes/trend-watchlist.yaml` and `pytrends` (Operator Guide §16.5).

## Source 2 — NewsAPI headlines

Call `terminal` exactly once for NewsAPI. This command reads credentials only from the absolute `$HOME/.hermes/trend-ingest.env` path and prints JSON with either `{"headlines":[...]}` or `{"error":"..."}`:

```text
terminal(command="python3 - <<'PY'\nimport json, os, urllib.parse, urllib.request\nfrom pathlib import Path\n\nenv_path = Path(os.environ['HOME']) / '.hermes' / 'trend-ingest.env'\nkey = ''\nif env_path.exists():\n    for line in env_path.read_text(encoding='utf-8').splitlines():\n        line = line.strip()\n        if not line or line.startswith('#') or '=' not in line:\n            continue\n        name, value = line.split('=', 1)\n        if name.strip() == 'NEWSAPI_API_KEY':\n            key = value.strip().strip('\"').strip(\"'\")\n            break\nif not key:\n    print(json.dumps({'error': 'missing NEWSAPI_API_KEY'}))\n    raise SystemExit(0)\nparams = urllib.parse.urlencode({\n    'q': '(\"artificial intelligence\" OR \"AI agents\" OR automation) AND NOT sports',\n    'sortBy': 'publishedAt',\n    'pageSize': '5',\n    'language': 'en',\n    'apiKey': key,\n})\ntry:\n    with urllib.request.urlopen('https://newsapi.org/v2/everything?' + params, timeout=20) as response:\n        payload = json.loads(response.read().decode('utf-8'))\nexcept Exception as exc:\n    print(json.dumps({'error': type(exc).__name__}))\n    raise SystemExit(0)\nif payload.get('status') != 'ok':\n    print(json.dumps({'error': payload.get('code') or payload.get('message') or 'newsapi error'}))\n    raise SystemExit(0)\nheadlines = [a.get('title', '').strip() for a in payload.get('articles', []) if a.get('title', '').strip()]\nprint(json.dumps({'headlines': headlines[:5]}))\nPY", workdir=resolved_repo_root, timeout=45)
```

Load `NEWSAPI_API_KEY` from that path only. **Do not** use repo-relative or cwd-relative env paths.

Request (one call per digest):

- Endpoint: `https://newsapi.org/v2/everything`
- Query: `q=("artificial intelligence" OR "AI agents" OR automation) AND NOT sports`
- Params: `sortBy=publishedAt`, `pageSize=5`, `language=en`

Emit up to **5** headline titles (title field only) under **Headlines**.

On failure (missing key, HTTP error, empty results): `- (source unavailable: <short reason>)` and **continue** to Source 3.

## Source 3 — Perplexity deep signal

Call `mcp__perplexity__search` exactly once.

- Keyword: **top** item from Source 1 (after sort).
- Query: `<keyword> — latest news and developments last 24 hours — CNS operator brief`
- Target **2–3 sentences** in **Deep Signal** section (no bullets in that section).
- Soft cap **45s** — on timeout, write `(source unavailable: perplexity timeout)` in Deep Signal body.

## Output contract (post to `#hermes`)

```text
🌅 **Morning Digest** — <YYYY-MM-DD>

**Trending Now** (Google Trends)
- <keyword 1> · <score>
- <keyword 2> · <score>
...up to 5

**Headlines** (NewsAPI)
- <headline 1>
- <headline 2>
...up to 5

**Deep Signal** (Perplexity — top trend: "<keyword>")
<2–3 sentence sweep summary>

**Recommended focus:** <top keyword to watch today>
```

**Recommended focus:** same keyword as Source 3 unless Source 1 failed entirely (then use best available signal or `(none — trends unavailable)`).

## Allowed tools

| Tool | Use |
|------|-----|
| `terminal` | Machine-local date; `trend-ingest.py --dry-run`; NewsAPI fetch |
| `mcp__perplexity__search` | Deep signal only |
| Discord reply | Final formatted digest |

**Forbidden:** `vault_write`, `vault_append_daily`, `vault_create_note`, NotebookLM, Firecrawl, dashboard APIs.

## Partial failure

Still post the full template with all section headers. Never invent headlines or trend keywords.

Never stop the run because an earlier source failed — only the failing section gets `(source unavailable: …)`.
