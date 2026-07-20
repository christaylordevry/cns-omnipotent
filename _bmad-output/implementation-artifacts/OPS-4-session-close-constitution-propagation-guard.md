---
story_id: OPS-4
epic: ops-observability
title: session-close-constitution-propagation-guard
status: review
created: 2026-07-20
design_gate: APPROVED_2026-07-20
baseline_commit: 588e17c
incident: 2026-07-20 session 24 — /session-close propagated corrupt vault AGENTS.md over clean specs mirror
predecessors: OPS-1, OPS-2, 48-4, 87-2
related_deferred: deferred-work.md top entry (2026-07-20 session 24 constitution propagation)
do_not_run: /session-close until this ships ($3–5/run; re-spreads vault corruption)
---

# Story OPS-4: Session-close must validate the constitution before propagating it

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

Epic: **ops-observability** (reopened — fail-loud on unvalidated state; same theme as OPS-1 / OPS-2)  
Tracked in sprint-status as: **`OPS-4-session-close-constitution-propagation-guard`**  
**Depends on:** nothing unshipped (48-4 apply path + 87-2 `normalizeLf` / compare-refuse pattern are live)

## Story

As the **CNS operator**,
I want **`apply-section8.mjs` to refuse writing either AGENTS target when the source constitution is structurally corrupt, stale relative to the git-tracked mirror, or would mint a changelog version that already exists in source ∪ mirror**,
so that **a dirty vault working copy can never overwrite the clean specs mirror and report success** — and so **`verify.sh` surfaces vault↔specs AGENTS drift before the next paid close**.

---

## Incident (the bug this closes)

**Observed live 2026-07-20, session 24.** `/session-close` overwrote clean git-tracked `specs/cns-vault-contract/AGENTS.md` with a corrupted copy and reported `agents_sync: synced`, `failure_class: none`.

| Defect | Detail |
|--------|--------|
| §2 | `HookSetNote` / `WeaponsCheckNote` each duplicated in the note-routing table |
| §3 | `"governed governed"` in the PAKE Standard scope sentence |
| Version | Hermes claimed bump to v2.1.58; mirror was *already* 2.1.58 — second identical changelog row minted |
| Rollup | Success reported while both targets were poisoned |

**Root cause (LOCKED — do not re-derive; do not chase the transform):**

```121:126:scripts/session-close/apply-section8.mjs
  try {
    agentsText = await readFile(paths.constitutionAgentsPath, "utf8");
  } catch {
    agentsText = await readFile(paths.repoAgentsPath, "utf8");
  }
```

`constitutionAgentsPath` → vault copy (`lib/paths.mjs:113-114`). Patched result writes to **both** vault and specs. No structural / stale / collision gate. Dirty vault propagates over clean mirror.

`applySection8ToAgentsText` is **proven clean** (2026-07-20 empirical: clean in → clean out). **Do not "fix" it.**

Full analysis: `_bmad-output/implementation-artifacts/deferred-work.md` (top entry). Corrected same day: session-close is the **amplifier**, not the origin of the §2/§3 corruption.

**⛔ Do not run `/session-close` to test this story.** Drive everything through unit tests and `--dry-run`.

---

## Design decisions — RESOLVED 2026-07-20 (binding)

| # | Decision | Binding rule |
|---|----------|--------------|
| 1 | Story key **OPS-4**; reopen **ops-observability** | Epic 87 stays closed — different concern (mirror dedup). This is fail-loud / refuse-unvalidated-state, same theme as OPS-1/OPS-2. |
| 2 | Doubled-token scope = **entire §2 and §3** | Case-insensitive adjacent-token match; small allowlist (`had had`, `that that`). False positives fail closed (safe). |
| 3 | Collision scope = **source ∪ mirror** | **Not optional.** Source-only **fails to catch the observed bug** (vault 2.1.57 → bump 2.1.58 already in *mirror* changelog). Union is the only variant that catches the motivating incident — ACs must state this so it cannot be "simplified" later. |
| 4 | Verify-time AGENTS vault↔specs parity **in scope** | Same guard helper. Shortens detection window; would have flagged vault drift between 07-14 and 07-20 without a paid close. |
| 5 | Dual-copy | **Verify via `git diff --name-only`**, not the plan. If only `scripts/session-close/lib/*` → negative assertion (no `hermes-skill-examples/` touch). If skill tree touched → real `cmp` vs `~/.hermes/skills/cns/session-close/`. OPS-1 gate (b) trap. |
| 6 | Vacuous checks must fail loudly | A check that **cannot** run must never render as **passed**. Same defect class as OPS-1/OPS-2 silent success. See **AC11**. |

