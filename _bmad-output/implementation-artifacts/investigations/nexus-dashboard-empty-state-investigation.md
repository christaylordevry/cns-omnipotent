# Investigation: Nexus (cns-dashboard) showing empty state despite completed ingestion epics

## Hand-off Brief

1. **What happened.** The Nexus cockpit (`cns-dashboard`, local `vite dev` at `127.0.0.1`) reads from Convex **dev** deployment `exciting-pony-764`, while all three live Hermes ingestion crons (trend-ingest, dashboard-sync, awareness-pull) push to Convex **prod** deployment `amiable-ox-862` — two entirely separate databases (Confirmed via env-file reads).
2. **Where the case stands.** Deduced with high confidence: the browser is querying a Convex project that the real pipeline never writes to, which fully explains every empty panel. Not yet directly confirmed by querying document counts in each deployment (see Missing Evidence).
3. **What's needed next.** Point `cns-dashboard/.env.local`'s `PUBLIC_CONVEX_URL` / `CONVEX_DEPLOYMENT` at the prod deployment (`amiable-ox-862`) that the real pipeline feeds — a config fix, not a code fix.

## Case Info

| Field            | Value                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Ticket           | N/A — operator-reported, session 17 (2026-07-06)                                                 |
| Date opened      | 2026-07-06                                                                                        |
| Status           | Active                                                                                            |
| System           | Windows 11 host, WSL2 Ubuntu-24.04 (Hermes gateway + crons), cns-dashboard SvelteKit local dev server |
| Evidence sources | Env files (`~/.hermes/{trend-ingest,dashboard-sync,awareness-pull}.env`, `cns-dashboard/.env.local`), operator screenshot, `project-context.md`, sprint-status.yaml |

## Problem Statement

Operator viewed the Nexus cockpit (`cns-dashboard`, browser at `127.0.0.1`, "Intelligence" view) and saw empty/placeholder states across every panel: "Awareness data unavailable", "No signal seeds right now", "No signal history for the selected range", "No ingest sources configured", "No digest run yet", "Discovery work unavailable", "No digest signals yet", "No anomalies in the last 24h." This contradicts Epic 77 (JARVIS awareness sync), Epic 81 (digest enrichment + discovery cockpit + dev-state transport), and the trend-intelligence epics all being marked `done` in `sprint-status.yaml`. Operator separately observed the Hermes Desktop native app (a different local surface, built earlier this session) and asked whether these "two different dashboards" need to be "connected."

## Evidence Inventory

| Source   | Status                          | Notes     |
| -------- | ------------------------------- | --------- |
| `~/.hermes/trend-ingest.env` | Available | `CONVEX_URL=https://amiable-ox-862.convex.cloud`, `CONVEX_DEPLOY_KEY=prod:amiable-ox-862\|...` |
| `~/.hermes/dashboard-sync.env` | Available | Same prod deployment `amiable-ox-862` |
| `~/.hermes/awareness-pull.env` | Available | Same prod deployment `amiable-ox-862` (via `CONVEX_URL` + `HERMES_CONVEX_READ_KEY`) |
| `cns-dashboard/.env.local` | Available | `CONVEX_DEPLOYMENT=dev:exciting-pony-764`, `PUBLIC_CONVEX_URL=https://exciting-pony-764.convex.cloud` — comment: `team: christaylor-devry, project: cns-dashboard` |
| `cns-dashboard/.env.example` | Available | No deployment name hardcoded; documents `PUBLIC_CONVEX_URL` (frontend) vs `CONVEX_DEPLOY_KEY` (prod-only, Vercel) as intentionally distinct concerns |
| Operator screenshot | Available | URL bar shows `127.0.0.1` (confirms local dev server, not the deployed Vercel `/nexus`) |
| `project-context.md` | Available, **stale** | Says "Epics 1-72 done, 73 in-progress, AGENTS v2.1.44" — actual state is Epic 84 done; this file itself is out of sync, a side finding, not load-bearing for this case |
| Convex document counts (direct query) | Missing | Would upgrade Deduced → Confirmed; see Missing Evidence |
| `NEXUS/` sibling directory | Available, ruled out | Old dormant project (files dated Mar–Jun, `ralph.yml`/`.cursor` scaffolding, no relation to current work) — considered as a "second dashboard" candidate, refuted by file dates |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Query document counts in both Convex deployments directly (`npx convex data <table>` or Convex dashboard UI) for a table like `hermesAwareness` or `trendSignals` | High | Open | Would confirm exciting-pony-764 is empty and amiable-ox-862 has real rows — turns Deduced conclusion into Confirmed |
| 2 | Check whether a deployed Vercel `/nexus` URL exists and which deployment *it* points to (separate from local dev) | Medium | Open | Per ADR-HERMES-001, Vercel `/nexus` is the intended awareness-facing surface; confirming its Convex target rules out a second mismatch |
| 3 | Check `cns-dashboard` git history / commit log for when `.env.local`'s `CONVEX_DEPLOYMENT` was last changed, and whether it was ever `prod:amiable-ox-862` | Low | Open | Would establish whether this is a regression (was working, drifted) or was never correctly pointed |

