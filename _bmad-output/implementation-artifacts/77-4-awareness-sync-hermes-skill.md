---
baseline_commit: 7b0077a
---

# Story 77.4: Awareness-sync Hermes skill

Status: review

**Epic:** 77 — JARVIS Awareness in Nexus (alias Epic D1)  
**Repo boundary:** **Omnipotent.md only** (Hermes skill mirror, install script, contract tests). Pull client is **77-2** (`review`); Convex endpoint is **77-1** (`done`).  
**Normative spec:** `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` Story 77-4; `architecture-hermes-consolidation.md` ADR-HERMES-002, FR12 pull + chat surface  
**Prerequisites:** **77-2** pull client implemented (`scripts/hermes-awareness-pull.ts`, cron optional but not required for skill AC)  
**Blocks:** Operator FR12 chat queries on Desktop/Discord until this skill is installed and bound  
**Unblocks:** Natural-language cockpit Q&A without per-turn Convex MCP calls

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As an **operator**,
I want **a Hermes skill to on-demand refresh the awareness snapshot and summarize it for chat**,
so that **I can ask Hermes about live Nexus/cockpit state in Desktop or Discord (FR12)**.

## Acceptance Criteria

### AC1 — Skill installed at Hermes home (FR12 chat surface)

**Given** **77-2** pull client exists and operator has `~/.hermes/awareness-pull.env` configured (or env vars in Hermes session)  
**When** `bash scripts/install-hermes-skill-awareness-sync.sh` runs  
**Then** skill tree exists at `~/.hermes/skills/cns/awareness-sync/SKILL.md`  
**And** `SKILL.md` has valid Hermes frontmatter: `name: awareness-sync`, `description`, `version`, `metadata.hermes.tags`  
**And** `metadata.hermes.requires_toolsets: [terminal]` (or equivalent terminal capability per Hermes docs)  
**And** frontmatter lists required env **names only** (`OMNIPOTENT_REPO`, `CONVEX_URL`, `HERMES_CONVEX_READ_KEY`) — never secret values

### AC2 — Repo mirror + install gate compatibility

**Given** Epic **54/60/75** Hermes skill mirror conventions  
**When** implementation completes  
**Then** repo mirror exists at `scripts/hermes-skill-examples/awareness-sync/` (full tree: `SKILL.md`, `references/*`)  
**And** `scripts/install-hermes-skill-awareness-sync.sh` copies mirror → `~/.hermes/skills/cns/awareness-sync/` using the same `cp -a` pattern as `install-hermes-skill-run-chain.sh`  
**And** `awareness-sync` is added to `scripts/hermes-skill-bindings-expected.json` → `#hermes` channel `skills` list (after `investigate-trend`, before `morning-digest` — prefix triggers stay unambiguous)  
**And** `awareness-sync` is added to `tests/hermes-trigger-contract.test.mjs` → `TRIGGER_CONTRACT_SKILLS`  
**And** `awareness-sync` is **not** added to `parity_skills` trio (same as `run-chain` / `investigate-trend`) — mirror + install + bound-skill existence check only  
**And** after operator install, `bash scripts/verify.sh` passes (NFR1), including `node scripts/assert-hermes-skill-install-gate.mjs`

### AC3 — On-demand pull + cache read into session context

**Given** operator invokes the skill on Discord `#hermes` or Hermes Desktop  
**When** the skill runs (default: refresh then summarize)  
**Then** it invokes **`scripts/hermes-awareness-pull.ts`** via **`terminal()`** using the canonical pattern:

```bash
cd "${OMNIPOTENT_REPO}" && \
  set -a && source "${HOME}/.hermes/awareness-pull.env" && set +a && \
  npx tsx scripts/hermes-awareness-pull.ts
```