---

## Acceptance Criteria

### AC1 — Pre-write gate placement (zero partial write)

**Given** `runApplySection8` has read the source constitution  
**When** any guard check fails  
**Then** it throws **before** `applySection8ToAgentsText` *and* before any write to repo AGENTS, vault AGENTS, or dry-run preview  
**And** neither AGENTS target on disk is modified (assert **bytes on disk**, not merely return/throw)  
**And** on real (non-dry-run) close, `recordSection8Failure` stamps `failure_class: section8` and CLI exits non-zero  

> Same zero-partial-write rule as OPS-2's pre-flight assertion. A guard that throws *after* a partial write is the failure mode this story removes.

### AC2 — Structural invariants (source)

**Given** source AGENTS text (after `normalizeLf`)  
**When** validating  
**Then** each of these §2 routing-table row labels appears **exactly once**:  
`SourceNote`, `InsightNote`, `SynthesisNote`, `WorkflowNote`, `ValidationNote`, `HookSetNote`, `WeaponsCheckNote`  
**And** within the text spanning `## 2.` … `## 4.` (entire §2 **and** §3), no case-insensitive adjacent duplicate tokens except an explicit allowlist including at least `had had` and `that that`  
**And** on violation: refuse both targets; loud message prefixed `constitution-guard: structural:`

### AC3 — Stale-source refuse

**Given** source and mirror resolve to **distinct** realpaths (see AC11a)  
**And** source header version `Vs` and git-tracked mirror (`paths.repoAgentsPath`) header version `Vm`  
**When** `semver(Vs) < semver(Vm)`  
**Then** refuse both targets with `constitution-guard: stale: source v… < mirror v…`  
**And** both targets unchanged on disk

> When source and mirror are the same realpath, AC3 does **not** apply as a pass — see AC11a (`not_applicable`).

### AC4 — Version-collision guard (source ∪ mirror) — **incident-shaped**

**Given** source and mirror resolve to **distinct** realpaths (see AC11a)  
**And** computed `newVersion = bumpPatchVersion(Vs)` (unless `versionOverride`)  
**When** `newVersion` appears in the changelog version column of the **source** **or** the **mirror** (union)  
**Then** refuse both targets with `constitution-guard: version-collision: …`  

**Hard requirement (do not weaken):** a fixture matching the 07-20 incident must fail:

- source header `2.1.57`, source changelog **lacks** `2.1.58`
- mirror header `2.1.58`, mirror changelog **contains** `2.1.58`
- bump would emit `2.1.58`

A **source-only** collision check **passes** that fixture. That is a story failure. Union is mandatory.

> When source and mirror are the same realpath, AC4 does **not** apply as a pass — see AC11a (`not_applicable`). Union still requires a readable distinct mirror when drift checks are applicable (AC11b).

### AC5 — The one test that matters (corrupt source → both targets unchanged)

**Given** a temp vault+repo fixture where:

- source (vault) AGENTS is deliberately corrupt (§2 duplicate HookSetNote/WeaponsCheckNote rows **and** `governed governed` in §3)
- both write targets are pre-seeded with **known clean** bytes

**When** `runApplySection8({ dryRun: false, … })` runs with a valid draft  
**Then** it throws  
**And** reading both target paths from disk yields **byte-identical** content to the pre-seeded clean bytes  

Marker-count-only tests on clean transform output do **not** satisfy this AC.

### AC6 — Clean path still works

**Given** clean source with `Vs >= Vm` and no collision for the bumped version  
**When** apply runs  
**Then** existing SC-4 happy-path behavior remains (version bump, changelog insert, both targets written when not using repo-vault fallback)  
**And** `applySection8ToAgentsText` is **not** modified except if a shared pure helper must be imported (prefer zero edits to the transform body)

### AC7 — Rollup honesty

