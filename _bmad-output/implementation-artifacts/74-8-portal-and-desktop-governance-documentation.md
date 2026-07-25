---
baseline_commit: dd74547110501ac3d36bddf8b6410fd9e37d3b13
---

# Story 74.8: Portal and Desktop governance documentation

Status: review

<!-- Documentation-only story: vault governance modules + routing reconcile + operator guide pointer. NO src/ changes. Protect-list untouched. Uses 74-7 handoff draft as primary source. -->

## Story

As a **maintainer**,
I want **`hermes-desktop.md` and `routing.md` updated for Portal + reversibility**,
so that **future sessions and operators know the keystone config (NFR5, NFR6)**.

## Acceptance Criteria

1. **Prerequisites — Epic 74 runtime state verified**
   **Given** stories **74-1** through **74-7** are **done** (74-4 may still be backlog)
   **When** this story begins
   **Then** operator captures live baseline (paste redacted excerpts into evidence file):
   ```bash
   hermes --version
   hermes portal info
   grep -A6 '^model:' ~/.hermes/config.yaml
   grep -A10 'compression:' ~/.hermes/config.yaml
   curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers, .backend_ready'
   systemctl --user is-active hermes-dashboard.service
   ```
   **And** `auth_path: oauth` from **74-6** is confirmed (or document fallback if changed)
   **And** if dashboard service is not **active**, **stop** — restore 74-6 before writing governance

2. **Create vault module `hermes-desktop.md` (NEW — primary deliverable)**
   **Given** live baseline from AC #1 and handoff draft `74-7-connection-steps-draft.md`
   **When** governance module is authored at:
   - Repo mirror: `Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md`
   - Canonical vault: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md`
   **Then** both copies are **identical** after save
   **And** module includes these sections (minimum):
   - **Purpose + topology** — ADR-HERMES-001: browser UI at `http://localhost:9119` (Hermes v0.17 **browser-based**, not Electron); WSL backend canonical; Discord gateway separate process
   - **Portal OAuth (WSL)** — `hermes auth add nous --type oauth --manual-paste`; `hermes portal info` health check
   - **Dashboard OAuth register (FR5 / ADR-HERMES-008)** — `hermes dashboard register` → `HERMES_DASHBOARD_OAUTH_CLIENT_ID` in `~/.hermes/.env` (mode `0600`); client name `quiet_ibex` (ID redacted in vault)
   - **systemd** — `hermes-dashboard.service` on `0.0.0.0:9119`, `--skip-build`; gateway remains independent
   - **Desktop / browser sign-in (FR6)** — open `http://localhost:9119`; **Sign in with Nous Research** (same Portal account as WSL); WebSocket live chat at `/api/ws` (status page alone is insufficient)
   - **URLs** — Windows `http://localhost:9119`; WSL `http://127.0.0.1:9119`; optional `HERMES_DESKTOP_REMOTE_URL`
   - **Dual-home anti-pattern** — WSL `~/.hermes/` = canonical agent; Windows `%LOCALAPPDATA%\hermes` = install/support only; do **not** run second local agent via `hermes setup` on Windows
   - **Recorded `auth_path`** — document **74-6 outcome: `oauth`** (primary path in production)
   - **Basic-auth fallback (trusted localhost only)** — when to use `HERMES_DASHBOARD_BASIC_AUTH_*`; requires recording `auth_path: basic-auth-fallback` + reason; never default; never internet-facing
   - **openai-codex last-resort fallback (NFR5)** — link to rollback commands (also in `routing.md`); residential-IP fragility pointer to `docs/CNSHermes New Big Plan/05-openai-codex-assessment.md`
   - **Subscription cost note (NFR6)** — one Nous Portal **$30/mo paid tier** replaces prior fragmented spend (openai-codex fragility, exhausted OpenRouter, dead Anthropic for Hermes inference); **do not cancel** standalone subscriptions until operator confirms Tool Gateway + stability (74-4 / Phase 5 cleanup); FR11 Anthropic key remains separate for run-chain
   - **Troubleshooting matrix** — adapt from `74-7-connection-steps-draft.md` §8
   - **References** — ADR-HERMES-001, ADR-HERMES-008; superseded research: `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md`

