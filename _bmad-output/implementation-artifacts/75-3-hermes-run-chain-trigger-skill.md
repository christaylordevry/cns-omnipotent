# Story 75.3: Hermes run-chain trigger skill

Status: review

baseline_commit: 18b917197d4b94293f9cc2b073612de96aa85197

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. FR8 Hermes skill; zero protect-list / engine edits. SSOT for stage order, env, CLI, failure modes: AI-Context/modules/run-chain.md (75-2). No live E2E (75-5); no validate-anthropic-key.ts (75-4). -->

## Story

As an **operator**,
I want **a Hermes skill that runs run-chain via `terminal()` and reports results to Discord or Desktop**,
so that **I can revive the research chain without new adapter code (FR8)**.

## Acceptance Criteria

1. **Skill installed at Hermes home (FR8)**
   **Given** governance module from **75-2** (`AI-Context/modules/run-chain.md`) and Epic **74** Portal stable
   **When** the skill tree is installed at `~/.hermes/skills/cns/run-chain/SKILL.md`
   **Then** `SKILL.md` exists with valid Hermes frontmatter (`name: run-chain`, `description`, `version`, `metadata.hermes.tags`)
   **And** the skill declares **`.env.live-chain` dependency** and required env **var names only** (never secret values)
   **And** `metadata.hermes` includes `requires_toolsets: [terminal]` (or equivalent terminal capability per Hermes docs)

2. **Repo mirror + verify install gate pattern**
   **Given** Epic **54/60** Hermes skill mirror conventions
   **When** implementation completes
   **Then** repo mirror exists at `scripts/hermes-skill-examples/run-chain/` (full tree: `SKILL.md`, `references/*`)
   **And** `scripts/install-hermes-skill-run-chain.sh` copies mirror → `~/.hermes/skills/cns/run-chain/` using the same `cp -a` pattern as `install-hermes-skill-investigate-trend.sh`
   **And** after install, `cmp -r scripts/hermes-skill-examples/run-chain ~/.hermes/skills/cns/run-chain` is clean (or document operator re-run install in completion notes)
   **And** `bash scripts/verify.sh` passes (NFR1)
   **Note:** `run-chain` is **not** in the `parity_skills` trio (`notebook-query`, `morning-digest`, `session-close`) — mirror + install script is sufficient unless operator later adds it to `scripts/hermes-skill-bindings-expected.json` `parity_skills`.

3. **Terminal invocation (documented entry)**
   **Given** operator triggers the skill on Discord `#hermes` or Hermes Desktop
   **When** the skill runs
   **Then** it invokes **`scripts/run-chain.ts`** via **`terminal()`** (Hermes shell tool) using the canonical pattern from `AI-Context/modules/run-chain.md`:

   ```bash
   cd "${OMNIPOTENT_REPO:-/home/christ/ai-factory/projects/Omnipotent.md}" && \
     set -a && source .env.live-chain && set +a && \
     npx tsx scripts/run-chain.ts --topic "<topic>" --query "<query>" [--depth shallow|standard|deep] [--evidence-file <path>] [--raw-json]
   ```

   **And** brief args come from parsed operator input (`references/trigger-pattern.md`) — not hard-coded test briefs
   **And** skill **does not** call `runChain()` or import protect-list modules directly — CLI only
   **And** normative step-by-step behavior lives in `references/task-prompt.md` (REFERENCE ONLY invocation block per Story **54-4**)

4. **Success/failure summary to surface**
   **Given** terminal command completes (any exit code)
   **When** the skill finishes
   **Then** Hermes posts a **bounded** markdown summary to the **same Discord thread** or **Desktop session** that invoked the skill
   **And** summary includes at minimum: **exit code**, **Result** (PASS/FAIL or chain summary line), **topic**, and **actionable next step** on failure
   **And** on **HTTP 401 / dead `ANTHROPIC_API_KEY`**, summary explicitly states the known blocker and points to Story **75-4** (`scripts/validate-anthropic-key.ts`) — **never silent failure**
   **And** on **missing env / preflight throw** (before chain catch), summary cites missing var **names** from stderr and points to `.env.live-chain` + module SSOT
   **And** output is capped for Discord (no full `ChainRunResult` JSON dump unless operator passed `--raw-json` and explicitly requested verbose output)

