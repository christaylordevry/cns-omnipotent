---
story_id: 54-1
epic: 54
title: skill-install-gate
status: done
baseline_commit: 980e6d5a9d1ddb5709a473dbea369f608a1737ee
---

# Story 54.1: Skill install gate — Hermes bindings exist on disk + NotebookLM skill parity

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As the **CNS maintainer**,  
I want **`scripts/verify.sh` (or an `npm test` hook) to fail when `~/.hermes/config.yaml` references a skill that is missing on disk or when NotebookLM-critical skill trees drift from the repo mirror**,  
so that **Discord routing for `/notebook-query`, `morning-digest`, and `/session-close` cannot silently run stale or missing packages** after reinstall or Epic 50–53 changes.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 54: Hermes deployment parity & NotebookLM observability |
| **Phase** | 6 (ops / hygiene) |
| **Closes deferred work** | `deferred-work.md` → *36-2 review defer: No CI `diff -rq` parity gate*; `epic-36-retro-2026-05-20.md` technical-debt row |
| **Predecessors** | **36-2** (manual `cmp`/`diff -rq`), **48-5** (slim session-close mirror), **49-6** (morning-digest), **51-1** (notebook-query), **53-1/53-3** (session-close watchdog + NO_ROUTE reasons) |
| **Out of scope (later 54.x)** | Full-tree parity for all nine `#hermes` skills; vault-think / vault-lint drift remediation; Hermes gateway health; NotebookLM MCP auth watchdog (53-1) |

### Epic 54 intent (operator brief)

Hermes **deployment parity** means: what is bound in `config.yaml` is what exists under `~/.hermes/skills/cns/`, and what ships in git under `scripts/hermes-skill-examples/` is what runs after `install-hermes-skill-*.sh`. **NotebookLM observability** stories (later in the epic) assume these three surfaces are not silently stale.

### Live bindings snapshot (2026-06-01 — verify against your machine)

`~/.hermes/config.yaml` → `discord.channel_skill_bindings`:

| Channel ID | Skills |
|------------|--------|
| `1500733488897462382` (`#hermes`) | `hermes-url-ingest-vault`, `triage`, `session-close`, `vault-lint`, `vault-think`, `vault-graduate`, `investigate-trend`, `morning-digest`, `notebook-query` |
| `1484880486785486951` (`#general`) | `hermes-url-auto-capture-inbox` |

**Parity trio (this story):** `notebook-query`, `morning-digest`, `session-close` — each has repo mirror + install script:

| Skill | Repo mirror | Install script |
|-------|-------------|----------------|
| `notebook-query` | `scripts/hermes-skill-examples/notebook-query/` | `scripts/install-hermes-skill-notebook-query.sh` |
| `morning-digest` | `scripts/hermes-skill-examples/morning-digest/` | `scripts/install-hermes-skill-morning-digest.sh` |
| `session-close` | `scripts/hermes-skill-examples/session-close/` | `scripts/install-hermes-skill-session-close.sh` |

### Known drift before implementation (operator WSL)

| Skill | `diff -rq` repo vs `~/.hermes/skills/cns/` | Notes |
|-------|---------------------------------------------|-------|
| `notebook-query` | **clean** | — |
| `morning-digest` | **clean** | — |
| `session-close` | **Only in installed:** `references/task-prompt.md` | Slim router (48-5) intentionally **does not** load `task-prompt.md` (`tests/hermes-session-close-skill.test.mjs` asserts router must not reference it). File is **stale on disk** — install should prune it. |
| Other bound skills | Various diffs (url-ingest extras, vault-lint `bulk_scan.py`, vault-think SKILL) | **Not gated** in 54-1 — do not expand scope unless fixing session-close requires shared install helper |

## Acceptance Criteria

### 1. Binding existence gate (AC: bindings)

**Given** `HERMES_HOME` defaults to `$HOME/.hermes` (override allowed) and `$HERMES_HOME/config.yaml` exists  
**When** the gate runs  
**Then** it parses **every** skill name listed under `discord.channel_skill_bindings` → `skills:` (Hermes list form: `- id:` … `skills:` … `- name`)  
**And** for each skill name, `$HERMES_HOME/skills/cns/<skill>/SKILL.md` exists  
**And** on failure it prints: missing skill name, expected path, and channel id if parseable  
**And** exit code is non-zero.