3. **Reconcile `routing.md` Hermes surface with live `~/.hermes/config.yaml` (NFR5 complete)**
   **Given** live config from AC #1
   **When** `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` is updated (and synced to canonical vault copy)
   **Then** the **Hermes agent surface** subsection contains a reconciled alias table matching live config at story time:

   | Role | Provider | Model | Config path |
   |------|----------|-------|-------------|
   | Gateway / Discord / browser chat | `nous` | `anthropic/claude-sonnet-4.6` | `model.*` |
   | Context compression | `nous` | `anthropic/claude-haiku-4.5` | `auxiliary.compression.*` |
   | Last-resort fallback | `openai-codex` | `gpt-5.4-mini` (pinned — may drift) | fallback chain; not primary |
   | Web search (Tool Gateway) | `nous` / Nous Subscription | — | `hermes tools` — **row present**; if 74-4 not done, mark status `pending-74-4` with FR-GATE note |

   **And** existing Epic 15 IDE routing content is **not removed or broken**
   **And** rollback procedures for Portal primary **and** compression remain copy-pasteable
   **And** a **Reconciliation note** records story date + `hermes --version` + confirmation that table matches `grep`/`hermes config show` output
   **Critical:** Repo mirror and canonical vault copies of `routing.md` **currently differ** — dev must update **both** and verify with `diff -q` before closing

4. **Operator Guide pointer (§15 Epic 74)**
   **Given** `hermes-desktop.md` exists
   **When** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` is updated
   **Then** new subsection **§15.13 Portal + Desktop (Epic 74)** added after §15.12 with:
   - One-paragraph summary (Portal primary, browser UI at `:9119`, OAuth path)
   - Link to `AI-Context/modules/hermes-desktop.md` as SSOT runbook
   - Link to `AI-Context/modules/routing.md` for model alias / rollback table
   - Changelog row with version bump (follow existing §15 changelog pattern)
   **And** sync canonical vault copy if operator guide exists at `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

5. **Supersede stale research doc (repo only — not vault WriteGate)**
   **Given** vault module is canonical
   **When** `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` is annotated
   **Then** top-of-file callout states: **Superseded for operations by `AI-Context/modules/hermes-desktop.md` (Story 74-8)** — OAuth-primary, browser UI v0.17, not basic-auth-first / not Electron-first
   **And** research doc body is **not deleted** (historical reference retained)

6. **AGENTS.md module table (WriteGate — session-close path)**
   **Given** new `hermes-desktop.md` module
   **When** story closes
   **Then** either:
   - **(Preferred)** operator runs `/session-close` in `#hermes` with instruction to add Section 7 row: `Hermes Desktop | AI-Context/modules/hermes-desktop.md | Portal OAuth, dashboard service, browser chat surface, reversibility`, **or**
   - Story evidence records **deferred AGENTS §7 row → Epic 76-4** if session-close not run this story
   **And** dev does **not** directly edit `AI-Context/AGENTS.md` or `specs/cns-vault-contract/AGENTS.md` in this story (WriteGate)

7. **Evidence + verify gate (NFR1, NFR2, NFR4)**
   **Given** AC #2–#6 complete
   **When** story closes
   **Then** `_bmad-output/implementation-artifacts/74-8-governance-evidence.md` exists with:
   - Dated PASS/FAIL per AC
   - Redacted live config excerpts proving routing table reconcile
   - `diff -q` results for repo vs canonical vault copies (`routing.md`, `hermes-desktop.md`)
   - Note on AGENTS §7 row (done via session-close vs deferred)
   **And** `bash scripts/verify.sh` passes unchanged
   **And** git diff contains **no** secrets (`.env`, `auth.json`, OAuth client IDs, tokens)
   **And** protect-list paths have **zero** diffs
   **And** **no** `src/` changes

## Tasks / Subtasks

- [x] **AC #1 — Live baseline capture** (AC: #1)
  - [x] Run prerequisite commands; confirm dashboard active + Portal logged in
  - [x] Confirm `auth_path: oauth` matches 74-6 evidence
  - [x] Start evidence file scaffold

- [x] **AC #2 — Author `hermes-desktop.md`** (AC: #2)
  - [x] Merge `74-7-connection-steps-draft.md` into module structure
  - [x] Add NFR5 fallback + NFR6 cost sections
  - [x] Write repo mirror + canonical vault copy; `diff -q` identical

- [x] **AC #3 — Reconcile `routing.md`** (AC: #3)
  - [x] Extend Hermes surface table from 74-2/74-3; add Tool Gateway row status
  - [x] Add reconciliation note with date/version
  - [x] Sync repo + canonical vault copies

- [x] **AC #4 — Operator Guide §15.13** (AC: #4)
  - [x] Add subsection + changelog row
  - [x] Sync canonical operator guide if present

- [x] **AC #5 — Annotate research doc** (AC: #5)
  - [x] Superseded callout at top of `03-hermes-desktop-connection.md`