5. **Environment declaration without secrets (NFR4 / ADR-E46-003)**
   **Given** `.env.live-chain` is gitignored at repo root
   **When** skill frontmatter and docs reference credentials
   **Then** only **variable names** appear: `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY`, `APIFY_API_TOKEN` (or `APIFY_TOKEN` alias), optional `OPENROUTER_API_KEY`, `CNS_SYNTHESIS_MODEL`, `PERPLEXITY_API_KEY`, `CNS_VAULT_ROOT`, etc.
   **And** skill instructs operator to `source .env.live-chain` in the terminal preamble — **never** embed key values in SKILL.md, task-prompt, or Discord replies
   **And** `references/config-snippet.md` documents optional `terminal.env_passthrough` only if Hermes subprocess cannot see sourced vars (prefer `source .env.live-chain` in the same shell command)

6. **Protect-list + scope (NFR2)**
   **Given** ADR-HERMES-004 protect-list
   **When** implementation completes
   **Then** **zero diffs** on:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** no `scripts/validate-anthropic-key.ts` (75-4)
   **And** no live operator E2E proof artifact (75-5)

7. **Contract tests**
   **Given** repo mirror skill
   **When** `npm test` runs
   **Then** `tests/hermes-run-chain-skill.test.mjs` asserts mirror structure (SKILL.md, task-prompt, trigger-pattern, install script, terminal command, 401 handling language, env name-only policy)
   **And** optionally add `run-chain` to `tests/hermes-trigger-contract.test.mjs` `TRIGGER_CONTRACT_SKILLS` if `references/task-prompt.md` exists

## Tasks / Subtasks

- [x] **AC #1–#2 — Read SSOT + existing skill patterns** (AC: #1, #2)
  - [x] Read **`Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md`** fully — stage order, env tables, CLI flags, failure modes, manual procedure (**do not re-derive from `src/agents/*` or `scripts/run-chain.ts`**)
  - [x] Read **`~/.hermes/skills/cns/investigate-trend/`** and **`scripts/hermes-skill-examples/investigate-trend/`** for mirror layout
  - [x] Read **`scripts/hermes-skill-examples/triage/references/task-prompt.md`** § Synthesis invocation — reuse env sourcing pattern only; triage embeds shallow auto-synthesis, this skill is **standalone full-chain trigger**

- [x] **AC #1–#2 — Author repo mirror** (AC: #1, #2)
  - [x] Create `scripts/hermes-skill-examples/run-chain/SKILL.md` with Hermes frontmatter + overview
  - [x] Create `references/task-prompt.md` — terminal steps, output templates, 401/missing-env handling
  - [x] Create `references/trigger-pattern.md` — Discord + Desktop trigger grammar
  - [x] Create `references/config-snippet.md` — optional `#hermes` binding (operator-owned `~/.hermes/config.yaml`)
  - [x] Add `scripts/install-hermes-skill-run-chain.sh` (mirror investigate-trend install script)

- [x] **AC #3–#5 — Skill behavior spec** (AC: #3, #4, #5)
  - [x] Document `OMNIPOTENT_REPO` requirement (same pattern as `hermes-cns-verify-gate-summary`)
  - [x] Document default repo path fallback for this operator WSL checkout
  - [x] Define bounded success template (exit 0): topic, Result line from CLI summary, synthesis path if parseable from stdout when `--raw-json` used
  - [x] Define failure templates: preflight env, 401 Anthropic, non-zero exit with stage hint from stderr/evidence
  - [x] Declare `required_environment_variables` in frontmatter using **names only** + `.env.live-chain` sourcing note

- [x] **AC #6–#7 — Install, test, verify** (AC: #6, #7)
  - [x] Run `bash scripts/install-hermes-skill-run-chain.sh`
  - [x] Add `tests/hermes-run-chain-skill.test.mjs`
  - [x] `bash scripts/verify.sh` green
  - [x] `git diff --name-only` excludes protect-list paths
  - [x] **Do not** run live chain E2E in this story

### Review Findings

