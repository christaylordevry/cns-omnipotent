# Task: `unified-loop` (Story 84-1 / 84-2 / 84-3 / FR22 v1.5)

## Hard constraints (must follow)

1. **Discover read-only**: invoke **`collectInternalDevState()`** via **`terminal()`** only — reuse `scripts/lib/collect-internal-dev-state.ts`; do **not** fork ranking logic.
2. **No Build on cron path**: `unified-loop cron:discover` and WSL discover cron run **Discover only** — never enter Build/Verify/Persist without `unified-loop approve-build`.
3. **Skill-contract gate**: After Discover artifact + `#hermes` summary, **stop** and await operator continuation — **only** gate on the MCP-write path.
4. **Native approval is terminal-only**: `approvals.mode: manual` in `~/.hermes/config.yaml` routes through `approval.py` → `check_dangerous_command()` **before** `terminal()` — it does **not** intercept MCP vault mutators. **Do not** represent native approval as an MCP safety net.
5. **Absolute artifact paths**: write `~/.hermes/artifacts/unified-loop/discover.json` via absolute path; `repoRoot` in artifact must be absolute checkout path used for collector.
6. **Protect-list**: never edit `src/agents/synthesis-adapter-llm.ts`, `src/agents/hook-adapter-llm.ts`, `src/agents/boss-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`.

## 0) REFERENCE ONLY — invocation already confirmed

> **You have already been invoked.** The `config.yaml` trigger matched the incoming Discord message, Desktop session, or Hermes cron job. Do not re-check or re-evaluate the Hermes skill binding.
> Proceed directly to **§1 Trigger routing**.

## 1) Trigger routing

Parse the **first non-empty line** of the operator message (trimmed). Case-sensitive.

| Trigger line | Stage path | Autonomous? |
|--------------|------------|-------------|
| `unified-loop` | Discover → **pause** at gate (Build not auto-run) | Partial |
| `unified-loop cron:discover` | Discover-only | Yes (read-only) |
| `unified-loop approve-build` | Build handoff only → await `build-complete` → Verify handoff → Persist handoff (84-3) | No |
| `unified-loop approve-build <token>` | Same; optional single token e.g. `story:84-3` | No |
| `unified-loop build-complete` | Build → **Verify** handoff only (no Persist yet) | No |
| `unified-loop build-complete <token>` | Same; optional token e.g. `worktree:branch-name` | No |

**Continuation grammar (Discover → Build):**

- First line exactly: `unified-loop approve-build`
- OR prefix: `unified-loop approve-build ` with optional **single** trailing token (e.g. `story:84-3`)
- Single-line Discord; case-sensitive

**Build-complete grammar (Build → Verify):**

- First line exactly: `unified-loop build-complete`
- OR prefix: `unified-loop build-complete ` with optional **single** trailing token
- Case-sensitive; **not** free-text `#hermes` Build summary

**Negative examples (must NOT trigger Build):**

```text
unified-loop continue
```

**Negative examples (must NOT trigger Verify):**

```text
unified-loop build complete
unified-loop build-done
unified-loop continue
```

Cron invocation: Hermes job with `--skill unified-loop` and pseudo-label `cron:discover` — treat as `unified-loop cron:discover`; **never** full-loop / Build on cron.

## 2) Preconditions

### Resolve repo root

```
resolved_repo_root = OMNIPOTENT_REPO when set to a non-empty absolute path
else default from task-prompt operator reference OR stop with export instructions
```

Fallback when unset (operator smoke only — prefer explicit export):

```markdown
## Unified Loop — Discover skipped

Set the repo root, then re-run:

`export OMNIPOTENT_REPO=/absolute/path/to/Omnipotent.md`

Do not guess cwd for `repoRoot` in discover.json.
```

### Resolve vault root

```
resolved_vault_root = CNS_VAULT_ROOT when set
else documented default Knowledge-Vault-ACTIVE absolute path
```

## 3) Discover stage (terminal only)

Invoke **one or two** `terminal()` calls with `workdir=resolved_repo_root`.

### 3a) Collect + write artifact

```bash
cd "${OMNIPOTENT_REPO}" && \
  export CNS_VAULT_ROOT="${CNS_VAULT_ROOT:-/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE}" && \
  export UNIFIED_LOOP_TRIGGER="<trigger-label>" && \
  node scripts/hermes-skill-examples/unified-loop/scripts/write-discover-artifact.mjs "<trigger-label>"
```

