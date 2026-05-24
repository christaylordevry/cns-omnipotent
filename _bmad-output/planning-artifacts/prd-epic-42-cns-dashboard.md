---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
completedAt: "2026-05-24"
status: complete
inputDocuments:
  - _bmad-output/implementation-artifacts/deferred-work.md
  - CLAUDE.md
  - docs/architecture.md
  - docs/project-overview.md
  - scripts/hermes-skill-examples/session-close/references/daily-rhythm-static-rows.md
  - user-provided-epic-42-scope
workflowType: prd
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 4
classification:
  projectType: web_app
  domain: ai-orchestration-control-plane
  complexity: medium
  projectContext: brownfield
epicScope: epic-42
outputRepo: cns-dashboard
cnsRepoTouch: scripts/dashboard-sync.ts only
provisioning:
  cnsDashboardRepo: not-yet-created
  convex: not-yet-provisioned
  vercel: not-yet-provisioned
obsidianUriScheme: "obsidian://open?vault=Knowledge-Vault-ACTIVE&file={path}"
mcpLastCallSource: "_meta/logs/agent-log.md"
mcpPanelPolicy:
  vaultIo: real-timestamps-from-agent-log
  otherMcps: configured-status-unknown
  knownLimitation: "agent-log captures vault-io mutations only; no per-call log for other 6 MCPs"
  deferredTo: epic-44
---

# Product Requirements Document - Epic 42: CNS Dashboard Web App

**Author:** Chris Taylor  
**Date:** 2026-05-24  
**Product:** CNS Dashboard — read-only situational awareness surface for the Central Nervous System  
**Epic:** 42  
**Repository:** `cns-dashboard` (new); CNS repo touch limited to `scripts/dashboard-sync.ts`

## Repository & Hard Constraints

| Constraint | Value |
|------------|-------|
| Dashboard repo | `cns-dashboard` — greenfield, not yet created |
| CNS repo touch | `scripts/dashboard-sync.ts` **only** |
| CNS repo off-limits | package.json, tsconfig, verify.sh, AGENTS.md, vault-io MCP, all existing src/ |
| Stack (locked) | SvelteKit + Convex + Vercel, dark theme |
| Provisioning | Convex and Vercel not yet provisioned |
| Obsidian URI | `obsidian://open?vault=Knowledge-Vault-ACTIVE&file={path}` |
| MCP timestamps | vault-io from `_meta/logs/agent-log.md`; others "configured / status unknown" (Epic 44) |
| Auth | Vercel password protection — no app-level auth code |

## Executive Summary

The CNS Dashboard is a read-only situational awareness web app for the Central Nervous System operator. Phase 6 CNS is mature — vault-io MCP live, Hermes gateway running, 118 vault notes with zero lint errors — but operator visibility remains fragmented across Cursor, Discord, Obsidian, and raw vault files. Answering "is the system healthy?" requires context-switching across four surfaces.

Epic 42 delivers a single dark-themed dashboard that consolidates vault health, MCP status, Hermes activity, run-chain state, searchable note metadata, and a trend intelligence stub into one real-time view. The dashboard reads exclusively from Convex via subscriptions; it makes no vault writes and no live MCP calls from the browser.

Implementation splits across two repositories: a new `cns-dashboard` repo (SvelteKit + Convex + Vercel) and a single addition to the existing CNS repo (`scripts/dashboard-sync.ts`). The sync script reads the vault filesystem, Hermes config, sprint-status.yaml, and `_meta/logs/agent-log.md`, then pushes state to Convex every 3 minutes via Hermes cron. The browser never touches the vault directly — safety by architecture, not policy alone.

**Target user:** The CNS operator (single-tenant). Auth via Vercel password protection; no application-level auth code required.

**MVP scope:** Six panels — vault health, MCP status, Hermes activity feed, run-chain status, vault search (Convex-indexed metadata with Obsidian URI deep links), and trend intelligence stub ("Coming in Epic 44"). Convex and Vercel are not yet provisioned; the `cns-dashboard` repo will be created fresh.

### What Makes This Special

**Safety-by-architecture.** The sync script is the only bridge between CNS infrastructure and the dashboard. The browser consumes pre-indexed Convex data via real-time subscriptions. No WriteGate bypass risk, no credential exposure from browser-side MCP calls, no accidental vault mutation surface.

**Operator-tuned panels, not generic dashboards.** Each panel maps to a real operator question: Is the vault clean? Are MCPs configured? What did Hermes do recently? Is run-chain dormant as expected? Can I find and open a note? Panels reflect how CNS is actually operated — not a generic admin UI.