- [x] **AC #6 — AGENTS §7 row** (AC: #6)
  - [x] Session-close request **or** document deferral to 76-4 in evidence

- [x] **AC #7 — Evidence + verify** (AC: #7)
  - [x] Complete `74-8-governance-evidence.md`
  - [x] `bash scripts/verify.sh` green; protect-list + `src/` clean

## Dev Notes

### Epic and sequencing context

- **Epic 74 (Hermes on Portal + Desktop)** — story **74-8** closes Epic 74 documentation gate (**NFR5**, **NFR6**).
- **Prerequisites done:** 74-1 (embedder), 74-2 (Portal OAuth), 74-3 (compression), 74-5 (regression), 74-6 (dashboard OAuth/systemd), 74-7 (browser live chat + connection draft).
- **Parallel backlog:** **74-4** (Tool Gateway web search) may still be `backlog` — routing table must reflect **live** `hermes tools` state and mark pending if not configured.
- **Does not include:** Tool Gateway implementation (**74-4**), run-chain module (**75-2**), full orientation refresh (**76-1**), AGENTS §8 regeneration (session-close / **76-1**).
- **Branch:** `hermes-consolidation`.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Story 74-8; `sprint-status.yaml` Epic 74]

### Primary input artifact (74-7 handoff)

Use `_bmad-output/implementation-artifacts/74-7-connection-steps-draft.md` as the **starting body** for `hermes-desktop.md`. Key corrections already validated in 74-7:

| Topic | Canonical truth (74-7 evidence) |
|-------|--------------------------------|
| UI model | **Browser** at `http://localhost:9119` — Hermes Agent **v0.17.0**, not Electron Desktop app |
| Auth | **OAuth** (`auth_path: oauth`); Nous sign-in in browser UI |
| Chat proof | WebSocket live chat; test message `portal-desktop-ok` via Sonnet 4.6 |
| Gateway | PID **837348** unchanged; Discord independent |
| Dashboard client | `quiet_ibex` (name only) |

[Source: `_bmad-output/implementation-artifacts/74-7-connection-steps-draft.md`, `74-7-desktop-connection-evidence.md`, `74-6-dashboard-oauth-evidence.md`]

### Vault path contract — dual copy sync (CRITICAL)

| Copy | Path |
|------|------|
| Repo mirror (commit here) | `Knowledge-Vault-ACTIVE/AI-Context/modules/` |
| Canonical vault (operator Obsidian) | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/` |

**Known drift at story prep:** `routing.md` differs between repo mirror and canonical vault. Story **must** update both and confirm:

```bash
diff -q \
  Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md \
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md"
```

Same for new `hermes-desktop.md`. Pattern matches constitution sync discipline for `AGENTS.md`, but applies here because 74-2/74-3 edits landed in repo mirror only.

[Source: workspace rule `cns-specs-constitution.mdc`; operator vault layout `project-context.md`]

### WriteGate boundaries

| Path | This story |
|------|------------|
| `AI-Context/modules/hermes-desktop.md` | **Create/update** (repo + canonical) |
| `AI-Context/modules/routing.md` | **Update** (repo + canonical) — same pattern as 74-2, 74-3 |
| `03-Resources/CNS-Operator-Guide.md` | **Update** §15.13 |
| `AI-Context/AGENTS.md` | **Do not edit** — session-close or defer to 76-4 |
| `specs/cns-vault-contract/AGENTS.md` | **Do not edit** |

Optional: use `cns_vault_io` `vault_write` for governed paths if operator prefers MCP audit trail over direct filesystem edit — either path acceptable if WriteGate rules satisfied for protected paths.

[Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`; `project-context.md` §WriteGate]

### `hermes-desktop.md` module skeleton (use/adapt)

```markdown
# Hermes Desktop + Portal Surface (Epic 74)

Governance for Hermes on Nous Portal with browser-based JARVIS chat from Windows → WSL dashboard backend.

## Topology (ADR-HERMES-001)

- **Primary conversational surface:** browser UI → WSL `hermes dashboard :9119`
- **Secondary surface:** Discord `#hermes` via `hermes gateway` (separate process)
- **Not in scope:** Vercel `/nexus` embedded chat (ADR-HERMES-012 D3 opt-in)

## Prerequisites

(74-6 dashboard active, Portal logged in, mirrored WSL networking)

## Portal OAuth (WSL)

(commands from 74-2)

## Dashboard registration (ADR-HERMES-008)

`hermes dashboard register` …

## Browser connection + live chat (FR6)

