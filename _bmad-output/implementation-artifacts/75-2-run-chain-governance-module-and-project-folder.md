# Story 75.2: Run-chain governance module and project folder

baseline_commit: 722b28de07ece9114eecccf2acb4736d588bfb2d

Status: review

<!-- Documentation + vault stub story — zero protect-list / src/ edits. Hermes skill is 75-3. Derive all stage/env facts from scripts/run-chain.ts and src/agents/run-chain.ts — do not fabricate. -->

## Story

As an **operator**,
I want **run-chain documented in `AI-Context/modules/run-chain.md` and a vault project folder for revival work**,
so that **Hermes cold-starts with run-chain context without engine code changes (FR7)**.

## Acceptance Criteria

1. **Governance module created (FR7)**
   **Given** protect-list paths remain untouched (NFR2) and WriteGate rules for `AI-Context/**`
   **When** `AI-Context/modules/run-chain.md` is authored at **both** copies (repo mirror + canonical vault)
   **Then** both copies are **identical** after save (`diff -q` clean)
   **And** the module documents (derived from live code, not training data):
   - **Purpose** — what run-chain does (Research → Synthesis → Hook → Boss research pipeline)
   - **Entry point** — `scripts/run-chain.ts` (CLI) calling `runChain()` in `src/agents/run-chain.ts`
   - **Stage sequence** — exact order: Research (`runResearchAgent`) → Synthesis (`runSynthesisAgent`) → Hook (`runHookAgent`) → Boss/Weapons (`runBossAgent`)
   - **Required env vars** — from `assertChainLiveRequiredEnv()` plus runtime vars; **`.env.live-chain`** as operator sourcing pattern (gitignored repo root)
   - **Optional env vars** — `PERPLEXITY_API_KEY` (slot may disable), `SCRAPLING_COMMAND`, `CNS_BRIEF_TOPIC`, `CHAIN_VAULT_ROOT_CLASS`, `CNS_VAULT_ROOT`, OpenRouter synthesis branch
   - **CLI flags** — `--brief-file`, `--topic`, `--query`, `--depth`, `--save-sources`, `--evidence-file`, `--raw-json`, `--verbose-cleanup`, `--help`
   - **Known failure modes** — missing env, dead `ANTHROPIC_API_KEY` (401), Firecrawl/Apify HTTP errors, Scrapling not on PATH, Perplexity slot unavailable, synthesis PAKE validation fail, output read-back fail
   - **FR11 Option A credential posture** — one `ANTHROPIC_API_KEY` in `.env.live-chain` for Synthesis (default Anthropic) + Hook + Boss; Portal OAuth does **not** replace run-chain LLM calls
   - **Forbidden edits** — protect-list table (five paths); NFR2
   - **Operator trigger procedure (manual v1)** — copy-paste safe pattern: `cd` repo → `source .env.live-chain` → `npx tsx scripts/run-chain.ts` with brief args; note Hermes skill trigger is **75-3**, not this story
   - **Vault outputs** — default memory-only acquisition (Story 25.1); synthesis/hook/weapons notes under `03-Resources/`; `--save-sources` opt-in
   - **References** — ADR-HERMES-004, `deferred-work.md` §LLM provider consolidation, Epic 75 stories 75-3..75-5

2. **Vault project folder (co-located stub)**
   **Given** module from AC #1 and existing `AI-Context/modules/` layout
   **When** a lightweight revival stub is created at **`AI-Context/projects/run-chain/README.md`** (README only — **not** a full project plan)
   **Then** project folder is co-located under `AI-Context/projects/` alongside governance modules in `AI-Context/modules/`
   **And** stub links to `AI-Context/modules/run-chain.md` as SSOT
   **And** both repo mirror and canonical vault copies match
   **And** no stub under `02-Areas/` or other PARA roots — `AI-Context/projects/run-chain/` is the only project path