**Honest about data gaps.** The MCP panel shows vault-io with real last-call timestamps parsed from `agent-log.md`. The other six MCPs (notebooklm, context7, firecrawl, perplexity, playwright, discord) display as "configured / status unknown" — no per-call log source exists today. Accurate non-vault-io MCP timestamps deferred to Epic 44.

**Core insight:** Operator visibility is a systems problem solvable by scheduled sync plus real-time push — not by giving the browser more power over the vault.

**Value proposition:** One tab that tells you whether your AI operating system is healthy — without opening the vault, Discord, or an IDE.

## Project Classification

| Dimension | Value |
|-----------|-------|
| **Project Type** | Web app (SvelteKit SPA, Convex backend, Vercel deployment) |
| **Domain** | AI orchestration control plane — personal operator tooling |
| **Complexity** | Medium — multi-source sync, six panels, Obsidian URI integration; read-only and single-tenant limit scope |
| **Project Context** | Brownfield CNS addition (one sync script) + greenfield dashboard repo |
| **Stack (locked)** | SvelteKit + Convex + Vercel, dark theme |
| **CNS repo constraint** | Add `scripts/dashboard-sync.ts` only — no changes to package.json, tsconfig, verify.sh, AGENTS.md, or vault-io MCP |

## Success Criteria

### User Success

- **Time-to-awareness:** Operator opens dashboard and answers "is CNS healthy?" in **< 10 seconds** without opening Cursor, Discord, or Obsidian.
- **Zero re-orientation:** Operator does not need to grep vault files, tail logs, or check Discord to assess vault health, Hermes status, or run-chain state during routine checks.
- **Search-to-note:** Operator finds a note by title/tag/path fragment via vault search and opens it in Obsidian via URI in **< 5 seconds** (search + click).
- **Trust in read-only boundary:** Operator never worries the dashboard could mutate vault state — no write affordances, no MCP calls from browser.
- **Emotional success moment:** Operator glances at pinned tab during morning standup (or mid-session check) and feels **relieved** — system state is visible, nothing is on fire.

### Business Success

*(Single-operator tool — "business" = operator efficiency and CNS operational confidence)*

- **Surface consolidation:** Routine health checks move from 4 surfaces (Cursor, Discord, Obsidian, raw files) to **1 surface** for ≥ 80% of daily checks within 2 weeks of launch.
- **Incident detection:** Operator detects vault lint regression, Hermes gateway failure, or run-chain error state from dashboard **before** discovering it accidentally in another surface.
- **Epic 42 completion gate:** Dashboard deployed to Vercel production, sync cron running every 3 min, all 6 MVP panels functional — enables Epic 44 (trend intelligence) without rework of data layer.

### Technical Success

- **Sync reliability:** `dashboard-sync.ts` completes successfully on ≥ 95% of 3-minute cron runs; failures logged and visible in Hermes activity feed.
- **Data freshness:** Convex state reflects vault filesystem within **≤ 3 minutes** of any change (sync interval bound).
- **Real-time updates:** Dashboard panels update via Convex subscriptions within **≤ 2 seconds** of sync push — no manual refresh required.
- **CNS repo isolation:** Only `scripts/dashboard-sync.ts` added to CNS repo; `npm test` and `bash scripts/verify.sh` remain green (609+ tests passing, zero regressions).
- **No vault writes:** Dashboard and sync script perform **zero** vault mutations; sync is read-only against filesystem and config.
- **MCP panel accuracy:** vault-io shows real last-call timestamp from `agent-log.md`; other 6 MCPs show "configured / status unknown" — no fabricated timestamps.

### Measurable Outcomes

| Metric | Target | Measurement |
|--------|--------|-------------|
| Panels functional at launch | 6/6 | Manual acceptance checklist |
| Sync cron uptime | ≥ 95% over 7 days | Hermes cron logs |
| Vault search result latency | < 500ms p95 | Convex query timing |
| Dashboard load time | < 3s first contentful paint | Vercel / Lighthouse |
| CNS test regression | 0 failures | `npm test` + `verify.sh` unchanged |
| Obsidian deep link success | 100% for indexed notes | Click-through test on sample paths |

## Product Scope

Epic 42 MVP delivers six read-only dashboard panels, one sync script, one new repo, and Hermes cron integration. Detailed phasing, must-have analysis, and post-MVP roadmap are in **Project Scoping & Phased Development** below.

**MVP panels:** vault health, MCP status, Hermes activity feed, run-chain status, vault search, trend intelligence stub.

**Hard exclusions:** vault writes, browser MCP calls, CNS repo changes beyond sync script, non-vault-io MCP timestamps, mobile layout, multi-user auth.

