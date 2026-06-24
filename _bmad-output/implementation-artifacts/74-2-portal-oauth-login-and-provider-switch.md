---
baseline_commit: f02bf439a08f14efde84680ec0e3128589bae72b
---

# Story 74.2: Portal OAuth login and provider switch

Status: done

<!-- Operator-first story: WSL Hermes CLI + one routing governance artifact. NO src/ code changes. Protect-list forbidden. -->

## Story

As an **operator**,
I want **Hermes authenticated to Nous Portal with `anthropic/claude-sonnet-4.6` as the default inference model**,
so that **Hermes inference runs on one stable subscription instead of fragile `openai-codex` (FR1)** while preserving a documented last-resort fallback (NFR5).

## Acceptance Criteria

1. **Pre-4 Portal subscription active (FR-GATE baseline)**
   **Given** operator has subscribed to Nous Portal **paid tier** ($30 plan; Tool Gateway confirmed on upgrade screen)
   **When** story work begins
   **Then** subscription confirmation is recorded in the story Dev Agent Record (date + tier note; no payment secrets)
   **And** `pre_implementation_checklist.pre-4-portal-subscribe-fr-gate` in `sprint-status.yaml` is updated to `done` on story completion

2. **Portal OAuth login on WSL**
   **Given** Pre-4 active and Hermes v0.17+ on WSL (`hermes --version`)
   **When** operator runs:
   ```bash
   hermes auth add nous --type oauth --manual-paste
   ```
   **Then** OAuth completes (browser URL opened or pasted callback URL accepted)
   **And** `~/.hermes/auth.json` contains a `nous` credential entry (file mode `0600`; **never commit**)
   **And** `hermes portal info` shows **logged in** with **Nous inference provider**

3. **Provider switch + default model**
   **Given** Portal login from AC #2
   **When** operator runs:
   ```bash
   hermes config set model.provider nous
   hermes model   # interactive — select anthropic/claude-sonnet-4.6
   ```
   **Then** `hermes config get model.provider` returns `nous`
   **And** `hermes config get model.default` returns `anthropic/claude-sonnet-4.6`
   **And** `~/.hermes/config.yaml` shows:
   ```yaml
   model:
     provider: nous
     default: anthropic/claude-sonnet-4.6
     base_url: https://inference-api.nousresearch.com/v1
   ```
   **And** `hermes portal info` still shows logged in with Nous inference provider

4. **Smoke inference (minimal)**
   **Given** provider switch from AC #3
   **When** operator runs a short smoke:
   ```bash
   hermes chat --once "Reply with exactly: portal-smoke-ok"
   ```
   **Or** sends one test message in Discord `#hermes` after gateway restart (optional spot check — full regression is **74-5**)
   **Then** model response succeeds via Portal (no openai-codex / Cloudflare errors)
   **And** smoke command + truncated stdout (or Discord confirmation note) is pasted into completion artifact

5. **openai-codex fallback documented (NFR5)**
   **Given** Portal is now primary
   **When** governance artifact is updated
   **Then** `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` includes a **Hermes agent surface** subsection documenting:
   - Primary: `model.provider: nous`, default `anthropic/claude-sonnet-4.6`
   - Last-resort fallback: `openai-codex` (ChatGPT Codex OAuth — residential-IP fragile; see `docs/CNSHermes New Big Plan/05-openai-codex-assessment.md`)
   - Reversible rollback procedure (exact commands to restore openai-codex primary if Portal auth fails)
   **And** existing Epic 15 IDE routing content is **not removed or broken**
   **Note:** Full Portal + Desktop governance consolidation is **74-8** — this story adds only the fallback subsection required by NFR5.

6. **No secrets committed (NFR4)**
   **Given** OAuth stores refresh tokens in `~/.hermes/auth.json`
   **When** story completes
   **Then** git diff contains **no** changes to `.env`, `.env.live-chain`, `auth.json`, or API keys
   **And** completion artifact redacts any token material

7. **Scope boundary — no code / protect-list changes (NFR2)**
   **Given** this story is operator CLI + governance only
   **When** implementation completes
   **Then** **zero diffs** in:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** no Tool Gateway config (`hermes tools`) — that is **74-4**
   **And** no `auxiliary.compression` switch — that is **74-3**
   **And** `bash scripts/verify.sh` passes unchanged (NFR1)