### 2. NotebookLM parity gate (AC: parity)

**Given** the same `HERMES_HOME` and repo root (`OMNIPOTENT_REPO` or script-relative repo root)  
**When** the gate runs  
**Then** for each of `notebook-query`, `morning-digest`, `session-close`:

```bash
diff -rq "$REPO_ROOT/scripts/hermes-skill-examples/<skill>" "$HERMES_HOME/skills/cns/<skill>"
```

**And** produces **no output** and exit 0 (identical trees).

**And** if `session-close` fails only due to extra installed-only files, the fix is **prune-on-install** (see Dev Notes), not “add stale task-prompt back to repo.”

### 3. Verify integration (AC: verify)

**Then** `bash scripts/verify.sh` invokes the gate **after** `npm test` (or the gate is part of `npm test` and verify calls `npm test` — either is fine; prefer one clear entry point documented in verify output).  
**And** `bash scripts/verify.sh` passes on a machine where:

1. All bound skills exist on disk, and  
2. The three parity skills match repo mirrors (run install scripts first if needed).

### 4. CI / no-Hermes skip (AC: skip)

**Given** `$HERMES_HOME/config.yaml` is **missing** (e.g. GitHub Actions without Hermes)  
**When** the gate runs  
**Then** it **skips** with a single-line `(skip) Hermes config not found at …` message and **exit 0**  
**So** CI is not blocked, but developer workstations with Hermes get enforcement.

Optional: `HERMES_SKIP_SKILL_INSTALL_GATE=1` → skip with message (for emergency local override only; document in Operator Guide §15 if used).

### 5. Repo-side regression tests (AC: tests)

**Then** `tests/hermes-skill-install-gate.test.mjs` (or equivalent) covers **without** requiring live `~/.hermes`:

- YAML fixture: parser extracts all skill names from a sample `channel_skill_bindings` block matching Hermes schema (`- id` + `skills:` list).
- Manifest: every skill in `scripts/hermes-skill-bindings-expected.json` (or inline constant) has `scripts/hermes-skill-examples/<skill>/SKILL.md` **or** documents skills that are binding-only with no mirror (none today for CNS bindings).
- Parity trio: each has install script on disk.

**And** `npm test` passes.

### 6. Operator recovery documented (AC: docs)