## User Journeys

### Journey 1: Morning Health Check (Primary — Happy Path)

**Persona:** Chris, CNS operator. It's 8am. Hermes watchdog has been running overnight. A Cursor session yesterday added 3 vault notes.

**Opening scene:** Chris used to start the day by opening Discord `#hermes`, checking if the gateway responded, then opening Obsidian to scan inbox depth, then running vault lint mentally from memory. Four surfaces, five minutes, before coffee.

**Rising action:** Chris opens the pinned dashboard tab (Vercel production URL). Dark theme loads. Six panels populate via Convex subscriptions — data synced 90 seconds ago.

- **Vault health:** 121 notes, ERRORS: 0, WARNINGS: 0, inbox depth: 2, PAKE distribution chart looks normal
- **MCP status:** vault-io green with last call 14 min ago; other 6 MCPs show "configured"
- **Hermes feed:** Last 20 agent-log entries visible; watchdog cron shows last run 2 min ago
- **Run-chain:** Dormant (as expected — Epic 38-2 deferred)
- **Trend stub:** "Coming in Epic 44" badge — ignored

**Climax:** Chris answers "is CNS healthy?" in **8 seconds**. Everything green. No Discord, no Cursor, no Obsidian.

**Resolution:** Chris starts the day's first Cursor session already oriented. Dashboard stays pinned for mid-session glances.

**Requirements revealed:** All 6 MVP panels, real-time Convex subscriptions, 3-min sync freshness, dark theme, single-page layout.

### Journey 2: Mid-Session Vault Search (Primary — Core Feature)

**Persona:** Chris, mid-afternoon. Working in Cursor on Epic 43. Needs to reference a research note from last week — title partially remembered.

**Opening scene:** Without the dashboard, Chris would run `vault_search` via MCP in Cursor or use Obsidian global search. Context switch out of current story.

**Rising action:** Chris alt-tabs to dashboard. Types fragment in vault search panel: `"daily rhythm auto"`. Convex returns 3 matches with title, path, tags, modified date.

**Climax:** Chris clicks the top result. Browser opens Obsidian via `obsidian://open?vault=Knowledge-Vault-ACTIVE&file=03-Resources/...`. Note loads in Obsidian. Chris alt-tabs back to Cursor with the reference open.

**Resolution:** Search-to-note in **4 seconds**. No MCP call from browser. No vault write.

**Requirements revealed:** Convex-indexed note metadata table (title, path, tags, modified date), full-text or prefix search, Obsidian URI deep links, click-to-open behavior.

### Journey 3: Incident Detection — Sync Failure (Primary — Edge Case)

**Persona:** Chris, evening. Hermes cron for `dashboard-sync.ts` failed twice in the last hour (Convex deploy key rotated, sync script not updated).

**Opening scene:** Dashboard panels show stale data — vault note count still reads 118 from 2 hours ago. Hermes activity feed shows no recent sync entries.

**Rising action:** Chris opens dashboard for routine check. Notices vault health numbers haven't changed despite known afternoon edits. Checks Hermes feed panel — last sync entry is 2 hours old. Watchdog cron still green (gateway alive, but sync script failing).

**Climax:** Chris identifies sync failure from dashboard **before** assuming vault is stale. Opens Cursor, checks Hermes cron logs, rotates Convex deploy key in sync script env, triggers manual sync run.

**Resolution:** Dashboard updates within 3 min of fix. Chris trusts the dashboard again because stale data was **detectable** — not silently wrong.

**Requirements revealed:** Sync timestamp visible in Hermes feed or vault health panel, stale-data detectability (last-sync indicator), sync failure logging to agent-log or Hermes cron output.

### Journey 4: First-Time Setup (Operator + Agent — Implementation)

**Persona:** Chris (or Amelia dev agent) implementing Epic 42. `cns-dashboard` repo doesn't exist. Convex and Vercel not provisioned.

**Opening scene:** Greenfield dashboard repo, brownfield CNS data sources. Hard constraint: only `scripts/dashboard-sync.ts` touches CNS repo.

**Rising action:**

1. Create `cns-dashboard` repo — SvelteKit scaffold, dark theme
2. Provision Convex project — define schema (vault health, MCP status, agent log entries, note metadata, run-chain state)
3. Deploy to Vercel — enable password protection
4. Add `scripts/dashboard-sync.ts` to CNS repo — reads vault FS, Hermes config, sprint-status.yaml, agent-log
5. Register Hermes cron — sync every 3 min
6. Verify: `npm test` + `verify.sh` still green in CNS repo

**Climax:** First successful sync push populates all 6 panels. Dashboard loads on Vercel with real data.