**Given** a refused or failed constitution write  
**When** Discord reply / close-report is rendered  
**Then** it must **not** report `agents_sync: synced` / `synced via gate-apply-section8` or `failure_class: none`  
**And** `failure_class: section8` drives `formatAgentsSync` → `failed` (extend tests in `tests/session-close-render-discord-reply.test.mjs` if needed)

### AC8 — Verify-time AGENTS vault↔specs parity

**Given** live vault is resolvable (same pattern as 87-2: `CNS_VAULT_ROOT` / session-close.env)  
**When** `npm test` / `bash scripts/verify.sh` runs  
**Then** a test (extend `tests/vault-modules-parity.test.mjs` **or** dedicated `tests/agents-constitution-parity.test.mjs`) asserts vault `AI-Context/AGENTS.md` vs `specs/cns-vault-contract/AGENTS.md` using the **same** guard helper (`normalizeLf` + content compare)  
**And** on mismatch: fail loudly with actionable message (do not invent a second LF/diff implementation)  
**And** when vault unavailable: **skip with explicit reason** (same conditional pattern as modules parity — never silent green)

Also run structural invariants from AC2 against the **specs** mirror unconditionally (always available in repo) so CI catches committed corruption even without vault.

### AC9 — Dual-copy honesty (decide from `git diff`, not the plan)

**When** implementation is complete  
**Then** Dev Agent Record pastes `git diff --name-only` and states which tree each modified file lives in:

- **If** only `scripts/session-close/**` (and tests/docs) → **negative assertion:** no file under `scripts/hermes-skill-examples/` modified (OPS-1 AC7 pattern). Vacuous `cmp` is forbidden.
- **If** any `scripts/hermes-skill-examples/session-close/**` file is modified → install/sync and paste real `cmp` against `~/.hermes/skills/cns/session-close/` for each touched file.

### AC10 — verify green

**When** shipped  
**Then** `bash scripts/verify.sh` exits 0  
**And** no `/session-close` live run was used as proof

### AC11 — Vacuous checks must fail loudly, never silently pass

A check that **cannot** run must never be reported as a check that **passed**. Same defect class this epic exists to remove (OPS-1/OPS-2: unknown/unrunnable ≠ success). Gate placement and AC1–AC10 are unchanged; this only constrains how stale/collision report when their preconditions are missing.

#### (a) SOURCE == MIRROR (fallback path) → NOT APPLICABLE, not passed

**Given** the vault copy is unreadable and `constitutionAgentsPath` falls back to `repoAgentsPath` (or any other case where source and mirror resolve to the **same realpath**)  
**When** the propagation gate runs  
**Then** detect same-realpath via `realpath` (or equivalent) on the two paths  
**And** do **not** report stale or collision as **passed** — report them as **`not_applicable`** with a **loud reason naming the resolved path**  
**And** that `not_applicable` state is visible in `close-report.json` (e.g. under `steps.section8` / a `constitution_guard` object: `{ stale: "not_applicable", collision: "not_applicable", reason: "…" }`)  
**And** structural checks (AC2) **still run and still apply** — same-path fallback does not skip structural refuse  
**And** if structural fails, refuse both writes as usual  

**TEST:** Point source and mirror at one path; assert the run does **NOT** claim a passed stale/collision gate (must be `not_applicable` + loud reason, not `passed` / omitted-as-ok).

#### (b) MIRROR MISSING → FAIL CLOSED

**Given** the git-tracked mirror path cannot be read (ENOENT or equivalent)  
**When** the gate would otherwise treat “no mirror text” as “no drift detected”  
**Then** that silent skip is **forbidden**  
**And** refuse both writes, exit non-zero, set `failure_class: section8`  
**And** loud message e.g. `constitution-guard: mirror-unreadable: …` naming the path  
**And** both AGENTS targets are unchanged on disk  

**TEST:** Mirror path absent → refuse; assert **BOTH** targets byte-unchanged on disk.

> Catching ENOENT and proceeding as “no drift” is the exact silent-success pattern this epic forbids. Unknown mirror state is never success.

---

## Tasks / Subtasks

