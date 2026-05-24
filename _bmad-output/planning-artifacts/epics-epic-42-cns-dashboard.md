---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: ready-for-development
completedAt: "2026-05-24"
inputDocuments:
  - _bmad-output/planning-artifacts/prd-epic-42-cns-dashboard.md
  - _bmad-output/planning-artifacts/architecture-epic-42-cns-dashboard.md
epicScope: epic-42
outputRepo: cns-dashboard
cnsRepoTouch: scripts/dashboard-sync.ts only
---

# CNS Dashboard (Epic 42) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **CNS Dashboard (Epic 42)**, decomposing the requirements from the PRD, embedded UX/accessibility specifications, and Architecture requirements into implementable stories.

**Repositories:** Greenfield `cns-dashboard` (SvelteKit + Convex + Vercel); CNS repo touch limited to `scripts/dashboard-sync.ts` only.

## Requirements Inventory

### Functional Requirements

```
FR1: Operator can access the dashboard via a web browser at a deployed URL protected by password authentication.
FR2: Operator can view all six MVP panels on a single dashboard page without navigating between separate apps.
FR3: Operator can view the dashboard in a dark theme optimized for extended monitoring use.
FR4: Operator can view dashboard content on a desktop viewport without horizontal scrolling at 1280px width.
FR5: Operator can view the current total note count in the vault.
FR6: Operator can view the current vault lint error count (ERRORS).
FR7: Operator can view the current vault lint warning count (WARNINGS).
FR8: Operator can view the current inbox depth (number of unprocessed items in the inbox area).
FR9: Operator can view PAKE note type distribution across the vault (aggregated counts by type).
FR10: Operator can view a status list of all seven configured MCPs (vault-io, notebooklm, context7, firecrawl, perplexity, playwright, discord).
FR11: Operator can view the last-call timestamp for vault-io MCP derived from the vault audit log.
FR12: Operator can view non-vault-io MCPs as "configured / status unknown" when no per-call log source exists.
FR13: Operator can view a visual status badge per MCP entry (e.g., active/stale/unknown).
FR14: Operator can view the last 20 agent-log entries from the vault audit log in chronological order.
FR15: Operator can view Hermes watchdog cron status (last run time, success/failure indication).
FR16: Operator can view sufficient entry detail to identify action type, target path, and timestamp for each agent-log entry.
FR17: Operator can view the current run-chain state (dormant, running, or error).
FR18: Operator can view the last run-chain execution timestamp when available.
FR19: Operator can view the title of the last run-chain synthesis output when available.
FR20: Operator can search vault notes by metadata (title, path, tags) from the dashboard.
FR21: Operator can view search results showing note title, vault-relative path, tags, and modified date.
FR22: Operator can open a search result directly in Obsidian via a deep link using the vault URI scheme.
FR23: Operator can perform vault search without triggering live vault MCP calls from the browser.
FR24: System can aggregate vault health, MCP status, agent activity, run-chain state, and note metadata from local CNS sources on a scheduled interval.
FR25: System can push aggregated dashboard state to a remote data store accessible by the dashboard.
FR26: Operator can view the timestamp of the last successful data sync.
FR27: Operator can view a stale-data indicator when sync data exceeds the expected freshness window.
FR28: Dashboard can receive updated panel data without manual page refresh.
FR29: Sync process can read vault filesystem, Hermes configuration, sprint status, and agent audit log as read-only sources.
FR30: Sync process can run on a 3-minute schedule via Hermes cron.
FR31: Operator can view a trend intelligence panel displaying placeholder/mock data.
FR32: Operator can see an explicit "Coming in Epic 44" indicator on the trend intelligence panel.
FR33: Dashboard performs no vault writes during any operator interaction.
FR34: Dashboard makes no live MCP tool calls from the browser.
FR35: Sync process performs no vault mutations during data aggregation.
FR36: Sync process excludes credential and secret-pattern content from data pushed to the remote store.
FR37: CNS repository changes are limited to addition of the dashboard sync script only.
```

### NonFunctional Requirements

