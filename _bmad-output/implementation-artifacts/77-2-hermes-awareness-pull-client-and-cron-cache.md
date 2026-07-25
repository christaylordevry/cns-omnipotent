---
baseline_commit: cdd7f4217ecaa3d272c2064d8727f4b055363f81
---

# Story 77.2: Hermes Awareness Pull Client and Cron Cache

Status: review

**Epic:** 77 — JARVIS Awareness in Nexus (alias Epic D1)  
**Repo boundary:** **Omnipotent.md only** (pull script, cron installer, vitest). Convex HTTP endpoint is **77-1** (`done` in cns-dashboard).  
**Normative spec:** `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` Story 77-2; `architecture-hermes-consolidation.md` ADR-HERMES-002, FR12 pull pattern  
**Prerequisites:** **77-1** `done` — `GET /hermes/awareness` deployed with `HERMES_CONVEX_READ_KEY` in Convex env  
**Blocks:** **77-4** (awareness-sync skill), **77-7** (dashboard-sync retention decision needs pull validated)

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As **Hermes (WSL agent)**,
I want **`scripts/hermes-awareness-pull.ts` on a 3-min cron writing `~/.hermes/memories/awareness-snapshot.json`**,
so that **awareness is cached locally without per-turn Convex calls (FR12 pull)**.

## Acceptance Criteria

### AC1 — Pull script fetches awareness snapshot

**Given** 77-1 endpoint deployed and `HERMES_CONVEX_READ_KEY` set in WSL env  
**When** `npx tsx scripts/hermes-awareness-pull.ts` runs manually  
**Then** script performs `GET https://<deployment>.convex.site/hermes/awareness` with `Authorization: Bearer <HERMES_CONVEX_READ_KEY>`  
**And** on HTTP 200, writes JSON to `~/.hermes/memories/awareness-snapshot.json` (override via `HERMES_AWARENESS_CACHE_PATH`)  
**And** cache envelope uses camelCase with at minimum:

| Field | Type | Purpose |
|-------|------|---------|
| `pulledAt` | `number` | Unix ms when pull succeeded |
| `sourceUrl` | `string` | Full GET URL used (no bearer in file) |
| `snapshot` | `HermesAwarenessSnapshot` | DTO body from endpoint |

**Given** HTTP 401 or network failure  
**When** pull fails  
**Then** script exits non-zero, logs error to stderr  
**And** does **not** overwrite an existing cache file with empty/invalid snapshot (preserve last good cache)  
**And** optional `--json` flag prints envelope to stdout for operator debug (no secret scan required — snapshot has no secrets by design)

### AC2 — URL derivation (critical — do not call `.convex.cloud`)

**Given** `CONVEX_URL` is `https://<deployment>.convex.cloud` (same as dashboard-sync)  
**When** building the awareness GET URL  
**Then** use **`.convex.site`** origin: `https://<deployment>.convex.site/hermes/awareness`  
**And** helper `convexSiteUrlFromCloudUrl()` (or equivalent) replaces `.convex.cloud` → `.convex.site` and strips trailing slash  
**And** allow override via `HERMES_AWARENESS_URL` for non-standard deployments

**Anti-pattern:** `${CONVEX_URL}/hermes/awareness` or `${CONVEX_URL}/api/...` — mutations use `.convex.cloud`; HTTP routes use `.convex.site` only.

### AC3 — Hand-mirrored TypeScript types

**Given** ADR-HERMES-002 DTO contract in cns-dashboard  
**When** types are defined in `scripts/hermes-awareness-pull.ts` (or extracted `scripts/lib/hermes-awareness-types.ts` if script grows)  
**Then** `HermesAwarenessSnapshot` and subsection types are hand-mirrored from `cns-dashboard/convex/validators.ts` with sync comment:

```typescript
/** Hand-mirrored from cns-dashboard/convex/validators.ts hermesAwarenessSnapshotValidator — keep in sync. */
```

**And** top-level snapshot keys match 77-1 exactly: `sync`, `vault`, `chain`, `mcps`, `digest`, `entities`, `investigations`, `trends`  
**And** overlapping field shapes align with `dashboard-sync.ts` types where shared (`McpStatusRow`, `VaultHealth`, etc.) — reuse exports from `dashboard-sync.ts` when identical; do not duplicate `DashboardSnapshot` (awareness DTO is a different shape)

