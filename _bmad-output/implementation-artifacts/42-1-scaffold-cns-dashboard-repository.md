---
story_id: 42-1
epic: 42
planning_epic: "Epic 42 / internal Epic 1 Story 1.1"
title: scaffold-cns-dashboard-repository
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 42.1: Scaffold cns-dashboard repository

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

**Planning map:** Epic 42 planning doc labels this **Story 1.1** under **Epic 1: Read-Only CNS Data Bridge**. Sprint key: `42-1-scaffold-cns-dashboard-repository`.

## Story

As a **developer**,
I want **a greenfield `cns-dashboard` repo with SvelteKit, Convex, Tailwind dark mode, and Vercel adapter**,
so that **the dashboard frontend and Convex backend have a standard foundation before sync and panels**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 42: CNS Dashboard Web App |
| **Sub-epic** | Epic 1 (Read-Only CNS Data Bridge) — this story is **frontend repo only** |
| **Output repo** | Greenfield `cns-dashboard` — **not** inside `Omnipotent.md` |
| **CNS repo touch** | **None** for this story (`scripts/dashboard-sync.ts` is Story 42-3) |
| **Provisioning** | Convex + Vercel not yet created; local `convex dev` + `npm run dev` is the acceptance gate |
| **Stack (locked)** | SvelteKit + Convex + Vercel + Tailwind dark theme [Source: `prd-epic-42-cns-dashboard.md`] |
| **Next stories** | 42-2 Convex schema/mutations; 42-3 sync collectors; 42-4 push + cron |

### Scope boundary (critical)

| In scope (42-1) | Out of scope (later stories) |
|-----------------|------------------------------|
| `npx sv@latest create cns-dashboard` | `scripts/dashboard-sync.ts` in CNS repo |
| TypeScript + Tailwind + dark default | Convex schema tables / `ingestDashboardSnapshot` |
| `convex` + `convex-svelte` install | Panel components beyond empty shell |
| `npx convex dev` project init | Hermes cron registration |
| `@sveltejs/adapter-vercel` config | Vercel production deploy (42-9) |
| `setupConvex(PUBLIC_CONVEX_URL)` in `+layout.svelte` | `getDashboardSnapshot` query implementation |

## Acceptance Criteria

1. **Repo creation (AC: scaffold)**  
   **Given** no `cns-dashboard` repo exists at the agreed path  
   **When** the operator runs `npx sv@latest create cns-dashboard` choosing **TypeScript** and **Tailwind CSS**  
   **Then** the project initializes with SvelteKit + Vite and `npm run dev` serves locally  
   **And** recommended sibling path: `/home/christ/ai-factory/projects/cns-dashboard` (same parent as `Omnipotent.md`)

2. **Vercel adapter (AC: adapter)**  
   **When** `@sveltejs/adapter-vercel` is installed and configured in `svelte.config.js`  
   **Then** `npm run build` completes without error  
   **And** adapter replaces default `adapter-auto` per [Source: SvelteKit adapter-vercel docs via Context7 `/websites/svelte_dev_kit`]

3. **Convex wiring (AC: convex)**  
   **When** `npm install convex convex-svelte` and `npx convex dev` run  
   **Then** Convex project links to cloud dev deployment and creates `convex/` folder with `_generated/`  
   **And** `.env.local` (or Convex-generated env) provides `PUBLIC_CONVEX_URL` for the frontend

4. **Layout integration (AC: layout)**  
   **When** `src/routes/+layout.svelte` is updated  
   **Then** it calls `setupConvex(PUBLIC_CONVEX_URL)` from `convex-svelte` using `$env/static/public`  
   **And** `{@render children()}` wraps child routes (Svelte 5 pattern per Convex quickstart)

5. **Dark theme default (AC: theme)**  
   **When** the app loads  
   **Then** dark mode is active by default via `class="dark"` on `<html>` in `src/app.html` **or** Tailwind dark-mode config at scaffold time (UX-DR2 partial)  
   **And** `src/app.css` includes Tailwind directives

6. **Minimal shell page (AC: shell)**  
   **When** opening `/`  
   **Then** `src/routes/+page.svelte` renders a placeholder dashboard title (e.g. "CNS Dashboard") proving routing works  
   **And** no vault paths, MCP endpoints, or `CNS_VAULT_ROOT` references exist in browser code (NFR-S5 prep)

7. **Env documentation (AC: env)**  
   **When** scaffold completes  
   **Then** `.env.example` documents `PUBLIC_CONVEX_URL=` (frontend only)  
   **And** README.md documents local dev: `npx convex dev` + `npm run dev` in separate terminals

8. **CNS repo isolation (AC: cns-boundary)**  
   **When** this story completes  
   **Then** `Omnipotent.md` git diff is **empty** (no changes to package.json, src/, verify.sh, AGENTS.md)  
   **And** `bash scripts/verify.sh` in CNS repo still passes unchanged

9. **Standing task: Operator guide**  
   **When** shipped  
   **Then** note "Operator guide: no update required" in Dev Agent Record — no user-facing CNS behavior changes until sync + deploy stories land.