```
NFR-P1: Dashboard first contentful paint completes within 3 seconds on Vercel production (desktop, warm cache).
NFR-P2: All six panels render populated content within 3 seconds of initial page load when Convex data exists.
NFR-P3: Dashboard panel updates propagate to the operator within 2 seconds of a successful sync push (via real-time subscriptions).
NFR-P4: Vault search queries return results within 500ms p95 against the Convex-indexed note metadata table.
NFR-P5: Sync script completes a full aggregation and push cycle within 60 seconds on the operator's WSL environment with a 118+ note vault.
NFR-P6: Operator can answer "is CNS healthy?" within 10 seconds of opening the dashboard (time-to-awareness).
NFR-S1: Dashboard production URL is protected by Vercel password authentication — unauthenticated requests receive no dashboard content.
NFR-S2: No API keys, tokens, or credential-pattern matches are stored in or transmitted to the Convex data store by the sync process.
NFR-S3: Convex deploy credentials are stored in environment variables only — never committed to either repository.
NFR-S4: Sync process reads vault sources read-only — zero filesystem writes, renames, or deletions during aggregation.
NFR-S5: Dashboard frontend bundle contains no vault paths, MCP credentials, or Hermes configuration secrets.
NFR-S6: Convex stores note metadata only (title, path, tags, modified date) — not full note bodies — in MVP.
NFR-R1: Sync cron completes successfully on ≥ 95% of scheduled 3-minute runs over a 7-day observation window.
NFR-R2: Sync failures produce a log entry visible to the operator (Hermes cron output or agent-log append) without crashing the cron scheduler.
NFR-R3: Dashboard remains functional with last-known Convex data when sync is temporarily unavailable — panels show stale indicator rather than empty/error state.
NFR-R4: CNS repository test suite (npm test) and verification gate (bash scripts/verify.sh) pass with zero regressions after adding the sync script.
NFR-A1: Dark theme maintains WCAG AA contrast ratio (4.5:1) for body text against background colors.
NFR-A2: Vault search input and search result links are operable via keyboard (Tab navigation, Enter to activate).
NFR-A3: Status badges use both color and text/icon indicators — not color alone — to convey MCP and run-chain state.
NFR-I1: Obsidian deep links use the URI scheme obsidian://open?vault=Knowledge-Vault-ACTIVE&file={path} with URL-encoded vault-relative paths.
NFR-I2: Sync process reads from four defined source paths: vault filesystem (CNS_VAULT_ROOT), Hermes config (~/.hermes/), sprint status (sprint-status.yaml), and agent audit log (_meta/logs/agent-log.md).
NFR-I3: Sync schedule is registered in Hermes cron and executes every 3 minutes without manual intervention after initial setup.
NFR-I4: Dashboard connects exclusively to Convex for data — no direct integration with vault-io MCP, Hermes gateway, or vault filesystem from the browser.
```

### Additional Requirements