- [ ] [Review][Patch] Shell command construction needs explicit safe quoting or rejection for operator fields [scripts/hermes-skill-examples/run-chain/references/task-prompt.md:68]
- [ ] [Review][Patch] Env name-only tests only reject `sk-ant-*` and miss other credential value shapes [tests/hermes-run-chain-skill.test.mjs:36]
- [ ] [Review][Patch] Review scope contains vault files outside the nine listed story files [Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md:219]

## Dev Notes

### Epic and sequencing context

- **Epic 75 (Run-Chain Knowledge + Revival)** — alias **Epic B**; FRs **FR7** (75-2 done/review), **FR8** (this story), **FR11** (75-4).
- **Depends:** **75-2** governance module (`AI-Context/modules/run-chain.md`); Epic **74** Portal stable (`done`).
- **Blocks:** **75-5** E2E revival verification (needs this skill installed).
- **Parallel:** Epic **76** orientation cleanup.
- **Out of scope:** `validate-anthropic-key.ts` (**75-4**), live E2E proof (**75-5**), any engine/adapter edit, vault module edits (unless fixing unrelated regression).

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 75 Story 75-3; `sprint-status.yaml`]

### SSOT rule (CRITICAL — prevents dev mistakes)

**All** stage order, env var names, CLI flags, and failure-mode text in the skill MUST match **`AI-Context/modules/run-chain.md`** (75-2 output).

| Topic | SSOT | Do NOT |
|-------|------|--------|
| Stage order | Module § Stage sequence | Re-read `src/agents/run-chain.ts` to invent order |
| Required env | Module § Environment | Guess from adapter source |
| CLI flags | Module § CLI reference | Add undocumented flags |
| 401 blocker | Module § Known failure modes | Silently report "chain failed" |
| Manual CLI | Module § Operator procedure | Duplicate divergent command |

Repo mirror path: `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md`

[Source: `_bmad-output/implementation-artifacts/75-2-run-chain-governance-module-and-project-folder.md` AC #1; user story notes]

### Relationship to triage embedded run-chain (Story 30-2)

| Aspect | `triage` skill (30-2) | `run-chain` skill (75-3) |
|--------|----------------------|---------------------------|
| Trigger | Post-`vault_move` when `source_uri` http(s) | Operator `/run-chain` or Desktop request |
| Depth | `--depth shallow` fixed | Operator-selectable (`shallow`/`standard`/`deep`, default per module) |
| Mutations | May `vault_update_frontmatter` after success | **No vault mutations** in default path — terminal + report only |
| Purpose | Inbox triage automation | Standalone chain revival (FR8) |

Do **not** modify triage skill in this story unless verify gate fails due to unrelated regression.

[Source: `scripts/hermes-skill-examples/triage/references/task-prompt.md` § Synthesis invocation; `tests/hermes-triage-skill.test.mjs`]

### Hermes skill file structure (implement this tree)

```
scripts/hermes-skill-examples/run-chain/
├── SKILL.md
└── references/
    ├── task-prompt.md      # Normative terminal + output behavior
    ├── trigger-pattern.md  # Discord/Desktop grammar
    └── config-snippet.md   # Optional channel_skill_bindings
```

Installed copy (via install script):

```
~/.hermes/skills/cns/run-chain/
└── (identical to repo mirror)
```

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Project Structure; Context7 `/nousresearch/hermes-agent` SKILL.md format]

### Suggested trigger grammar (adapt in trigger-pattern.md)

**Discord `#hermes`** — first line starts with:

```text
run-chain topic: "<topic>"
  query: "<primary query>"
  depth: deep
```

Rules:

- **`topic`**: required, double-quoted string on line 1 after `run-chain topic:`
- **`query`**: required, at least one line `query: "..."` (repeatable queries → multiple `--query` flags)
- **`depth`**: optional; `shallow` | `standard` | `deep` (default **`deep`** per module)
- **`evidence-file`**: optional line `evidence: _bmad-output/run-chain-<slug>.md`

**Desktop / CLI Hermes session** — natural language equivalent ("run chain on topic X with query Y") maps to same args.

**Parse errors** — reply with one short block; **do not** run terminal (mirror investigate-trend `bad-payload` pattern).

### Terminal command (canonical — from module)

```bash
cd "${OMNIPOTENT_REPO}" && \
  set -a && source .env.live-chain && set +a && \
  npx tsx scripts/run-chain.ts \
    --topic "<topic>" \
    --query "<query>" \
    --depth <depth> \
    --evidence-file "<optional>" \
    --raw-json
```