(steps from 74-7 draft — install.ps1, browser URL, OAuth, WebSocket verify)

## URLs and env

| Context | URL |
|---------|-----|
| Windows browser | http://localhost:9119 |
| WSL curl | http://127.0.0.1:9119 |

## auth_path record

**Production (74-6/74-7):** `oauth`

## Basic-auth fallback (trusted localhost only)

(when + how + recording requirement)

## Reversibility (NFR5)

(openai-codex rollback — link routing.md)

## Subscription cost (NFR6)

($30 Portal vs prior providers; cancellation gates)

## Troubleshooting

(matrix from 74-7 draft)

## References

- ADR-HERMES-001, ADR-HERMES-008
- AI-Context/modules/routing.md
- docs/CNSHermes New Big Plan/05-openai-codex-assessment.md
```

### `routing.md` reconcile procedure

1. Capture live config:
   ```bash
   hermes config show
   grep -E '^(model|auxiliary|tools):' -A20 ~/.hermes/config.yaml
   hermes tools   # note Web search provider if 74-4 done
   ```
2. Update Hermes surface table rows to match — **do not guess** from training data.
3. Preserve 74-2 rollback block + 74-3 compression rollback block (extend, don't replace).
4. Add reconciliation footer:
   ```markdown
   **Reconciled:** YYYY-MM-DD — Hermes vX.Y.Z — Story 74-8 — matches live ~/.hermes/config.yaml
   ```

[Source: `_bmad-output/implementation-artifacts/74-2-portal-oauth-login-and-provider-switch.md` AC #5; `74-3-auxiliary-compression-on-portal.md` AC #5]

### NFR6 cost note content (minimum)

Document in `hermes-desktop.md`:

| Prior spend / fragility | Post-Portal posture |
|-------------------------|---------------------|
| openai-codex primary (Cloudflare / IP fragile) | Last-resort fallback only |
| OpenRouter (402 exhausted) | Removed from compression (74-3); account drain deferred |
| Dead Anthropic for Hermes inference | Portal OAuth replaces; **run-chain Boss still uses `.env.live-chain` ANTHROPIC_API_KEY (FR11-A)** |
| Standalone Firecrawl / TTS | Cancel only after **74-4** + **78-1** confirm Tool Gateway covers needs |

**Operator gate:** confirm net savings before cancelling any legacy subscription.

[Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §NFR6, §2 Background; `docs/CNSHermes New Big Plan/06-implementation-sequence.md` Phase 5]

### Architecture compliance

- **NFR5:** Full reversibility docs in `hermes-desktop.md` + reconciled `routing.md`.
- **NFR6:** Subscription cost note in governance module.
- **FR5–FR6:** Operational steps consolidated from 74-6/74-7.
- **ADR-HERMES-008:** OAuth primary; basic-auth fallback documented, not default.
- **NFR2:** No protect-list or `src/` edits.
- **NFR1:** `verify.sh` must pass.

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` ADR-HERMES-008; `prd-hermes-consolidation.md`]

### Protect-list (NFR2 — zero diffs required)

```
scripts/run-chain.ts
src/agents/synthesis-adapter-llm.ts
src/agents/hook-adapter-llm.ts
src/agents/boss-adapter-llm.ts
src/agents/run-chain.ts
```

Entire `src/` tree — **no changes this story**.

### CNS vault contract cite

Governance edits target `AI-Context/modules/` and `03-Resources/CNS-Operator-Guide.md` — governed vault paths. No Vault IO mutator signature changes. If using MCP writes, use `vault_write` with correct relative paths; protected `AI-Context/AGENTS.md` remains session-close only.

[Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`; `specs/cns-vault-contract/modules/security.md` WriteGate policy]

### Testing requirements

| Layer | Expectation |
|-------|-------------|
| Automated | `bash scripts/verify.sh` — must pass unchanged |
| Manual | AC #1 live config grep; AC #2 module completeness review; AC #3 table matches live config |
| Git | Vault modules, operator guide, research annotation, evidence, sprint-status — no secrets |
| Regression | No Hermes runtime config changes required (docs-only unless reconcile reveals doc bug) |

### Completion deliverables

| Deliverable | Path |
|-------------|------|
| **NEW** governance module | `Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md` (+ canonical copy) |
| Updated routing module | `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (+ canonical copy) |
| Operator guide | `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.13 |
| Research superseded note | `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` |
| Evidence | `_bmad-output/implementation-artifacts/74-8-governance-evidence.md` |
| Tracker | `sprint-status.yaml` — story `done` after dev-story |

### Previous story intelligence (74-7)

- Browser UI model supersedes Electron references in research docs.
- Connection runbook draft is **ready to merge** — do not rewrite from scratch.
- Discord gateway independence proven; cite in troubleshooting only.

[Source: `_bmad-output/implementation-artifacts/74-7-hermes-desktop-live-chat-connection.md`]

### Previous story intelligence (74-6, 74-2, 74-3)

- **74-6:** `auth_path: oauth`; systemd `hermes-dashboard.service`; `quiet_ibex`; Windows reachability via mirrored networking.
- **74-2:** Portal primary + openai-codex rollback block in routing.md (extend in 74-8).
- **74-3:** Compression on Portal Haiku (extend routing table).

### Previous story intelligence (74-4 — if still backlog)

When reconciling routing.md, run `hermes tools` / `hermes portal tools`. If Web search is not yet **Nous Subscription**, document:

```markdown
| Web search | pending-74-4 | FR-GATE confirmed Pre-4; configure in story 74-4 |
```

Do **not** block 74-8 on 74-4 completion — epic AC allows governance to reflect live state.

### Git intelligence

Expect repo diffs: new `hermes-desktop.md`, updated `routing.md`, operator guide, research annotation, evidence markdown, sprint-status, story file. No `~/.hermes/` files in git.

### Latest technical specifics (from Epic 74 evidence — verify live at dev time)

- **Hermes version:** v0.17.0 (2026.6.19)
- **Primary model:** `nous` / `anthropic/claude-sonnet-4.6`
- **Compression:** `nous` / `anthropic/claude-haiku-4.5`
- **Dashboard register:** `hermes dashboard register`
- **Browser UI:** `http://localhost:9119` — OAuth + `/api/ws` chat
- **Windows install (support):** `iex (irm https://hermes-agent.nousresearch.com/install.ps1)` → `%LOCALAPPDATA%\hermes`

[Source: Context7 ID `/nousresearch/hermes-agent` cited in 74-6/74-7; re-verify with `hermes dashboard --help` if CLI drift suspected]

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` (no direct edit)
- PRD NFR5/NFR6: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md`
- Architecture: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` ADR-HERMES-001, ADR-HERMES-008
- Vault alignment gap: `docs/CNSHermes New Big Plan/02-vault-alignment-report.md` — "No Hermes-Desktop module" (closed by this story)
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md` — dashboard redesign still deferred; not in scope

### Deferred work cross-reference

- OpenRouter account drain / Firecrawl cancel → Phase 5 / post-74-4 ops (not 74-8)
- AGENTS §7 module row → session-close this story or **76-4**
- Tool Gateway config → **74-4**
- Full orientation refresh → **76-1**

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (Cursor)

### Debug Log References

- Live baseline captured 2026-06-24; dashboard active, auth_path oauth confirmed against 74-6 evidence.
- `hermes tools` requires interactive TTY — Tool Gateway state taken from `hermes portal info` (Web tools via Nous Portal); routing row marked pending-74-4 per sprint backlog.

### Completion Notes List

- Created `hermes-desktop.md` governance module (repo + canonical vault, diff -q identical).
- Reconciled `routing.md` Hermes surface table with live config; added reconciliation footer; synced canonical vault (resolved prior drift).
- Added Operator Guide §15.13 + changelog 1.39.0; synced canonical operator guide.
- Annotated `03-hermes-desktop-connection.md` with superseded callout (body retained).
- AGENTS §7 row deferred to Epic 76-4 (session-close not running — story 76-1).
- `bash scripts/verify.sh` → VERIFY PASSED; no src/ or protect-list diffs.

### File List

- `Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md` (new)
- `Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md` (modified)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (modified)
- `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` (modified)
- `_bmad-output/implementation-artifacts/74-8-governance-evidence.md` (new)
- `_bmad-output/implementation-artifacts/74-8-portal-and-desktop-governance-documentation.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-06-24: Story 74-8 docs-only governance — hermes-desktop module, routing reconcile, operator guide §15.13, research superseded note, evidence file. AGENTS §7 deferred to 76-4.

## Story completion status

- **Status:** review
- **Context engine:** Ultimate context analysis completed — vault dual-copy sync, 74-7 browser UI handoff, routing reconcile procedure, NFR5/NFR6 content requirements, WriteGate boundaries, 74-4 pending handling, Operator Guide §15.13, and protect-list/`src/` exclusions documented.
- **Next story after done:** `74-4-tool-gateway-web-search` (if still backlog) or Epic 74 retrospective; Epic 75/76 unblocked after Epic 74 complete.