- [x] **Guard module** (AC: 1–4, 11) — `scripts/session-close/lib/agents-constitution-guard.mjs`
  - [x] Import `normalizeLf` from `sync-vault-modules.mjs` (87-2 reuse — no forked LF)
  - [x] Export `assertAgentsPropagationAllowed({ sourcePath, mirrorPath, sourceText, mirrorText, newVersion })` (or equivalent) returning/recording check statuses
  - [x] Structural: §2 row-once + §2∪§3 adjacent-token with allowlist
  - [x] Stale: compare header versions — **only when** `realpath(source) !== realpath(mirror)` and mirror readable
  - [x] Collision: changelog versions from **source ∪ mirror** — same applicability rule as stale
  - [x] Same-realpath: mark stale+collision `not_applicable` with loud path reason; structural still runs
  - [x] Mirror unreadable: throw fail-closed (`constitution-guard: mirror-unreadable:`) — never treat as empty/no-drift
  - [x] Loud error prefixes: `constitution-guard: structural|stale|version-collision|mirror-unreadable:`
- [x] **Wire into write path** (AC: 1, 6, 7, 11) — `scripts/session-close/apply-section8.mjs` `runApplySection8`
  - [x] After source read + mirror read attempt; **before** `applySection8ToAgentsText` and before any write/preview
  - [x] Persist `constitution_guard` / check statuses into close-report (incl. `not_applicable` reasons)
  - [x] On fail: `recordSection8Failure` when `!dryRun`; rethrow; exit 1 via existing CLI
  - [x] **Do not** change `applySection8ToAgentsText` transform logic
- [x] **Load-bearing test** (AC: 5) — corrupt source; assert both target files unchanged on disk
- [x] **Incident-shaped collision test** (AC: 4) — vault 2.1.57 / mirror 2.1.58 changelog union
- [x] **Stale + structural unit tests** (AC: 2–3)
- [x] **Vacuous-check tests** (AC: 11)
  - [x] Same realpath → stale/collision `not_applicable`, not passed; structural still enforced
  - [x] Mirror absent → refuse; both targets unchanged on disk
- [x] **Rollup test** (AC: 7)
- [x] **Verify-time parity** (AC: 8) — shared helper; skip-with-reason when no vault; structural on specs always
- [x] **Dual-copy record** (AC: 9) — paste `git diff --name-only`; negative or real cmp
- [x] **Verify** (AC: 10) — `bash scripts/verify.sh`

---

## Dev Notes

### Hard constraints

1. **Do not modify** `applySection8ToAgentsText` body to "fix" duplication — transform is clean.
2. **Do not run** `/session-close` for proof.
3. **Do not invent** a second LF/compare stack — reuse `normalizeLf` (+ compare/refuse style) from 87-2.
4. **Collision = union** — source-only is a known false green for the motivating incident.
5. **Assert disk bytes** on the corrupt-source / mirror-missing tests — not only that the function threw.
6. **Vacuous ≠ passed** — same-realpath stale/collision must be `not_applicable` (loud); missing mirror must refuse. Never catch ENOENT and proceed as no-drift.
7. No new npm packages unless >14 days old and justified (prefer hand-rolled three-part semver compare).
8. WriteGate: AGENTS mutation remains filesystem via apply path, not Vault IO mutators.

### Gate placement (canonical)

```text
read source (constitutionAgentsPath → fallback repoAgentsPath)
attempt read mirror (repoAgentsPath)
        │
        ▼
realpath(source) vs realpath(mirror)
  ├─ mirror unreadable → REFUSE (AC11b) — zero writes
  ├─ same realpath → stale/collision = not_applicable (loud); structural still runs
  └─ distinct paths → stale + collision ∪ as AC3/AC4
        │
        ▼
assertAgentsPropagationAllowed(...)   ← structural fail OR stale/collision fail = zero writes
        │ pass (structural ok; drift checks passed or not_applicable)
        ▼
applySection8ToAgentsText(...)         ← leave transform alone
        │
        ▼
dry-run → preview | real → write both targets (existing snapshot/rollback retained)
record constitution_guard statuses on close-report (incl. not_applicable reasons)
```

### Validation surface (API sketch — implementer may refine names)