## Tasks / Subtasks

- [x] **AC #1 — Confirm Pre-4 subscription** (AC: #1)
  - [x] Operator confirms paid tier + Tool Gateway on Portal upgrade screen
  - [x] Record date/tier in Dev Agent Record (no secrets)
  - [x] Update `sprint-status.yaml` `pre-4-portal-subscribe-fr-gate.status` → `done`

- [x] **AC #2 — Portal OAuth** (AC: #2)
  - [x] Run `hermes auth add nous --type oauth --manual-paste` on WSL
  - [x] If loopback fails: paste full callback URL from Windows browser (WSL2 manual-paste path)
  - [x] Verify `hermes portal info` → logged in, Nous inference provider
  - [x] Confirm `auth.json` permissions `0600`; do not copy contents into repo

- [x] **AC #3 — Provider + model** (AC: #3)
  - [x] `hermes config set model.provider nous`
  - [x] `hermes model` → select `anthropic/claude-sonnet-4.6` (exact Portal catalog string)
  - [x] Verify config show / grep + `config.yaml` shape (v0.17: no `config get`)
  - [x] Capture `hermes portal info` output in completion artifact

- [x] **AC #4 — Smoke inference** (AC: #4)
  - [x] Run `hermes -z` smoke (portal-smoke-ok)
  - [x] Paste evidence in `_bmad-output/implementation-artifacts/74-2-portal-oauth-evidence.md`

- [x] **AC #5 — Fallback governance** (AC: #5)
  - [x] Append Hermes surface subsection to `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md`
  - [x] Include rollback commands (see Dev Notes template)
  - [x] Do **not** edit `AI-Context/AGENTS.md` (WriteGate — session-close owns §8)

- [x] **AC #6–#7 — Scope + verify** (AC: #6, #7)
  - [x] `git status` / `git diff` — confirm no secret files staged
  - [x] Confirm protect-list paths untouched
  - [x] Run `bash scripts/verify.sh` — must pass

## Dev Notes

### Epic and sequencing context

- **Epic 74 (Hermes on Portal + Desktop)** — story **74-2** is the **Portal keystone**; Pre-4 operator gate executes **here** (not before 74-1).
- **Prerequisite done:** **74-1** Brain embedder audit — StubEmbedder only; Portal inference switch does **not** change Brain today.
- **Blocks:** 74-3 (aux compression), 74-4 (Tool Gateway web search), 74-5 (regression gate), 74-6+ (dashboard/Desktop).
- **Branch:** `hermes-consolidation` (operator context 2026-06-24).

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Pre-implementation checklist, §Story 74-2]

### Live baseline (verify at story start — do not assume)

| Property | Expected before 74-2 | Verify with |
|----------|----------------------|-------------|
| Portal auth | **Not logged in** | `hermes portal info` |
| `model.provider` | `openai-codex` | `hermes config show` or `grep provider ~/.hermes/config.yaml` |
| `model.default` | `gpt-5.4-mini` | `hermes config show` or `grep default ~/.hermes/config.yaml` |
| `model.base_url` | `https://chatgpt.com/backend-api/codex` | `grep base_url ~/.hermes/config.yaml` |
| `nous` in auth | **Absent** until login | `hermes auth list` |
| openai-codex OAuth | Present (device_code) | `hermes auth list` — keep for fallback |
| verify.sh | Green on `hermes-consolidation` | `bash scripts/verify.sh` |

### Operator CLI runbook (canonical sequence)

```bash
# 0. Preconditions
hermes --version          # expect v0.17.x+
hermes portal info        # baseline: not logged in

# 1. OAuth (WSL — manual paste when browser is on Windows host)
hermes auth add nous --type oauth --manual-paste
# Follow URL in terminal → sign in on Portal → paste callback URL back

# 2. Verify login
hermes portal info
# Expect: Auth: logged in, Nous inference provider

# 3. Switch provider + model
hermes config set model.provider nous
hermes model
# Pick: anthropic/claude-sonnet-4.6

# 4. Verify config (v0.17: no `config get` — use show or grep)
hermes config show                  # or: grep -A4 '^model:' ~/.hermes/config.yaml
hermes portal info                  # still logged in

# 5. Smoke (pick one)
hermes -z "Reply with exactly: portal-smoke-ok"
# alt: hermes chat --once "Reply with exactly: portal-smoke-ok"

# 6. Optional — bounce gateway if Discord still on old provider cache
# (Full regression checklist is story 74-5)
set -a && . .env.live-chain && set +a
DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN" hermes gateway run
# OR rely on existing watchdog/systemd if already running
```