3. **Hermes cold-start reference (MEMORY or skill index)**
   **Given** module from AC #1
   **When** story closes
   **Then** **at least one** cold-start path references the module:
   - **(Preferred A)** `AI-Context/MEMORY.md` **Environment** section includes a line: `Run-chain SSOT: AI-Context/modules/run-chain.md (Epic 75 revival; dormant engine)`
   - **(Preferred B)** operator runs `/session-close` requesting AGENTS §7 row: `Run-chain | AI-Context/modules/run-chain.md | Research→Synthesis→Hook→Boss pipeline, `.env.live-chain`, protect-list, manual/skill trigger`
   - **(Fallback)** story evidence records deferral of AGENTS §7 row → **76-4** with MEMORY line done
   **And** dev does **not** create `~/.hermes/skills/cns/run-chain/SKILL.md` (that is **75-3**)

4. **Verify gate (NFR1)**
   **Given** implementation complete
   **When** `bash scripts/verify.sh` runs
   **Then** it passes with no regressions

5. **Protect-list + scope (NFR2)**
   **Given** this story
   **When** implementation completes
   **Then** **zero diffs** on:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** no new Hermes skill files, no `scripts/validate-anthropic-key.ts` (75-4), no `src/` changes

6. **Evidence artifact**
   **Given** AC #1–#5 complete
   **When** story closes
   **Then** `_bmad-output/implementation-artifacts/75-2-governance-evidence.md` exists with dated PASS/FAIL per AC, `diff -q` results for vault copies, and note on MEMORY vs AGENTS §7 reference path

## Tasks / Subtasks

- [x] **AC #1 — Read live run-chain source** (AC: #1)
  - [x] Read `scripts/run-chain.ts` fully — env asserts, CLI, cleanup, evidence output
  - [x] Read `src/agents/run-chain.ts` — stage order and default adapters
  - [x] Skim `src/agents/research-agent.ts` for Research tier names (Firecrawl, Apify, Scrapling, Perplexity)
  - [x] Do **not** edit either run-chain file

- [x] **AC #1 — Author `run-chain.md` module** (AC: #1)
  - [x] Use `AI-Context/modules/hermes-desktop.md` as tone/structure reference (governance module pattern from 74-8)
  - [x] Write repo mirror: `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md`
  - [x] Write canonical vault: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md`
  - [x] `diff -q` both copies identical

- [x] **AC #2 — Create `AI-Context/projects/run-chain/README.md`** (AC: #2)
  - [x] Create `Knowledge-Vault-ACTIVE/AI-Context/projects/run-chain/README.md` (status: dormant/revival; link to module; Epic 75 tracker)
  - [x] Sync canonical vault: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/projects/run-chain/README.md`
  - [x] `diff -q` both copies identical

- [x] **AC #3 — Hermes cold-start pointer** (AC: #3)
  - [x] Update `AI-Context/MEMORY.md` Environment line **or** document session-close AGENTS §7 request
  - [x] Sync `~/.hermes/memories/MEMORY.md` if symlinked (verify with `readlink -f`)
  - [x] Do **not** install Hermes skill (75-3)

- [x] **AC #4–#6 — Gate + evidence** (AC: #4, #5, #6)
  - [x] `bash scripts/verify.sh` green
  - [x] `git diff` — protect-list clean; no secrets in committed files
  - [x] Complete `75-2-governance-evidence.md`

### Review Findings

- [ ] [Review][Patch] Remove unrelated Story 76-3 triage plan from the 75-2 worktree [Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md:1]
- [ ] [Review][Patch] Refresh or avoid introducing stale MEMORY cold-start state; the new file points Next Session at Story 73-7 while this review is for Epic 75 [Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md:1]
- [ ] [Review][Patch] Fix stale story status note that still says this story is ready-for-dev while the story status is review [_bmad-output/implementation-artifacts/75-2-run-chain-governance-module-and-project-folder.md:366]
- [ ] [Review][Patch] Clarify Apify required env as APIFY_API_TOKEN or APIFY_TOKEN alias, not two required variables [Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md:57]
- [ ] [Review][Patch] Document preflight failures separately from compact fatal evidence; parse/env failures occur before the script's evidence catch [Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md:128]
- [ ] [Review][Patch] Clarify research tier routing: Firecrawl and Apify run concurrently with social-domain routing, then Scrapling, then Perplexity filing [Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md:39]
- [ ] [Review][Patch] Add zero-source downstream skip cascade to failure modes so all-acquisition-failed runs are not misread as read-back defects [Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md:124]

