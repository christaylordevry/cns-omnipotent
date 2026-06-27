# Implementation Sequence
_As of 2026-06-23 | Full ordered plan from pre-work through consolidation_

---

## Pre-work: before any epic work begins

These steps are not epic stories — they're session-level cleanup
that must happen before the consolidation epic starts.

### Pre-1: Fix the test fixture (optional but recommended)

File: `tests/fixtures/session-close/section8-draft-fragment.md`

Remove the blockquote lines at the top so the file starts with `### Project Status`
instead of `> Update this section...`.

This changes the 7-failure `failure_class: tests` close to a clean close.
**Effort: 2 minutes. Impact: clean session-close, no noise in MEMORY.md.**

If skipped: session-close will still work (SAFE TO PROCEED verdict confirmed)
but will write `failure_class: tests` and `AUTO:TESTS = FAILED` to MEMORY.md,
creating cleanup debt.

### Pre-2: Run /session-close

From Discord `#hermes`:
```
/session-close
```

This regenerates in one operation:
- `AGENTS.md §8` (Epic 72 done, 73-7 in-progress, correct priorities)
- Both MEMORY files (`~/.hermes/memories/MEMORY.md` + `vault AI-Context/MEMORY.md`)
- All 11 AUTO blocks in `CNS-Daily-Rhythm.md`
- `vault-fast-scan-index.md`

**Do not skip this.** Starting the consolidation epic with stale MEMORY.md means
Hermes cold-starts with wrong context on every implementation session.

### Pre-3: Fix CNS-Daily-Rhythm static body

After session-close, manually edit `daily-rhythm-static-rows.md` in the repo:

```
Web App Vision (Epic 42): DONE
Stack: SvelteKit + Convex
URL: cns-dashboard-three.vercel.app
```

This is a hardcoded static row that session-close doesn't touch.
Commit to Omnipotent.md repo.

### Pre-4: Subscribe to Nous Portal

Browser: https://portal.nousresearch.com/manage-subscription

Confirm the plan tier covers Tool Gateway (web search).
Do NOT log Hermes into Portal yet — that's Phase 1 Step 2.

---

## Phase 1 — Hermes on Portal
### "Gateway-safe: touches nothing that can break Discord or morning digest"

Morning digest safety note: Digest uses `terminal` scripts + Perplexity/NewsAPI/etc.
Switching Hermes to Portal does NOT break digest collection. Cron still requires
gateway running (unchanged guard in `hermes-morning-digest.sh`).

**Steps:**

1. WSL: Portal OAuth login
   ```bash
   hermes auth add nous --type oauth --manual-paste
   # Follow OAuth URL, paste callback URL back into terminal
   ```

2. WSL: Verify login
   ```bash
   hermes portal info
   # Should show: logged in, Nous inference provider
   ```

3. WSL: Switch provider and model
   ```bash
   hermes config set model.provider nous
   hermes model    # select: anthropic/claude-sonnet-4.6
   ```

4. WSL: Configure Tool Gateway (drops standalone Firecrawl for Hermes)
   ```bash
   hermes tools    # set Web search → "Nous Subscription"
   hermes portal tools   # verify: Web search = Nous Subscription
   ```

5. WSL: Smoke test
   ```bash
   hermes chat     # ask a question that requires web search
   # Confirms: Portal inference + Firecrawl-via-Portal working
   ```

6. WSL: Restart gateway (keep Discord bridge unchanged)
   ```bash
   set -a && . .env.live-chain && set +a
   DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN" hermes gateway run
   ```

7. Discord: Single message in `#hermes` to confirm mobile surface unaffected

8. Move `auxiliary.compression` to Portal:
   ```bash
   hermes config set auxiliary.compression.provider nous
   hermes config set auxiliary.compression.model anthropic/claude-haiku-4.5
   # Drops last dependency on exhausted OpenRouter
   ```

**Phase 1 complete when:** `hermes portal info` shows logged in, Hermes responds
in Discord, web search uses "Nous Subscription."

---

## Phase 2 — Hermes Desktop
### "Additive — gateway stays running, this is a new parallel service"

1. WSL: Add basic-auth vars to `~/.hermes/.env`
   ```bash
   HERMES_DASHBOARD_BASIC_AUTH_USERNAME=admin
   HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=<strong-password>
   HERMES_DASHBOARD_BASIC_AUTH_SECRET=<openssl rand -base64 32 output>
   ```