**And** on pull exit **0**, skill reads `~/.hermes/memories/awareness-snapshot.json` (or `HERMES_AWARENESS_CACHE_PATH` from env) into working context  
**And** cache envelope shape is `{ pulledAt, sourceUrl, snapshot }` where `snapshot` matches `HermesAwarenessSnapshot` (8 top-level keys: `sync`, `vault`, `chain`, `mcps`, `digest`, `entities`, `investigations`, `trends`)  
**And** skill **does not** call Convex HTTP directly, import Convex SDK, or use Convex MCP — **CLI pull + local file read only** (ADR-HERMES-002)  
**And** normative step-by-step behavior lives in `references/task-prompt.md` (REFERENCE ONLY invocation block per Story **54-4**)

**Given** pull fails (non-zero exit, 401, network) but a prior cache file exists  
**When** skill continues  
**Then** it reads **last good cache** and replies with explicit **stale** warning including `pulledAt` age  
**And** it does **not** claim freshness when pull failed

**Given** operator sends `awareness-sync --cache-only` (or documented alias)  
**When** skill runs  
**Then** it **skips** terminal pull and reads existing cache only — useful when cron refreshed within last 3 min

### AC4 — Bounded summary for operator question

**Given** snapshot (fresh or stale) is loaded  
**When** skill responds  
**Then** reply is **bounded markdown** (Discord-safe — no full JSON dump unless operator explicitly asks for `--json` debug)  
**And** summary addresses the operator's question using relevant snapshot sections:

| Question theme | Snapshot path | Minimum fields to cite |
|----------------|---------------|-------------------------|
| Run-chain status | `snapshot.chain` | `state`, `lastRunAt`, `lastSynthesisTitle` |
| Vault health | `snapshot.vault` | inbox depth, lint metrics, PAKE distribution summary |
| MCP / tool health | `snapshot.mcps` | name, status, last check |
| Morning digest | `snapshot.digest` | `brief.status`, `brief.date`, top 3 `topSignals` titles |
| Investigations | `snapshot.investigations` | `totalItems`, `columnCounts` |
| Entity intelligence | `snapshot.entities` | tracked/emerging display names + momentum one-liners |
| Trends / anomalies | `snapshot.trends` | anomaly keywords, score lifecycle stages |
| Sync freshness | `snapshot.sync` + envelope `pulledAt` | last sync time, stale if age > 5 min |

**And** when operator message is bare trigger (`awareness-sync` with no question), skill posts a **cockpit digest** covering chain, digest, vault, investigations count, and sync age in ≤25 lines

### AC5 — Example prompts documented

**Given** skill mirror complete  
**When** operator reads `references/example-prompts.md` (or equivalent section in SKILL.md)  
**Then** at least these documented example prompts exist with expected snapshot sections:

- `awareness-sync` — full cockpit digest  
- `What's the run-chain status?` — `snapshot.chain`  
- `How did the morning digest go?` — `snapshot.digest.brief` + top signals  
- `Any trend anomalies?` — `snapshot.trends.anomalies`  
- `Investigation board summary` — `snapshot.investigations`  
- `MCP health check` — `snapshot.mcps`

### AC6 — Protect-list and scope boundaries (NFR2)

**Given** Epic 77 D1 skill scope  
**When** implementation completes  
**Then** these paths have **zero diffs**:

- `src/agents/synthesis-adapter-llm.ts`
- `src/agents/hook-adapter-llm.ts`
- `src/agents/boss-adapter-llm.ts`
- `src/agents/run-chain.ts`
- `scripts/run-chain.ts`
- `scripts/hermes-awareness-pull.ts` (77-2 complete — skill **consumes**, does not modify pull client)
- `../cns-dashboard/convex/**` (77-1/77-3/77-5 territory)

**And** no vault WriteGate mutations, no Discord gateway config edits in repo, no secrets committed (NFR4)  
**And** no changes to `dashboard-sync.ts` behavior

### AC7 — Contract tests

**Given** repo mirror skill  
**When** `npm test` runs  
**Then** `tests/hermes-awareness-sync-skill.test.mjs` asserts mirror structure (SKILL.md frontmatter, task-prompt, trigger-pattern, example-prompts, install script, terminal command, cache path, stale-cache fallback language, env name-only policy)  
**And** `bash scripts/verify.sh` green in Omnipotent.md

## Tasks / Subtasks

### Prerequisite gate