### AC4 — Cron installation (3-minute interval)

**Given** operator runs `bash scripts/install-awareness-pull-cron.sh` from Omnipotent.md repo root  
**When** installer completes  
**Then** WSL user crontab contains tagged line `*/3 * * * *` invoking `scripts/run-awareness-pull-cron.sh` with tag `cns-awareness-pull`  
**And** log appends to `~/.hermes/logs/awareness-pull.log`  
**And** wrapper sources env from `~/.hermes/awareness-pull.env` (create from example if missing, `chmod 600`)  
**And** wrapper exports NVM `bin` to PATH (mirror `run-dashboard-sync-cron.sh` — minimal cron PATH lesson from 67-11)  
**And** installer is idempotent (grep-remove old tag before append)

**Env file variables (example in `scripts/awareness-pull.env.example`):**

| Variable | Required | Notes |
|----------|----------|-------|
| `CONVEX_URL` | Yes | `.convex.cloud` deployment URL (derive `.convex.site` for GET) |
| `HERMES_CONVEX_READ_KEY` | Yes | Bearer token — **WSL only**, never Vercel, never commit |
| `HERMES_AWARENESS_CACHE_PATH` | No | Default `~/.hermes/memories/awareness-snapshot.json` |
| `HERMES_AWARENESS_URL` | No | Full override for GET URL |

### AC5 — Vitest coverage

**Given** `tests/hermes/hermes-awareness-pull.test.ts`  
**When** `npm run test:vitest` and `bash scripts/verify.sh` run  
**Then** tests cover (mock `fetch`):

1. `buildAwarenessUrl()` — cloud → site URL derivation
2. `verifyBearerHeader()` / request builder — correct `Authorization: Bearer …` header
3. Successful pull — parses JSON, writes envelope with `pulledAt` + `snapshot`
4. HTTP 401 — throws/returns error exit; does not clobber existing cache file
5. Minimal DTO shape parse — all top-level keys present on fixture response

**And** tests import from `scripts/hermes-awareness-pull.js` (compiled path pattern per `validate-anthropic-key.test.ts`)  
**And** no tests at repo root `tests/*.test.ts`

### AC6 — Coexistence with dashboard-sync

**Given** `scripts/dashboard-sync.ts` still pushes full snapshot every 3 min  
**When** this story completes  
**Then** `dashboard-sync.ts` is **unchanged** in behavior (no removal, no frequency change)  
**And** both crons may run in parallel safely (different endpoints, different cache files)  
**And** retention/deprecation decision deferred to **77-7** after ≥24h production validation

### AC7 — Protect-list and scope boundaries

**Given** Epic 77 D1 pull client scope  
**When** implementation completes  
**Then** these paths have **zero diffs**:

- `src/agents/synthesis-adapter-llm.ts`
- `src/agents/hook-adapter-llm.ts`
- `src/agents/boss-adapter-llm.ts`
- `src/agents/run-chain.ts`
- `scripts/run-chain.ts`

**And** no changes to Discord gateway, morning-digest cron, `convex/` in cns-dashboard, or WriteGate paths  
**And** no `~/.hermes/skills/cns/awareness-sync/SKILL.md` (that is **77-4**)

## Tasks / Subtasks

### Prerequisite gate

- [x] **T0 — Dependency check**
  - [x] T0.1 Confirm **77-1** `done` in sprint-status; cns-dashboard has `convex/http.ts`, `convex/hermesAwareness.ts`
  - [ ] T0.2 Operator confirms `HERMES_CONVEX_READ_KEY` set in **Convex deployment env** (Dashboard → Settings → Environment Variables)
  - [ ] T0.3 Manual smoke: `curl -H "Authorization: Bearer $KEY" "https://<dep>.convex.site/hermes/awareness"` returns 200 JSON

### Core pull script