## Tasks / Subtasks

- [x] Create repo: `npx sv@latest create cns-dashboard` — TypeScript, Tailwind, minimal/skeleton template (AC: scaffold, theme)
- [x] Install `@sveltejs/adapter-vercel`; update `svelte.config.js`; verify `npm run build` (AC: adapter)
- [x] `npm install convex convex-svelte`; run `npx convex dev` to link project (AC: convex)
- [x] Wire `setupConvex(PUBLIC_CONVEX_URL)` in `src/routes/+layout.svelte` (AC: layout)
- [x] Set dark mode default on `<html class="dark">` in `app.html` (AC: theme)
- [x] Add minimal `+page.svelte` placeholder shell (AC: shell)
- [x] Add `.env.example` + README local-dev section (AC: env)
- [x] Confirm zero diff in `Omnipotent.md`; run `bash scripts/verify.sh` in CNS repo (AC: cns-boundary)
- [x] Standing task: Operator guide note (AC: 9)

## Dev Notes

### Verified init commands (Context7 May 2026)

**SvelteKit create:**
```bash
cd /home/christ/ai-factory/projects
npx sv@latest create cns-dashboard
# Prompts: TypeScript yes, Tailwind yes, minimal or skeleton template
cd cns-dashboard
```

**Vercel adapter** [Source: Context7 `/websites/svelte_dev_kit` — adapter-vercel]:
```bash
npm i -D @sveltejs/adapter-vercel
```
```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter()
  }
};
export default config;
```

**Convex + Svelte** [Source: Context7 `/websites/convex_dev` — Svelte quickstart]:
```bash
npm install convex convex-svelte
npx convex dev
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { PUBLIC_CONVEX_URL } from '$env/static/public';
  import { setupConvex } from 'convex-svelte';

  const { children } = $props();
  setupConvex(PUBLIC_CONVEX_URL);
</script>

{@render children()}
```

**Package versions (architecture pin):** `convex@1.39.x`, `convex-svelte@0.0.12` — verify latest compatible at install time via `npm view`; do not guess breaking API from training data.

### Dark mode pattern

```html
<!-- src/app.html -->
<html lang="en" class="dark">
```

Ensure `tailwind.config.js` uses `darkMode: 'class'` if not set by `sv create`.

### Target directory structure (Story 42-1 subset only)

```text
cns-dashboard/
├── README.md
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── .env.example
├── .gitignore          # must ignore .env.local
├── src/
│   ├── app.html        # class="dark"
│   ├── app.css
│   ├── routes/
│   │   ├── +layout.svelte   # setupConvex
│   │   └── +page.svelte     # placeholder shell
│   └── lib/            # empty or .gitkeep — panels come in 42-5+
└── convex/
    └── _generated/     # from npx convex dev — no schema.ts yet (42-2)
```

Full target tree documented in [Source: `architecture-epic-42-cns-dashboard.md` § Project Structure].

### Architecture compliance

| Rule | Enforcement |
|------|-------------|
| CNS repo diff scope | **Zero files** this story — sync script is 42-3 |
| Browser vault access | Forbidden — grep `CNS_VAULT_ROOT` → 0 hits in `cns-dashboard/` |
| Credentials in frontend | Only `PUBLIC_CONVEX_URL`; never `CONVEX_DEPLOY_KEY` in Vite bundle |
| Phase 1 orthogonality | No changes to Vault IO MCP, WriteGate, or `specs/` |

### Testing requirements

| Layer | Requirement |
|-------|-------------|
| **cns-dashboard** | Manual: `npm run dev` loads placeholder; `npm run build` passes; Convex dev connects |
| **CNS repo** | `bash scripts/verify.sh` unchanged green — no new CNS tests unless operator approves |
| **CI (optional this story)** | `.github/workflows/ci.yml` may be added if trivial; full CI gate is 42-9 — document choice in Dev Agent Record |

### Anti-patterns

- Do **not** add `scripts/dashboard-sync.ts` to Omnipotent.md (42-3).
- Do **not** implement `convex/schema.ts` or dashboard queries (42-2).
- Do **not** `npm install convex` in CNS repo.
- Do **not** embed vault paths or Hermes config reads in SvelteKit code.
- Do **not** use `adapter-auto` for production-bound project — pin `adapter-vercel` now.

### Git intelligence (recent CNS work)

Recent commits are session-close / AGENTS / Epic 43 — **no cns-dashboard work yet**. First commit for Epic 42 should be **inside `cns-dashboard` repo only**, e.g. `feat: scaffold SvelteKit + Convex + Vercel adapter (Epic 42-1)`.

### Previous story intelligence

N/A — first story in Epic 42. Cross-reference completed **43-1** for Hermes/session-close patterns only; no code reuse required.

### Latest tech information