```js
// scripts/session-close/lib/agents-constitution-guard.mjs
import { normalizeLf } from "./sync-vault-modules.mjs";

export const PAKE_ROUTING_TYPES = Object.freeze([/* seven types */]);
export const ADJACENT_TOKEN_ALLOWLIST = new Set(["had had", "that that"]);

/** @typedef {"passed" | "failed" | "not_applicable"} GuardCheckStatus */

export function extractSectionRange(text, startHeading, endHeading) { /* … */ }
export function assertRoutingRowsOnce(section2Text) { /* … */ }
export function assertNoDoubledAdjacentTokens(section2And3Text, allowlist) { /* … */ }
export function parseAgentsHeaderVersion(text) { /* > Version: X.Y.Z */ }
export function listChangelogVersions(text) { /* version column */ }
export function compareSemver(a, b) { /* -1 | 0 | 1 */ }
/**
 * @returns {{
 *   structural: GuardCheckStatus,
 *   stale: GuardCheckStatus,
 *   collision: GuardCheckStatus,
 *   reason?: string
 * }}
 * Throws on structural fail, stale fail, collision fail, or mirror-unreadable.
 * Same-realpath → stale+collision not_applicable (never "passed"); structural still evaluated.
 */
export function assertAgentsPropagationAllowed({
  sourcePath,
  mirrorPath,
  sourceText,
  mirrorText, // null/undefined only if mirror read failed — that path must throw, not skip
  newVersion,
}) { /* … */ }
export function compareAgentsMirror(vaultText, specsText) { /* { ok, … } using normalizeLf */ }
export function formatAgentsParityMessage(diff) { /* actionable */ }
```

### Files to READ before editing

| File | Current behavior | This story |
|------|------------------|------------|
| `scripts/session-close/apply-section8.mjs` | Read vault source → transform → write both; rollback on mid-write error; no pre-validate | **UPDATE:** call guard after read, before transform/write; stamp section8 failure on refuse |
| `scripts/session-close/lib/apply-section8-body.mjs` | Clean §8 patch + bump + changelog | **Do not change transform**; may import `bumpPatchVersion` for collision preview |
| `scripts/session-close/lib/sync-vault-modules.mjs` | `normalizeLf`, modules compare/refuse | **Reuse** `normalizeLf`; do not overload modules sync with AGENTS logic |
| `scripts/session-close/lib/paths.mjs` | `constitutionAgentsPath`, `repoAgentsPath`, `agentsPath` | Read only unless a tiny helper export is needed |
| `scripts/session-close/render-discord-reply.mjs` | `failure_class === "section8"` → agents_sync failed | Confirm path; add test if gap |
| `tests/session-close-pipeline.test.mjs` | SC-4 apply fixtures | Extend with AC5/AC4 fixtures |
| `tests/vault-modules-parity.test.mjs` | Live modules parity + skip | Pattern to mirror for AGENTS parity |
| `tests/constitution.test.mjs` | Specs line budget + planning mirror | Optional: structural assert on specs via shared helper |

### Previous story intelligence

| Story | Reuse |
|-------|-------|
| **OPS-1** | Fail loud; dual-copy **negative assertion** when no Hermes twin; do not claim `cmp` vacuously |
| **OPS-2** | Pre-flight before first write; verify-time sweep **and** runtime assertion; both required |
| **87-2** | `normalizeLf` + compare → refuse + actionable message; live vault skip-with-reason |
| **48-4** | Dual-target write + snapshot rollback; `failure_class: section8`; dry-run preview path |

### Git intelligence (recent)

- `588e17c` / `0467743` — deferred-work root-cause correction + incident log (amplifier not origin)
- OPS-1/OPS-2/OPS-3 landed same day on fail-loud theme
- Baseline for this story: `588e17c`

### Out of scope

- Fixing §8 regen quality / dropped epic lines (separate deferred concern)
- Finding who first corrupted the vault copy between 07-14 and 07-20
- Drive-sync timeout / rollup (sibling deferred entry — not this story)
- Reopening epic-87 or changing modules sync direction

### Project structure notes

- Session-close **runtime scripts** live under `scripts/session-close/` and are invoked by **absolute repo path** from the Hermes skill (see skill task-prompt). Confirm at ship time with `git diff --name-only` whether any skill-example file moved.
- Constitution SSOT at runtime: vault `AI-Context/AGENTS.md`; git-tracked mirror: `specs/cns-vault-contract/AGENTS.md` ([Source: `specs/cns-vault-contract/AGENTS.md` sync rule / Story 87-1]).