- [x] **T1 — `scripts/hermes-awareness-pull.ts`** (AC: 1, 2, 3)
  - [x] T1.1 Export testable helpers: `convexSiteUrlFromCloudUrl`, `buildAwarenessRequest`, `parseAwarenessResponse`, `writeAwarenessCache`, `pullAwarenessSnapshot`
  - [x] T1.2 `main()` — load env, validate required vars, mkdir `~/.hermes/memories/`, pull, write cache
  - [x] T1.3 CLI flags: `--json` (stdout debug), `--dry-run` (fetch but don't write — optional, helpful for operator)
  - [x] T1.4 Hand-mirror `HermesAwarenessSnapshot` types with sync comment to `cns-dashboard/convex/validators.ts`
  - [x] T1.5 Reuse `normalizeConvexUrl` from `dashboard-sync.ts` if exported (or duplicate one-liner with comment — prefer export to avoid drift)

### Cron wiring

- [x] **T2 — Cron installer + wrapper** (AC: 4)
  - [x] T2.1 `scripts/run-awareness-pull-cron.sh` — NVM PATH + source `awareness-pull.env`
  - [x] T2.2 `scripts/install-awareness-pull-cron.sh` — idempotent crontab tag `cns-awareness-pull`
  - [x] T2.3 `scripts/awareness-pull.env.example` — document vars; operator copies to `~/.hermes/awareness-pull.env`

### Tests + verify

- [x] **T3 — Vitest** (AC: 5)
  - [x] T3.1 `tests/hermes/hermes-awareness-pull.test.ts`
  - [x] T3.2 `bash scripts/verify.sh` green in Omnipotent.md

### Manual validation (operator)

- [ ] **T4 — Smoke** (AC: 1, 4, 6)
  - [ ] T4.1 Manual pull writes cache; inspect `awareness-snapshot.json` sections match live cockpit
  - [ ] T4.2 Install cron; confirm log line every 3 min for 2 cycles
  - [ ] T4.3 Confirm `dashboard-sync` cron still runs independently

## Dev Notes

### Repo boundary

| Repo | This story | Later stories |
|------|------------|---------------|
| **Omnipotent.md** | Pull client, cron, vitest, env example | 77-4 skill |
| **cns-dashboard** | None (77-1 already done) | 77-3 webhook push, 77-5 UI |

Work from Omnipotent.md repo root. Commit here only.

### Architecture compliance

- **ADR-HERMES-002:** HTTP GET only; bearer `HERMES_CONVEX_READ_KEY`; fixed DTO; no Convex MCP at runtime.
- **FR12 pull:** 3-min cron + `~/.hermes/memories/awareness-snapshot.json` — Hermes reads cache, not live Convex per chat turn.
- **ADR-E46-003:** `HERMES_CONVEX_READ_KEY` never on Vercel, never in git, never in `PUBLIC_*`.
- **ADR-E63-005:** No `NEXUS_*` env vars.
- **Protect-list:** No run-chain adapter edits.
- **Process:** `dashboard-sync.ts` retained until **77-7** validates pull in production ≥24h.

### 77-1 endpoint contract (implemented — read before coding)

**Route:** `GET /hermes/awareness` on `.convex.site`  
**Auth:** `Authorization: Bearer ${HERMES_CONVEX_READ_KEY}` — custom static bearer (not Convex JWT, not deploy key)  
**Response:** JSON matching `hermesAwarenessSnapshotValidator`:

```604:614:/home/christ/ai-factory/projects/cns-dashboard/convex/validators.ts
export const hermesAwarenessSnapshotValidator = v.object({
	sync: v.union(syncMetadataValidator, v.null()),
	vault: v.union(vaultHealthValidator, v.null()),
	chain: v.union(runChainStatusValidator, v.null()),
	mcps: v.array(mcpStatusRowValidator),
	digest: hermesAwarenessDigestSectionValidator,
	entities: hermesAwarenessEntitiesSectionValidator,
	investigations: hermesAwarenessInvestigationsSummaryValidator,
	trends: hermesAwarenessTrendsSectionValidator
});
```

**Excluded from response:** `noteIndex`, `agentLogEntries` (unlike `dashboard-sync` push payload).

[Source: `_bmad-output/implementation-artifacts/77-1-convex-hermes-awareness-snapshot-http-endpoint.md`]

### dashboard-sync pattern to mirror (not duplicate)

**Env sourcing:** `run-dashboard-sync-cron.sh` sources `~/.hermes/dashboard-sync.env` with bash `source` (not `. env` in crontab — quoted-path lesson).

**Type discipline:** `dashboard-sync.ts` lines 20–90 hand-mirror `DashboardSnapshot` with sync comment to `cns-dashboard/convex/validators.ts`. Awareness pull uses the **awareness** validator, not `dashboardSnapshotValidator`.

**URL difference:**

| Script | Base URL | Path | Auth |
|--------|----------|------|------|
| `dashboard-sync.ts` | `.convex.cloud` | `/api/mutation` | `Convex ${CONVEX_DEPLOY_KEY}` |
| `hermes-awareness-pull.ts` | `.convex.site` | `/hermes/awareness` | `Bearer ${HERMES_CONVEX_READ_KEY}` |

Reuse `normalizeConvexUrl()` from `dashboard-sync.ts` for trailing-slash handling; add site-URL derivation as new helper.

### Suggested implementation sketch

```typescript
// scripts/hermes-awareness-pull.ts — pattern only

export function convexSiteUrlFromCloudUrl(cloudUrl: string): string {
  const normalized = normalizeConvexUrl(cloudUrl);
  if (!normalized.includes(".convex.cloud")) {
    throw new Error("CONVEX_URL must be a .convex.cloud deployment URL");
  }
  return normalized.replace(/\.convex\.cloud$/, ".convex.site");
}

export function buildAwarenessGetUrl(env: NodeJS.ProcessEnv): string {
  const override = env.HERMES_AWARENESS_URL?.trim();
  if (override) return override;
  const cloud = env.CONVEX_URL?.trim();
  if (!cloud) throw new Error("CONVEX_URL is required");
  return `${convexSiteUrlFromCloudUrl(cloud)}/hermes/awareness`;
}

export async function pullAwarenessSnapshot(opts: {
  url: string;
  readKey: string;
  fetchImpl?: typeof fetch;
}): Promise<HermesAwarenessSnapshot> {
  const response = await (opts.fetchImpl ?? fetch)(opts.url, {
    method: "GET",
    headers: { Authorization: `Bearer ${opts.readKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 401) throw new Error("awareness pull unauthorized (check HERMES_CONVEX_READ_KEY)");
  if (!response.ok) throw new Error(`awareness pull HTTP ${response.status}`);
  return (await response.json()) as HermesAwarenessSnapshot;
}
```

Cache write: `writeFile` to temp path in same directory, then `rename` (atomic replace). On failure, leave prior cache intact.

### Cron installer pattern

Mirror `scripts/install-dashboard-sync-cron.sh`:

- Tag: `cns-awareness-pull` (distinct from `cns-dashboard-sync`)
- Schedule: `*/3 * * * *` (same cadence as dashboard-sync — acceptable parallel load; different lightweight GET vs heavy local collect+push)
- Log: `~/.hermes/logs/awareness-pull.log`
- Env: `~/.hermes/awareness-pull.env` (separate from deploy key file — principle of least privilege: read key ≠ mutation deploy key)

**Optional convenience:** Document that operator may `source` both env files in wrapper if they prefer one file — but default installer creates dedicated env file.

### Testing strategy

Follow `tests/hermes/validate-anthropic-key.test.ts` patterns:

- Import pure helpers from `../../scripts/hermes-awareness-pull.js`
- `vi.stubGlobal("fetch", …)` for HTTP mocks
- Use `mkdtemp` for cache write tests; verify file contents and that failed pull does not truncate existing cache
- Fixture minimal snapshot JSON with all 8 top-level keys (empty arrays/nulls OK)

**Runner:** `tests/hermes/**/*.test.ts` already in `vitest.config.ts` (story 75-1).

### Cross-story context (Epic 77)

| Story | Relationship to 77-2 |
|-------|---------------------|
| 77-1 | **Done** — HTTP endpoint this script calls |
| 77-3 | Independent — webhook push from Convex |
| 77-4 | **Blocked by 77-2** — skill runs this pull script on demand |
| 77-5 | Independent — UI uses Convex `useQuery`, not this cache file |
| 77-7 | Needs 77-2 validated ≥24h before deprecating dashboard-sync |

### Deferred-work awareness

- `deferred-work.md` notes dashboard-sync type drift risk — awareness types need same sync-comment discipline.
- Log rotation for `~/.hermes/logs/awareness-pull.log` — defer to ops (same as dashboard-sync deferred item).
- `RUN_CHAIN_STORY_KEY` stale in dashboard-sync — out of scope; do not fix in this story.

### Protect-list / WriteGate

**Not applicable** to vault WriteGate — no vault mutations. No `security.md` or `vault_log_action` changes.

### Project structure notes

```
Omnipotent.md/
├── scripts/
│   ├── hermes-awareness-pull.ts       # NEW
│   ├── awareness-pull.env.example     # NEW
│   ├── install-awareness-pull-cron.sh  # NEW
│   ├── run-awareness-pull-cron.sh     # NEW
│   └── dashboard-sync.ts            # UNCHANGED
├── tests/hermes/
│   └── hermes-awareness-pull.test.ts  # NEW
└── vitest.config.ts                 # UNCHANGED (75-1 already added glob)