```
- **Starter template (Epic 42 Story 1 — cns-dashboard repo):** `npx sv@latest create cns-dashboard` (TypeScript, Tailwind dark mode); `@sveltejs/adapter-vercel`; `convex` + `convex-svelte`; `npx convex dev`; `setupConvex(PUBLIC_CONVEX_URL)` in `+layout.svelte`.
- **CNS repo Story 1 (paired):** `scripts/dashboard-sync.ts` only — run via `npx tsx scripts/dashboard-sync.ts`; env: `CNS_VAULT_ROOT`, `CONVEX_URL`, `CONVEX_DEPLOY_KEY`; no new package.json dependencies in Omnipotent.md (Convex HTTP mutation via Node 20+ fetch).
- **Dual-repository boundary:** CNS changes limited to `scripts/dashboard-sync.ts`; never modify package.json, tsconfig, verify.sh, AGENTS.md, vault-io src/, or other scripts.
- **Convex schema (MVP tables):** `vaultHealth`, `mcpStatus` (7 rows by name), `agentLogEntries` (last 20), `runChainStatus`, `noteIndex`, `syncMetadata` — singleton docs use id `"current"` where applicable; `noteIndex` keyed by `path`.
- **Sync transport:** Single `ingestDashboardSnapshot` mutation via `ConvexHttpClient` / HTTP API + deploy key; full replace per sync (not event sourcing).
- **Browser queries:** `getDashboardSnapshot`, `searchNotes` (debounced 300ms, cap 50 results, `modifiedAt` desc); one `useQuery(getDashboardSnapshot)` for panels — no polling.
- **Vault lint source (C3):** Parse newest `_meta/reports/vault-lint-YYYY-MM-DD.md`; set `lintStale` if missing or >7 days old; do not invoke /vault-lint during sync.
- **Agent-log parser (C4):** Pipe format `[ISO8601 UTC] | action | tool | surface | target_path | payload_summary`; tolerant parse failures; vault-io `lastCallAt` = max timestamp where tool is vault-io tool.
- **Note index scope (I7):** `01-Projects/`, `02-Areas/`, `03-Resources/` only; vault-relative POSIX paths in Convex; URL-encode only in Obsidian href.
- **MCP registry (I3):** Static list of 7 names in sync script; non-vault-io: status `"configured"` / `"unknown"` — never fabricate `lastCallAt`.
- **Pre-push secret guard (I5):** Load `config/secret-patterns.json`; abort push on match (aligned with WriteGate philosophy).
- **Stale UX:** Global `StaleBanner` when `now - lastSyncAt > 6 min` OR `lastSyncStatus !== "ok"`; show last-known data (NFR-R3), not empty panels.
- **Hermes cron:** `*/3 * * * *` → `npx tsx scripts/dashboard-sync.ts`; failures update `syncMetadata.lastSyncError`, stderr + non-zero exit.
- **Run-chain:** Read `_bmad-output/implementation-artifacts/sprint-status.yaml`; best-effort synthesis metadata from `_bmad-output` artifacts.
- **Provisioning:** Convex + Vercel + `cns-dashboard` repo not yet created — local dev (`convex dev` + `npm run dev`) before production gate.
- **Phase 1 orthogonality:** Does not extend Vault IO MCP, WriteGate, or `architecture.md`; consumes FS, agent-log, lint reports only.
- **Schema stability:** Convex contract backward-compatible for Epic 44 trend intelligence — no breaking changes without migration plan.
- **WSL paths:** Sync reads `/mnt/c/...` vault; Convex stores vault-relative paths for Obsidian URIs.
- **CI split:** CNS enforced by `verify.sh`; `cns-dashboard` separate CI (`.github/workflows/ci.yml`).
- **Context7 required:** SvelteKit, Convex, adapter-vercel docs before implementation (project rule).
```

### UX Design Requirements

_No separate UX Design.md — requirements extracted from PRD § Web App Specific Requirements, § Accessibility, journeys, and architecture § Frontend Architecture._