**Resolution:** Epic 42 acceptance checklist passes. Epic 44 can build on Convex schema without rework.

**Requirements revealed:** Convex schema design, sync script data contract, Hermes cron registration, Vercel deployment config, CNS repo isolation verification.

### Journey Requirements Summary

| Journey | Capabilities Required |
|---------|----------------------|
| Morning health check | 6 panels, Convex subscriptions, sync freshness, dark theme |
| Vault search | Note metadata index, search UI, Obsidian URI links |
| Sync failure recovery | Last-sync timestamp, stale-data visibility, cron failure logging |
| First-time setup | Repo scaffold, Convex schema, sync script, Hermes cron, Vercel deploy |

**User types covered:**

| Type | Journeys | MVP? |
|------|----------|------|
| CNS operator (primary) | 1, 2, 3 | Yes |
| Dev agent / operator (setup) | 4 | Yes (implementation) |
| External user | None | No — password protected |
| API consumer | None | N/A — no public API |

## Domain-Specific Requirements

### Compliance & Regulatory

- **No regulated-industry compliance** (healthcare, fintech, govtech) applies. Single-operator personal tooling.
- **Vault constitution alignment:** Dashboard must not violate CNS Phase 1 protected-path policy indirectly — sync script reads allowed paths only; never syncs `AI-Context/AGENTS.md` content to Convex if it contains operator secrets (sync metadata, not full constitution bodies, unless explicitly scoped).
- **Credential hygiene:** Sync script must not push API keys, tokens, or secret-pattern matches to Convex. Apply same secret-pattern scan philosophy as vault-io WriteGate before any Convex push.

### Technical Constraints

- **Read-only boundary (hard):** Sync script and dashboard perform zero vault mutations. No WriteGate bypass surface.
- **Data minimization:** Convex stores operational metadata (note counts, paths, titles, tags, lint summaries, agent-log entries) — not full note bodies unless explicitly required for search indexing. Prefer metadata-only index for vault search panel.
- **Sync credential isolation:** Convex deploy key lives in environment variables (Hermes cron env or `.env` excluded from git) — never hardcoded in `dashboard-sync.ts` or committed to either repo.
- **3-minute staleness bound:** Operator must understand dashboard data is eventually consistent, not live. Last-sync timestamp displayed prominently.
- **Obsidian URI contract:** Deep links use `obsidian://open?vault=Knowledge-Vault-ACTIVE&file={path}` — path must be vault-relative, URL-encoded, no traversal.

### Integration Requirements

| System | Integration | Direction |
|--------|-------------|-----------|
| Vault filesystem | Sync script reads note metadata, lint output, inbox depth | Read-only |
| `_meta/logs/agent-log.md` | Sync parses vault-io mutation log for Hermes feed + MCP timestamps | Read-only |
| Hermes config (`~/.hermes/`) | Sync reads gateway status, cron config, skill count | Read-only |
| `sprint-status.yaml` | Sync reads epic/story status for run-chain panel context | Read-only |
| Convex | Sync pushes aggregated state; dashboard subscribes | Write (Convex only) |
| Vercel | Hosts SvelteKit app; password protection at edge | Deploy target |
| Obsidian | Browser opens notes via URI scheme | Client-side deep link |

### Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Vault note bodies leaked to Convex cloud | Index metadata only; no full-body sync in MVP |
| Sync script writes to vault accidentally | Script uses read-only FS APIs; no `writeFile`, `rename`, or MCP calls |
| Stale dashboard misleads operator | Last-sync timestamp + stale indicator when sync > 6 min old |
| Convex deploy key exposed in git | Env var only; `.env` in `.gitignore`; Hermes cron injects at runtime |
| Browser calls vault-io MCP directly | Architecturally forbidden — dashboard reads Convex only |
| CNS repo scope creep | Hard constraint: only `scripts/dashboard-sync.ts`; verify.sh must stay green |
| MCP panel shows fake timestamps | vault-io real only; others show "configured / status unknown" — documented limitation |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Sync-boundary read-only bridge (primary)**

Most ops dashboards either call APIs live from the browser or require a heavy backend with write access. Epic 42 introduces a **scheduled sync script as the sole trust boundary** — one TypeScript file in the CNS repo reads filesystem state and pushes to Convex; the browser never touches vault, MCP, or Hermes directly.

This inverts the typical pattern: instead of giving the dashboard more power, it gives the dashboard **less** power and compensates with scheduled aggregation. Safety by architecture.

**2. Personal AI control plane visibility layer**

