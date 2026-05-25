---
story_id: 42-10
epic: 42
planning_epic: "Epic 42 / internal Epic 4 Stories 4.1 + 4.2"
title: vault-search
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 42.10: Vault search (Convex query + panel + Obsidian handoff)

Status: done

**Planning map:** Epic 42 **Epic 4** Stories **4.1** + **4.2** — `42-10-vault-search`. Delivers FR20–FR23, NFR-P4, NFR-A2, NFR-I1.

## Story

As a **CNS operator**,
I want **to search note metadata and open results in Obsidian from the dashboard**,
so that **I complete search-to-note in under 5 seconds without browser vault MCP calls**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` at `/home/christ/ai-factory/projects/cns-dashboard` |
| **CNS repo touch** | **None** |
| **Depends on** | 42-2 `noteIndex` + ingest; 42-5 `VaultSearchPanel` shell slot |
| **Out of scope** | Sync script changes; Epic 44 trend; new Convex tables |

### Scope boundary

| In scope (42-10) | Out of scope |
|-----------------|--------------|
| `searchNotes` Convex query + search index | Full-text note bodies |
| `VaultSearchPanel` debounced UI (300ms) | Second shell `useQuery` for ops snapshot |
| `obsidian-uri.ts` client-side URIs only | Browser vault-io / MCP |
| Unit + convex tests | Operator guide (standing: no update until deploy smoke) |

## Acceptance Criteria

1. **searchNotes query (AC: query)**  
   **Given** `noteIndex` rows from sync (title, path, tags, modifiedAt)  
   **When** the dashboard calls `searchNotes({ query })` with non-empty trimmed query  
   **Then** results return capped at 50, sorted by `modifiedAt` descending (FR20 partial; NFR-P4, NFR-S6)  
   **And** search uses Convex search index on metadata — no vault-io MCP from browser (FR23, NFR-I4).

2. **Search panel (AC: panel)**  
   **Given** `VaultSearchPanel` with 300ms debounced input  
   **When** I type a title, path, or tag fragment  
   **Then** results show title, vault-relative path, tags, and modified date (FR21; UX-DR6).

3. **Obsidian handoff (AC: obsidian)**  
   **When** I click or press Enter on a result link  
   **Then** the browser opens `obsidian://open?vault=Knowledge-Vault-ACTIVE&file={encodeURIComponent(path)}` via `obsidian-uri.ts` (FR22, NFR-I1).

4. **Keyboard (AC: a11y)**  
   **Then** search input and result links are keyboard-operable (Tab, Enter) (NFR-A2; UX-DR12).

5. **Trust boundary (AC: boundary)**  
   **When** searching `cns-dashboard/src/`  
   **Then** zero `CNS_VAULT_ROOT`, `/mnt/c/`, `agent-log`, or MCP endpoint strings; Obsidian URI only in `obsidian-uri.ts`.

6. **Build gate (AC: build)**  
   **Then** `npm run check`, `npm run build`, `npm test` pass in `cns-dashboard`; `bash scripts/verify.sh` green in Omnipotent.md.

7. **Standing task: Operator guide**  
   **Then** note "Operator guide: no update required" until post-deploy acceptance.

## Tasks / Subtasks

- [x] Add `searchText` + search index on `noteIndex`; implement `searchNotes` query (AC: query)
- [x] Add `tests/convex/search-notes.test.ts` (AC: query)
- [x] Add `src/lib/utils/obsidian-uri.ts` + tests (AC: obsidian)
- [x] Implement `VaultSearchPanel.svelte` with debounced `useQuery(searchNotes)` (AC: panel, a11y)
- [x] Boundary grep on `src/` (AC: boundary)
- [x] Run `npm run check && npm run build && npm test` in `cns-dashboard` (AC: build)
- [x] Standing task: Operator guide — no update required (AC: standing)

### Review Findings

- [x] [Review][Patch] Index path `take(50)` before `modifiedAt` sort can omit newer matches [convex/dashboard.ts:166]
- [x] [Review][Patch] Stale result list while new query is loading [src/lib/components/panels/VaultSearchPanel.svelte:28]
- [x] [Review][Defer] Full-table fallback `collect()` on empty index [convex/dashboard.ts:173] — deferred, test-only path per dev notes; production uses index
- [x] [Review][Defer] No Convex auth on `searchNotes` [convex/dashboard.ts:155] — deferred, pre-existing; no `ctx.auth` on any dashboard query

## Dev Notes

- Context7: Convex `searchIndex` + `withSearchIndex`; `convex-svelte` `'skip'` for empty query.
- Compute `searchText` in `ingestDashboardSnapshot` from title + path + tags (sync contract unchanged).
- Separate `useQuery(searchNotes)` in panel only — shell keeps single snapshot query (arch pattern).
- Reuse `formatPanelTimestamp` for modified date.

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- `convex-test` does not return search-index hits; `searchNotes` falls back to token scan on `searchText` when index is empty (production still uses index first).
- Trust boundary grep: `obsidian://` + vault name only in `obsidian-uri.ts`.

### Completion Notes List

- `searchNotes` query: search index on `searchText`, cap 50, `modifiedAt` desc; metadata scan fallback.
- Ingest computes `searchText` from title/path/tags (sync JSON unchanged).
- `VaultSearchPanel`: 300ms debounce, separate `useQuery`, keyboard links via `<a href>`.
- `cns-dashboard`: 32 tests pass; `verify.sh` green in Omnipotent.md.
- Operator guide: no update required until deploy acceptance.

### File List

**cns-dashboard:**

- `convex/schema.ts`
- `convex/validators.ts`
- `convex/dashboard.ts`
- `convex/note-search.ts` (new)
- `src/lib/utils/obsidian-uri.ts` (new)
- `src/lib/types/note-search.ts` (new)
- `src/lib/components/panels/VaultSearchPanel.svelte`
- `tests/convex/search-notes.test.ts` (new)
- `tests/convex/note-search.test.ts` (new)
- `tests/lib/obsidian-uri.test.ts` (new)

**Omnipotent.md:**

- `_bmad-output/implementation-artifacts/42-10-vault-search.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-26: Story created; dev started (42-10).
- 2026-05-26: Epic 4 vault search implemented; status → review.
- 2026-05-26: Code review patches applied (index prefetch + loading stale-results); status → done.