**Alternative one-shot (Context7-documented, equivalent outcome):** `hermes setup --portal` or bare `hermes portal` runs OAuth + provider setup interactively. Epics AC names the explicit two-command path; either is acceptable if AC #2–#3 evidence is captured.

[Source: Context7 `/nousresearch/hermes-agent` — providers.md, nous-portal.md; `docs/CNSHermes New Big Plan/04-nous-portal-integration.md`]

### WSL OAuth troubleshooting

| Symptom | Fix |
|---------|-----|
| Loopback callback unreachable from Windows browser | Use `--manual-paste`; paste full redirect URL from browser address bar |
| `hermes portal info` still "not logged in" after paste | Re-run auth; check `~/.hermes/auth.json` mtime; confirm Portal subscription active |
| Model picker missing Sonnet 4.6 | Run `hermes model --refresh` after login |
| Smoke fails with auth error | `hermes portal info`; re-login; confirm `model.provider` is `nous` not `openai-codex` |

### Governance artifact — routing.md subsection template

Append to `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (preserve existing Epic 15 IDE content):

```markdown
## Hermes agent surface (Epic 74 — Portal primary)

| Role | Provider | Default model | Config path |
|------|----------|---------------|-------------|
| Hermes gateway / Discord / Desktop chat | `nous` (Nous Portal OAuth) | `anthropic/claude-sonnet-4.6` | `~/.hermes/config.yaml` → `model.*` |
| Last-resort fallback | `openai-codex` | `gpt-5.4-mini` (pinned — may drift) | Hermes provider fallback chain; **not primary** |

**Portal login:** `hermes auth add nous --type oauth --manual-paste` · **Inspect:** `hermes portal info`

**Rollback to openai-codex primary (reversible):**
```bash
hermes config set model.provider openai-codex
hermes config set model.default gpt-5.4-mini
hermes config set model.base_url https://chatgpt.com/backend-api/codex
hermes gateway restart   # or watchdog cycle
```
Verify: `hermes portal info` may still show Portal logged in — openai-codex uses separate device_code creds in `auth.json`.

**Fragility note:** openai-codex relies on undocumented Cloudflare allowlisting; residential IP only. See `docs/CNSHermes New Big Plan/05-openai-codex-assessment.md`. Full Portal governance: story **74-8**.
```

**WriteGate note:** Do **not** edit `AI-Context/AGENTS.md` in this story. `routing.md` is the NFR5 target per AC; 74-8 expands `hermes-desktop.md` + full routing reconciliation.

### Explicitly out of scope (defer to later Epic 74 stories)

| Action | Story |
|--------|-------|
| `hermes config set auxiliary.compression.provider nous` | 74-3 |
| `hermes tools` → Web search = Nous Subscription | 74-4 |
| Discord + morning-digest regression checklist | 74-5 |
| `hermes dashboard register`, systemd, Desktop | 74-6, 74-7 |
| Full `hermes-desktop.md` + routing alias table reconcile | 74-8 |
| `hermes proxy start` for run-chain | Epic 75 |
| Brain Portal `/embeddings` adapter | FR16 stretch (post 74-2 per 74-1 audit) |

### Architecture compliance

- **NFR2 protect-list:** Zero edits to run-chain adapters/orchestrator (see AC #7).
- **NFR4:** OAuth refresh token lives in `~/.hermes/auth.json` only; completion artifact redacts secrets.
- **NFR5:** Partial — fallback procedure in `routing.md`; full reversibility docs in 74-8.
- **FR11 Option A:** Run-chain still uses `ANTHROPIC_API_KEY` — **unaffected** by this story.
- **Untouched:** NEXUS bridge, morning-digest cron scripts, Vault IO MCP, Brain index pipeline.

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §protect-list, ADR-HERMES-004]

### Testing requirements

| Layer | Expectation |
|-------|-------------|
| Automated | `bash scripts/verify.sh` — must pass; **no new tests required** (no repo code changes) |
| Manual | AC #2–#4 CLI smoke + evidence file |
| Git | No staged secret files; protect-list paths clean |

### Completion deliverables

| Deliverable | Path |
|-------------|------|
| Operator evidence | `_bmad-output/implementation-artifacts/74-2-portal-oauth-evidence.md` (new) |
| Fallback governance | `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (append subsection) |
| Tracker | `sprint-status.yaml` — story `done`, pre-4 `done` |
| This story | Dev Agent Record + status `done` after dev-story |