## Dev Notes

### Epic and sequencing context

- **Epic 75 (Run-Chain Knowledge + Revival)** — alias **Epic B**; FRs **FR7**, **FR8**, **FR11**.
- **Depends:** Epic 74 complete (Portal stable). **75-1** done (vitest `tests/hermes/` domain).
- **This story blocks:** **75-3** (Hermes run-chain skill reads this module as SSOT).
- **Parallel:** Epic 76 orientation cleanup.
- **Out of scope:** Hermes skill (`75-3`), `validate-anthropic-key.ts` (`75-4`), E2E revival proof (`75-5`), any adapter/engine code.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 75, Story 75-2; `sprint-status.yaml`]

### Run-chain architecture (from code — MUST match module)

**Orchestrator** (`src/agents/run-chain.ts`):

```typescript
// Stage order (sequential await chain):
const sweep = await runResearchAgent(vaultRoot, brief, opts.research);
const synthesis = await runSynthesisAgent(vaultRoot, sweep, { ... });
const hooks = await runHookAgent(vaultRoot, synthesis, { ... });
const weapons = await runBossAgent(vaultRoot, hooks, { ... });
return { sweep, synthesis, hooks, weapons };
```

**CLI entry** (`scripts/run-chain.ts`):

| Concern | Detail |
|---------|--------|
| Invoke | `npx tsx scripts/run-chain.ts` from repo root |
| Env file pattern | `source .env.live-chain` (used by gateway, digest, triage skill examples) |
| Default vault | `CNS_VAULT_ROOT` or fallback `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` |
| Fail-fast env | `assertChainLiveRequiredEnv()` before chain runs |

**Required environment variables** (`assertChainLiveRequiredEnv`):

| Variable | Stage / service |
|----------|-----------------|
| `FIRECRAWL_API_KEY` | Research — Firecrawl adapter |
| `ANTHROPIC_API_KEY` | Synthesis (default provider), Hook, Boss |
| `APIFY_API_TOKEN` | Research — Apify (canonical) |
| `APIFY_TOKEN` | Deprecated alias for Apify — accepted if canonical unset |

**Conditional (OpenRouter synthesis only)** — when `CNS_SYNTHESIS_PROVIDER=openrouter`:

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Synthesis adapter |
| `CNS_SYNTHESIS_MODEL` | e.g. `moonshotai/kimi-k2.6` |

Default synthesis provider is **Anthropic** (`claude-sonnet-4-6`) when `CNS_SYNTHESIS_PROVIDER` unset — Hook/Boss always Anthropic regardless.

**Optional / runtime variables**:

| Variable | Default / behavior |
|----------|-------------------|
| `CNS_VAULT_ROOT` | Active vault path |
| `CNS_BRIEF_TOPIC` | Default topic string in script |
| `PERPLEXITY_API_KEY` | Not in assertChainLiveRequiredEnv — Perplexity slot may report `available: false` |
| `SCRAPLING_COMMAND` | Default `scrapling`; disabled if not on PATH |
| `CHAIN_VAULT_ROOT_CLASS` | `staging` \| `active` \| `unknown` for evidence |
| `CNS_SYNTHESIS_PROVIDER` | `anthropic` (default) or `openrouter` |

**Brief selection** (CLI or env):

- `--brief-file path.json` — ResearchBrief JSON (`topic`, `queries`, `depth`, optional `tags`)
- `--topic`, `--query` (repeatable), `--depth` (`shallow` \| `standard` \| `deep`, default `deep`)
- `CNS_BRIEF_TOPIC` env when no `--topic`

