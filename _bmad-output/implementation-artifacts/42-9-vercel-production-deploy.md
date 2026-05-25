---
story_id: 42-9
epic: 42
planning_epic: "Epic 42 / internal Epic 2 Story 2.5"
title: vercel-production-deploy
status: done
output_repo: cns-dashboard
cns_repo_touch: operator-guide-only
---

# Story 42.9: Vercel production deploy with password protection

Status: done

**Planning map:** Epic 42 **Epic 2** Story **2.5** — `42-9-vercel-production-deploy`. Epic 42 production acceptance gate.

## Story

As a **CNS operator**,
I want **the dashboard on a password-protected production URL**,
so that **I can pin one tab for daily health checks**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` at `/home/christ/ai-factory/projects/cns-dashboard` |
| **CNS repo touch** | `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (§16); story artifacts in `_bmad-output/` |
| **Depends on** | 42-1 through 42-8 (buildable dashboard + sync pipeline) |
| **Out of scope** | Epic 4 VaultSearch UI; Epic 44 trend engine; app-level auth code |

### Scope boundary

| In scope (42-9) | Out of scope |
|-----------------|--------------|
| `.github/workflows/ci.yml` (`check`, `build`, `test`) | Browser MCP or vault reads from frontend |
| `docs/DEPLOY.md` provisioning runbook (Convex cloud + Vercel) | Changing Convex ingest auth model |
| `docs/EPIC-42-ACCEPTANCE-CHECKLIST.md` manual gate | Automated Lighthouse CI (optional operator follow-up) |
| Operator guide §16 CNS Dashboard | Hermes watchdog row in Convex (future) |

**Provisioning note:** Convex cloud + Vercel project creation require operator credentials. This story delivers repo/CI/docs; production URL verification is the manual checklist.

## Acceptance Criteria

1. **CI gate (AC: ci)**  
   **When** GitHub Actions runs on `cns-dashboard`  
   **Then** `npm run check`, `npm run build`, and `npm test` pass on Node from `.nvmrc` (NFR build gate; epics Story 2.5).

2. **Deploy runbook (AC: runbook)**  
   **When** the operator follows `docs/DEPLOY.md`  
   **Then** steps cover Convex production deploy, Vercel project import, `PUBLIC_CONVEX_URL` env, password protection (NFR-S1, FR1), and sync cron env (`CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `CNS_VAULT_ROOT`).

3. **Acceptance checklist (AC: checklist)**  
   **Then** `docs/EPIC-42-ACCEPTANCE-CHECKLIST.md` lists all six MVP panels, stale banner, sync freshness, password gate, and FCP spot-check (≤3s warm cache, NFR-P1).

4. **Operator guide (AC: guide)**  
   **Then** `CNS-Operator-Guide.md` §16 documents dashboard URL, deploy pointer, sync cron install script, and env file location (no secrets).

5. **Trust boundary (AC: boundary)**  
   **Then** no `CONVEX_DEPLOY_KEY` or vault paths added to `cns-dashboard/src/`; `bash scripts/verify.sh` green in Omnipotent.md.

6. **Build gate (AC: build)**  
   **Then** local `npm run check && npm run build && npm test` pass in `cns-dashboard`.

## Tasks / Subtasks

- [x] Add `.github/workflows/ci.yml` in `cns-dashboard` (AC: ci)
- [x] Add `docs/DEPLOY.md` and `docs/EPIC-42-ACCEPTANCE-CHECKLIST.md` (AC: runbook, checklist)
- [x] Update `cns-dashboard/README.md` deploy section (AC: runbook)
- [x] Add Operator Guide §16 + version history 1.33.0 (AC: guide)
- [x] Boundary grep + `npm run check/build/test` in `cns-dashboard` (AC: build, boundary)
- [x] Run `bash scripts/verify.sh` in Omnipotent.md (AC: build)
- [x] Standing task: Operator guide updated (AC: guide)

## Dev Notes

- Vercel password protection is configured in Vercel project **Deployment Protection** (dashboard UI or API) — not in SvelteKit source.
- `PUBLIC_CONVEX_URL` must point at **production** Convex deployment URL on Vercel; sync uses `CONVEX_URL` + `CONVEX_DEPLOY_KEY` in `~/.hermes/dashboard-sync.env` only.
- Install sync: `bash scripts/install-dashboard-sync-cron.sh` from Omnipotent.md repo root.
- Context7: `/websites/svelte_dev_kit` adapter-vercel; `/websites/vercel` password protection; Convex `npx convex deploy`.

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Implementation Plan

- Repo-deliverable gate: GitHub Actions CI on Node 24 from `.nvmrc`.
- Operator-deliverable gate: `DEPLOY.md` + acceptance checklist; no live Vercel/Convex provisioning in agent session (credentials + project not linked).

### Completion Notes List

- Added `cns-dashboard` CI workflow: `npm ci`, `check`, `build`, `test`.
- Added deploy runbook and Epic 42 manual acceptance checklist.
- Operator guide **§16 CNS Dashboard** (v1.33.0): Vercel password gate, env split, sync cron, doc pointers.
- Trust boundary: zero forbidden strings in `cns-dashboard/src/`.
- `cns-dashboard`: 24 tests pass; Omnipotent `verify.sh`: VERIFY PASSED (642 tests).
- **Operator follow-up:** run `docs/DEPLOY.md`, enable Vercel password protection, `npx convex deploy`, fill production URL in §16 bookmark, complete checklist to close Epic 42.

### File List

**cns-dashboard:**

- `.github/workflows/ci.yml` (new)
- `docs/DEPLOY.md` (new)
- `docs/EPIC-42-ACCEPTANCE-CHECKLIST.md` (new)
- `README.md` (modified)

**Omnipotent.md:**

- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (modified)
- `_bmad-output/implementation-artifacts/42-9-vercel-production-deploy.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-05-25: Story created; CI, deploy docs, operator guide §16; status → review.
- 2026-05-26: Code review batch-fix: DEPLOY ordering/env/preview policy; operator guide §16.1 URL placeholder; status → done.

### Review Findings

- [x] [Review][Patch] Replace hardcoded vault path in DEPLOY env example [`cns-dashboard/docs/DEPLOY.md:78`]
- [x] [Review][Patch] Add Production URL placeholder in Operator Guide §16.1 [`Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md:905`]
- [x] [Review][Patch] Document Convex-before-Vercel deploy order in DEPLOY [`cns-dashboard/docs/DEPLOY.md:31`]
- [x] [Review][Patch] Require Vercel `PUBLIC_CONVEX_URL` before first production build [`cns-dashboard/docs/DEPLOY.md:39`]
- [x] [Review][Patch] Clarify preview deployment protection policy [`cns-dashboard/docs/DEPLOY.md:51`]
- [x] [Review][Defer] Production build allows empty `PUBLIC_CONVEX_URL` (no runtime guard) [`cns-dashboard/src/routes/+layout.svelte:9`] — deferred, pre-existing; out of 42-9 doc-only scope
- [x] [Review][Defer] CI does not fail when `PUBLIC_CONVEX_URL` unset at build time [`.github/workflows/ci.yml`] — deferred, matches local build; env contract is operator/Vercel
- [x] [Review][Defer] Vercel password protection may require paid Deployment Protection tier [`cns-dashboard/docs/DEPLOY.md:47`] — deferred, operator verifies during provisioning
- [x] [Review][Defer] Acceptance checklist FCP gate allows subjective pass [`cns-dashboard/docs/EPIC-42-ACCEPTANCE-CHECKLIST.md:41`] — deferred, manual gate by design