```
UX-DR1: Single-route dashboard shell (`+page.svelte`) with CSS grid layout — 2–3 columns at viewport ≥1280px; single column acceptable on narrower desktop windows; no horizontal scroll at 1280px (FR4).
UX-DR2: Dark theme as default via Tailwind `class="dark"` on `<html>` or CSS custom properties — locked product decision, not optional light mode (FR3).
UX-DR3: Six panel components under `src/lib/components/panels/`: VaultHealthPanel, McpStatusPanel, HermesFeedPanel, RunChainPanel, VaultSearchPanel, TrendStubPanel — all visible on one page without route changes (FR2).
UX-DR4: DashboardShell layout component wrapping panel grid and global chrome (title, last-sync display per FR26).
UX-DR5: StaleBanner component — prominent global banner when sync stale or errored; must not hide last-known panel data (FR27, NFR-R3).
UX-DR6: VaultSearchPanel — search input with 300ms debounce; results list showing title, path, tags, modified date; each result links via `obsidian-uri.ts` helper (FR20–FR22, NFR-I1).
UX-DR7: McpStatusPanel — seven rows with dual-encoded badges (color + text/icon) for active/stale/unknown/configured (FR13, NFR-A3); vault-io shows real timestamp; others show "configured / status unknown" copy (FR12).
UX-DR8: TrendStubPanel — static placeholder content with visible "Coming in Epic 44" badge; no live backend beyond optional placeholder row (FR31–FR32).
UX-DR9: HermesFeedPanel — chronological list of last 20 agent-log entries with action, tool, surface, target path, timestamp, summary (FR14–FR16).
UX-DR10: VaultHealthPanel — note count, lint ERRORS/WARNINGS, inbox depth, PAKE distribution visualization; indicate lintStale when lint report aged (FR5–FR9, arch C3).
UX-DR11: RunChainPanel — state dormant/running/error/unknown with last run time and synthesis title or em-dash when missing (FR17–FR19).
UX-DR12: Keyboard-accessible vault search — Tab to input, Tab through results, Enter activates Obsidian link (NFR-A2).
UX-DR13: WCAG AA contrast (4.5:1) for body text on dark backgrounds — semantic HTML structure (NFR-A1).
UX-DR14: Real-time panel updates via `convex-svelte` `useQuery` — no manual refresh control in MVP (FR28).
UX-DR15: Browser matrix: Chrome/Chromium primary; Firefox supported; Safari best-effort; mobile browsers out of MVP scope.
```

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | 2 | Password-protected web access |
| FR2 | 2 | Six panels on one page |
| FR3 | 2 | Dark theme |
| FR4 | 2 | 1280px desktop layout |
| FR5 | 3 | Note count |
| FR6 | 3 | Lint ERRORS |
| FR7 | 3 | Lint WARNINGS |
| FR8 | 3 | Inbox depth |
| FR9 | 3 | PAKE distribution |
| FR10 | 3 | Seven MCP list |
| FR11 | 3 | vault-io last-call |
| FR12 | 3 | Other MCPs configured/unknown |
| FR13 | 3 | MCP status badges |
| FR14 | 3 | Last 20 agent-log entries |
| FR15 | 3 | Watchdog cron status |
| FR16 | 3 | Agent-log entry detail |
| FR17 | 3 | Run-chain state |
| FR18 | 3 | Last run-chain timestamp |
| FR19 | 3 | Last synthesis title |
| FR20 | 4 | Metadata search |
| FR21 | 4 | Search result fields |
| FR22 | 4 | Obsidian deep link |
| FR23 | 4 | No browser MCP for search |
| FR24 | 1 | Scheduled aggregation |
| FR25 | 1 | Push to Convex |
| FR26 | 2 | Last sync timestamp |
| FR27 | 2 | Stale indicator |
| FR28 | 2 | Real-time panel updates |
| FR29 | 1 | Read-only source reads |
| FR30 | 1 | Hermes 3-min cron |
| FR31 | 2 | Trend stub panel |
| FR32 | 2 | Epic 44 placeholder badge |
| FR33 | 2 | No dashboard vault writes |
| FR34 | 2 | No browser MCP calls |
| FR35 | 1 | No sync vault mutations |
| FR36 | 1 | Secret exclusion on push |
| FR37 | 1 | CNS sync script only |

## Epic List

### Epic 1: Read-Only CNS Data Bridge
CNS state flows from vault, Hermes, sprint status, and agent-log into Convex on a 3-minute cadence — read-only, secret-safe, with CNS repo limited to `scripts/dashboard-sync.ts`.

**FRs covered:** FR24, FR25, FR29, FR30, FR35, FR36, FR37

### Epic 2: Operator Dashboard Access & Trust Chrome
Operator opens a password-protected, dark, single-page dashboard with sync freshness, stale visibility, live updates, and trend placeholder — before or alongside ops panels.

**FRs covered:** FR1, FR2, FR3, FR4, FR26, FR27, FR28, FR31, FR32, FR33, FR34

### Epic 3: Operational Visibility Panels
Operator answers vault health, MCP status, Hermes activity, and run-chain state without Cursor, Discord, or Obsidian.

**FRs covered:** FR5–FR19

### Epic 4: Vault Search & Obsidian Handoff
Operator finds notes by metadata and opens them in Obsidian in seconds — no browser MCP calls.