Where `<trigger-label>` is one of: `unified-loop`, `cron:discover`, `manual` (smoke).

**Artifact path (canonical):** `$HOME/.hermes/artifacts/unified-loop/discover.json`  
**Optional override:** `UNIFIED_LOOP_DISCOVER_ARTIFACT` — absolute path only  
**Write rule:** script uses `path.join(os.homedir(), '.hermes/artifacts/unified-loop/discover.json')` or env override — **never** relative to process cwd.

Parse stdout JSON from writer; on failure, post error template and **stop** (no fabricated items).

### 3b) `#hermes` markdown summary (bounded)

After artifact write, post a **bounded** operator briefing (≤25 lines):

```markdown
## Unified Loop — Discover

**Trigger:** <trigger-label>
**Artifact:** ~/.hermes/artifacts/unified-loop/discover.json
**repoRoot:** <absolute path from artifact>
**Items:** <count> (cap 20)

### Top picks
1. **<title>** (<category>) — <rationale>
…

**Build intent:** awaiting operator approval
**Continue with:** `unified-loop approve-build` (optional token e.g. `story:84-3`)
```

Use `items[]` from artifact (PrioritizedItem shape: `rank`, `rankScore`, `title`, `category`, `rationale`, `sourcePath`).

## 4) Discover → [PAUSE] → Build boundary

After §3 completes on `unified-loop` or `unified-loop cron:discover`:

- On **`unified-loop cron:discover`** / cron: **STOP** after Discover — no Build intent execution.
- On **`unified-loop`** (manual full-loop entry): **STOP** after Discover; emit structured Build intent in summary; **do not** run Build-stage work.

Build stage (84-3) loads artifact from **absolute** `~/.hermes/artifacts/unified-loop/discover.json` (or `UNIFIED_LOOP_DISCOVER_ARTIFACT`); uses **`artifact.repoRoot`** only as **parent-repo reference** — Build execution occurs in **EnterWorktree** worktree, not main checkout.

## 5) Forbidden pre-approval actions

**violation = skill failure.** None of the following may occur before operator posts `unified-loop approve-build`:

| # | Forbidden before operator continuation | Detection |
|---|----------------------------------------|-----------|
| 1 | `vault_create_note` | MCP tool call |
| 2 | `vault_move` | MCP tool call |
| 3 | `vault_append_daily` | MCP tool call |
| 4 | `vault_update_frontmatter` | MCP tool call |
| 5 | `vault_log_action` | MCP tool call |
| 6 | Worktree-exiting merges (git merge/rebase/checkout that leaves isolated worktree) | terminal / git |
| 7 | session-close apply paths (any mutation that applies session-close drafts to vault/repo) | terminal / MCP |

There is **no** `vault_write` MCP tool — use the five mutator names above.

## 6) Approval layers (reference)

| Layer | MCP-write path? |
|-------|-----------------|
| **Primary — skill contract** (`unified-loop approve-build`) | **Yes — only gate** |
| Secondary — EnterWorktree (84-3) | Indirect |
| Tertiary — WriteGate | Enforcement, not approval |
| Quaternary — native dangerous-command approval | **No — terminal shell only** |

## 7) Build / Verify / Persist (84-2 Verify + 84-3 Build/Persist handoffs)

### Build — post-approval only (84-3, HARD gate)

Build runs **only** after operator posts `unified-loop approve-build` — within Discover→[PAUSE]→Build sequence. Build is **forbidden** on:

- `unified-loop cron:discover`
- WSL cron tag `cns-unified-loop-discover`
- Any Discover-only / read-only path

Build is **never** auto-fired on recurring schedule or cron. `bmad-dev-story` is **paid** — the loop must **not** auto-invoke it without operator action (DDR Decision 4a: prove-once dry-run, then **dormant** capability).

**Composition (no new build logic):** Build composes **`bmad-dev-story`** by exact registered skill ID in **EnterWorktree** isolation (constitution §9).