Combining Obsidian vault metadata + Hermes agent activity + MCP status + sprint state into one Convex-backed view is a novel composition for a single-operator AI orchestration stack. Not a product category — a **personal infrastructure pattern** that may be reusable for other vault-first agent setups.

**3. Honest partial telemetry (anti-innovation as feature)**

Deliberately showing "configured / status unknown" for 6 of 7 MCPs rather than fabricating timestamps is a product integrity choice. Reduces trust theater; sets up Epic 44 with clear data debt.

### Market Context & Competitive Landscape

| Alternative | Gap Epic 42 fills |
|-------------|-------------------|
| Grafana / Datadog | Generic metrics; no vault/Hermes/MCP semantics |
| Obsidian Bases | Vault-only; no agent activity or MCP state |
| Custom Discord bots | Activity feed, not structured health panels |
| Cursor/IDE dashboards | Session-local; not persistent ops surface |

No direct competitor for "personal AI orchestration situational awareness." Closest analog is internal SRE dashboards — but scoped to one operator's CNS stack.

### Validation Approach

| Innovation claim | Validation |
|------------------|------------|
| Sync boundary is sufficient (no browser MCP needed) | MVP acceptance: all 6 panels functional with zero browser-side vault/MCP calls |
| 3-min sync is fresh enough for ops | Operator journey test: morning health check completes in < 10s with acceptable staleness |
| Convex subscriptions replace live polling | Panel updates within 2s of sync push without manual refresh |
| Metadata-only index suffices for search | Search-to-Obsidian journey completes in < 5s on 118+ note vault |

**Fallback if sync boundary proves insufficient:** Add optional manual "refresh now" button that triggers Hermes cron ad-hoc — still no browser MCP calls.

### Risk Mitigation

| Innovation risk | Mitigation |
|-----------------|------------|
| Sync boundary adds latency (3 min) | Last-sync timestamp + stale indicator; operator knows data age |
| Convex cloud stores vault metadata | Metadata only; no full bodies; Vercel password protection |
| Pattern doesn't generalize beyond CNS | Document sync data contract in PRD for Epic 44 reuse |
| Over-engineering for single user | Hard MVP scope: 6 panels, one script, one repo — no feature creep |

## Web App Specific Requirements

### Project-Type Overview

CNS Dashboard is a **single-page application (SPA)** built with SvelteKit, deployed to Vercel, backed by Convex for real-time data. It is an internal operator tool — not a public-facing product. Desktop-first, dark theme, password-protected at the Vercel edge.

### Technical Architecture Considerations

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **SPA vs MPA** | SPA (SvelteKit) | Single-page dashboard with panel grid; no server-rendered pages needed beyond initial load |
| **Real-time** | Convex subscriptions | Panels update within 2s of sync push; no polling, no WebSocket custom infra |
| **Backend** | Convex (schema + functions in code) | Agent-friendly; backend state co-located with frontend in `cns-dashboard` repo |
| **Auth** | Vercel password protection | No app-level auth code; sufficient for single-operator internal tool |
| **Data source** | Convex only (browser) | Sync script pushes; dashboard never calls vault/MCP/Hermes directly |

### Browser Matrix

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome / Chromium | Primary | Operator daily driver on WSL + Windows |
| Firefox | Supported | Secondary |
| Safari | Best-effort | Not primary target |
| Mobile browsers | Out of MVP scope | Desktop-first; mobile-responsive deferred to post-MVP |

**Minimum:** ES2022+ features; no IE support.

### Responsive Design

- **MVP:** Desktop-first layout — optimized for 1280px+ viewport (pinned tab use case)
- **Panel grid:** 2–3 column layout on desktop; single column acceptable on narrower windows
- **Mobile:** Not MVP — no dedicated mobile layout required for Epic 42 acceptance

### Performance Targets

See **Non-Functional Requirements → Performance** (NFR-P1 through NFR-P6) for measurable targets.

### SEO Strategy

**Not applicable.** Dashboard is password-protected on Vercel — no public indexing, no meta tags, no sitemap. `robots: noindex` acceptable but not required (Vercel auth gate prevents crawl).

### Accessibility Level

- **MVP baseline:** Semantic HTML, sufficient color contrast for dark theme (WCAG AA target for text/background)
- **Keyboard navigation:** Vault search input and result links keyboard-accessible
- **Screen reader:** Best-effort — not a compliance requirement for single-operator internal tool
- **No formal WCAG audit** required for Epic 42 acceptance

### Implementation Considerations

