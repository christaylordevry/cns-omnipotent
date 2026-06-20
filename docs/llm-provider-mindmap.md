# CNS — LLM Provider Mindmap & Consolidation Plan

**Compiled:** 2026-06-20
**Why this exists:** Multiple LLM provider decisions were made at different times, for different reasons (cost, reliability, structured-output needs), by different sessions that didn't always know about each other. This document maps every touchpoint as currently understood from project history, flags what's confirmed vs. what needs live verification, and proposes a staged, low-risk path to consolidation — without making any changes yet.

---

## 1. The five touchpoints

### A. Hermes core agent (the CLI/gateway itself)
**What it does:** Runs `/session-close`, `/triage`, `/vault-think`, `/verify`, Discord gateway, cron-skill dispatch, and (per Epic 70) was the *original* digest orchestrator before being demoted to a thinner role.

**Provider history (confirmed via handoffs, chronological):**
1. Started on direct Anthropic API key
2. Switched to **OpenRouter** (`openai/gpt-4o` main, `gpt-4o-mini` compression) — 2026-06-10 session, explicitly to fix "Hermes wasn't following instructions well" and to centralize a key already in `trend-ingest.env`
3. Migrated again to **`openai-codex` / `gpt-5.5`** (Codex CLI subscription auth, i.e. your ChatGPT subscription) — per Epic 38, Story 38-1 "provider migration documentation," done 2026-05-22ish (note: this date is *before* #2 above in some doc timestamps — the chronology across handoff docs is genuinely inconsistent; treat step order as approximate, not certain)
4. **Known breakage:** Codex CLI on WSL2/Linux gets blocked by Cloudflare's WAF — `chatgpt.com/backend-api/codex` requests get TLS-fingerprinted as bot traffic and rejected. This is a documented, unresolved-at-the-time issue, not a config error on your end. Works fine on macOS, fails specifically on WSL2.
5. When that broke, a session suggested reverting to Anthropic — you said no, **that's the cost problem we were trying to escape in the first place**. Alternative floated but not confirmed adopted: **Nous Portal** (Hermes' native subscription, covers 300+ models + tool gateway, flat-fee, built specifically to avoid this exact problem).

**Current live state: UNKNOWN — needs verification.** Docs disagree across sessions. `~/.hermes/config.yaml` needs a direct read before any plan touches this.

---

### B. CNS Research Chain (`scripts/run-chain.ts` — Epic 17-19: Synthesis/Hook/Boss/Weapons-check)
**What it does:** The deep-research pipeline — takes Research Agent output, runs Synthesis (patterns/gaps), Hook (4 options, 3+ iterations, 9/10 quality gate), Boss (novelty + copy-intensity check). This is the **structured-JSON-output** workload — each stage needs a parseable, schema-validated response, which is *why* it was originally built against the raw Anthropic Messages API rather than an agentic CLI.

**Today's finding:** `ANTHROPIC_API_KEY` returns 401 — confirmed dead via direct curl, bypassing the chain entirely. Key is set in Omnipotent.md's own `.env` (not `trend-ingest.env`).

**Important — this was already half-fixed once and the fix may have been shelved:**
- **Epic 38, Story 38-2** ("Kimi K2.6 evaluation for run-chain," done 2026-05-24) built a **second code path**: `callOpenRouterSynthesis()` now exists alongside `callAnthropicSynthesis()` in the codebase. This was explicitly an evaluation to reduce run-chain cost.
- The code-review deferred-work log from that story notes: *"Duplicated fetch/parse logic in `callAnthropicSynthesis` vs `callOpenRouterSynthesis` — acceptable spike scope; refactor when hook/boss also move to OpenRouter."* This implies only **Synthesis** got the OpenRouter path; **Hook and Boss were not migrated**, and the refactor to unify them was deferred indefinitely.
- Separately, `deferred-work.md` documents an explicit **policy decision**: *"Per-skill Hermes model routing: Haiku for triage/graduate/vault-lint/session-close; **Sonnet for vault-think/verify/run-chain**."* This reads like the eventual call was **keep run-chain on Sonnet-quality output**, not switch it to Kimi — but the actual adopt/defer/reject verdict from 38-2 isn't visible in what I've pulled. **Needs the actual story file read to confirm**, not inferred.