**Then** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` adds a short §15.x subsection: **Skill install gate** — how to fix failures (`bash scripts/install-hermes-skill-*.sh`, re-run `verify.sh`, when to restart gateway).

### 7. Verify gate before done (AC: done)

**Then** `bash scripts/verify.sh` passes before commit.

**Out of scope:** Changing skill behavior; editing live `~/.hermes/config.yaml` in repo; parity for non–NotebookLM skills; auto-generating config from repo.

## Tasks / Subtasks

- [x] Add `scripts/assert-hermes-skill-install-gate.mjs` (or `.sh` calling node) implementing AC 1–2, 4 (AC: 1, 2, 4)
  - [x] Reuse repo-root resolution pattern from `scripts/verify.sh`
  - [x] Parse bindings via small line/state parser or shared `scripts/lib/hermes-config-bindings.mjs` (avoid new npm deps unless necessary)
- [x] Wire gate into `scripts/verify.sh` after Node tests (AC: 3)
- [x] Fix **session-close** install parity: extend `install-hermes-skill-session-close.sh` to **delete installed files not present in repo mirror** after copy (`rsync -a --delete` or explicit `rm` of known stale `references/task-prompt.md`) (AC: 2)
- [x] Run all three install scripts; confirm `diff -rq` clean for parity trio (AC: 2)
- [x] Add `tests/hermes-skill-install-gate.test.mjs` (AC: 5)
- [x] Operator Guide §15.x (AC: 6)
- [x] `bash scripts/verify.sh` (AC: 7)

### Review Findings

- [x] [Review][Patch] session-close install `cp` fallback does not prune stale files [`scripts/install-hermes-skill-session-close.sh:18-26`] — Fixed: `rm -f "$DEST_DIR/references/task-prompt.md"` after cp fallback.
- [x] [Review][Patch] `PARITY_SKILLS` constant can drift from `hermes-skill-bindings-expected.json` — Fixed: `scripts/lib/hermes-skill-bindings-expected.mjs` loads JSON; test asserts `deepStrictEqual`.
- [x] [Review][Patch] Install regression test allows non-pruning fallback [`tests/hermes-session-close-skill.test.mjs:49-52`] — Fixed: requires `rsync -a --delete` and explicit `rm` in fallback.
- [x] [Review][Defer] `vault-fast-scan-index.md` date bump — incidental to Operator Guide edit; not in story File List [`Knowledge-Vault-ACTIVE/AI-Context/vault-fast-scan-index.md:5`] — deferred, pre-existing index maintenance pattern.
- [x] [Review][Defer] notebook-query / morning-digest install scripts still use `cp` without `--delete` — parity gate detects drift; full rsync parity deferred to a future epic (out of 54-1 scope per story Out of scope).

## Dev Notes

### Recommended implementation shape

**Single gate script** (Node ESM matches `tests/*.test.mjs`):

```
scripts/assert-hermes-skill-install-gate.mjs
  ├─ resolve HERMES_HOME, REPO_ROOT
  ├─ if !exists(config.yaml) → skip exit 0
  ├─ parseChannelSkillBindings(configText) → Set<skillName>
  ├─ for each skill: assert exists(HOME/skills/cns/<skill>/SKILL.md)
  ├─ for skill in PARITY_SKILLS:
  │     execSync(`diff -rq ${repoMirror} ${installed}`, { stdio: 'pipe' })
  └─ on failure: print diff output, exit 1
```

**verify.sh** addition (after npm test block):

```bash
echo "==> Hermes skill install gate"
node scripts/assert-hermes-skill-install-gate.mjs
```

### Hermes `channel_skill_bindings` schema (Context7)

Per `/nousresearch/hermes-agent` messaging docs, bindings are a **list of objects**:

```yaml
discord:
  channel_skill_bindings:
    - id: "1500733488897462382"
      skills:
        - hermes-url-ingest-vault
        - session-close
```

Do **not** assume map form `channel_id: skill-name` (older snippets in story 51-1 config-snippet are illustrative only). Parser must handle **list + `skills:` array**.

### session-close: prune stale `task-prompt.md`

Installed copy (~21 KB) is **not** in repo mirror. Story **48-5** router uses `task-prompt.legacy.md` only as archive; live skill must not load `references/task-prompt` on activation.

**Fix options (pick one, prefer A):**

- **A.** `rsync -a --delete "$SRC_DIR/" "$DEST_DIR/"` in install script (strongest parity for all skills long-term).
- **B.** After `cp -a`, `rm -f "$DEST_DIR/references/task-prompt.md"` in `install-hermes-skill-session-close.sh` only.

Existing install script only `cmp`s four files — that allowed extra files to linger. Parity gate uses **full tree** `diff -rq`.

### Binding skills without repo mirrors

All current bindings have mirrors under `scripts/hermes-skill-examples/` except none — **every bound skill today has a mirror**. If a future binding references a skill with no mirror, either add mirror + install script or exclude via manifest with operator approval.

### Expected binding manifest (repo test SSOT)

Commit a small JSON file so repo tests do not read operator `~/.hermes`:

`scripts/hermes-skill-bindings-expected.json`:

```json
{
  "channel_skill_bindings": [
    { "id": "1500733488897462382", "skills": ["hermes-url-ingest-vault", "triage", "session-close", "vault-lint", "vault-think", "vault-graduate", "investigate-trend", "morning-digest", "notebook-query"] },
    { "id": "1484880486785486951", "skills": ["hermes-url-auto-capture-inbox"] }
  ],
  "parity_skills": ["notebook-query", "morning-digest", "session-close"]
}
```

Live gate compares **parsed live config** to disk paths; repo test asserts manifest matches parser output on a **fixture YAML** fragment and that parity skills have mirrors + install scripts.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `HERMES_HOME` | `$HOME/.hermes` | Config + skills root |
| `HERMES_SKIP_SKILL_INSTALL_GATE` | unset | `1` → skip gate (local emergency) |
| `OMNIPOTENT_REPO` | auto-detect from script | Repo mirror path |

Skills path is always `$HERMES_HOME/skills/cns/<skill>/` (CNS convention since Epic 26).

### Files to touch (expected)

| File | Action |
|------|--------|
| `scripts/assert-hermes-skill-install-gate.mjs` | **NEW** gate |
| `scripts/verify.sh` | **UPDATE** call gate |
| `scripts/install-hermes-skill-session-close.sh` | **UPDATE** prune/`rsync --delete` |
| `scripts/hermes-skill-bindings-expected.json` | **NEW** SSOT for tests |
| `scripts/lib/hermes-config-bindings.mjs` | **NEW** optional shared parser |
| `tests/hermes-skill-install-gate.test.mjs` | **NEW** |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | **UPDATE** §15 skill gate |

### Testing standards

- Follow `tests/hermes-session-close-skill.test.mjs` / `scripts/assert-verify-failure-modes.mjs` patterns.
- Gate failure test: temp dir with fixture config + intentionally missing skill dir → assert exit 1 (unit test the gate module, do not require real `~/.hermes` in CI).
- Do **not** add vitest unless exercising TS; use `node --test`.

### Architecture compliance

- **Spec-first:** No vault contract / WriteGate changes.
- **Verify gate:** Story is part of the verify gate itself — must stay fast (<2s on WSL).
- **Security:** Gate reads only `config.yaml` and skill trees; never print secrets from config (redact `token`, `api_key` lines if logging config paths).

### Previous story intelligence (53-3)

- NotebookLM resolver changes live in repo mirror; operator must `install-hermes-skill-notebook-query.sh` after skill edits — this story **automates detection** of forgotten install.
- `53-3` completion notes: “optional install for live Hermes parity” becomes **required on dev machines** once gate is enabled.

### Git intelligence

Recent commits (`980e6d5`, `077f1f0`, `d7cf680`) touched notebook-query task-prompt and session-close watchdog — high risk of installed-vs-repo drift; gate prevents recurrence.

## Project Context Reference

- [Source: `_bmad-output/implementation-artifacts/36-2-hermes-skill-parity-pass.md` — `diff -rq` one-liner, deferred CI gate]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 36-2 defer *No CI diff -rq parity gate*]
- [Source: `scripts/verify.sh` — factory verify gate]
- [Source: `scripts/install-hermes-skill-session-close.sh` — partial `cmp` parity today]
- [Source: `tests/hermes-session-close-skill.test.mjs` — router must not load `task-prompt`]
- [Source: Context7 `/nousresearch/hermes-agent` — `channel_skill_bindings` list schema]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15 — Hermes install paths]

## Dev Agent Record

### Agent Model Used

(create-story workflow)

### Debug Log References

### Completion Notes List

- Implemented `scripts/lib/hermes-config-bindings.mjs` + `scripts/lib/hermes-skill-install-gate.mjs` and CLI `scripts/assert-hermes-skill-install-gate.mjs` (binding existence, parity trio `diff -rq`, skip when config missing or `HERMES_SKIP_SKILL_INSTALL_GATE=1`).
- Wired gate into `scripts/verify.sh` after npm test/lint/typecheck.
- `install-hermes-skill-session-close.sh` now uses `rsync -a --delete` to prune stale `references/task-prompt.md`.
- Added `scripts/hermes-skill-bindings-expected.json`, `tests/hermes-skill-install-gate.test.mjs`, fixture YAML; Operator Guide §15.12.
- `bash scripts/verify.sh` passes after installing parity trio to `~/.hermes`.

### File List

- `scripts/assert-hermes-skill-install-gate.mjs`
- `scripts/lib/hermes-config-bindings.mjs`
- `scripts/lib/hermes-skill-install-gate.mjs`
- `scripts/lib/hermes-skill-bindings-expected.mjs`
- `scripts/hermes-skill-bindings-expected.json`
- `scripts/verify.sh`
- `scripts/install-hermes-skill-session-close.sh`
- `tests/hermes-skill-install-gate.test.mjs`
- `tests/fixtures/hermes-channel-skill-bindings.yaml`
- `tests/hermes-session-close-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] Add §15.x **Skill install gate** (failure messages + install script list for parity trio)

## Change Log

- 2026-06-01: Story 54-1 created — Hermes skill install gate (bindings exist + NotebookLM trio `diff -rq`).
- 2026-06-01: Implemented gate, verify integration, session-close rsync prune, tests, Operator Guide §15.12; verify.sh passes.
- 2026-06-01: Code review patches — JSON SSOT for parity skills, cp-fallback prune, tightened install tests.