- **SvelteKit project structure:** `cns-dashboard/` repo with `src/routes/` for panel pages or single dashboard route with panel components
- **Convex schema:** Define tables for vault health, MCP status, agent log entries, note metadata, run-chain state, sync metadata (last-sync timestamp)
- **Dark theme:** CSS custom properties or Tailwind dark mode — locked decision, not negotiable
- **Obsidian URI links:** `<a href="obsidian://open?vault=Knowledge-Vault-ACTIVE&file={encodedPath}">` — browser handles protocol dispatch
- **Environment variables:** `CONVEX_URL`, `CONVEX_DEPLOY_KEY` (sync script only); no secrets in frontend bundle
- **Local dev:** `npm run dev` (SvelteKit) + `npx convex dev` (Convex) — standard stack dev workflow
- **Production deploy:** Vercel auto-deploy from `cns-dashboard` repo main branch; Convex cloud backend

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — ship the smallest surface that replaces the 4-surface morning health check with one dashboard tab. Validation = operator uses it daily within 2 weeks.

**Resource Requirements:** Single dev agent session (Amelia) + operator provisioning (Convex, Vercel, Hermes cron). No dedicated team. Estimated: 3–5 stories across sync script, Convex schema, dashboard UI, deploy.

**MVP philosophy:** The sync script + Convex schema are the foundation. UI panels are the proof. Trend stub is a placeholder, not work.

### MVP Feature Set (Phase 1 — Epic 42)

**Core user journeys supported:**
- Journey 1: Morning health check
- Journey 2: Mid-session vault search
- Journey 3: Sync failure detection
- Journey 4: First-time setup

**Must-have capabilities:**

| # | Capability | Without it, product fails? |
|---|------------|---------------------------|
| 1 | `scripts/dashboard-sync.ts` (CNS repo) | Yes — no data pipeline |
| 2 | Convex schema + push mutations | Yes — no backend |
| 3 | Hermes cron (3 min) | Yes — no fresh data |
| 4 | Vault health panel | Yes — primary ops question |
| 5 | Hermes activity feed panel | Yes — agent visibility |
| 6 | MCP status panel (vault-io real; others unknown) | Yes — MCP visibility |
| 7 | Run-chain status panel | Yes — run-chain state is key ops signal |
| 8 | Vault search panel + Obsidian URI | Yes — core workflow journey |
| 9 | Trend intelligence stub | No — but explicitly in scope as Epic 44 placeholder |
| 10 | Last-sync timestamp / stale indicator | Yes — trust in eventual consistency |
| 11 | Vercel deploy + password protection | Yes — production access |
| 12 | Dark theme | Yes — locked decision |

**Explicitly excluded from MVP:**
- Mobile layout, alerting, historical charts, multi-user auth, browser MCP calls, vault writes, non-vault-io MCP timestamps, changes to CNS repo beyond sync script

### Post-MVP Features

**Phase 2 (Growth — post Epic 42):**
- Accurate MCP telemetry for all 7 MCPs (Epic 44 dependency)
- Mobile-responsive layout
- Push notifications / Discord alerts on vault error spike or Hermes failure
- Historical trend charts (note count, lint rate over time)
- Manual "refresh now" button (triggers Hermes cron ad-hoc)

**Phase 3 (Expansion — Epic 44+):**
- Live trend intelligence (replace stub with real analytics)
- Morning standup auto-summary to Discord
- Correlation views (lint spike ↔ agent activity)
- CNS-Daily-Rhythm.md live panel
- Optional read-only sharing for collaborators

### Risk Mitigation Strategy

**Technical risks:**

| Risk | Mitigation |
|------|-----------|
| Convex not yet installed — learning curve | Context7 docs lookup before implementation; standard SvelteKit + Convex starter |
| Sync script reads vault FS correctly | Unit tests on fixture paths; manual verify against live vault |
| CNS repo regression | `verify.sh` must pass; only one file added |
| 3-min staleness unacceptable | Last-sync indicator; Phase 2 manual refresh if needed |

**Market risks:** N/A — single-operator internal tool, no market validation needed.

**Resource risks:**

| Risk | Mitigation |
|------|-----------|
| Scope creep into CNS repo | Hard constraint documented in PRD; code review checks diff |
| Epic 44 blocked by bad schema | Document Convex data contract in this PRD for downstream reuse |
| Provisioning delays (Convex/Vercel) | Local dev works without production deploy; Vercel deploy is acceptance gate, not dev blocker |

## Convex Sync Data Contract

Data contract between `scripts/dashboard-sync.ts` (CNS repo) and `cns-dashboard` Convex schema. Epic 44 trend intelligence builds on this schema — do not break backward compatibility without migration plan.

### Sync Sources (Read-Only)

