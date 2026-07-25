# Nous Portal Integration Strategy
_As of 2026-06-23 | Sourced from Prompt C (Context7 + live system inspection)_

---

## What Nous Portal is

Portal is **both**:

1. **A flat-fee LLM subscription** — one bill covers 300+ frontier models routed through Nous's inference plane at `inference-api.nousresearch.com`. Billed against your Portal account instead of separate per-lab API balances.

2. **An OAuth credential system** — not a long-lived API key in `.env`. Hermes stores a refresh token in `~/.hermes/auth.json`, mints short-lived `inference:invoke` JWTs per request, handles refresh automatically.

It also unlocks the **Tool Gateway**: web search/extract (Firecrawl), image gen (FAL), TTS (OpenAI TTS), browser automation (Browser Use) — all routed through the same subscription.

---

## Model catalog (Portal)

| Family | Available models |
|--------|-----------------|
| Anthropic | Opus 4.7, Opus 4.6, **Sonnet 4.6** ← target, Haiku 4.5 |
| OpenAI | GPT-5.5, GPT-5.5 Pro, GPT-5.4 Mini, GPT-5.4 Nano, GPT-5.3 Codex |
| Google | Gemini 3 Pro/Flash, 3.1 variants |
| DeepSeek | V4 Pro |
| Kimi | K2.6 |
| Hermes-native | Hermes-4-70B, Hermes-4-405B (**not recommended for agent tool loops**) |
| + 280 more | Full OpenRouter-style catalog |

**Recommended model for CNS operator workload:** `anthropic/claude-sonnet-4.6`
This matches the current Sonnet target, deferred-work policy ("Sonnet for vault-think/verify/run-chain"), and the Portal model string format.

---

## How to switch Hermes to Portal

### Current live state

| Property | Value |
|----------|-------|
| Portal auth | **Not logged in** |
| `model.provider` | `openai-codex` |
| `model.default` | `gpt-5.4-mini` |
| `model.base_url` | `https://chatgpt.com/backend-api/codex` |
| `web.backend` | `firecrawl` (direct, not Portal gateway) |
| Portal section in config | None (expected — Portal config is provider: nous + OAuth in auth.json) |

### Login flow (WSL consideration)

Portal login is browser-based OAuth. From WSL2 headless you need:

```bash
# Option 1 — SSH port forward to host browser
ssh -L 8642:127.0.0.1:8642 user@localhost

# Option 2 — manual paste (simpler)
hermes auth add nous --type oauth --manual-paste
```

### Switch commands

```bash
# One-shot setup (recommended):
hermes setup --portal

# OR on existing install:
hermes portal          # alias for: hermes auth add nous --type oauth
hermes config set model.provider nous
hermes model           # pick anthropic/claude-sonnet-4.6
hermes tools           # set Web search → "Nous Subscription"
```

### Resulting config.yaml shape

```yaml
model:
  provider: nous
  default: anthropic/claude-sonnet-4.6
  base_url: https://inference-api.nousresearch.com/v1

web:
  backend: nous   # enables Firecrawl via Portal gateway (no separate key for agent)
```

### Verify

```bash
hermes portal info       # shows logged in + Nous inference provider
hermes portal tools      # Web search = "Nous Subscription"
hermes chat              # smoke test with a web search prompt
```

### CLI subcommands available

```
hermes portal {login, info, status, open, tools}
```

---

## How run-chain gets onto Portal

### Current adapter reality

| Stage | Endpoint | Auth | Flexibility |
|-------|----------|------|-------------|
| Synthesis | `api.anthropic.com/v1/messages` OR `openrouter.ai/api/v1/chat/completions` | `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` | `CNS_SYNTHESIS_PROVIDER=openrouter` already wired |
| Hook | `api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY` only | **Hardwired — no alternate path** |
| Boss | `api.anthropic.com/v1/messages` + `tool_choice` | `ANTHROPIC_API_KEY` only | **Hardwired — no alternate path** |

All three return 401 today. OpenRouter synthesis path exists but OpenRouter is 402 exhausted.

### Path 1 — Portal Subscription Proxy (recommended)

Portal exposes inference at `https://inference-api.nousresearch.com/v1` (OpenAI chat-completions format). Hermes ships a local proxy that attaches Portal JWTs automatically:

```bash
hermes proxy start     # listens at http://127.0.0.1:8645/v1
```

External apps point at `http://127.0.0.1:8645/v1` with any dummy bearer.
Proxy attaches the real Portal JWT transparently.

**Allowed proxy paths:** `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/models`
**Not supported:** Anthropic Messages API format (`/v1/messages`)

#### Code delta per adapter

| Adapter | Change needed | Estimate |
|---------|--------------|---------|
| **Synthesis** | Add configurable `CNS_SYNTHESIS_BASE_URL` env var to `callOpenRouterSynthesis()` (today URL is hardcoded) | ~15–40 lines |
| **Hook** | Add OpenAI chat-completions path (same JSON-in-text pattern as synthesis) | ~70–90 lines |
| **Boss** | Uses Anthropic `tool_choice` + `tool_use` blocks. Proxy doesn't speak Messages API. Rewrite to JSON-only / OpenAI function-calling, OR use Boss's existing text JSON fallback path | ~100–150 lines |