- [x] **T0 — Dependency check**
  - [x] T0.1 Confirm **77-2** implemented: `scripts/hermes-awareness-pull.ts`, `scripts/awareness-pull.env.example`
  - [x] T0.2 Operator smoke (document in completion notes): manual pull writes `~/.hermes/memories/awareness-snapshot.json`
  - [x] T0.3 Read **77-2** story file for cache envelope contract and env file location

### Author repo mirror

- [x] **T1 — Skill tree** (AC: 1, 2, 5)
  - [x] T1.1 Create `scripts/hermes-skill-examples/awareness-sync/SKILL.md` — Hermes frontmatter, overview, When to use / not use, Policy
  - [x] T1.2 Create `references/task-prompt.md` — pull command, cache read, stale fallback, summary templates per section
  - [x] T1.3 Create `references/trigger-pattern.md` — `awareness-sync`, `awareness-sync --cache-only`, natural-language follow-ups when bound
  - [x] T1.4 Create `references/example-prompts.md` — documented Q&A examples (AC5)
  - [x] T1.5 Create `references/config-snippet.md` — `#hermes` binding + `OMNIPOTENT_REPO` + `awareness-pull.env` note
  - [x] T1.6 Add `scripts/install-hermes-skill-awareness-sync.sh`

### Verify gate wiring

- [x] **T2 — Bindings + tests** (AC: 2, 7)
  - [x] T2.1 Update `scripts/hermes-skill-bindings-expected.json` — add `awareness-sync` to `#hermes` skills list
  - [x] T2.2 Add `awareness-sync` to `tests/hermes-trigger-contract.test.mjs` → `TRIGGER_CONTRACT_SKILLS`
  - [x] T2.3 Add `tests/hermes-awareness-sync-skill.test.mjs`
  - [x] T2.4 Run `bash scripts/install-hermes-skill-awareness-sync.sh` (operator/dev machine with `~/.hermes/`)
  - [x] T2.5 `bash scripts/verify.sh` green

### Manual validation (operator)

- [x] **T3 — Smoke** (AC: 3, 4)
  - [x] T3.1 Discord or Desktop: `awareness-sync` → bounded cockpit digest with fresh `pulledAt`
  - [x] T3.2 Ask `What's the run-chain status?` → cites `chain.state` without full JSON
  - [x] T3.3 Simulate pull failure (wrong key) with existing cache → stale warning + last-good summary

## Dev Notes

### Repo boundary

| Repo | This story | Related |
|------|------------|---------|
| **Omnipotent.md** | Skill mirror, install script, bindings expected JSON, contract tests | All AC |
| **cns-dashboard** | None | 77-1 endpoint, 77-5 UI panels |
| **`~/.hermes/`** | Installed skill + runtime cache (not in git) | Operator install target |

Work from Omnipotent.md repo root. Commit here only.

### Architecture compliance

- **ADR-HERMES-001:** Production chat surface = Hermes Desktop/Discord; this skill is the FR12 **read** path for operators asking about `/nexus` data.
- **ADR-HERMES-002:** Skill consumes **cached** HTTP pull output — no Convex MCP, no live GET per chat turn unless operator explicitly triggers refresh via this skill.
- **FR12 pull:** 3-min cron (77-2) keeps cache warm; skill adds **on-demand refresh** for stale or operator-initiated queries.
- **NFR4:** `HERMES_CONVEX_READ_KEY` only in `~/.hermes/awareness-pull.env` (chmod 600) — never SKILL.md, never Discord replies.
- **Protect-list:** No run-chain adapter edits.
- **WriteGate:** Not applicable — read-only skill, no vault mutations.

### 77-2 pull client contract (READ — do not modify)

**Script:** `npx tsx scripts/hermes-awareness-pull.ts`  
**Flags:** `--json` (stdout envelope), `--dry-run` (fetch, no write)  
**Cache default:** `~/.hermes/memories/awareness-snapshot.json`  
**Env file:** `~/.hermes/awareness-pull.env` (from `scripts/awareness-pull.env.example`)

**Envelope:**