| Source | Path | Data Extracted |
|--------|------|----------------|
| Vault filesystem | `CNS_VAULT_ROOT` | Note count, inbox depth, PAKE type distribution, note metadata (title, path, tags, modified) |
| Vault lint | Lint script output or equivalent | ERRORS count, WARNINGS count |
| Agent audit log | `_meta/logs/agent-log.md` | Last 20 entries, vault-io last-call timestamp |
| Hermes config | `~/.hermes/` | Gateway status, watchdog cron status, skill count |
| Sprint status | `sprint-status.yaml` | Run-chain state, last run timestamp, last synthesis title |
| MCP registry | Hermes/Cursor config | 7 MCP names and configured status |

### Convex Tables (Minimum MVP Schema)

| Table | Key Fields | Panel |
|-------|-----------|-------|
| `vaultHealth` | noteCount, lintErrors, lintWarnings, inboxDepth, pakeDistribution, syncedAt | Vault health |
| `mcpStatus` | name, status, lastCallAt (nullable), badge | MCP status |
| `agentLogEntries` | timestamp, action, tool, surface, targetPath, summary | Hermes feed |
| `runChainStatus` | state, lastRunAt, lastSynthesisTitle | Run-chain |
| `noteIndex` | title, path, tags, modifiedAt | Vault search |
| `syncMetadata` | lastSyncAt, lastSyncStatus, lastSyncError | All panels (freshness) |

### Push Semantics

- Sync script upserts all tables on each successful run
- `syncMetadata.lastSyncAt` updated on every attempt (success or failure)
- Stale indicator triggers when `now - lastSyncAt > 6 minutes`
- No full note bodies in `noteIndex` — metadata only

## Functional Requirements

### Dashboard Access & Layout

- **FR1:** Operator can access the dashboard via a web browser at a deployed URL protected by password authentication.
- **FR2:** Operator can view all six MVP panels on a single dashboard page without navigating between separate apps.
- **FR3:** Operator can view the dashboard in a dark theme optimized for extended monitoring use.
- **FR4:** Operator can view dashboard content on a desktop viewport without horizontal scrolling at 1280px width.

### Vault Health Visibility

- **FR5:** Operator can view the current total note count in the vault.
- **FR6:** Operator can view the current vault lint error count (ERRORS).
- **FR7:** Operator can view the current vault lint warning count (WARNINGS).
- **FR8:** Operator can view the current inbox depth (number of unprocessed items in the inbox area).
- **FR9:** Operator can view PAKE note type distribution across the vault (aggregated counts by type).

### MCP Status Visibility

- **FR10:** Operator can view a status list of all seven configured MCPs (vault-io, notebooklm, context7, firecrawl, perplexity, playwright, discord).
- **FR11:** Operator can view the last-call timestamp for vault-io MCP derived from the vault audit log.
- **FR12:** Operator can view non-vault-io MCPs as "configured / status unknown" when no per-call log source exists.
- **FR13:** Operator can view a visual status badge per MCP entry (e.g., active/stale/unknown).

### Hermes Activity Visibility

- **FR14:** Operator can view the last 20 agent-log entries from the vault audit log in chronological order.
- **FR15:** Operator can view Hermes watchdog cron status (last run time, success/failure indication).
- **FR16:** Operator can view sufficient entry detail to identify action type, target path, and timestamp for each agent-log entry.

### Run-Chain Status Visibility

- **FR17:** Operator can view the current run-chain state (dormant, running, or error).
- **FR18:** Operator can view the last run-chain execution timestamp when available.
- **FR19:** Operator can view the title of the last run-chain synthesis output when available.

### Vault Search & Navigation

- **FR20:** Operator can search vault notes by metadata (title, path, tags) from the dashboard.
- **FR21:** Operator can view search results showing note title, vault-relative path, tags, and modified date.
- **FR22:** Operator can open a search result directly in Obsidian via a deep link using the vault URI scheme.
- **FR23:** Operator can perform vault search without triggering live vault MCP calls from the browser.

### Data Sync & Freshness

- **FR24:** System can aggregate vault health, MCP status, agent activity, run-chain state, and note metadata from local CNS sources on a scheduled interval.
- **FR25:** System can push aggregated dashboard state to a remote data store accessible by the dashboard.
- **FR26:** Operator can view the timestamp of the last successful data sync.
- **FR27:** Operator can view a stale-data indicator when sync data exceeds the expected freshness window.
- **FR28:** Dashboard can receive updated panel data without manual page refresh.
- **FR29:** Sync process can read vault filesystem, Hermes configuration, sprint status, and agent audit log as read-only sources.
- **FR30:** Sync process can run on a 3-minute schedule via Hermes cron.