[Source: `scripts/run-chain.ts` lines 1–25, 197–222, 514–547, 736–831; `src/agents/run-chain.ts` lines 55–94]

### Known failure modes (document in module)

| Failure | Symptom | Operator action |
|---------|---------|-----------------|
| Missing required env | Throws before chain: `Missing required environment variables: …` | Fix `.env.live-chain`; run `source .env.live-chain` |
| Dead `ANTHROPIC_API_KEY` | HTTP 401 on Synthesis/Hook/Boss | **75-4** validate/rotate key; do **not** edit adapters (ADR-HERMES-004) |
| Firecrawl / Apify HTTP error | Recorded in smoke evidence `externalServiceErrors` | Check keys, quotas, network |
| Scrapling not on PATH | Operator note: adapter disabled | Install CLI or set `SCRAPLING_COMMAND` |
| Perplexity unavailable | Research continues without Perplexity tier | Optional — configure MCP/slot if needed |
| Synthesis PAKE validation fail | Summary `PAKE++ validation: FAIL` | Review synthesis body vs operator context |
| Output read-back fail | Summary `Result: FAIL` on synthesis/hooks/weapons paths | Check vault write permissions, WriteGate on target paths |
| Fatal uncaught error | Compact fatal evidence markdown to stderr | Read evidence file; check brief JSON shape |

**Current production blocker (PRD):** `ANTHROPIC_API_KEY` **401 dead** since ~2026-05-24 — chain dormant until **75-4** key validation/rotation.

[Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §2 Background; `deferred-work.md` §LLM provider consolidation]

### FR11 Option A (ADR-HERMES-004)

- Keep **one** `ANTHROPIC_API_KEY` in `.env.live-chain`.
- **All three** LLM stages (Synthesis default, Hook, Boss) use Anthropic Messages API via existing adapters.
- **Zero** edits to protect-list adapter files in Epic 75 unless operator explicitly authorizes FR11-B.
- Portal `nous` OAuth replaces Hermes **inference** only — **not** run-chain LLM calls.

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §ADR-HERMES-004]

### Protect-list (NFR2 — zero diffs)

| Path | Reason |
|------|--------|
| `src/agents/synthesis-adapter-llm.ts` | Synthesis LLM adapter |
| `src/agents/hook-adapter-llm.ts` | Hook LLM adapter |
| `src/agents/boss-adapter-llm.ts` | Boss LLM adapter |
| `src/agents/run-chain.ts` | Orchestrator |
| `scripts/run-chain.ts` | CLI entry |

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Protect-list gate]

### Vault path contract — dual copy sync (CRITICAL)