~/.hermes/  (runtime, not in repo)
├── awareness-pull.env               # operator-created
├── memories/awareness-snapshot.json # cache output
└── logs/awareness-pull.log          # cron log
```

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` — Epic 77, Story 77-2]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` — ADR-HERMES-002, FR12 pull, test domain, file tree]
- [Source: `_bmad-output/implementation-artifacts/77-1-convex-hermes-awareness-snapshot-http-endpoint.md` — endpoint contract, URL note]
- [Source: `scripts/dashboard-sync.ts` — env pattern, normalizeConvexUrl, hand-mirror types]
- [Source: `scripts/install-dashboard-sync-cron.sh`, `scripts/run-dashboard-sync-cron.sh` — cron installer pattern]
- [Source: `../cns-dashboard/docs/DEPLOY.md` — `.convex.site` vs `.convex.cloud`, HERMES_CONVEX_READ_KEY]
- [Source: `../cns-dashboard/convex/validators.ts` — `hermesAwarenessSnapshotValidator` (normative DTO)]
- [Source: Convex docs — HTTP routes on `.convex.site`, Bearer header via Context7 `/llmstxt/convex_dev_llms_txt`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- `npm run test:vitest -- tests/hermes/hermes-awareness-pull.test.ts` — 13 passed
- `bash scripts/verify.sh` — VERIFY PASSED (after lint fix for unused imports in test file)

### Completion Notes List

- Implemented `scripts/hermes-awareness-pull.ts` with FR12 pull helpers: `.convex.cloud` → `.convex.site` URL derivation, Bearer auth, atomic cache write, `--json` / `--dry-run` CLI.
- Hand-mirrored `HermesAwarenessSnapshot` and subsection types from `cns-dashboard/convex/validators.ts`; reused `normalizeConvexUrl`, `McpStatusRow`, `VaultHealth`, `RunChainStatus`, `SyncMetadata` from `dashboard-sync.ts`.
- Added cron wrapper + idempotent installer mirroring dashboard-sync pattern (`cns-awareness-pull` tag, 3-min schedule, `~/.hermes/awareness-pull.env`).
- Vitest: 13 tests covering URL derivation, bearer header, successful pull envelope, 401 preserve-cache, DTO key validation.
- `dashboard-sync.ts` unchanged (AC6). Protect-list paths untouched.
- **Operator follow-up (T0.2, T0.3, T4):** Set `HERMES_CONVEX_READ_KEY` in Convex + WSL `~/.hermes/awareness-pull.env`, run manual pull + `bash scripts/install-awareness-pull-cron.sh`, confirm 2 cron cycles in `~/.hermes/logs/awareness-pull.log`.

### File List

- `scripts/hermes-awareness-pull.ts` (new)
- `scripts/awareness-pull.env.example` (new)
- `scripts/run-awareness-pull-cron.sh` (new)
- `scripts/install-awareness-pull-cron.sh` (new)
- `tests/hermes/hermes-awareness-pull.test.ts` (new)

### Change Log

- 2026-06-25: Story 77-2 — Hermes awareness pull client, cron installer, vitest coverage (Claude Sonnet 4.6)