### Trend Intelligence (Stub)

- **FR31:** Operator can view a trend intelligence panel displaying placeholder/mock data.
- **FR32:** Operator can see an explicit "Coming in Epic 44" indicator on the trend intelligence panel.

### System Safety & Boundaries

- **FR33:** Dashboard performs no vault writes during any operator interaction.
- **FR34:** Dashboard makes no live MCP tool calls from the browser.
- **FR35:** Sync process performs no vault mutations during data aggregation.
- **FR36:** Sync process excludes credential and secret-pattern content from data pushed to the remote store.
- **FR37:** CNS repository changes are limited to addition of the dashboard sync script only.

## Non-Functional Requirements

### Performance

- **NFR-P1:** Dashboard first contentful paint completes within **3 seconds** on Vercel production (desktop, warm cache).
- **NFR-P2:** All six panels render populated content within **3 seconds** of initial page load when Convex data exists.
- **NFR-P3:** Dashboard panel updates propagate to the operator within **2 seconds** of a successful sync push (via real-time subscriptions).
- **NFR-P4:** Vault search queries return results within **500ms p95** against the Convex-indexed note metadata table.
- **NFR-P5:** Sync script completes a full aggregation and push cycle within **60 seconds** on the operator's WSL environment with a 118+ note vault.
- **NFR-P6:** Operator can answer "is CNS healthy?" within **10 seconds** of opening the dashboard (time-to-awareness).

### Security

- **NFR-S1:** Dashboard production URL is protected by Vercel password authentication — unauthenticated requests receive no dashboard content.
- **NFR-S2:** No API keys, tokens, or credential-pattern matches are stored in or transmitted to the Convex data store by the sync process.
- **NFR-S3:** Convex deploy credentials are stored in environment variables only — never committed to either repository.
- **NFR-S4:** Sync process reads vault sources read-only — zero filesystem writes, renames, or deletions during aggregation.
- **NFR-S5:** Dashboard frontend bundle contains no vault paths, MCP credentials, or Hermes configuration secrets.
- **NFR-S6:** Convex stores note metadata only (title, path, tags, modified date) — not full note bodies — in MVP.

### Reliability

- **NFR-R1:** Sync cron completes successfully on **≥ 95%** of scheduled 3-minute runs over a 7-day observation window.
- **NFR-R2:** Sync failures produce a log entry visible to the operator (Hermes cron output or agent-log append) without crashing the cron scheduler.
- **NFR-R3:** Dashboard remains functional with last-known Convex data when sync is temporarily unavailable — panels show stale indicator rather than empty/error state.
- **NFR-R4:** CNS repository test suite (`npm test`) and verification gate (`bash scripts/verify.sh`) pass with zero regressions after adding the sync script.

### Accessibility

- **NFR-A1:** Dark theme maintains **WCAG AA** contrast ratio (4.5:1) for body text against background colors.
- **NFR-A2:** Vault search input and search result links are operable via keyboard (Tab navigation, Enter to activate).
- **NFR-A3:** Status badges use both color and text/icon indicators — not color alone — to convey MCP and run-chain state.

### Integration

- **NFR-I1:** Obsidian deep links use the URI scheme `obsidian://open?vault=Knowledge-Vault-ACTIVE&file={path}` with URL-encoded vault-relative paths.
- **NFR-I2:** Sync process reads from four defined source paths: vault filesystem (`CNS_VAULT_ROOT`), Hermes config (`~/.hermes/`), sprint status (`sprint-status.yaml`), and agent audit log (`_meta/logs/agent-log.md`).
- **NFR-I3:** Sync schedule is registered in Hermes cron and executes every **3 minutes** without manual intervention after initial setup.
- **NFR-I4:** Dashboard connects exclusively to Convex for data — no direct integration with vault-io MCP, Hermes gateway, or vault filesystem from the browser.

## Requirement Traceability

| Journey | Success Criteria | Functional Requirements |
|---------|-----------------|------------------------|
| Morning health check | Time-to-awareness, surface consolidation | FR1–FR4, FR5–FR9, FR10–FR16, FR17–FR19, FR26–FR28 |
| Vault search | Search-to-note | FR20–FR23 |
| Sync failure detection | Sync reliability, incident detection | FR26–FR27, FR30; NFR-R1–R3 |
| First-time setup | Epic 42 completion gate, CNS repo isolation | FR24–FR25, FR29–FR30, FR37; NFR-R4 |
| Read-only safety (all journeys) | Trust in read-only boundary | FR33–FR36; NFR-S1–S6 |
| Trend stub (placeholder) | Epic 44 gate | FR31–FR32 |