| Copy | Path |
|------|------|
| Repo mirror (commit in Omnipotent.md) | `Knowledge-Vault-ACTIVE/AI-Context/...` |
| Canonical vault (Obsidian live) | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/...` |

Pattern established in **74-8**: update **both**, verify:

```bash
diff -q \
  Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md \
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md"
```

[Source: `_bmad-output/implementation-artifacts/74-8-portal-and-desktop-governance-documentation.md` §Vault path contract]

### WriteGate boundaries

| Path | This story |
|------|------------|
| `AI-Context/modules/run-chain.md` | **Create** (repo + canonical) — operator FS or approved MCP write |
| `AI-Context/projects/run-chain/README.md` | **Create** stub (co-located with `AI-Context/modules/`) |
| `AI-Context/MEMORY.md` | **Update** Environment line only (optional AGENTS §7 via session-close) |
| `AI-Context/AGENTS.md` | **Do not edit directly** — route §7 row via `/session-close` or defer **76-4** |
| `specs/cns-vault-contract/AGENTS.md` | **Do not edit** |

`src/write-gate.ts` blocks all `AI-Context/**` Vault IO writes (`PROTECTED_PATH`). Session-close uses operator filesystem for `AI-Context/**` per skill contract.

[Source: `src/write-gate.ts` `isAiContextPath()`; `scripts/hermes-skill-examples/session-close/SKILL.md`; `specs/cns-vault-contract/AGENTS.md` §4]

### `run-chain.md` module skeleton (minimum sections)

```markdown
# Run-Chain Pipeline (Epic 75 / FR7)

Governance for the CNS research chain: Research → Synthesis → Hook → Boss.
Engine code is **protect-listed** — revival is knowledge + env + Hermes trigger only.

## Status

Dormant (ANTHROPIC_API_KEY 401 until 75-4). Hermes inference uses Portal OAuth separately.

## What it does

(4-stage pipeline summary + vault outputs)

## Entry points

| Entry | Path |
|-------|------|
| CLI (operator) | `scripts/run-chain.ts` |
| Orchestrator | `src/agents/run-chain.ts` → `runChain()` |

## Stage sequence

Research → Synthesis → Hook → Boss (table with agent function names)

## Environment (`.env.live-chain`)

Required / conditional / optional tables from assertChainLiveRequiredEnv

## Operator procedure (manual)

source .env.live-chain → tsx scripts/run-chain.ts …
(Hermes skill: story 75-3)

## CLI reference

(flags from parseArgs / printHelp)

## Known failure modes

(matrix from Dev Notes)

## FR11 / protect-list

ADR-HERMES-004 + forbidden paths table

## References

- AI-Context/projects/run-chain/README.md
- deferred-work.md, Epic 75 stories
```

Mirror tone/depth of `AI-Context/modules/hermes-desktop.md` (tables, prerequisites, troubleshooting).

### Project folder (operator decision — locked)

**Path:** `AI-Context/projects/run-chain/README.md` only.

Co-locate revival work under `AI-Context/projects/` next to governance docs in `AI-Context/modules/`. Do **not** create `02-Areas/run-chain-revival/` or any other PARA-root stub.

Stub content only:

- Title + `status: dormant`
- Link to `[[AI-Context/modules/run-chain]]`
- One-line Epic 75 tracker (75-3 skill, 75-4 key, 75-5 E2E)

### Hermes cold-start — MEMORY vs AGENTS §7

**74-8 precedent:** AGENTS §7 row added via session-close **or** deferred to **76-4**.

For **75-2**, AC requires Hermes to know run-chain exists at cold-start:

1. **MEMORY.md** — `~/.hermes/memories/MEMORY.md` often symlinks to vault `AI-Context/MEMORY.md`. Add Environment bullet pointing to module. Session-close regenerates CNS State block but preserves other sections — confirm merge behavior before overwriting unrelated content.
2. **AGENTS §7 module table** — row: `Run-chain | AI-Context/modules/run-chain.md | Run-chain pipeline, env, protect-list, operator trigger`
3. **Not skill index** — `~/.hermes/skills/cns/run-chain/` is **75-3**; do not partial-install.

Existing cross-reference: `hermes-desktop.md` already notes run-chain uses `.env.live-chain` ANTHROPIC key — new module is the dedicated SSOT.

[Source: `AI-Context/modules/hermes-desktop.md`; `_bmad-output/implementation-artifacts/74-8-portal-and-desktop-governance-documentation.md` AC #6]

### Previous story intelligence (75-1)

- `tests/hermes/**/*.test.ts` registered in `vitest.config.ts`; placeholder at `tests/hermes/run-chain.test.ts`.
- **Do not** duplicate vault-io run-chain tests (`tests/vault-io/run-chain.test.ts` — orchestration unit tests).
- Real Hermes integration tests for run-chain land in **75-4** (`validate-anthropic-key.test.ts`).
- 75-1 verify baseline: 51 vitest files, 643 tests; `VERIFY PASSED` 2026-06-24.

[Source: `_bmad-output/implementation-artifacts/75-1-hermes-test-domain-and-vitest-include.md`]

### Architecture compliance

- **FR7:** Governance module + vault folder + cold-start reference — no engine code.
- **NFR1:** `bash scripts/verify.sh` passes (docs-only expected).
- **NFR2:** Protect-list untouched; NEXUS bridge / digest cron untouched.
- **ADR-HERMES-004:** Document Option A; forbid adapter edits in module.

### File structure requirements

| File | Action |
|------|--------|
| `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md` | **NEW** |
| `/mnt/c/.../AI-Context/modules/run-chain.md` | **NEW** (canonical) |
| `Knowledge-Vault-ACTIVE/AI-Context/projects/run-chain/README.md` | **NEW** stub |
| `/mnt/c/.../AI-Context/projects/run-chain/README.md` | **NEW** (canonical) |
| `AI-Context/MEMORY.md` | **UPDATE** (Environment line) — optional |
| `_bmad-output/implementation-artifacts/75-2-governance-evidence.md` | **NEW** |

**Forbidden:** any `src/`, `scripts/run-chain.ts`, protect-list, Hermes skill files, `vitest.config.ts` changes unless fixing unrelated regression.

### Testing requirements

- **Primary gate:** `bash scripts/verify.sh` — must pass unchanged.
- **No new vitest tests required** — documentation story; 75-4 adds Hermes script tests.
- **Manual verification:**
  - Module stage names match `src/agents/run-chain.ts`
  - Env table matches `assertChainLiveRequiredEnv` / `printHelp`
  - `diff -q` on all dual vault copies
  - Protect-list: `git diff --name-only` excludes five paths

### Project context reference

- Hermes Consolidation track Epics 74–78 on branch `hermes-consolidation`.
- Epic 74 `done`; Epic 75 `in-progress` (75-1 `done`, this story `review`).
- Run-chain **dormant** — adapters use Anthropic API directly (Epic 38-2 deferred OpenRouter path exists in synthesis adapter but protect-list applies).

[Source: `project-context.md`; `_bmad-output/implementation-artifacts/deferred-work.md`]

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 75, Story 75-2]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §ADR-HERMES-004, §Protect-list, §Project Structure]
- [Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR7, §G2, §2 Background]
- [Source: `scripts/run-chain.ts` — CLI, env, evidence]
- [Source: `src/agents/run-chain.ts` — stage orchestration]
- [Source: `_bmad-output/implementation-artifacts/74-8-portal-and-desktop-governance-documentation.md` — governance module pattern]
- [Source: `_bmad-output/implementation-artifacts/75-1-hermes-test-domain-and-vitest-include.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — Anthropic 401 blocker]
- [Source: `specs/cns-vault-contract/AGENTS.md` §4, §7]

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (Cursor)

