# CNS Ground Truth — Current System State
_As of 2026-06-23 | Sourced from Hermes config audit + vault audit_

---

## Repos

| Repo | Commit | Status |
|------|--------|--------|
| `Omnipotent.md` | `8b35d09` | Clean on master |
| `cns-dashboard` | `70f4def` | Clean on master |

---

## Hermes Agent

| Property | Value |
|----------|-------|
| Version | `v0.17.0` (2026-06-19) |
| Install path | `~/.hermes/` (WSL2 Ubuntu) |
| Primary provider | `openai-codex` |
| Primary model | `gpt-5.4-mini` |
| Base URL | `https://chatgpt.com/backend-api/codex` |
| Auth type | Device-code OAuth (ChatGPT subscription) |
| Gateway | Running — PID 837348, `@reboot` cron via `scripts/hermes-gateway-start.sh` |
| Dashboard | **NOT running** — port 9119 not listening |
| Nous Portal | **NOT logged in** |
| Web backend | `firecrawl` (direct, not via Portal gateway) |

### Other credentials present (masked)

| Provider | Status |
|----------|--------|
| `openai-codex` | Active (device-code OAuth) |
| `openrouter` | **Exhausted — 402** |
| `gemini` | 429 (rate-limited) |
| `copilot` | GitHub token present |
| `nous` | **Not present** |
| `anthropic` | **Dead — 401** |

### MCP servers wired to Hermes

| Server | Status | Vault root |
|--------|--------|------------|
| `cns_vault_io` | ✅ **Live child process of gateway** | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` |

### Hermes skills installed

- `morning-digest`
- `session-close`
- `vault-lint`
- `hermes-url-ingest-vault`
- 106 total `SKILL.md` files under `~/.hermes/skills` (AUTO:SKILLS_COUNT says 94 — stale)

### MEMORY.md cold-start content (`~/.hermes/memories/MEMORY.md`)

```
Closed: 2026-06-21T21:49:12.729Z | AGENTS v2.1.43 | failure_class: none
Epics: 72, 73 in-progress | Tests: 642 passing  ← WRONG (1317/7)
Vault: 0/0 clean — STALE REPORT (>7d)
Last Session Decisions: Story 53.3 done, 53.1 done, 52.2 done  ← WRONG (2 cycles stale)
Next Session: Review and close Story 53.3  ← WRONG
```

---

## Test Suite

| Metric | Value |
|--------|-------|
| Total passing | **1317** |
| Total failing | **7** |
| Failing file | `tests/session-close-token-gate.test.mjs` (6) + `session-close-pipeline.test.mjs` (1) |
| Root cause | Fixture drift — `section8-draft-fragment.md` starts with `>` blockquotes; validator requires `###` |
| Infrastructure broken? | **No** |
| `failure_class` designation | **`tests`** — safe to proceed with `/session-close` |
| Fix available | Drop blockquote lines from `tests/fixtures/session-close/section8-draft-fragment.md` |
| Documented in deferred-work? | **Yes** — "Full verify gate fails seven unrelated session-close Section 8 tests" |

---

## Sprint Status

| Epic | Status |
|------|--------|
| Epics 1–71 | ✅ Complete |
| Epic 72 (source adapters) | ✅ **All stories done** (72-1 through 72-8) |
| Epic 73 (entity intelligence) | In-progress |
| 73-1 through 73-6 | ✅ Done |
| 73-7 (digest entity sections) | **In-progress** |

---

## Morning Digest

| Property | Value |
|----------|-------|
| Orchestrator | Deterministic Node script (Epic 70 refactor) |
| Hermes role | Receives Discord post at end only — does NOT orchestrate |
| Sources live | 19 sources |
| Publish | Daily — working |
| Output destination | Convex + Discord only |
| Vault writes | **None** — digest never writes to vault |
| Digest artifact | `~/.hermes/digest-push-{date}.json` — exists but Hermes never reads it |

---

## run-chain

| Stage | Provider | Status |
|-------|----------|--------|
| Research (sweep) | Firecrawl, Apify, Perplexity | Working |
| Synthesis | Anthropic direct (default) OR OpenRouter (`CNS_SYNTHESIS_PROVIDER=openrouter`) | **401 — dead key** |
| Hook | Anthropic direct only — **hardwired, no alternate path** | **401** |
| Boss (weapons) | Anthropic direct only + `tool_choice` — **hardwired** | **401** |

**Last successful synthesis run:** 2026-05-24
**Last Apify research sweep:** 2026-06-19
**Hook/weapons notes in vault:** 0 (none accumulating)

---

## Nexus Dashboard

| Property | Value |
|----------|-------|
| URL | `cns-dashboard-three.vercel.app` |
| Tech stack | SvelteKit + Convex |
| Entity Intelligence | ✅ Live |
| Convex backend | `amiable-ox-862.convex.cloud` |
| Vault project folder | **Does not exist** — no dedicated vault project folder for dashboard |

---

## Vault (Knowledge-Vault-ACTIVE)

| Metric | Value |
|--------|-------|
| Path | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/` |
| Total notes | 632 |
| Inbox | **103** (severe backlog, oldest March 2026) |
| Projects | 40 |
| Areas | 11 |
| Resources | 90 |
| Archives | **0** (empty — nothing ever archived) |
| DailyNotes | 9 (last: 2026-06-07 — 16 days ago, pattern broken) |
| AI-Context | 12 |
| Last vault-lint | 2026-06-02 (21 days ago): 0 errors, 3 warnings |
| pending-review | 0 |
| Last MCP action | 2026-06-19 (Apify research_sweep) |

### AGENTS.md

| Property | Value |
|----------|-------|
| Version | `v2.1.43` |
| Last updated | 2026-06-21 |
| Vault root copy | `AI-Context/AGENTS.md` |
| Repo spec copy | `specs/cns-vault-contract/AGENTS.md` |
| `.hermes.md` copy | Vault root — mirrors v2.1.43 |

**Stale in §8:**

| Says | Reality |
|------|---------|
| "Epic 72: no stories tracked yet" | 72-1–72-8 all done |
| "73-7 in review" | in-progress |
| Priority 2: "Define and start Epic 72 stories" | Stale — 72 is done |
| No Hermes provider/model stated | Reality: `openai-codex / gpt-5.4-mini` |

**Missing from §7:** Playwright MCP, Discord MCP, Scrapling, Stitch (may be intentional Tier-2 omission)

**Missing files referenced in §5/§7/§9:**
- `AI-Context/modules/mobile-posture.md` — **does not exist**
- `AI-Context/personas/` — **directory does not exist**

---

## Subscriptions / Keys currently active

| Service | Role | Notes |
|---------|------|-------|
| ChatGPT Pro (OpenAI) | Hermes agent via openai-codex OAuth | Fragile — see `05-openai-codex-assessment.md` |
| OpenRouter | Hermes auxiliary compression | **402 exhausted** |
| Anthropic API | run-chain Synthesis/Hook/Boss | **401 dead** |
| Firecrawl | Hermes web tools + run-chain research | Direct key — separate subscription |
| Apify | run-chain research sweep | Active |
| Perplexity | run-chain research + digest source 3 | Active |
| ScrapeCreators | Digest sources 14–19 | Active |
| NewsAPI | Digest headlines | Active |
| Convex | Dashboard backend | Active |
| Vercel | Dashboard hosting | Active |
| NotebookLM | Vault context queries | Active |
| Cursor IDE | Development surface | Active |
| Nous Portal | **NOT subscribed / not logged in** | Target provider |
