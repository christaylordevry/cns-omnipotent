# MCP Operator Runbook

One page, copy/paste friendly, secrets safe. This runbook standardizes env wiring, key rotation, and live-call smoke across Cursor and Claude Code.

## Non-negotiables

- **No secrets in repo or vault**: never commit keys, never paste keys into chat, never store keys in tracked files.
- **Registration is not verification**: `mcp list` or a green status is not proof. You must perform **one real remote tool call**.
- **Live smoke is operator-run only**: do not add network calls to tests or CI.

## Glossary: tool names and why they look different

There are two tool-name layers:

- **Host alias (what you click or see in host UI)**: for example `mcp__perplexity__search`
- **MCP protocol tool name (what the server exposes)**: for example `search`

Host alias naming varies by host and server. Many hosts prefix MCP tools with something like `mcp__<server>__<tool>`, but you should confirm the actual names in your surface before running smoke, and record the observed alias in evidence.

## Cursor vs Claude Code differences (table)

| Topic | Cursor | Claude Code |
|------|--------|------------|
| **Config location** | `~/.cursor/mcp.json` | Claude user config (via `claude mcp add`, stored under the Claude config directory) |
| **Registration mechanism** | Edit `mcp.json`, then restart Cursor | `claude mcp add --scope user <name> -- <command> <args...>` |
| **Env wiring** | `env` object in `mcp.json`, values should reference existing environment variables | `-e VAR="$(printenv VAR)"` or `-e VAR="$VAR"` flags on `claude mcp add` |
| **Reload required** | Restart Cursor to reload `mcp.json` | Re-run `claude mcp add` (to update), and restart `claude` session if needed |
| **Tool names you see** | Host alias names (often `mcp__...`) | Host alias names (often `mcp__...`) |
| **Tool names used by SDK** | Protocol tool names (server-defined) | Protocol tool names (server-defined) |

## Env patterns (do this, not that)

### Claude Code stdio registration pattern (env safe)

Pattern:

```bash
claude mcp add --scope user <server_name> \
  -e SOME_API_KEY="$(printenv SOME_API_KEY)" \
  -- <command> <args...>
```

Notes:

- This pattern keeps key literals **out of documentation**, but the shell still expands the secret at runtime. Treat your shell history and terminal logs as sensitive.
- If your shell history is enabled, consider using a no-history shell/session for secret-bearing commands.
- If `printenv SOME_API_KEY` is empty, stop. Fix your shell environment first.

### Cursor registration pattern (`~/.cursor/mcp.json`)

Pattern:

```json
{
  "mcpServers": {
    "<server_name>": {
      "command": "<command>",
      "args": ["<arg1>", "<arg2>"],
      "env": {
        "SOME_API_KEY": "${SOME_API_KEY}"
      }
    }
  }
}
```

Notes:

- Never place key literals in `mcp.json`.
- Use environment-variable interpolation only.
- Restart Cursor after edits.

### Optional `.env` files (allowed only if ignored)

If you need a local env file for operator smoke runs, use a git-ignored file and never paste its contents. The established pattern for live chain smoke is a local `.env.live-chain` that is ignored and loaded only in an operator shell.

## Live-call smoke procedure (operator-run only)

### What counts as a smoke

Minimum bar per MCP service:

- A single tool invocation that forces a real remote call, for example a search query to a hosted API.
- A short, human-readable evidence record captured in Markdown, with no secrets.

### Evidence template (safe)

Evidence must be secret-safe, it may be stored in the vault. Recommended locations:

- Today’s daily note under `## Agent Log`, or
- A dedicated operator note under `03-Resources/` (no raw payloads).

Do not include raw JSON payloads, request bodies, token values, or private URLs with sensitive query params.

```text
Date (UTC): YYYY-MM-DD
Surface: Cursor | Claude Code
Server: <server_name>
Tool invoked: <host alias or protocol name>
Query summary: <one sentence, no sensitive data>
Result summary: success | failure
Notes: <high-level error class, for example "missing env", "auth failed", "rate limited">
```

### Minimal smoke calls (Tier 1)

Use the smallest possible queries. Prefer a query that is safe to share and does not leak business context.

- **Perplexity**
  - Tool: host alias `mcp__perplexity__search` (host), protocol tool `search` (SDK)
  - Query: a simple public topic query
- **Firecrawl**
  - Tool: `mcp__firecrawl__...` (host surface varies by server), pick the smallest tool that fetches one URL