### Debug Log References

- `readlink -f ~/.hermes/memories/MEMORY.md` → not symlinked to vault (self path); vault MEMORY updated per Preferred A
- All dual-copy `diff -q` checks clean (module, project stub, MEMORY)

### Completion Notes List

- Authored `AI-Context/modules/run-chain.md` from live `scripts/run-chain.ts` and `src/agents/run-chain.ts` (stage order, env asserts, CLI flags, failure modes, FR11-A, protect-list)
- Created co-located project stub at `AI-Context/projects/run-chain/README.md`
- Added MEMORY Environment line for Hermes cold-start (AGENTS §7 deferred to 76-4 / session-close)
- `bash scripts/verify.sh` VERIFY PASSED; protect-list zero diffs; no Hermes skill created

### File List

- Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md (new)
- Knowledge-Vault-ACTIVE/AI-Context/projects/run-chain/README.md (new)
- Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md (new repo mirror + Environment line)
- _bmad-output/implementation-artifacts/75-2-governance-evidence.md (new)
- _bmad-output/implementation-artifacts/75-2-run-chain-governance-module-and-project-folder.md (updated)
- _bmad-output/implementation-artifacts/sprint-status.yaml (updated)

### Change Log

- 2026-06-24: Story 75-2 — run-chain governance module, project stub, MEMORY cold-start pointer, evidence artifact

## Story Completion Status

- **Status:** review
- **Completion note:** Governance module, project stub, and MEMORY cold-start pointer complete; verify gate passed; ready for code review