```typescript
type AwarenessCacheEnvelope = {
  pulledAt: number;      // Unix ms
  sourceUrl: string;     // GET URL (no bearer)
  snapshot: HermesAwarenessSnapshot;
};
```

**Snapshot top-level keys (required):** `sync`, `vault`, `chain`, `mcps`, `digest`, `entities`, `investigations`, `trends`

**Chain section** (`snapshot.chain`) — answers "What's the run-chain status?":

```typescript
// Hand-mirrored from cns-dashboard/convex/validators.ts runChainStatusValidator
{ state: string; lastRunAt: number | null; lastSynthesisTitle: string | null } | null
```

[Source: `scripts/hermes-awareness-pull.ts`; `_bmad-output/implementation-artifacts/77-2-hermes-awareness-pull-client-and-cron-cache.md`]

### Skill behavior spec (normative)

#### Trigger grammar (`references/trigger-pattern.md`)

| Trigger | Behavior |
|---------|----------|
| `awareness-sync` | Pull (refresh) + cockpit digest |
| `awareness-sync --cache-only` | Read cache only, no terminal pull |
| `awareness-sync --json` | Pull + post envelope JSON (operator debug only — warn about size) |
| Natural language when skill bound | e.g. "What's the run-chain status?" — refresh (unless `--cache-only` semantics requested) then answer from relevant section |

**Prefix discipline:** First token must be `awareness-sync` for explicit triggers (case-sensitive). Natural-language questions route when Hermes binds this skill — document in config-snippet, do not conflict with `investigate-trend keyword:` or `morning-digest` line-1 tokens.

#### Terminal invocation (canonical)

**Precondition:** `OMNIPOTENT_REPO` set to absolute Omnipotent.md path. If unset, reply with export instructions — do not guess cwd (mirror `run-chain` / verify-gate pattern).

**Pull command** — single `terminal()` call, `workdir=resolved_repo_root`:

```bash
cd "${OMNIPOTENT_REPO}" && \
  set -a && source "${HOME}/.hermes/awareness-pull.env" && set +a && \
  npx tsx scripts/hermes-awareness-pull.ts
```

**Env file missing:** Reply with copy instructions from `scripts/awareness-pull.env.example` → `~/.hermes/awareness-pull.env`, chmod 600. Do not run pull without `CONVEX_URL` + `HERMES_CONVEX_READ_KEY`.

**Cache read:** After successful pull (or cache-only path), read JSON via `terminal()` (`cat` with quoted path) or Hermes file-read capability if available — parse envelope, validate `snapshot` keys exist.

#### Output templates (`references/task-prompt.md`)

**Success digest (bare trigger):**

```markdown
## Cockpit awareness (fresh | stale — pulled <N> min ago)

**Run-chain:** {chain.state} — last run {relative time} — {lastSynthesisTitle or "—"}
**Digest ({date}):** {brief.status} — top signal: {topSignals[0].title or "—"}
**Vault:** inbox {depth} — lint {critical}/{total}
**Investigations:** {totalItems} ({triage} triage, {investigating} active)
**MCPs:** {ok count}/{total} healthy
**Sync:** last cockpit sync {sync.lastSyncAt relative}
```

**Stale fallback header (pull failed):**

```markdown
## Cockpit awareness (STALE — pull failed)

Pull error: {stderr one-liner — no secrets}
Using cache from {pulledAt relative}.
```

**401 / auth failure:** Point operator to verify `HERMES_CONVEX_READ_KEY` in both Convex deployment env and `~/.hermes/awareness-pull.env` — cite var **names** only.

### Hermes skill format (Context7 — `/nousresearch/hermes-agent`)

Required frontmatter fields: `name`, `description`, `version`, `author`, `metadata.hermes.tags`.  
Optional: `required_environment_variables`, `metadata.hermes.requires_toolsets: [terminal]`.  
Canonical invocation through **`terminal` tool** per Hermes CONTRIBUTING.md.

[Source: Context7 `/nousresearch/hermes-agent` — SKILL.md frontmatter, requires_toolsets]

### Pattern to mirror (prior art)