**Bottom line for B:** there's already a working OpenRouter code path sitting in the repo, unused or partially used, built for exactly this cost concern — before reaching for a new Anthropic key, this needs to be read and understood, not rebuilt.

---

### C. Nexus Inspector AI actions (`convex/investigation.ts` — Explain/Trace/Compare/Ask AI)
**What it does:** On-demand AI actions inside the dashboard UI.

**Confirmed migrated:** Epic 66, commit `db093e5` — *"Swap Anthropic → OpenRouter (gpt-4o); fix quoted ANTHROPIC_API_KEY."* This one's done and (per the commit) presumably stable. Lowest-risk reference pattern for how an Anthropic→OpenRouter swap was actually executed cleanly elsewhere in this same codebase.

**Caveat:** Convex prod env still listed `ANTHROPIC_API_KEY` as set (clean, no quotes) as of the June 10 handoff — worth confirming it's not still a fallback path anywhere, or just leftover or used elsewhere in Convex.

---

### D. Morning digest pipeline (Epic 70 architecture)
**What it does:** The 15-source cron pipeline (Sources 1-15, today's TikTok/Instagram included). **By design, this does NOT call an LLM to collect or score sources** — Epic 70's whole point was removing the "LLM-agent-as-orchestrator" pattern that caused hallucinated/fabricated digest sections. It's a deterministic Node pipeline: fetch → normalize → dedupe → score → write → push. The architecture doc explicitly allows for **"(optional) ONE bounded LLM call for synthesis/editorial"** at the end — unclear if that optional call is currently wired to anything live, or what provider it'd use if so.

**This is the cleanest touchpoint** — no known issues, no provider confusion, because it mostly doesn't use an LLM at all.

---

### E. Model routing/alias registry (Epic 14-15 — `config/model-routing/`)
**What it does:** A formal routing framework (`resolveRoutingDecision`, alias registry, surface adapters for Cursor/Claude Code/Gemini CLI) that maps task categories → model aliases → providers, with fallback chains and operator-override governance. This is **IDE/tooling routing** (which model Cursor or Claude Code should use for a given task type), not backend chain routing.

**Status:** Built (Epic 15, all stories done), but it's unclear from what I've read whether this is actively driving any of A-C above, or whether it's a parallel system that exists but isn't wired into the actual cost-bearing decisions. **Needs verification** whether this registry is load-bearing or dormant.

---

## 2. The billing-model confusion — an important correction

One past session's reasoning conflated two genuinely different things, and it's worth correcting before any plan gets built on it:

| Route | What it actually is | Billing |
|---|---|---|
| **Anthropic API direct** (`api.anthropic.com`, `x-api-key`) | Pay-per-token, metered, needs funded balance | Metered |
| **OpenRouter** (`openrouter.ai`, `OPENROUTER_API_KEY`) | A multi-provider marketplace/proxy — **its own metered billing**, needs its own funded balance | Metered (can be cheaper per-model, but still pay-per-token, NOT a flat subscription) |
| **Codex CLI** (ChatGPT subscription auth) | Genuine flat-fee subscription usage, tied to your ChatGPT Plus/Pro/Team login | Flat-fee, included in subscription |
| **Claude Code** (Claude Pro/Max subscription) | Genuine flat-fee subscription usage | Flat-fee, included in subscription |
| **Gemini CLI** (Gemini subscription) | Genuine flat-fee subscription usage | Flat-fee, included in subscription |
| **Nous Portal** (Hermes' native provider) | Flat-fee subscription covering 300+ models + tool gateway | Flat-fee |

A past session's claim that *"OpenRouter can proxy to GPT-4o using your ChatGPT subscription credits"* appears to be **incorrect** — OpenRouter doesn't draw from a ChatGPT Plus subscription balance; it's a separate metered account. If Hermes or run-chain are currently routed through OpenRouter expecting subscription-style "already paid for" usage, that needs re-checking — it may quietly be metered spend that looks free because nobody's watched the OpenRouter balance.

**This matters directly for your stated goal** ("consolidate billing, I have subscriptions for Claude/Gemini/Codex already") — the only routes that actually satisfy "no separate billing" are Codex CLI, Claude Code, and Gemini CLI (the three you already pay for), or Nous Portal (a fourth flat fee, not yet committed to). OpenRouter and raw Anthropic API both add metered spend on top of what you're already paying for.

---

## 3. Why structured output complicates the "just use my subscription" plan

Synthesis/Hook/Boss need parseable JSON back from every call, with retry/score-gating logic (Hook needs 9+/10 across 3+ iterations). Claude Code, Codex CLI, and Gemini CLI are built as **interactive/agentic tools**, not simple request→JSON endpoints. They *can* be driven non-interactively (Claude Code has a `-p`/print/headless mode; Codex has an exec mode; Gemini CLI has similar non-interactive flags) — but scripting against a CLI's headless mode is a different integration shape than a clean `fetch()` call to a JSON API, and needs its own error handling, auth-session management, and output-parsing work. This is exactly the kind of redesign that needs to be scoped carefully — not flipped on for a Friday-afternoon fix — because a broken JSON parse mid-Hook-iteration is a worse failure mode than a 401.

---

## 4. What needs verifying before any plan is finalized

In priority order:

1. **Read `~/.hermes/config.yaml` directly** — what provider/model is Hermes *actually* running right now, today, not per stale docs.
2. **Read the actual `38-2-kimi-k2-6-evaluation-run-chain` story file** in `_bmad-output/implementation-artifacts/` — get the real adopt/defer/reject verdict instead of inferring it from a deferred-work breadcrumb.
3. **Check `scripts/run-chain.ts` and the synthesis adapter source directly** — confirm whether `callOpenRouterSynthesis()` is wired up and reachable via an env flag, or dead code from the spike.
4. **Check OpenRouter account balance** (`openrouter.ai` dashboard) — if anything is quietly running through it, confirm it's not accumulating unexpected metered spend.
5. **Re-check Codex-on-WSL2/Cloudflare status** — that block was time-stamped to an earlier session; OpenAI may have shipped a fix since, worth a quick current-state check before ruling Codex out as the subscription route for Hermes.
6. **Confirm whether the Epic 14-15 routing registry is load-bearing** anywhere in the current request path, or fully dormant.

---

## 5. Proposed approach (no action taken yet)

**Principle, matching your three constraints:**
- **(a) Nothing broken:** every change gets verified live before being called done, same bar as 72-3 today (build → review → live trigger → confirmed in outcome record).
- **(b) Cost-effective:** prefer the three subscriptions you already pay for over any metered route (Anthropic direct or OpenRouter) wherever the integration shape allows it.
- **(c) No regression:** Synthesis/Hook/Boss's quality gate (9+/10, 3+ iterations) is the thing most at risk if a cheaper/different model genuinely produces worse output — this needs an actual side-by-side comparison, not an assumption, before swapping run-chain's primary model.

**Staged plan (for discussion, not yet scoped into stories):**

| Stage | Touchpoint | Likely move | Risk |
|---|---|---|---|
| 1 | Verify everything in §4 | — | None — read-only |
| 2 | Research-chain (B) | Resume the 38-2 work: read what's already built, finish the OpenRouter path for Hook/Boss too (not just Synthesis) *if* the 38-2 verdict supports it — OR escalate to a genuine Claude-Code-headless-mode integration if quality demands stay high | Medium — touches the highest quality-bar component |
| 3 | Hermes core (A) | Confirm current state, decide once between Codex-subscription (if WSL2/Cloudflare issue is resolved) vs. Nous Portal (proven to avoid the issue entirely) — pick one and stop oscillating | Low-Medium — mostly config, but has bitten you 3+ times already |
| 4 | Nexus Inspector (C) | Already done — just confirm no stray Anthropic fallback | None |
| 5 | Digest pipeline (D) | No action — already correctly minimal | None |
| 6 | Routing registry (E) | Decide keep vs. deprecate based on §4.6 finding | Low |

---

## 6. Recommendation for right now

Don't fix the 401 by minting a fresh Anthropic key yet. Do the six verification checks in §4 first — most are single read-only commands — then come back with real current-state data and decide Stage 2/3 with full information instead of historical breadcrumbs.