**Total estimate: ~150–250 lines** across three adapters + env/docs + proxy lifecycle.

**Operational requirement:** `hermes proxy start` must be running whenever run-chain runs outside Hermes (cron, manual `tsx scripts/run-chain.ts`). Needs to be in systemd or tmux alongside the gateway and dashboard.

#### .env.live-chain changes

```env
# Current (broken):
ANTHROPIC_API_KEY=<dead>

# After Portal proxy:
CNS_SYNTHESIS_PROVIDER=openrouter          # reuse existing OpenRouter branch
CNS_SYNTHESIS_BASE_URL=http://127.0.0.1:8645/v1   # NEW env var (needs code)
CNS_SYNTHESIS_MODEL=anthropic/claude-sonnet-4.6
OPENROUTER_API_KEY=unused                  # proxy ignores it, keeps assert happy
# ANTHROPIC_API_KEY — drop once Hook/Boss adapters migrated
```

### Path 2 — Hermes subagent + proxy combo

Hermes can shell out to run-chain via `terminal()` tool call (morning digest does this already):

```markdown
terminal(
  command="set -a && . .env.live-chain && set +a && npx tsx scripts/run-chain.ts",
  workdir="/home/christ/ai-factory/projects/Omnipotent.md",
  timeout=1800
)
```

**What this solves:** Operator triggers chain from Discord via Hermes. Better UX.
**What it does NOT solve alone:** subprocess still reads `.env.live-chain` keys — it does NOT inherit Portal OAuth JWT. The 401 persists unless the proxy is also running.

**Verdict: Path 2 + proxy is the right combination.**
- Path 2 for operator UX (Discord → Hermes → run-chain)
- Proxy for credential plumbing (Portal auth reaches subprocess)
- Path 2 without proxy = still broken

### Boss tool_choice consideration

Boss uses Anthropic-format `tool_choice` + `tool_use` response blocks. The Portal proxy speaks OpenAI format only. Options:

1. **Rewrite Boss to OpenAI function-calling format** (~100–150 lines) — clean, permanent fix
2. **Use Boss's existing text JSON fallback path** — Boss already has this; route via OpenAI chat-completions with JSON instruction in system prompt instead of tool_choice. Smaller change, may reduce reliability slightly.
3. **Keep Boss on a Messages-compatible endpoint** — would need a separate bridge; Portal proxy won't do it. Not recommended.

---

## Firecrawl Situation

| Surface | Today | After Portal (Hermes) | After Portal (run-chain) |
|---------|-------|----------------------|--------------------------|
| Hermes `web_search` / extract | Direct `FIRECRAWL_API_KEY` | **Portal Tool Gateway → Firecrawl** (no separate key needed) | N/A |
| Morning digest | Perplexity, NewsAPI, ScrapeCreators, RSS | **Unchanged** | Unchanged |
| run-chain Research stage | Direct `api.firecrawl.dev` + `FIRECRAWL_API_KEY` | **Still needs `FIRECRAWL_API_KEY`** unless refactored | Still needs key |

**Can standalone Firecrawl subscription be cancelled?**
- For Hermes agent web tools: **Yes**, once Portal is logged in and `web.backend: nous` verified
- For run-chain: **No** — not without code changes to research stage
- Morning digest: Minimal impact — digest never depended on Firecrawl

**Portal does NOT bundle:** Perplexity, ScrapeCreators, NewsAPI, Apify.

---

## Subscription End State

### What Portal consolidates (eliminates)

- Hermes agent inference (replaces `openai-codex`, OpenRouter for main chat, dead Anthropic direct)
- Hermes web search/extract (replaces standalone Firecrawl **for agent tools only**)
- run-chain Synthesis/Hook/Boss (via proxy, after adapter changes)
- Optional: image gen (FAL), TTS, browser via Tool Gateway

### What still needs separate subscriptions/keys

| Still needed | Why |
|-------------|-----|
| Convex | Dashboard backend |
| Vercel | Hosting |
| Discord token | `HERMES_DISCORD_TOKEN` |
| Apify | run-chain research (social scraping) |
| Perplexity | run-chain research + digest source 3 |
| ScrapeCreators | Digest sources 14–19 |
| NewsAPI | Digest headlines |
| NotebookLM | Vault context queries |
| Cursor IDE | Dev surface |
| `FIRECRAWL_API_KEY` | run-chain direct API calls (until research stage refactored) |

### What gets eliminated

- OpenRouter as Hermes main provider (currently 402 exhausted)
- `openai-codex` / ChatGPT Codex OAuth fragility
- Dead `ANTHROPIC_API_KEY` (for both Hermes and run-chain)
- Standalone Firecrawl subscription **for Hermes web tools**
- OpenRouter auxiliary compression (move `auxiliary.compression` to `nous` in config)

---

## Pricing

Hermes docs do not publish dollar amounts. Plan selection at:
https://portal.nousresearch.com/manage-subscription

After login: `hermes portal info` and Portal web UI show subscription status and usage.
Confirm plan tier covers Tool Gateway (web search) before cancelling standalone Firecrawl.