| Pattern source | Reuse for awareness-sync |
|----------------|--------------------------|
| `scripts/hermes-skill-examples/run-chain/` | Mirror layout, install script, REFERENCE ONLY task-prompt §0, `OMNIPOTENT_REPO` gate |
| `scripts/hermes-skill-examples/hermes-cns-verify-gate-summary/` | CLI terminal-only verify invocation, bounded summary output |
| `scripts/hermes-skill-examples/investigate-trend/` | Read-only skill, no vault writes, `#hermes` binding in expected JSON |
| `scripts/hermes-skill-examples/notebook-query/` | Sectioned task-prompt, bounded Discord output |

**Do NOT mirror:** `morning-digest` complexity (multi-adapter orchestration) — this skill is pull + read + summarize only.

### Verify Hermes skill gate (AC2)

`scripts/lib/hermes-skill-install-gate.mjs` checks:

1. Every skill listed in `hermes-skill-bindings-expected.json` → `~/.hermes/skills/cns/<skill>/SKILL.md` exists
2. `parity_skills` trio diff-match repo mirror (awareness-sync **excluded** from trio)

**Dev must run install script** before verify on machines with `~/.hermes/config.yaml` present, or gate fails on missing installed tree.

### Cross-story context (Epic 77)

| Story | Relationship to 77-4 |
|-------|---------------------|
| 77-1 | **Done** — HTTP endpoint pull script calls |
| 77-2 | **Prerequisite** — pull script + cache file this skill consumes |
| 77-3 | Independent — webhook push to Discord (proactive alerts) |
| 77-5 | Independent — `/nexus` UI uses Convex `useQuery`, not this cache file |
| 77-6 | Stretch — async ask box (FR13) |
| 77-7 | Retention decision for `dashboard-sync.ts` vs pull |

### Previous story intelligence (77-2)

- Pull uses `.convex.site` not `.convex.cloud` — skill must **not** document wrong URL pattern.
- Failed pull preserves last-good cache on disk — skill stale path aligns with 77-2 behavior.
- Separate env file `~/.hermes/awareness-pull.env` (not dashboard-sync deploy key) — skill sources this file, not `.env.live-chain`.
- Vitest for pull logic lives in `tests/hermes/hermes-awareness-pull.test.ts` — skill tests are **separate** contract tests in `tests/hermes-awareness-sync-skill.test.mjs` (Node test runner glob).
- Operator follow-ups T0.2/T4 from 77-2 may still be open — skill smoke depends on working pull env.

[Source: `_bmad-output/implementation-artifacts/77-2-hermes-awareness-pull-client-and-cron-cache.md` Dev Agent Record]

### Git intelligence

Recent Epic 77 commit: `7b0077a feat(hermes-consolidation): story 77-2 — Hermes awareness pull client and cron cache` — establishes files this skill wraps without modifying.

### Project structure notes

```
Omnipotent.md/
├── scripts/
│   ├── hermes-awareness-pull.ts              # UNCHANGED (77-2)
│   ├── awareness-pull.env.example            # UNCHANGED
│   ├── install-hermes-skill-awareness-sync.sh  # NEW
│   ├── hermes-skill-bindings-expected.json   # UPDATE — add awareness-sync
│   └── hermes-skill-examples/
│       └── awareness-sync/                   # NEW
│           ├── SKILL.md
│           └── references/
│               ├── task-prompt.md
│               ├── trigger-pattern.md
│               ├── example-prompts.md
│               └── config-snippet.md
├── tests/
│   ├── hermes-awareness-sync-skill.test.mjs  # NEW
│   └── hermes-trigger-contract.test.mjs      # UPDATE
└── scripts/verify.sh                         # UNCHANGED (runs skill gate)

~/.hermes/  (runtime, not in repo)
├── awareness-pull.env
├── memories/awareness-snapshot.json
└── skills/cns/awareness-sync/                # install target
```

### Testing strategy

**Contract tests** (`tests/hermes-awareness-sync-skill.test.mjs`) — mirror `tests/hermes-run-chain-skill.test.mjs`:

- SKILL.md frontmatter: `name: awareness-sync`, `requires_toolsets: [terminal]`, REFERENCE ONLY language
- task-prompt: pull command with `awareness-pull.env`, cache read, stale template, section routing table
- trigger-pattern: `awareness-sync`, `--cache-only`, example natural-language hooks
- example-prompts: all AC5 strings present
- install script exists and references correct SRC_DIR
- No secret-like patterns in skill text (`sk-ant-`, bearer tokens, long `key=value` assignments)
- Documents `hermes-awareness-pull.ts` path (not direct Convex URL in skill output templates)

**Not in scope:** Live Discord E2E, mocking Hermes gateway routing.

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` — Epic 77, Story 77-4]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` — ADR-HERMES-002, file tree `awareness-sync/SKILL.md`]
- [Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` — FR12]
- [Source: `_bmad-output/implementation-artifacts/77-2-hermes-awareness-pull-client-and-cron-cache.md` — pull/cache contract]
- [Source: `_bmad-output/implementation-artifacts/75-3-hermes-run-chain-trigger-skill.md` — skill mirror + install pattern]
- [Source: `scripts/hermes-awareness-pull.ts` — envelope types, cache path, CLI]
- [Source: `scripts/hermes-skill-bindings-expected.json` — channel bindings SSOT for verify gate]
- [Source: `scripts/lib/hermes-skill-install-gate.mjs` — gate behavior]
- [Source: Context7 `/nousresearch/hermes-agent` — SKILL.md frontmatter, terminal invocation]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — no vault mutations in this story]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- `bash scripts/verify.sh` — PASS (full suite including `hermes-awareness-sync-skill.test.mjs` and install gate)
- `bash scripts/install-hermes-skill-awareness-sync.sh` — installed to `~/.hermes/skills/cns/awareness-sync`
- `npx tsx scripts/hermes-awareness-pull.ts --dry-run` — PASS with `~/.hermes/awareness-pull.env`; cache at `~/.hermes/memories/awareness-snapshot.json` present

### Completion Notes List

- Added `awareness-sync` Hermes skill mirror (SKILL.md + references) following run-chain / investigate-trend patterns; terminal-only pull via `hermes-awareness-pull.ts`, local cache read, stale fallback, bounded cockpit digest templates.
- Wired `awareness-sync` into `hermes-skill-bindings-expected.json` (after `investigate-trend`, before `morning-digest`), trigger contract tests, and fixture YAML; excluded from `parity_skills` trio per AC2.
- Contract tests in `tests/hermes-awareness-sync-skill.test.mjs` cover frontmatter, task-prompt, triggers, example-prompts, install script, env name-only policy.
- **Operator follow-up (T3 live chat):** Bind `awareness-sync` in `~/.hermes/config.yaml` if not already synced from expected JSON; smoke `awareness-sync` and natural-language questions in Discord `#hermes` or Desktop. T3.3 stale path: temporarily set wrong `HERMES_CONVEX_READ_KEY` in env file, invoke skill, confirm STALE header — skill docs and task-prompt specify behavior; automated tests do not cover live Hermes routing.

### File List

- `scripts/hermes-skill-examples/awareness-sync/SKILL.md` (new)
- `scripts/hermes-skill-examples/awareness-sync/references/task-prompt.md` (new)
- `scripts/hermes-skill-examples/awareness-sync/references/trigger-pattern.md` (new)
- `scripts/hermes-skill-examples/awareness-sync/references/example-prompts.md` (new)
- `scripts/hermes-skill-examples/awareness-sync/references/config-snippet.md` (new)
- `scripts/install-hermes-skill-awareness-sync.sh` (new)
- `scripts/hermes-skill-bindings-expected.json` (modified)
- `tests/hermes-awareness-sync-skill.test.mjs` (new)
- `tests/hermes-trigger-contract.test.mjs` (modified)
- `tests/fixtures/hermes-channel-skill-bindings.yaml` (modified)

### Change Log

- 2026-06-25: Story 77-4 — awareness-sync Hermes skill mirror, install script, bindings, contract tests; verify.sh green.
