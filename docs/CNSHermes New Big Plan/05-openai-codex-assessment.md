# openai-codex Provider Assessment
_As of 2026-06-23 | Sourced from live web research + Hermes source code_

---

## What it actually is

`openai-codex` in Hermes config is **not Nous Portal**.
It is a completely separate provider: ChatGPT subscription auth via
device-code OAuth, hitting OpenAI's Codex backend at
`https://chatgpt.com/backend-api/codex`.

It was adopted as a cost-escape when Anthropic credits ran out.
It was never an intentional long-term choice.

---

## Why it's working right now

The Hermes source code (`agent/auxiliary_client.py`) has a function called
`_codex_cloudflare_headers()` which documents:

> "The Cloudflare layer in front of the Codex endpoint whitelists a small
> set of first-party originators (`codex_cli_rs`, `codex_vscode`,
> `codex_sdk_ts`, anything starting with `Codex`). Requests from
> non-residential IPs (VPS, server-hosted agents) that don't advertise
> an allowed originator are served [403]."

Hermes **spoofs those first-party originator headers** to pass Cloudflare.
On a residential IP (your HP EliteBook at home), this currently works.

That's why it appears functional — it IS functional right now on this machine.
The question is whether to build on it.

---

## Why it's fragile

### 1. The model list drifts silently

The same source file notes:
> "ChatGPT-account auth is an undocumented, shifting allow-list, and
> pinning one here has drifted silently twice
> (gpt-5.3-codex → gpt-5.2-codex → gpt-5.4 over 6 weeks in early 2026).
> Callers must pass the model they want explicitly."

Your current config pins `gpt-5.4-mini`. That model string has already
changed twice without warning. It will change again.

### 2. Breaks immediately on non-residential IPs

Confirmed in multiple open issues (Hermes #13834, OpenAI Codex #17860):
- WSL2 Cloudflare 403 blocks all `chatgpt.com/backend-api/` requests on some configurations
- The official Codex CLI uses "a more native transport path involving websocket/SSE response handling" that Hermes cannot fully replicate
- Hermes fails on the main Codex request path on some machines where official CLI succeeds
- Completely broken on VPS, server-hosted agents, mainland China, and some proxy configurations

### 3. Hermes officially labels this P2

Hermes GitHub issue #13834 is tagged:
- **P2** — Medium, degraded but workaround exists
- `provider/openai` + `type/bug`

This is an acknowledged known issue, not a solved problem.

### 4. No official support

OpenAI does not publicly document or support using the `chatgpt.com/backend-api/codex`
endpoint from non-browser clients. Any Cloudflare rule change on OpenAI's side
can break this silently with no notice.

### 5. The auxiliary model chain depends on it

Hermes uses openai-codex in the auto-detection fallback chain for auxiliary tasks:
`OpenRouter → Nous → Codex`
If OpenRouter is exhausted (402) and Portal isn't configured, auxiliary tasks
(compression, session search, skill matching, memory flush) fall through to Codex.
This means the whole auxiliary layer is currently on the fragile Codex path.

---

## The accurate framing

This is **not** "the openai-codex provider is broken — don't use it."

This is: **"openai-codex is currently functional on this residential machine
but is built on undocumented, unsupported header spoofing against a shifting
Cloudflare allowlist. The model has silently drifted twice in six weeks.
It breaks immediately on non-residential IPs or server deployments."**

It's a ticking clock, not a dead provider. The consolidation epic should
replace it before it breaks at an inconvenient moment — not in response to it breaking.

---

## What Portal replaces it with

| Dimension | openai-codex | Nous Portal |
|-----------|-------------|------------|
| Auth | ChatGPT device-code OAuth (fragile) | Nous OAuth → JWT (documented, supported) |
| Endpoint | `chatgpt.com/backend-api/codex` (Cloudflare-gated) | `inference-api.nousresearch.com/v1` (stable) |
| Model string | Undocumented shifting allow-list | Published catalog, versioned |
| Residential IP required | Yes | No |
| Server/VPS compatible | No | Yes |
| Model changes | Silent, no notice | Documented versioning |
| Support | None | Nous Research native |
| Hermes integration | Workaround (header spoofing) | Native (first-class provider) |

---

## Recommendation

Replace openai-codex with Portal in Phase 1 of the consolidation epic.
Keep it as a configured fallback in Hermes's provider fallback chain
(`openrouter → nous → openai-codex`) so it acts as a last-resort
backup if Portal auth expires unexpectedly. But it should not be
the primary provider for anything.