- **`OMNIPOTENT_REPO`**: required env var for Hermes session (pattern from `hermes-cns-verify-gate-summary`). If unset, ask operator to `export OMNIPOTENT_REPO=/absolute/path/to/Omnipotent.md` — do not guess cwd.
- **`source .env.live-chain`**: must run in the **same** shell as `npx tsx` (triage pattern uses inline `source`).
- **`--raw-json`**: include when skill needs to extract `synthesis.insight_note.vault_path` for success summary (same JSON path as triage 30-2).

[Source: `AI-Context/modules/run-chain.md` § Operator procedure, § CLI reference; triage task-prompt § Synthesis invocation]

### Output templates (task-prompt.md)

**Success (exit 0)** — bounded Discord/Desktop reply:

```markdown
## Run-chain complete

- **topic:** <topic>
- **exit:** 0
- **result:** PASS (or CLI summary Result line)
- **synthesis:** <vault_path or "see evidence file">
- **evidence:** <path if --evidence-file set>
```

**Failure — preflight env (throws before chain)**:

```markdown
## Run-chain failed (preflight)

- **exit:** 1
- **cause:** Missing required environment variables: <names from stderr>
- **action:** Fix `.env.live-chain`, `source .env.live-chain`, rerun. SSOT: `AI-Context/modules/run-chain.md`
```

**Failure — Anthropic 401 (known dormant blocker)**:

```markdown
## Run-chain failed (credentials)

- **exit:** non-zero
- **cause:** Anthropic API returned 401 — `ANTHROPIC_API_KEY` dead (dormant since ~2026-05-24)
- **action:** Run Story **75-4** key validation/rotation (`scripts/validate-anthropic-key.ts`). Do **not** edit protect-list adapters.
```

**Failure — chain stage error (non-401)**:

```markdown
## Run-chain failed

- **exit:** <code>
- **topic:** <topic>
- **hint:** <one line from stderr / evidence — stage name if visible>
- **action:** See `AI-Context/modules/run-chain.md` § Known failure modes
```

### Environment variables (declare names only)

From module § Environment — list in SKILL.md / frontmatter, **never values**:

| Variable | Required? | Notes |
|----------|-----------|-------|
| `FIRECRAWL_API_KEY` | Yes | Research |
| `ANTHROPIC_API_KEY` | Yes | Synthesis (default), Hook, Boss |
| `APIFY_API_TOKEN` | Yes* | *Or deprecated `APIFY_TOKEN` alias |
| `OPENROUTER_API_KEY` | Conditional | When `CNS_SYNTHESIS_PROVIDER=openrouter` |
| `CNS_SYNTHESIS_MODEL` | Conditional | OpenRouter synthesis |
| `PERPLEXITY_API_KEY` | Optional | Tier may disable |
| `CNS_VAULT_ROOT` | Optional | Vault path override |
| `SCRAPLING_COMMAND` | Optional | Default `scrapling` |
| `CNS_BRIEF_TOPIC` | Optional | Default topic |
| `OMNIPOTENT_REPO` | Skill runtime | Hermes session — path to Omnipotent.md checkout |

**`.env.live-chain`**: gitignored operator file at repo root; skill docs reference the filename only.

Hermes frontmatter example (names only):

```yaml
required_environment_variables:
  - name: OMNIPOTENT_REPO
    prompt: Absolute path to Omnipotent.md repo
    required_for: locating scripts/run-chain.ts
metadata:
  hermes:
    tags: [cns, hermes, run-chain, terminal, research]
    requires_toolsets: [terminal]
```

[Source: Context7 `/nousresearch/hermes-agent` — `required_environment_variables`, `requires_toolsets`; `AI-Context/modules/run-chain.md`]

### Verify gate / mirror mechanics

| Check | What verify does |
|-------|------------------|
| `scripts/verify.sh` | Runs `npm test` + lint + typecheck |
| `assert-hermes-skill-install-gate.mjs` | Bound skills from `~/.hermes/config.yaml` exist on disk; **`parity_skills` trio** `diff -rq` vs repo mirror |
| Contract tests | Assert repo mirror content (`tests/hermes-run-chain-skill.test.mjs`) |