- **Apify**
  - Tool: `mcp__apify__...`, run a minimal actor or a lightweight endpoint call
- **Scrapling** (only if configured)
  - Tool: `mcp__scrapling__...`, run a single scrape against a stable test URL

If any of these are not installed or not present, record that explicitly as "not configured" in evidence. Do not claim success without a remote call.

### Troubleshooting: missing env, missing auth, “needs authentication”

- **If the server is listed but tools fail**: treat it as wiring/auth until proven otherwise.
- **If Cursor cannot see your env**: remember Cursor is a GUI app, it may not inherit shell env. Ensure the env var is set in the environment that launches Cursor, then restart Cursor.
- **If Claude Code tool fails with auth**: confirm the env var is set (`printenv VAR`), then re-run `claude mcp add ...` and restart the session if needed.
- **If you see `available=false` / “needs authentication”**: capture evidence (safe), then fix env/auth and re-run one live-call smoke.

## Key rotation hygiene (post-incident checklist)

Trigger conditions:

- A key was pasted into chat, a terminal log, a screenshot, or committed into any file.
- A provider reports suspicious activity.

Checklist:

1. **Rotate at provider**: create a new key, revoke the old key.
2. **Invalidate local caches**: clear or replace any local secret stores that might still contain the old value.
3. **Re-register MCP**:
   - Claude Code: re-run `claude mcp add ...` with env wiring and confirm server reconnects.
   - Cursor: confirm `~/.cursor/mcp.json` contains env placeholders only, then restart Cursor.
4. **Re-run live-call smoke**: perform one remote tool call and capture evidence.
5. **Clean up**: remove any pasted key from chat logs or shared documents when possible, and document the incident at a high level without the secret value.

Safe env handling reminders:

- Prefer `printenv VAR` for presence checks.
- Never paste `env` output into chat.
- Avoid copying terminal output that includes command invocations where literals may appear.

## Perplexity worked example (canonical reference case)

This is the reference case because it exposes common pitfalls: configured vs available, tool-name ambiguity, and per-surface config differences.

### Registration examples (placeholders only)

Claude Code:

```bash
claude mcp add --scope user perplexity \
  -e PERPLEXITY_API_KEY="$(printenv PERPLEXITY_API_KEY)" \
  -- npx -y perplexity-mcp
```

Cursor (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "npx",
      "args": ["-y", "perplexity-mcp"],
      "env": {
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}"
      }
    }
  }
}
```

### Live-call example and evidence record

- Perform a single search in the host using the Perplexity tool.
- Record only the minimal evidence template fields.

Example evidence (safe):

```text
Date (UTC): 2026-04-30
Surface: Claude Code
Server: perplexity
Tool invoked: mcp__perplexity__search
Query summary: public query about a non-sensitive topic
Result summary: success
Notes: response returned with citations
```

### Pitfalls and troubleshooting

- **Configured vs available**
  - Configured means the server is registered.
  - Available means a real tool call can run with required env present and provider auth working.
- **Host alias vs protocol tool name**
  - If you are in a host UI, you will likely see and invoke `mcp__perplexity__search`.
  - If you are writing code using the MCP SDK, you will likely call `search`.
- **Interpreting failures**
  - `available=false` (host health) often indicates missing env or auth, not a code bug.
  - A registered server that fails on first tool call is still a failure, capture evidence and fix wiring.

## Never do this

- Hardcode secrets in `~/.cursor/mcp.json` or any tracked file.
- Paste keys into chat, screenshots, or terminal sessions you plan to share.
- Use raw JSON output as "evidence" when it can include request metadata or payload details.
- Claim "connected" based on `mcp list` alone.

## Checklist: adding a new MCP service

1. Install the MCP server in your environment (or identify the hosted endpoint).
2. Register in Claude Code using env-safe `-e VAR="$(printenv VAR)"` wiring.
3. Register in Cursor using `~/.cursor/mcp.json` with env placeholders only.
4. Restart the relevant surface so config reloads.
5. Perform one live-call smoke tool invocation.
6. Record safe evidence in Markdown using the template above.
7. If anything fails, rotate keys only when you have evidence of leakage or compromise, then re-run smoke.

## Related implementation artifacts (optional)

- `_bmad-output/implementation-artifacts/19-1-live-chain-smoke-harness-and-evidence-record.md`
- `_bmad-output/implementation-artifacts/21-3-single-repeatable-run-script.md`