### Previous story intelligence (74-1)

- Brain uses **StubEmbedder only** — Portal switch does not require Brain re-index or embedder code.
- Portal `/embeddings` verdict: **SAFE TO ADOPT LATER** with preconditions (74-2 proxy reachable, matching adapter, full re-index).
- 74-1 verify gate required session-close fixture alignment — ensure verify.sh still green before marking 74-2 done.

[Source: `_bmad-output/implementation-artifacts/74-1-brain-embedder-audit-before-portal-switch.md`, `74-1-brain-embedder-audit-report.md`]

### Git intelligence (hermes-consolidation branch)

Recent commits are **docs/research + 74-1 audit** — no Portal OAuth landed yet. Expect **routing.md + evidence markdown + sprint-status** as the only repo-tracked diffs; Hermes state changes live under `~/.hermes/` (gitignored).

### Latest technical specifics (Context7 — Hermes Agent v0.17)

- **OAuth provider id:** `nous` (not `nous-portal`)
- **Config keys:** `model.provider`, `model.default`, `model.base_url`
- **Post-login base_url:** `https://inference-api.nousresearch.com/v1`
- **Inspect commands:** `hermes portal info`, `hermes config show` (v0.17 has no `config get`), `hermes portal tools` (tools routing is 74-4)
- **Smoke one-shot:** `hermes -z "prompt"` (alias for single-turn chat)
- **Credentials file:** `~/.hermes/auth.json` — JWT refresh handled by Hermes; no long-lived API key in `.env`

[Source: Context7 `/nousresearch/hermes-agent` — integrations/providers.md, integrations/nous-portal.md]

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` (do not edit this story)
- Hermes consolidation PRD: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR1, §NFR4, §NFR5
- Portal research pack: `docs/CNSHermes New Big Plan/04-nous-portal-integration.md`, `06-implementation-sequence.md` Phase 1 steps 1–3
- Deferred Pre-2 session-close → **76-1** (blocked until Portal restores provider — **this story unblocks that path**)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor dev-story)

### Debug Log References

- Baseline verified 2026-06-24: Hermes v0.17.0, portal not logged in, `model.provider=openai-codex`, no `nous` in auth list.

### Completion Notes List

- Pre-4 confirmed 2026-06-24: $30 paid tier, Tool Gateway active (picker visible).
- Portal OAuth complete: logged in via device_code flow; auth.json mode 600; gio loopback error cosmetic.
- Provider switched: `nous` / `anthropic/claude-sonnet-4.6` / inference-api base_url; portal info confirms Nous provider.
- Smoke: `hermes -z "Reply with exactly: portal-smoke-ok"` → `portal-smoke-ok`.
- Dev Notes corrected: v0.17 uses `hermes config show` (not `config get`); smoke via `hermes -z`.
- verify.sh green; no secrets or protect-list diffs.

### File List

- `_bmad-output/implementation-artifacts/74-2-portal-oauth-evidence.md` (new — operator evidence)
- `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (append Hermes surface subsection)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (74-2 done, pre-4 done)
- `_bmad-output/implementation-artifacts/74-2-portal-oauth-login-and-provider-switch.md` (story tracking)

### Change Log

- 2026-06-24: Dev-story prep — governance + evidence scaffold; paused for operator OAuth CLI (AC #2–#4).
- 2026-06-24: Operator CLI complete — Portal OAuth, provider switch, smoke; story done.

## Story completion status

- **Status:** done
- **Context engine:** Ultimate context analysis completed — operator CLI runbook, scope guards, and governance template included.
- **Next story after done:** `74-3-auxiliary-compression-on-portal`