**Install script pattern** (copy from investigate-trend):

```bash
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/run-chain"
DEST_DIR="${HOME}/.hermes/skills/cns/run-chain"
mkdir -p "$DEST_DIR"
cp -a "$SRC_DIR/." "$DEST_DIR/"
```

**Do not** add `run-chain` to `scripts/hermes-skill-bindings-expected.json` `channel_skill_bindings` in this story unless operator explicitly wants verify to require installed copy on CI — default is **config-snippet.md** for operator binding.

[Source: `scripts/lib/hermes-skill-install-gate.mjs`; `scripts/hermes-skill-bindings-expected.json`; `tests/hermes-skill-install-gate.test.mjs`]

### Protect-list (NFR2 — zero diffs)

| Path | Reason |
|------|--------|
| `src/agents/synthesis-adapter-llm.ts` | Synthesis LLM adapter |
| `src/agents/hook-adapter-llm.ts` | Hook LLM adapter |
| `src/agents/boss-adapter-llm.ts` | Boss LLM adapter |
| `src/agents/run-chain.ts` | Orchestrator |
| `scripts/run-chain.ts` | CLI entry |

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Protect-list gate]

### Previous story intelligence

**75-1 (done):** `tests/hermes/` vitest domain exists; placeholder `tests/hermes/run-chain.test.ts` is domain bootstrap only — add **`tests/hermes-run-chain-skill.test.mjs`** under repo-root `tests/*.test.mjs` (Node runner), matching investigate-trend pattern.

**75-2 (review):** Governance module + project stub + MEMORY cold-start pointer complete. Review patches pending on module wording — skill must track **module SSOT**, not re-open engine files. Known module locations:

- `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md`
- `Knowledge-Vault-ACTIVE/AI-Context/projects/run-chain/README.md`

**75-2 explicitly deferred** Hermes skill to this story — do not assume partial install exists.

[Source: `_bmad-output/implementation-artifacts/75-1-hermes-test-domain-and-vitest-include.md`; `_bmad-output/implementation-artifacts/75-2-run-chain-governance-module-and-project-folder.md`]

### Architecture compliance

- **FR8:** Hermes skill triggers CLI via terminal; reports to Discord/Desktop.
- **FR7:** Skill references governance module; does not replace it.
- **NFR1:** `bash scripts/verify.sh` passes.
- **NFR2:** Protect-list untouched; NEXUS bridge / digest cron untouched.
- **NFR4:** No secrets in skill markdown or Discord output.
- **ADR-HERMES-004:** Option A — chain uses `.env.live-chain` Anthropic key; Portal OAuth does not replace run-chain LLM calls.

### File structure requirements

| File | Action |
|------|--------|
| `scripts/hermes-skill-examples/run-chain/SKILL.md` | **NEW** |
| `scripts/hermes-skill-examples/run-chain/references/task-prompt.md` | **NEW** |
| `scripts/hermes-skill-examples/run-chain/references/trigger-pattern.md` | **NEW** |
| `scripts/hermes-skill-examples/run-chain/references/config-snippet.md` | **NEW** |
| `scripts/install-hermes-skill-run-chain.sh` | **NEW** |
| `~/.hermes/skills/cns/run-chain/**` | **NEW** (via install script) |
| `tests/hermes-run-chain-skill.test.mjs` | **NEW** |
| `tests/hermes-trigger-contract.test.mjs` | **UPDATE** (add `run-chain` to array if task-prompt present) |

**Forbidden:** protect-list paths, `scripts/validate-anthropic-key.ts`, `src/` changes, edits to `AI-Context/modules/run-chain.md` (unless fixing typo blocking skill accuracy — prefer module issue → separate story).

### Testing requirements

- **Contract test:** `tests/hermes-run-chain-skill.test.mjs` — mirror exists, frontmatter, terminal command contains `source .env.live-chain` + `scripts/run-chain.ts`, 401 handling text, env name-only policy, install script exists.
- **Trigger contract:** If task-prompt has `REFERENCE ONLY` block, add to `TRIGGER_CONTRACT_SKILLS` in `tests/hermes-trigger-contract.test.mjs`.
- **Gate:** `bash scripts/verify.sh` must pass.
- **Manual (optional, not AC):** Invoke skill with invalid env to confirm preflight message — **do not** require live chain success (401 blocker; E2E is **75-5**).