2. WSL: Create and enable systemd user unit
   ```ini
   # ~/.config/systemd/user/hermes-dashboard.service
   [Unit]
   Description=Hermes Agent Dashboard
   After=network-online.target
   [Service]
   Type=simple
   EnvironmentFile=%h/.hermes/.env
   ExecStart=%h/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main dashboard \
       --no-open --host 0.0.0.0 --port 9119 --skip-build
   Restart=on-failure
   RestartSec=10
   [Install]
   WantedBy=default.target
   ```
   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now hermes-dashboard.service
   ```

3. WSL: Verify
   ```bash
   curl -s http://127.0.0.1:9119/api/status | jq '.auth_required'
   # Expected: true
   ```

4. Windows: Install Hermes Desktop
   ```powershell
   iex (irm https://hermes-agent.nousresearch.com/install.ps1)
   ```

5. Windows: Connect to WSL backend
   - Settings → Gateway → Remote URL: `http://localhost:9119`
   - Sign in with basic-auth credentials
   - Save and reconnect

6. Windows: Confirm chat works (WebSocket connected, not just status page)

7. WSL: Confirm gateway still running independently
   ```bash
   pgrep -f 'hermes gateway'
   ```

**Phase 2 complete when:** Hermes Desktop on Windows shows chat interface
connected to WSL backend, Discord mobile still works independently.

---

## Phase 3 — run-chain via Portal Proxy
### "Code work — separate epic story, ~1 day"

**Prerequisite:** Phase 1 complete (Portal logged in).

1. WSL: Start and persist proxy
   ```bash
   hermes proxy start   # http://127.0.0.1:8645/v1
   # Add to systemd or tmux alongside gateway + dashboard
   ```

2. Code: Add `CNS_SYNTHESIS_BASE_URL` env var to `callOpenRouterSynthesis()`
   in `src/agents/synthesis-adapter-llm.ts` (~15–40 lines)

3. Code: Add OpenAI chat-completions path to Hook adapter
   in `src/agents/hook-generation-adapter-llm.ts` (~70–90 lines)

4. Code: Rewrite Boss to JSON-only via OpenAI format
   in `src/agents/weapons-check-adapter-llm.ts` (~100–150 lines)
   _(Boss already has text JSON fallback path — this reuses it)_

5. Env: Update `.env.live-chain`
   ```env
   CNS_SYNTHESIS_PROVIDER=openrouter
   CNS_SYNTHESIS_BASE_URL=http://127.0.0.1:8645/v1
   CNS_SYNTHESIS_MODEL=anthropic/claude-sonnet-4.6
   OPENROUTER_API_KEY=unused
   # Remove: ANTHROPIC_API_KEY (no longer needed after adapter migration)
   ```

6. Verify
   ```bash
   bash scripts/verify.sh    # must pass before commit
   npx tsx scripts/run-chain.ts "AI agents" 2>&1 | tail -30
   # A working chain produces structured intelligence output, not a 401
   ```

7. Commit both repos, push

**Phase 3 complete when:** `run-chain.ts` produces synthesis + hook + weapons output
using Portal via proxy, with no `ANTHROPIC_API_KEY` in `.env.live-chain`.

---

## Phase 4 — run-chain as Hermes Skill (UX improvement)
### "Optional — enables Discord-triggered chains"

**Prerequisite:** Phase 3 complete (proxy running, adapters migrated).

Create `~/.hermes/skills/cns/run-chain/SKILL.md`:

```markdown
name: run-chain
trigger: /run-chain <topic>
toolsets: [terminal]
description: Run the CNS research chain on a topic brief
```

Skill body:
```
terminal(
  command="set -a && . .env.live-chain && set +a && npx tsx scripts/run-chain.ts \"${topic}\"",
  workdir="/home/christ/ai-factory/projects/Omnipotent.md",
  timeout=1800
)
```

**Phase 4 complete when:** `/run-chain "AI agents"` in Discord triggers the chain,
Hermes reports back synthesis output, vault receives synthesis note.

---

## Phase 5 — Cleanup

1. Remove `openai-codex` as primary (keep as last-resort fallback in chain)
2. Drain/cancel OpenRouter account after compression auxiliary moved to Portal
3. Evaluate Firecrawl standalone subscription cancellation — only after confirming
   run-chain research stage no longer calls `api.firecrawl.dev` directly
4. Update `AI-Context/modules/routing.md` to add Hermes Desktop surface
5. Create `AI-Context/modules/hermes-desktop.md` module
6. Archive stale `01-Projects/CNS-Phase-1/deferred-work.md` (fossil, superseded by repo copy)
7. Create `01-Projects/CNS-Dashboard/` project folder with Entity Intelligence status
8. Create `01-Projects/Omnipotent-CNS/` project folder documenting Epics 67–73

---

## Dependency graph

```
Pre-1 (fixture fix)
    ↓
Pre-2 (session-close) ─── Pre-3 (static body fix)
    ↓
Pre-4 (Portal subscription)
    ↓
Phase 1 (Hermes on Portal)
    ├── Phase 2 (Desktop) — parallel after Phase 1
    └── Phase 3 (run-chain proxy) — sequential after Phase 1
            ↓
        Phase 4 (run-chain skill) — after Phase 3
            ↓
        Phase 5 (cleanup) — after all phases
```

---

## Reasoning-model session brief

Use this verbatim when opening the Opus / o3 session:

---

> You are designing the Hermes consolidation epic for the CNS system.
>
> Read all files in this package (00 through 07). The research is complete —
> do not re-research anything. Design a complete implementation epic with:
> - Numbered stories with clear titles
> - Acceptance criteria for each story
> - Explicit sequencing constraints (what blocks what)
> - Risks flagged per story, not just overall
> - Story size estimates (XS / S / M / L)
>
> The goal is to make Hermes the single orchestration layer that knows
> everything — vault, digest results, run-chain output, entity intelligence —
> with Hermes Desktop as the primary surface and Discord as mobile/secondary.
> Nous Portal is the single LLM subscription provider.
>
> Constraints:
> - Do not break the Discord gateway or morning digest cron at any step
> - Do not mint a new Anthropic API key
> - Do not assume anything not in the documents
> - The test fixture fix (Pre-1) and /session-close (Pre-2) happen BEFORE
>   the first epic story — include them as pre-work, not stories
> - Flag every place where the Boss adapter's tool_choice rewrite could
>   regress weapons-check quality
> - Include a story for the vault project folders gap (Entity Intelligence
>   and dashboard work have no vault documentation)
> - Include a story for the two missing governance files
>   (mobile-posture.md module, personas/ directory)

---