**Handoff (operator decision #1A):** Hermes does **not** run dev-story inline. On `unified-loop approve-build`:

1. Load discover.json from absolute `~/.hermes/artifacts/unified-loop/discover.json` (or `UNIFIED_LOOP_DISCOVER_ARTIFACT`)
2. Post `#hermes` Build handoff per `references/build-handoff.md`
3. **STOP** — no Verify handoff until operator posts `unified-loop build-complete`
4. Operator runs EnterWorktree + `bmad-dev-story` in Cursor (or Claude Code)

**Build-complete trigger:** Operator posts exact line-1 `unified-loop build-complete` → Hermes posts Verify handoff → **STOP** (no Persist yet).

### Verify — post-approval only (84-2, HARD gate)

Verify runs **only** after `unified-loop build-complete` — within Build→Verify sequence **after** operator approval and Build completion. Verify is **forbidden** on:

- `unified-loop cron:discover`
- WSL cron tag `cns-unified-loop-discover`
- Any Discover-only / read-only path
- `unified-loop approve-build` alone (Build handoff first — regression guard vs 84-2)

Verify is **never** auto-fired on recurring schedule or cron. The three review skills are **paid** — the loop must **not** auto-invoke them without operator action (DDR Decision 4a: prove-once dry-run, then **dormant** capability).

**Composition (no new review logic):** Verify composes three existing BMAD skills by exact registered skill ID:

| Order | Skill ID | Purpose |
|-------|----------|---------|
| 1 | `bmad-code-review` | Structured adversarial code review (parallel layers + triage) |
| 2 | `bmad-review-adversarial-general` | Cynical Review — attitude-driven gap finding |
| 3 | `bmad-review-edge-case-hunter` | Path-tracer — unhandled edge cases only (JSON output) |

**Handoff (operator decision #2A):** Hermes does **not** run review skills inline. On `unified-loop build-complete`:

1. Post `#hermes` Verify handoff per `references/verify-handoff.md`
2. **STOP** — no Persist until operator completes Verify in IDE
3. Operator runs the three skills in Cursor (or Claude Code); may reference `84-2-verify-evidence.md` or re-run on Build diff

No terminal/CLI wrapper for review skills. No inline Hermes adversarial review. No duplicate adversarial prompts in this skill tree.

### Persist — governed mutation (84-3, HARD gate)

Persist runs **only** on post-approval path after Build + Verify complete. Persist is **forbidden** on:

- `unified-loop cron:discover`
- WSL cron tag `cns-unified-loop-discover`
- Any Discover-only / read-only path
- Before `unified-loop approve-build` (forbidden row #5: `vault_log_action` pre-approval)

Persist is **never** auto-fired on recurring schedule or cron (4a dormant-after-proof).

**Governance (NFR-GOV-1, Story 5.2):** No silent vault mutation. Every Persist write is governed via WriteGate + `vault_log_action` / `appendRecord` audit. No alternate write path to `AI-Context/` or `_meta/logs/agent-log.md`.

**Composition (not new logic):**

| Scope | Path |
|-------|------|
| **#2B E2E proof** | Single `vault_log_action` via MCP per `references/persist-handoff.md` |
| **Full Persist** | session-close orchestrator — WriteGate/PAKE/audit on `AI-Context/` mutations |

**Handoff (#2B):** After Verify in IDE, operator follows `references/persist-handoff.md` — operator-driven in Cursor/MCP; **no** Hermes trigger token for #2B. Governance module delta via session-close WriteGate only — **not** direct dev-story edit to `AI-Context/`.

**On `unified-loop approve-build` sequence (full):**

1. Build handoff → **STOP** (await `build-complete`)
2. On `build-complete`: Verify handoff → **STOP** (await operator Verify)
3. After Verify: Persist handoff reference — operator executes `vault_log_action` proof (#2B) or session-close (production)

Reference `AI-Context/modules/unified-loop.md` after session-close apply.

## 8) discover.json schema v1 (summary)

| Field | Required | Notes |
|-------|----------|-------|
| `schemaVersion` | yes | `1` |
| `stage` | yes | `"discover"` |
| `generatedAt` | yes | ISO-8601 with offset |
| `trigger` | yes | e.g. `cron:discover`, `manual`, `unified-loop` |
| `repoRoot` | yes | **Absolute** Omnipotent.md checkout |
| `artifactPath` | yes | **Absolute** path to this file |
| `collector` | yes | module + itemCap 20 |
| `items` | yes | `PrioritizedItem[]` from collector |
| `topPick` | yes | highest-priority snapshot |
| `buildIntent` | yes | `status: awaiting-operator-approval` |

Governance SSOT: `AI-Context/modules/unified-loop.md` (WriteGate — session-close apply only).