| Technology | Notes |
|------------|-------|
| **SvelteKit CLI** | `npx sv@latest create` — official scaffold; replaces deprecated `npm create svelte` |
| **Svelte 5** | `$props()` + `{@render children()}` in layouts — match generated template |
| **convex-svelte** | `setupConvex()` in root layout; `useQuery` comes in 42-7 |
| **adapter-vercel** | Minimal config `adapter()` sufficient for MVP; image optimization optional |
| **Convex dev** | Keep `npx convex dev` running during frontend dev for codegen sync |

### Project context reference

No `project-context.md` in repo. Follow:
- [Source: `_bmad-output/planning-artifacts/architecture-epic-42-cns-dashboard.md`]
- [Source: `_bmad-output/planning-artifacts/prd-epic-42-cns-dashboard.md`]
- [Source: `_bmad-output/planning-artifacts/epics-epic-42-cns-dashboard.md` § Story 1.1]
- [Source: `CLAUDE.md` — Context7 mandatory before library implementation]

### References

- [Source: `epics-epic-42-cns-dashboard.md` — Story 1.1 AC verbatim]
- [Source: `architecture-epic-42-cns-dashboard.md` — Starter Template Evaluation, Implementation Handoff]
- [Source: `prd-epic-42-cns-dashboard.md` — Repository & Hard Constraints]
- [Source: Context7 `/websites/svelte_dev_kit` — sv create, adapter-vercel]
- [Source: Context7 `/websites/convex_dev` — Svelte quickstart, setupConvex]

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] No user-facing CNS behavior changes — note "Operator guide: no update required" in Dev Agent Record when complete.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Node v20.18.2 (Cursor default) fails `@sveltejs/vite-plugin-svelte@7` engine check; resolved with `.nvmrc` + Node 24.14.0.
- `npx convex dev --configure new` prompts login in non-interactive terminal; `CONVEX_AGENT_MODE=anonymous npx convex dev --once` succeeded (local deployment at `http://127.0.0.1:3210`).
- Tailwind v4 scaffold uses `src/routes/layout.css` with `@import 'tailwindcss'` and `@custom-variant dark` instead of legacy `app.css` / `tailwind.config.js`.

### Completion Notes List

- Greenfield repo at `/home/christ/ai-factory/projects/cns-dashboard` via `npx sv@0.15.3 create --template minimal --types ts --add tailwindcss="plugins:none"`.
- Installed `convex@1.39.1`, `convex-svelte@0.0.12`, `@sveltejs/adapter-vercel@6.3.3`; removed `adapter-auto`.
- Convex anonymous local dev linked; `.env.local` has `PUBLIC_CONVEX_URL=http://127.0.0.1:3210`; `convex/_generated/` checked in per Convex best practice.
- Verified: `npm run build` ✓, `npm run dev` serves "CNS Dashboard" ✓, `npm run check` 0 errors ✓, grep `CNS_VAULT_ROOT` → 0 hits ✓.
- CNS repo: no changes to `package.json`, `src/`, `verify.sh`, or `AGENTS.md`; `bash scripts/verify.sh` passes (619 tests).
- **Operator guide: no update required** — no user-facing CNS behavior changes.
- CI (`.github/workflows/ci.yml`) deferred to Story 42-9 per story Dev Notes.
- Git initialized in `cns-dashboard`; files staged, commit left to operator.

### File List

**cns-dashboard repo** (`/home/christ/ai-factory/projects/cns-dashboard/`):

- `.env.example`
- `.gitignore`
- `.nvmrc`
- `README.md`
- `package.json`
- `package-lock.json`
- `svelte.config.js`
- `src/app.html`
- `src/routes/+layout.svelte`
- `src/routes/+page.svelte`
- `src/routes/layout.css`
- `convex/_generated/*` (api, server, dataModel)
- `convex/tsconfig.json`
- `convex/README.md`

**Omnipotent.md** (sprint tracking only):

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/42-1-scaffold-cns-dashboard-repository.md`

## Change Log

- 2026-05-24: Scaffolded greenfield `cns-dashboard` repo — SvelteKit + Tailwind dark + Convex + Vercel adapter; all ACs satisfied; story ready for review.
- 2026-05-24: Code review patches — `@types/node`, Convex URL dev guard, AC8 AGENTS cleanup, story tracking.

### Review Findings

- [x] [Review][Patch] Missing `@types/node` — added `@types/node` devDependency; `npm run check` now 0 warnings.
- [x] [Review][Patch] Unguarded `setupConvex(PUBLIC_CONVEX_URL)` — dev-only fail-fast in `+layout.svelte` when URL missing.
- [x] [Review][Patch] AC8 / CNS-boundary drift — removed erroneous `42-1` line from canonical vault `AGENTS.md`; specs mirror had no 42-1 diff.
- [x] [Review][Patch] Story artifact not tracked — story file added for sprint traceability (stage with `sprint-status.yaml` on commit).
- [x] [Review][Defer] No initial git commit in `cns-dashboard` — files are staged only; Dev Record defers commit to operator.
- [x] [Review][Defer] Anonymous local Convex (`CONVEX_AGENT_MODE=anonymous`) — acceptable for 42-1 scaffold; cloud team deployment linking is Story 42-2+.