**FRs covered:** FR20–FR23

**Dependency chain:** Epic 1 → Epic 2 → (Epic 3 ∥ Epic 4)

---

## Epic 1: Read-Only CNS Data Bridge

CNS state flows from vault, Hermes, sprint status, and agent-log into Convex on a 3-minute cadence — read-only, secret-safe, with CNS repo limited to `scripts/dashboard-sync.ts`.

### Story 1.1: Scaffold cns-dashboard repository

As a **developer**,
I want **a greenfield `cns-dashboard` repo with SvelteKit, Convex, Tailwind dark mode, and Vercel adapter**,
So that **the dashboard frontend and Convex backend have a standard foundation before sync and panels**.

**Acceptance Criteria:**

**Given** no `cns-dashboard` repo exists
**When** the operator runs `npx sv@latest create cns-dashboard` with TypeScript and Tailwind, installs `convex`, `convex-svelte`, and `@sveltejs/adapter-vercel`, and runs `npx convex dev`
**Then** the project builds locally with `npm run dev` and Convex dev connects
**And** `setupConvex(PUBLIC_CONVEX_URL)` is wired in `src/routes/+layout.svelte` per architecture; dark mode is default on `<html>` (UX-DR2 partial; architecture starter template).

### Story 1.2: Convex schema and ingest mutation

As a **developer**,
I want **Convex tables and `ingestDashboardSnapshot` mutation with `getDashboardSnapshot` query**,
So that **the sync script and browser share one validated data contract**.

**Acceptance Criteria:**

**Given** the `cns-dashboard` Convex project is initialized
**When** `convex/schema.ts` defines `vaultHealth`, `mcpStatus`, `agentLogEntries`, `runChainStatus`, `noteIndex`, and `syncMetadata` per PRD data contract
**Then** `ingestDashboardSnapshot` accepts a `DashboardSnapshot` payload with `camelCase` fields and atomically replaces table contents (singleton `id: "current"` where applicable; `noteIndex` keyed by `path`; exactly 7 `mcpStatus` rows by `name`)
**And** `getDashboardSnapshot` returns all panel data for the shell; validators use `convex/values` (FR25 partial; additional requirements — schema stability for Epic 44).

### Story 1.3: CNS dashboard-sync.ts collectors

As an **operator**,
I want **`scripts/dashboard-sync.ts` in the CNS repo to read all local sources and build a snapshot**,
So that **vault and agent state can be pushed to Convex without new npm dependencies in Omnipotent.md**.

**Acceptance Criteria:**

**Given** env vars `CNS_VAULT_ROOT`, `CONVEX_URL`, and `CONVEX_DEPLOY_KEY` are set
**When** `npx tsx scripts/dashboard-sync.ts` runs
**Then** it read-only collects: vault note metadata from `01-Projects/`, `02-Areas/`, `03-Resources/`; inbox depth; PAKE distribution; newest `_meta/reports/vault-lint-YYYY-MM-DD.md` (ERRORS/WARNINGS, `lintStale` if missing or >7 days); last 20 `agent-log.md` lines (AuditLogger pipe format); vault-io `lastCallAt` as max timestamp for vault-io tools; 7 MCP rows (non-vault-io without fabricated `lastCallAt`); Hermes config from `~/.hermes/`; run-chain from `sprint-status.yaml`
**And** the script uses no `fs.writeFile`, `rename`, or vault mutations; it is the **only** new file in the CNS repo diff (FR24, FR29, FR35, FR37; FR11–FR12, FR14–FR19 data collection).

### Story 1.4: Sync push, secret guard, and Hermes cron

As an **operator**,
I want **successful snapshot pushes to Convex on a 3-minute Hermes cron with secret scanning and visible failures**,
So that **dashboard data stays fresh and unsafe payloads never reach Convex**.

**Acceptance Criteria:**

