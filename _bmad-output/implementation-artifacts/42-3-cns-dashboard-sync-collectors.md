---
story_id: 42-3
epic: 42
planning_epic: "Epic 42 / internal Epic 1 Story 1.3"
title: cns-dashboard-sync-collectors
status: done
output_repo: none
cns_repo_touch: scripts/dashboard-sync.ts only
---

# Story 42.3: CNS dashboard-sync.ts collectors

Status: done

**Planning map:** Epic 42 Story 1.3 — `42-3-cns-dashboard-sync-collectors`.

## Story

As an **operator**,
I want **`scripts/dashboard-sync.ts` in the CNS repo to read all local sources and build a snapshot**,
so that **vault and agent state can be pushed to Convex without new npm dependencies in Omnipotent.md**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | **None** — CNS repo only |
| **CNS repo touch** | **`scripts/dashboard-sync.ts` only** (new file) |
| **Depends on** | 42-2 Convex schema + ingest contract |
| **Out of scope** | Convex HTTP push, secret scan, Hermes cron (Story 42-4) |

## Acceptance Criteria

1. **Collect (AC: collect)** — `npx tsx scripts/dashboard-sync.ts` read-only collects: note metadata from `01-Projects/`, `02-Areas/`, `03-Resources/`; inbox depth (`00-Inbox/`); PAKE distribution; newest `_meta/reports/vault-lint-YYYY-MM-DD.md` (ERRORS/WARNINGS, `lintStale` if missing or >7 days); last 20 `agent-log.md` lines (AuditLogger pipe format); vault-io `lastCallAt` as max timestamp for vault-io tools; 7 MCP rows (non-vault-io without fabricated `lastCallAt`); run-chain from `sprint-status.yaml` + best-effort `_bmad-output` synthesis metadata.
2. **Snapshot (AC: snapshot)** — Assembled payload matches hand-mirrored `DashboardSnapshot` type aligned with `cns-dashboard/convex/validators.ts` (camelCase, 7 MCP names from FR10 kebab list).
3. **Safety (AC: safety)** — No `fs.writeFile`, `rename`, or vault mutations; script is the **only** new file in the CNS repo diff.
4. **Tests (AC: test)** — Vitest unit tests cover parsers and snapshot assembly with fixture dirs; `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] Add `DashboardSnapshot` types + MCP constants mirroring `cns-dashboard/convex/` (AC: snapshot)
- [x] Implement read-only collectors: vault notes, inbox, lint, agent-log, MCP registry, run-chain (AC: collect)
- [x] Implement `buildDashboardSnapshot()` + CLI entry (`--json` stdout) (AC: collect, snapshot)
- [x] Add `tests/vault-io/dashboard-sync.test.ts` with fixture vault (AC: test)
- [x] Run `npm test` and `bash scripts/verify.sh` (AC: test, safety)
- [x] Standing task: Operator guide — no update required (internal sync script)

## Dev Notes

- **MCP names (FR10):** `vault-io`, `notebooklm`, `context7`, `firecrawl`, `perplexity`, `playwright`, `discord` — must match `cns-dashboard/convex/constants.ts`.
- **Vault-io tools:** `vault_read`, `vault_read_frontmatter`, `vault_list`, `vault_search`, `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_log_action`, `vault_move`, `vault_request_disambiguation`.
- **Agent-log format (C4):** `[ISO8601 UTC] | action | tool | surface | target_path | payload_summary` — tolerant parse; skip bad lines.
- **Lint (C3):** Newest `vault-lint-YYYY-MM-DD.md` by basename date; parse Summary `Errors:` / `Warnings:`; `lintStale` if missing or >7 days.
- **Paths:** Vault-relative POSIX paths in `noteIndex.path`; use `gray-matter` (existing dep) for frontmatter.
- **Hermes config:** Read `~/.hermes/config.yaml` as text; MCP `configured` if name appears in file (presence only, I3).
- **Run-chain:** `38-2-kimi-k2-6-evaluation-run-chain` status from sprint-status → state; best-effort `lastSynthesisTitle` from newest `*synthesis*` artifact in `_bmad-output/implementation-artifacts/`.
- **Env:** `CNS_VAULT_ROOT` required; `CONVEX_URL` / `CONVEX_DEPLOY_KEY` not used in this story.
- **No Convex push** in this story — stdout JSON only for verification.

### References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-42-cns-dashboard.md` § Data Architecture, C3–C5, I3–I4]
- [Source: `cns-dashboard/convex/validators.ts`, `constants.ts`]
- [Source: `src/audit/audit-logger.ts` — `formatAuditLine`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Completion Notes List

- `scripts/dashboard-sync.ts`: read-only collectors + hand-mirrored `DashboardSnapshot` type aligned with 42-2 Convex validators.
- Parses agent-log (AuditLogger pipe), vault-lint reports (basename date + Summary), sprint-status run-chain story, Hermes config MCP presence.
- `buildDashboardSnapshot()` assembles full payload; CLI supports `--json` stdout; no vault writes.
- 10 Vitest tests (parsers + fixture vault assembly); `verify.sh` green (629 tests).
- **Operator guide: no update required.**

### File List

**Omnipotent.md:**

- `scripts/dashboard-sync.ts`
- `tests/vault-io/dashboard-sync.test.ts`
- `_bmad-output/implementation-artifacts/42-3-cns-dashboard-sync-collectors.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-24: Story created; implementation started.
- 2026-05-24: Collectors + tests complete — ready for review.
- 2026-05-24: Code review — batch patches applied; decision B on run-chain `error`; status **done**.

### Review Findings

- [x] [Review][Patch] Hermes MCP presence matches unrelated config keys [`scripts/dashboard-sync.ts`] — fixed: `mcp_servers` block parse only
- [x] [Review][Patch] Vault note trees scanned twice per sync — fixed: `collectVaultNotes()` single pass
- [x] [Review][Patch] CLI `main()` lacks top-level error handling — fixed: try/catch + `.catch` on main
- [x] [Review][Patch] No test for synthesis artifact selection in run-chain — fixed: `findLatestSynthesisArtifact` test
- [x] [Review][Decision] Run-chain `error` state — **B**: reserved for Story 42-4; sprint-only mapping documented
- [x] [Review][Defer] Hand-mirrored `DashboardSnapshot` can drift from Convex validators — deferred, pre-existing (no npm dep in CNS per architecture C5)