## Confirmed Findings

### Finding 1: All three live ingestion crons target the same production Convex deployment

**Evidence:** `~/.hermes/trend-ingest.env`, `~/.hermes/dashboard-sync.env`, `~/.hermes/awareness-pull.env` — all reference `amiable-ox-862.convex.cloud` (prod deploy key present in trend-ingest.env and dashboard-sync.env; awareness-pull.env uses the same `CONVEX_URL` with a read key).

**Detail:** This is the deployment the real Hermes automation (Epic 77 awareness, Epic 81 digest/discovery, trend-intelligence) actually writes to.

### Finding 2: The local dashboard frontend targets a different, separate Convex deployment

**Evidence:** `cns-dashboard/.env.local:1-3` — `CONVEX_DEPLOYMENT=dev:exciting-pony-764`, `PUBLIC_CONVEX_URL=https://exciting-pony-764.convex.cloud`, comment noting `team: christaylor-devry, project: cns-dashboard`.

**Detail:** `dev:` prefix is Convex's standard naming for a personal per-developer sandbox deployment, auto-created by `npx convex dev`. This is architecturally a *different Convex project* from `amiable-ox-862`, not just a different environment tag within the same project.

### Finding 3: The screenshot is from the local dev server, not a deployed instance

**Evidence:** Operator screenshot — browser URL bar reads `127.0.0.1`.