**Given** `dashboard-sync.ts` assembles a `DashboardSnapshot`
**When** content matches `config/secret-patterns.json`
**Then** the push aborts with non-zero exit and no mutation call (FR36, NFR-S2)
**When** the snapshot is clean
**Then** the script calls `ingestDashboardSnapshot` via Convex HTTP API + deploy key (no `npm install convex` in CNS repo) and updates `syncMetadata` (`lastSyncAt`, `lastSyncStatus`, `lastSyncError` on failure)
**And** Hermes cron runs `*/3 * * * *` → `npx tsx scripts/dashboard-sync.ts`; failures log to stderr/cron output without crashing the scheduler; `bash scripts/verify.sh` passes in CNS repo after adding the script (FR25, FR30, NFR-R1, NFR-R2, NFR-R4, NFR-I3; NFR-P5 ≤60s on 118+ note vault).

---

## Epic 2: Operator Dashboard Access & Trust Chrome

Operator opens a password-protected, dark, single-page dashboard with sync freshness, stale visibility, live updates, and trend placeholder.

### Story 2.1: Dashboard shell and panel grid

As a **CNS operator**,
I want **a single-page dashboard with dark theme and six panel slots on a desktop grid**,
So that **I have one situational-awareness surface without navigating between apps**.

**Acceptance Criteria:**

**Given** Convex has been seeded by at least one successful sync
**When** I open the dashboard at local or deployed URL
**Then** I see `DashboardShell` with a 2–3 column CSS grid at ≥1280px width without horizontal scroll (FR2, FR4; UX-DR1, UX-DR3)
**And** dark theme is active by default (FR3, UX-DR2, NFR-A1 semantic structure); six placeholder panel components mount in the grid; browser code contains zero references to `CNS_VAULT_ROOT`, vault paths, or MCP endpoints (FR34, NFR-S5, NFR-I4).

### Story 2.2: Sync freshness chrome and StaleBanner

As a **CNS operator**,
I want **to see when data was last synced and when it is stale**,
So that **I trust eventual consistency and detect sync failures early**.

**Acceptance Criteria:**

**Given** `syncMetadata` exists in Convex
**When** I view the dashboard
**Then** I see the last successful sync timestamp (FR26; UX-DR4)
**When** `now - lastSyncAt > 6 minutes` or `lastSyncStatus !== "ok"`
**Then** `StaleBanner` displays prominently while panels still show last-known data (FR27, NFR-R3; UX-DR5)
**And** stale/error states use text labels in addition to color (NFR-A3 partial).

### Story 2.3: Real-time panel updates via Convex subscriptions

As a **CNS operator**,
I want **panels to update automatically after each sync push**,
So that **I never manually refresh during routine monitoring**.

**Acceptance Criteria:**

**Given** `convex-svelte` is configured and `getDashboardSnapshot` returns data
**When** a sync push updates Convex
**Then** subscribed UI reflects new data within 2 seconds without page reload (FR28, NFR-P3; UX-DR14)
**And** implementation uses `useQuery(getDashboardSnapshot)` — no polling interval (architecture communication patterns).

### Story 2.4: Trend intelligence stub panel

As a **CNS operator**,
I want **a trend panel that clearly defers real analytics to Epic 44**,
So that **the six-panel layout is complete without scope creep**.

**Acceptance Criteria:**

**Given** the dashboard shell from Story 2.1
**When** I view the trend panel
**Then** I see placeholder/mock content and an explicit **"Coming in Epic 44"** badge (FR31, FR32; UX-DR8)
**And** no additional Convex tables or sync work are required beyond optional static placeholder row.

### Story 2.5: Vercel production deploy with password protection

As a **CNS operator**,
I want **the dashboard on a password-protected production URL**,
So that **I can pin one tab for daily health checks**.

**Acceptance Criteria:**

**Given** `cns-dashboard` builds with `adapter-vercel` and `PUBLIC_CONVEX_URL` is set in Vercel env
**When** the app is deployed to Vercel production with password protection enabled
**Then** unauthenticated requests receive no dashboard content (FR1, NFR-S1)
**And** first contentful paint target ≤3s on desktop warm cache (NFR-P1); `npm run build` passes in CI (`.github/workflows/ci.yml`).

---

## Epic 3: Operational Visibility Panels