### Latest technical information (Hermes Agent — Context7)

- **SKILL.md frontmatter:** `name`, `description`, `version`, `metadata.hermes.tags`, optional `required_environment_variables` (prompt for missing vars at skill load).
- **Terminal toolsets:** declare `metadata.hermes.requires_toolsets: [terminal]` when skill depends on shell execution.
- **Env passthrough:** Skills declaring `required_environment_variables` pass those vars to `terminal` child processes; otherwise use inline `source .env.live-chain` in the same command string.
- **Skill authoring:** Keep `## When to Use`, procedure in task-prompt, pitfalls (401, missing env), verification (exit code + summary).

[Source: Context7 `/nousresearch/hermes-agent` — creating-skills.md, code-execution.md env passthrough]

### Project context reference

- Hermes Consolidation track Epics 74–78 on branch `hermes-consolidation`.
- Epic **74** `done`; Epic **75** `in-progress` (75-1 `done`, 75-2 `review`, this story `ready-for-dev`).
- Run-chain **dormant** — `ANTHROPIC_API_KEY` 401 until **75-4**; skill must report this gracefully.

[Source: `project-context.md`; `_bmad-output/implementation-artifacts/deferred-work.md` §LLM provider consolidation]

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 75 Story 75-3]
- [Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR8]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Epic B, §Protect-list, §Project Structure]
- [Source: `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md` — **SSOT**]
- [Source: `_bmad-output/implementation-artifacts/75-2-run-chain-governance-module-and-project-folder.md`]
- [Source: `_bmad-output/implementation-artifacts/75-1-hermes-test-domain-and-vitest-include.md`]
- [Source: `scripts/hermes-skill-examples/investigate-trend/` — mirror pattern]
- [Source: `scripts/hermes-skill-examples/triage/references/task-prompt.md` § Synthesis invocation]
- [Source: `scripts/lib/hermes-skill-install-gate.mjs`]
- [Source: Context7 `/nousresearch/hermes-agent` — SKILL.md, terminal, env vars]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- `diff -rq scripts/hermes-skill-examples/run-chain ~/.hermes/skills/cns/run-chain` — clean after install
- `bash scripts/verify.sh` — VERIFY PASSED

### Completion Notes List

- Created Hermes `run-chain` skill mirror with SKILL.md frontmatter (`name: run-chain`, `requires_toolsets: [terminal]`, env names only, `.env.live-chain` dependency).
- task-prompt.md: REFERENCE ONLY block, canonical `terminal()` command with inline `source .env.live-chain`, bounded success/failure templates including explicit 401 → Story 75-4 guidance.
- trigger-pattern.md: Discord/Desktop grammar (`run-chain topic:`, `query:`, optional `depth`/`evidence`).
- config-snippet.md: optional `#hermes` channel binding + `OMNIPOTENT_REPO` / env_passthrough names.
- install script copies mirror to `~/.hermes/skills/cns/run-chain/`; install verified clean.
- Added `tests/hermes-run-chain-skill.test.mjs` and `run-chain` to `TRIGGER_CONTRACT_SKILLS`.
- Protect-list paths unchanged; no live chain E2E run.

### File List

- `scripts/hermes-skill-examples/run-chain/SKILL.md` (new)
- `scripts/hermes-skill-examples/run-chain/references/task-prompt.md` (new)
- `scripts/hermes-skill-examples/run-chain/references/trigger-pattern.md` (new)
- `scripts/hermes-skill-examples/run-chain/references/config-snippet.md` (new)
- `scripts/install-hermes-skill-run-chain.sh` (new)
- `tests/hermes-run-chain-skill.test.mjs` (new)
- `tests/hermes-trigger-contract.test.mjs` (updated)
- `~/.hermes/skills/cns/run-chain/**` (installed via install script)

### Change Log

- 2026-06-24: Story 75-3 — Hermes run-chain trigger skill mirror, install script, contract tests (FR8).

## Story Completion Status

- **Status:** review
- **Completion note:** Hermes run-chain skill installed at `~/.hermes/skills/cns/run-chain/`; verify gate green; ready for code review.