**Detail:** Confirms the frontend currently being viewed is served by `vite dev` reading `.env.local` directly (Finding 2's deployment), not a Vercel-deployed build using a different, possibly-correct env configuration.

## Deduced Conclusions

### Deduction 1: The empty dashboard is caused by a Convex deployment mismatch, not a broken pipeline

**Based on:** Findings 1, 2, 3.

**Reasoning:** The dashboard's every panel (awareness, signals, digest, discovery, anomalies) is a Convex reactive query against tables that Epic 77/81/trend-intelligence write to. Those writes all land in `amiable-ox-862` (Finding 1). The browser session currently being viewed queries `exciting-pony-764` (Finding 2 + 3) — a separate Convex project that the pipeline never touches. A reactive query against a project with no matching writes returns empty results, which renders as exactly the placeholder copy observed ("No X configured/available yet").

**Conclusion:** The ingestion pipeline is very likely healthy; the dashboard is looking at the wrong database. This is a **config problem** (`.env.local` pointing at the wrong deployment), not a data-pipeline or code defect.

## Hypothesized Paths

### Hypothesis 1: "Two different dashboards" refers to Hermes Desktop vs Nexus being unmerged by design, not a bug

**Status:** Open (high confidence from documentation, not independently re-derived from current architecture doc in this session)

**Theory:** Per `project-context.md`'s summary of ADR-HERMES-001: "JARVIS topology: Desktop/Discord = chat+voice; Vercel `/nexus` = awareness + async ask (not embedded WSL chat on Vercel)." This states Hermes Desktop (live chat+voice to the WSL agent, direct session list) and Nexus/cns-dashboard (a read-only, Convex-backed awareness cockpit, updated asynchronously by cron push) are **intentionally two separate surfaces at different architectural layers** — not meant to merge into one UI. The operator's Desktop app session list (24-25 real sessions) and the Nexus cockpit (Convex-backed intelligence panels) are different data models entirely: one is live agent session state, the other is periodically-pushed intelligence/awareness snapshots.

**Supporting indicators:** `project-context.md` ADR summary; the whole v1 PRD language distinguishing "Desktop/Discord chat surface" from "Vercel/nexus awareness surface"; Epic 85's own spec (which this session was originally scoping) is titled "Cockpit Fusion" — implying fusion of *cockpit panels* (kanban + trend + voice-reachability) within Nexus itself, not a merge with the Desktop chat app.

**Would confirm:** Re-reading the full (non-stale) architecture doc's ADR-HERMES-001 text directly, and confirming Epic 85's "Cockpit Fusion" stories don't propose merging Desktop chat into Nexus.

**Would refute:** If Epic 85 or a later PRD revision explicitly calls for unifying Desktop chat and Nexus cockpit into one interface.

**Resolution:** Not yet resolved — flagged as Open since this session's `project-context.md` copy is stale and I have not re-read the primary architecture doc to confirm the ADR text verbatim in this pass.

## Missing Evidence

| Gap              | Impact                               | How to Obtain   |
| ---------------- | ------------------------------------ | --------------- |
| Direct document counts in both Convex deployments | Would move Deduction 1 from high-confidence-Deduced to fully Confirmed | `npx convex data <table>` against each deployment (needs deploy/admin key for prod), or the Convex web dashboard UI for both projects |
| Deployed Vercel `/nexus` URL and its Convex target | Rules out whether a *third*, correctly-configured surface already exists that the operator simply isn't viewing | Check Vercel project settings / `vercel.json` / deployment env vars in `cns-dashboard` |
| Git history of `cns-dashboard/.env.local`'s deployment value | Establishes whether this is a regression or was never correctly set | `git log -p -- .env.local` (likely gitignored, so may need `git log --all --source -- .env.local` or ask operator when it was last hand-edited) |

## Source Code Trace

| Element       | Detail                                      |
| ------------- | -------------------------------------------- |
| Error origin  | Not a code defect — configuration value at `cns-dashboard/.env.local:1-3` |
| Trigger       | `npm run dev` (`vite dev`) reads `.env.local` at startup and wires all Convex client queries to `PUBLIC_CONVEX_URL` |
| Condition     | `.env.local`'s Convex deployment differs from the deployment the ingestion crons write to |
| Related files | `~/.hermes/{trend-ingest,dashboard-sync,awareness-pull}.env` (the write side); `cns-dashboard/src/**` Convex query call sites (not yet traced — would confirm which tables are queried, not necessary to confirm root cause) |

## Conclusion

**Confidence:** Medium-High (Deduced, not yet directly Confirmed via document-count query)

The pipeline (Epic 77/81/trend-intelligence) writing all real data to Convex prod deployment `amiable-ox-862` is Confirmed via three independent env files. The dashboard currently being viewed reading from a different Convex deployment (`dev:exciting-pony-764`) is also Confirmed via its own env file and the screenshot's `127.0.0.1` URL. The causal link between these two facts and the observed empty UI is a strong Deduction, not yet elevated to Confirmed because I have not directly queried either Convex deployment's document counts. Given how completely and uniformly every single panel is empty — matching exactly what "reading from an unrelated Convex project" would produce — I'd assign this high confidence even pre-verification.

Separately: the "two different dashboards" framing (Hermes Desktop vs Nexus) is very likely **by design** per ADR-HERMES-001 (Hypothesis 1, Open) — not itself a defect, though the complete emptiness of the Nexus one is.

## Recommended Next Steps

### Fix direction

Point `cns-dashboard/.env.local` at the production Convex deployment the pipeline actually writes to:

```
CONVEX_DEPLOYMENT=prod:amiable-ox-862   # or omit if prod deployments don't use this key
PUBLIC_CONVEX_URL=https://amiable-ox-862.convex.cloud
PUBLIC_CONVEX_SITE_URL=https://amiable-ox-862.convex.site
```

This is a **local environment config change**, not a code change — restart `vite dev` after editing `.env.local` and the same UI should immediately populate from real data, if Deduction 1 is correct.

### Diagnostic

Before changing anything, it's worth 2 minutes to directly confirm rather than assume:
1. Open the Convex web dashboard for `exciting-pony-764` (`https://dashboard.convex.dev`) and check whether any of the awareness/digest/trend tables have rows — expect zero or near-zero.
2. Open the Convex web dashboard for `amiable-ox-862` and check the same tables — expect real rows matching the last cron run timestamps.

If both match expectation, the fix direction above is safe to apply immediately.

## Reproduction Plan

1. In `cns-dashboard`, run `npm run dev` with the current `.env.local` (dev:exciting-pony-764) — reproduces the empty-panel state.
2. Edit `.env.local` to point at prod (`amiable-ox-862`), restart `npm run dev`.
3. Reload the Nexus Intelligence view — expect populated Awareness, Signal Seeds, Trajectory, Source Weights, Discovery Work, Digest Feed, and Anomaly Feed panels reflecting real cron-pushed data.

## Side Findings

- `project-context.md` (repo root) is stale — describes Epics 1-72 done / 73 in-progress / AGENTS v2.1.44, while the actual current state (per `sprint-status.yaml`) is Epic 84 done, multiple epics past that. Not addressed in this investigation; worth a housekeeping pass separately since stale persistent-fact files can mislead future investigations (this one included — I discounted it early, but a less careful pass might not).
- Sibling directories `cns-dashboard-claude-archive` and `cns-dashboard-agents-archive` exist alongside the live `cns-dashboard` — not investigated, but worth confirming neither is accidentally the one being served (ruled out here only because the operator's `npm run start`/`npm run dev` context and file dates point to the live repo, not verified by directly checking archive contents).
- A dormant top-level `NEXUS/` project directory (unrelated old prototype, files dated Mar-Jun) was initially a candidate for "second dashboard" but ruled out by file-date evidence — not the thing on the operator's screen.