### References

- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — top entry 2026-07-20]
- [Source: `scripts/session-close/apply-section8.mjs` — read/write path]
- [Source: `scripts/session-close/lib/paths.mjs` — `constitutionAgentsPath`]
- [Source: `scripts/session-close/lib/sync-vault-modules.mjs` — `normalizeLf`, compare/refuse]
- [Source: `_bmad-output/implementation-artifacts/87-2-specs-modules-vault-sync-drift-gate.md`]
- [Source: `_bmad-output/implementation-artifacts/OPS-1-digest-push-fail-loud.md` — AC7 dual-copy trap]
- [Source: `_bmad-output/implementation-artifacts/OPS-2-digest-signal-schema-contract-guard.md` — pre-flight + verify sweep]
- [Source: `_bmad-output/implementation-artifacts/48-4-session-close-apply-section8-agents-sync.md`]
- [Source: `specs/cns-vault-contract/AGENTS.md` §2–§3]

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Adjacent-token check initially false-positive on clean specs (`pake_type` prose→table cross-line; `0.0` decimal split). Fixed: per-line check + decimal-aware tokenization. Still catches same-line `governed governed`.
- AC4 incident fixture (Vs 2.1.57 / Vm 2.1.58) also matches AC3 stale. Collision is evaluated before stale so the incident fixture surfaces `version-collision` (union proof); pure stale uses Vs≪Vm with bump not in either changelog.
- Token-gate fixtures needed §2–§4 sections so structural gate does not break SC-4 happy paths.

### Completion Notes List

- Design gate approved 2026-07-20 with four operator decisions (story key, §2∪§3 doubled tokens + allowlist, collision = source ∪ mirror, verify-time parity in scope).
- 2026-07-20 follow-up: **AC11** vacuous-check honesty (same-realpath → `not_applicable`; mirror missing → fail closed) — operator confirmed before dev.
- Ultimate context engine analysis completed — comprehensive developer guide created.
- Implemented `agents-constitution-guard.mjs`; wired into `runApplySection8` before `applySection8ToAgentsText` / any write or dry-run preview. Transform body untouched.
- Load-bearing AC5 asserts disk bytes unchanged on both targets after refuse; AC4 incident union fixture (2.1.57→2.1.58 mirror-only) fails with `version-collision`; AC11a/b covered.
- `bash scripts/verify.sh` → VERIFY PASSED (2026-07-20). No `/session-close` live run.
- **Before claiming done:** paste `git diff --name-only` and dual-copy disposition (negative vs real cmp). — done below.

### File List

- `scripts/session-close/lib/agents-constitution-guard.mjs` (NEW)
- `scripts/session-close/apply-section8.mjs` (UPDATE wire + close-report constitution_guard)
- `tests/agents-constitution-guard.test.mjs` (NEW — AC2–8, AC11)
- `tests/session-close-pipeline.test.mjs` (SAMPLE_AGENTS gains §2–§4 for structural happy path)
- `tests/session-close-token-gate.test.mjs` (same fixture structural sections)
- `_bmad-output/implementation-artifacts/OPS-4-session-close-constitution-propagation-guard.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Dual-copy disposition (AC9 — fill after implement)

```
# git diff --name-only (+ untracked implementation files)
_bmad-output/implementation-artifacts/OPS-4-session-close-constitution-propagation-guard.md
_bmad-output/implementation-artifacts/sprint-status.yaml
scripts/session-close/apply-section8.mjs
scripts/session-close/lib/agents-constitution-guard.mjs
tests/agents-constitution-guard.test.mjs
tests/session-close-pipeline.test.mjs
tests/session-close-token-gate.test.mjs

# NEGATIVE: no scripts/hermes-skill-examples/ paths → OK (OPS-1 AC7 pattern)
# Vacuous cmp forbidden; runtime scripts only under scripts/session-close/
```

### Change Log

- 2026-07-20: OPS-4 implemented — pre-write constitution propagation guard (structural / stale / union collision / vacuous honesty); verify-time AGENTS parity; verify.sh green.