Operator answers vault health, MCP status, Hermes activity, and run-chain state without Cursor, Discord, or Obsidian.

### Story 3.1: Vault health panel

As a **CNS operator**,
I want **vault health metrics on the dashboard**,
So that **I know note volume, lint status, inbox depth, and PAKE distribution at a glance**.

**Acceptance Criteria:**

**Given** `vaultHealth` is populated by sync
**When** I view `VaultHealthPanel`
**Then** I see note count, lint ERRORS, lint WARNINGS, inbox depth, and PAKE type distribution (FR5–FR9; UX-DR10)
**When** lint report is missing or older than 7 days
**Then** the panel indicates `lintStale` per architecture C3
**And** panel data updates via Epic 2 subscriptions without manual refresh.

### Story 3.2: MCP status panel

As a **CNS operator**,
I want **MCP status for all seven configured servers with honest telemetry**,
So that **I see vault-io activity without fake timestamps for other MCPs**.

**Acceptance Criteria:**

**Given** `mcpStatus` has seven rows: vault-io, notebooklm, context7, firecrawl, perplexity, playwright, discord
**When** I view `McpStatusPanel`
**Then** vault-io shows `lastCallAt` from agent-log; other MCPs show **configured / status unknown** with no fabricated `lastCallAt` (FR10–FR12, FR11)
**And** each row has a badge with color **and** text/icon (active/stale/unknown/configured) (FR13, NFR-A3; UX-DR7).

### Story 3.3: Hermes activity feed panel

As a **CNS operator**,
I want **recent agent-log entries and watchdog status on the dashboard**,
So that **I see what agents did without opening the audit log file**.

**Acceptance Criteria:**

**Given** sync parsed the last 20 agent-log entries and Hermes config
**When** I view `HermesFeedPanel`
**Then** entries appear in chronological order with timestamp, action, tool, surface, target path, and summary (FR14, FR16; UX-DR9)
**And** watchdog cron status shows last run time and success/failure indication (FR15).

### Story 3.4: Run-chain status panel

As a **CNS operator**,
I want **run-chain state and last synthesis metadata on the dashboard**,
So that **I know whether run-chain is dormant, running, or in error**.

**Acceptance Criteria:**

**Given** `runChainStatus` is populated from `sprint-status.yaml` and best-effort synthesis metadata
**When** I view `RunChainPanel`
**Then** I see state `dormant`, `running`, `error`, or `unknown` (FR17)
**And** last run timestamp and synthesis title display when available, or em-dash when missing (FR18, FR19; UX-DR11).

---

## Epic 4: Vault Search & Obsidian Handoff

Operator finds notes by metadata and opens them in Obsidian in seconds — no browser MCP calls.

### Story 4.1: Convex searchNotes query

As a **CNS operator**,
I want **fast metadata search backed by Convex**,
So that **search does not scan the vault from the browser**.

**Acceptance Criteria:**

**Given** `noteIndex` rows exist from sync (title, path, tags, modifiedAt; metadata only, no bodies)
**When** the dashboard calls `searchNotes(query)` with 300ms debounce
**Then** results return within 500ms p95, capped at 50, sorted by `modifiedAt` descending (FR20, FR23 partial; NFR-P4, NFR-S6)
**And** search uses Convex search index on metadata fields — no vault-io MCP from browser (FR23, NFR-I4).

### Story 4.2: Vault search panel and Obsidian deep links

As a **CNS operator**,
I want **to search notes and open results in Obsidian from the dashboard**,
So that **I complete search-to-note in under 5 seconds**.

**Acceptance Criteria:**

**Given** `VaultSearchPanel` with debounced input (300ms)
**When** I type a title, path, or tag fragment
**Then** results show title, vault-relative path, tags, and modified date (FR21; UX-DR6)
**When** I click or press Enter on a result
**Then** the browser opens `obsidian://open?vault=Knowledge-Vault-ACTIVE&file={encodeURIComponent(path)}` via `obsidian-uri.ts` (FR22, NFR-I1)
**And** search input and result links are keyboard-operable (Tab, Enter) (NFR-A2; UX-DR12).
