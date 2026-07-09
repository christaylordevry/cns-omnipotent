---
story_id: 87-1
epic: 87
title: untrack-vault-ai-context-constitution-duplicates
status: review
baseline_commit: e08ad984fe8fa6376063aa0d6dfbf2c2c0ed4f0a
zone: Omnipotent.md repo hygiene + vault fixture layout
branch: hermes-consolidation
predecessors: 1-1, 1-2, 31-1, 48-4, 86-1
related_deferred: deferred-work.md §AGENTS.md line-ending flip-flop; §7 Active Modules registration (operator WriteGate)
canonical_vault_modules: /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/
---

# Story 87.1: Vault-first constitution mirror — specs tracks vault; repo copy untracked

Status: review

<!-- Corrected 2026-07-09 — 11 vault modules (incl. mcp-operator-runbook); relocate vault-lint only. -->

Epic: **87** (Constitution mirror dedup — stop tracking stale `Knowledge-Vault-ACTIVE/AI-Context/` copies)  
Tracked in sprint-status as: **`87-1-untrack-vault-ai-context-constitution-duplicates`**

## Story

As a **CNS maintainer working in the Omnipotent.md repo**,
I want **`specs/cns-vault-contract/` to git-track an exact mirror of the live vault constitution tree, with the in-repo `Knowledge-Vault-ACTIVE/AI-Context/` copy untracked**,
so that **agents and CI never load stale repo-vault content (e.g. AGENTS v2.0.1) when the real vault and specs are current**.

## SSOT principle (LOCKED)

```text
Real vault  AI-Context/{AGENTS.md, modules/, personas/}  →  SSOT (runtime)
     ↓ mirror exactly (git)
specs/cns-vault-contract/{AGENTS.md, modules/, personas/}  →  git-tracked mirror
     ↓ never git-track
Knowledge-Vault-ACTIVE/AI-Context/{AGENTS.md, modules/, personas/}  →  local/untracked only
```

**Source path for module content:** `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/` (canonical vault). Prefer canonical over repo mirror when copying.

## Problem statement (confirmed — do not re-investigate)

| Location | State (2026-07-09) | Git-tracked? | Problem |
|----------|-------------------|--------------|---------|
| Canonical vault `AI-Context/AGENTS.md` | Live | No (outside repo) | Runtime SSOT |
| `specs/cns-vault-contract/AGENTS.md` | v2.1.51 | Yes | Should mirror vault |
| `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` | v2.0.1 (stale) | Yes | Legacy fixture; leaks into agent context |
| Canonical vault `AI-Context/modules/` | **11 files** | — | **SSOT** (operator restored `mobile-posture`, `mcp-operator-runbook`) |
| `specs/cns-vault-contract/modules/` | **7 files** (6 vault + `vault-lint`) | Yes | Missing 5 vault modules; `vault-lint` wrongly placed here |
| Repo `Knowledge-Vault-ACTIVE/AI-Context/modules/` | Stale duplicate | Yes | Untrack after specs sync |

### Canonical vault module inventory (SSOT — 11 files)

Verified 2026-07-09 at `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/`:

| # | Module | In specs/modules now? | Notes |
|---|--------|----------------------|-------|
| 1 | `vault-io.md` | Yes | Links `modules/mcp-operator-runbook.md` |
| 2 | `security.md` | Yes | |
| 3 | `note-style-guide.md` | **No — ADD** | Referenced in AGENTS §4 |
| 4 | `notebooklm-workflow.md` | **No — ADD** | AGENTS §7 |
| 5 | `hermes-desktop.md` | **No — ADD** | §7 registration deferred (out of scope) |
| 6 | `run-chain.md` | **No — ADD** | References mcp-operator-runbook; §7 registration deferred |
| 7 | `two-bot-vault-boundary.md` | Yes | §7 registration deferred |
| 8 | `memory-pillars-verification.md` | Yes | §7 registration deferred |
| 9 | `routing.md` | **No — ADD** | AGENTS §7 |
| 10 | `mobile-posture.md` | Yes | Operator restored; verify byte-match only |
| 11 | `mcp-operator-runbook.md` | Yes | **Genuine vault module** — vault-io + run-chain cross-link; self-declares "this vault module is the mirror operators read" |

**Specs already has 6 of 11:** `mcp-operator-runbook`, `mobile-posture`, `security`, `vault-io`, `two-bot-vault-boundary`, `memory-pillars-verification`.

**Add 5 from canonical vault:** `note-style-guide`, `notebooklm-workflow`, `routing`, `hermes-desktop`, `run-chain`.

### vault-lint.md — NOT a vault module (relocate only this)

`vault-lint.md` lives under `specs/cns-vault-contract/modules/` today but is **absent from the canonical vault**. It is normative **skill/operator contract** docs (Epic 29), not an agent-context vault module. **Nothing in the vault cross-links `modules/vault-lint.md`.**

**Action:** Relocate `vault-lint.md` out of `modules/` → `specs/cns-vault-contract/` root (preferred) or `docs/`. Update **active** cross-links to the new path only. **Do not delete.**

**Do NOT relocate `mcp-operator-runbook.md`** — it stays under `modules/` as vault module #11.

### mobile-posture (operator-resolved)

Operator restored `mobile-posture.md` to canonical vault. **This story:** verify specs copy byte-matches canonical; no edits unless `diff` fails.

## Out of scope (explicit)

- **AGENTS §1–7 / §8 body edits** — WriteGate
- **§7 Active Modules registration** for `hermes-desktop`, `run-chain`, `two-bot-vault-boundary`, `memory-pillars-verification` — separate operator WriteGate task
- **Personas migration to specs/** — gitignore untrack only (optional mirror)

## Acceptance Criteria

### AC#1 — Reference audit

**Given** untrack scope `Knowledge-Vault-ACTIVE/AI-Context/{AGENTS.md,modules/**,personas/**}`  
**When** audit completes  
**Then** Dev Agent Record table covers every repo reference to those paths **and** active references to `modules/vault-lint.md` (pre-relocation)  
**And** no active code/test depends on **git-tracked** in-repo vault copies  
**And** these **remain tracked**:

- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `Knowledge-Vault-ACTIVE/00-Inbox/**`
- `Knowledge-Vault-ACTIVE/AI-Context/vault-fast-scan-index.md`
- `Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md`
- `Knowledge-Vault-ACTIVE/AI-Context/inbox-triage-plan.md`
- `Knowledge-Vault-ACTIVE/AI-Context/projects/**`
- PARA `_README.md` manifests

**Seed audit (extend via `rg`):**

| Path | Kind | Action |
|------|------|--------|
| `.cursor/rules/cns-specs-constitution.mdc` | rule | **update** — drop in-repo vault AGENTS sync |
| `project-context.md` | doc | **update** — vault-first mirror principle |
| `specs/cns-vault-contract/README.md` | doc | **update** — 11-file modules mirror; `vault-lint` at spec root |
| `specs/cns-vault-contract/shims/CLAUDE.md` | shim | **update** — relocated `vault-lint.md` path |
| `scripts/hermes-skill-examples/vault-lint/SKILL.md` | skill | **update** — relocated `vault-lint.md` path |
| `specs/cns-vault-contract/modules/vault-io.md` | module | **keep** — `modules/mcp-operator-runbook.md` pointer stays |
| `tests/constitution.test.mjs` | test | **keep** |
| `scripts/session-close/lib/paths.mjs` | code | **review** — `vaultFallbackUnderRepo` marker |
| `_bmad-output/implementation-artifacts/*.md` | artifact | **legacy-skip** |

### AC#2 — Sync specs/modules/ to canonical vault (11-file mirror)

**Given** canonical vault `AI-Context/modules/` is SSOT  
**When** sync completes  
**Then** `specs/cns-vault-contract/modules/` contains **exactly these 11 files** (content from canonical vault):

1. `vault-io.md`
2. `security.md`
3. `note-style-guide.md`
4. `notebooklm-workflow.md`
5. `hermes-desktop.md`
6. `run-chain.md`
7. `two-bot-vault-boundary.md`
8. `memory-pillars-verification.md`
9. `routing.md`
10. `mobile-posture.md`
11. `mcp-operator-runbook.md`

**And** the **5 missing** files are copied from canonical vault: `note-style-guide`, `notebooklm-workflow`, `routing`, `hermes-desktop`, `run-chain`  
**And** the **6 existing** vault modules in specs are verified against canonical (`diff -q` each or batch `diff -qr`)  
**And** `mobile-posture.md` byte-matches canonical (operator already restored)  
**And** `diff -qr` canonical vs specs/modules shows **11 identical files, zero extras**  
**And** no AGENTS §1–7 edits

### AC#3 — Relocate vault-lint.md only

**Given** `vault-lint.md` is skill/normative docs, not a vault module  
**When** relocation completes  
**Then** `vault-lint.md` is **not** under `specs/cns-vault-contract/modules/`  
**And** it exists at `specs/cns-vault-contract/vault-lint.md` (or `docs/` — prefer spec root)  
**And** active cross-links updated (`shims/CLAUDE.md`, `vault-lint/SKILL.md`, `README.md`; tests if any)  
**And** `mcp-operator-runbook.md` **remains** under `modules/` — no path changes for runbook cross-links

### AC#4 — Untrack redundant repo Knowledge-Vault-ACTIVE/AI-Context copies

**Given** AC#1–AC#3 complete  
**When** git index updated  
**Then** removed from tracking + `.gitignore`:

```
Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md
Knowledge-Vault-ACTIVE/AI-Context/modules/
Knowledge-Vault-ACTIVE/AI-Context/personas/
```

**And** AC#1 keep-list paths remain tracked

### AC#5 — Update active references for mirror model

**Given** untrack applied  
**When** docs/rules/skills/tests updated  
**Then** repo work cites `specs/cns-vault-contract/` for constitution/modules  
**And** vault-relative `AI-Context/...` retained only for **runtime vault** semantics (shims, WriteGate, brain paths)  
**And** `.cursor/rules/cns-specs-constitution.mdc`: sync `specs/AGENTS.md` ↔ canonical vault via session-close — not in-repo `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`

### AC#6 — Verification gate

**When** `bash scripts/verify.sh` runs  
**Then** exit code **0**

**And** completion notes document:

```bash
CANON="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules"
SPEC="specs/cns-vault-contract/modules"
diff -qr "$CANON" "$SPEC"   # must be empty
ls -1 "$SPEC" | wc -l       # must be 11
```

## Tasks / Subtasks

- [x] **Audit** (AC#1): full `rg`; paste table in Dev Agent Record
- [x] **Relocate vault-lint** (AC#3): out of `modules/` + fix active cross-links only
- [x] **Copy 5 missing modules** (AC#2): from canonical vault into `specs/modules/`
- [x] **Verify 6 existing modules** (AC#2): `diff -qr` canonical vs specs (after vault-lint removed from modules/)
- [x] **Verify mobile-posture** (AC#2): byte-match canonical
- [x] **Assert 11-file modules dir** (AC#2): no extras; `diff -qr` empty
- [x] **Untrack + gitignore** (AC#4)
- [x] **Reference updates** (AC#5): rules, README, paths.mjs if needed
- [x] **Verify** (AC#6): `bash scripts/verify.sh`

**Suggested commits:** (1) vault-lint relocation + 5 module adds + verify existing 6, (2) cross-link/doc updates, (3) gitignore/untrack

## Dev Notes

### Hard constraints

1. **Spec-first** — read `specs/cns-vault-contract/CNS-Phase-1-Spec.md` + `README.md`
2. **No AGENTS §1–7 / §8 edits** — WriteGate
3. **No §7 module table registration** — operator deferred task
4. **Small commits**
5. **Do NOT relocate `mcp-operator-runbook.md`** — it is vault module #11

### Target layout after story

```text
specs/cns-vault-contract/
├── AGENTS.md
├── vault-lint.md              # relocated FROM modules/ (skill docs)
├── README.md
├── modules/                   # EXACTLY 11 files = canonical vault
│   ├── vault-io.md
│   ├── security.md
│   ├── note-style-guide.md
│   ├── notebooklm-workflow.md
│   ├── hermes-desktop.md
│   ├── run-chain.md
│   ├── two-bot-vault-boundary.md
│   ├── memory-pillars-verification.md
│   ├── routing.md
│   ├── mobile-posture.md
│   └── mcp-operator-runbook.md
└── shims/ ...

Knowledge-Vault-ACTIVE/AI-Context/
├── AGENTS.md          # UNTRACKED
├── modules/           # UNTRACKED
├── personas/          # UNTRACKED
├── MEMORY.md          # TRACKED
├── vault-fast-scan-index.md  # TRACKED
└── ...
```

### vault-lint cross-link checklist (AC#3 only)

- `specs/cns-vault-contract/shims/CLAUDE.md`
- `specs/cns-vault-contract/README.md`
- `scripts/hermes-skill-examples/vault-lint/SKILL.md`
- Any active test asserting `modules/vault-lint.md`

**Keep unchanged:** `specs/cns-vault-contract/modules/vault-io.md` → `modules/mcp-operator-runbook.md`; operator guide → `AI-Context/modules/mcp-operator-runbook.md`

### Tests that must stay green

```text
Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md
Knowledge-Vault-ACTIVE/00-Inbox/...
Knowledge-Vault-ACTIVE/AI-Context/vault-fast-scan-index.md
Knowledge-Vault-ACTIVE/{PARA}/_README.md
tests/constitution.test.mjs
```

### Previous story intelligence

- **Story 24-1** — `mcp-operator-runbook.md` belongs in vault `modules/`; vault-io cross-links confirm
- **Story 29-4/29-5** — `vault-lint.md` is normative skill spec; belongs outside `modules/`
- **Story 31-1** — obsolete in-repo AGENTS fixture; untrack here
- **Story 13-1** — `mobile-posture.md`; verify only

## References

- [Source: canonical vault `AI-Context/modules/` — 11-file SSOT]
- [Source: `specs/cns-vault-contract/modules/vault-io.md` — links `mcp-operator-runbook`]
- [Source: canonical `modules/mcp-operator-runbook.md` — vault module self-declaration]
- [Source: `specs/cns-vault-contract/AGENTS.md` §4 — `note-style-guide`]
- [Source: `.cursor/rules/cns-specs-constitution.mdc`]
- [Source: `scripts/session-close/apply-section8.mjs`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor dev-story)

### Debug Log References

- `diff -qr` canonical vs specs/modules: empty (11 identical files)
- `bash scripts/verify.sh`: exit 0 (2026-07-09)

### Completion Notes List

- Relocated `vault-lint.md` from `specs/cns-vault-contract/modules/` to `specs/cns-vault-contract/vault-lint.md`; updated active cross-links in README, shims/CLAUDE.md, vault-lint SKILL.md.
- Synced all 11 vault modules from canonical vault into `specs/cns-vault-contract/modules/` (5 added, 6 refreshed from canonical).
- Untracked `Knowledge-Vault-ACTIVE/AI-Context/{AGENTS.md,modules/,personas/}` via `.gitignore` + `git rm --cached`; keep-list paths remain tracked.
- Updated mirror-model docs: `.cursor/rules/cns-specs-constitution.mdc`, `project-context.md`, `specs/cns-vault-contract/README.md`, `CNS-Phase-1-Spec.md`, `docs/mobile-vault-access-journey.md`.
- `paths.mjs`: `vaultFallbackUnderRepo` now keys off tracked `vault-fast-scan-index.md` instead of untracked AGENTS fixture.
- Added `tests/constitution.test.mjs` case for 11-module mirror + vault-lint root placement.

### File List

- `.gitignore`
- `.cursor/rules/cns-specs-constitution.mdc`
- `project-context.md`
- `docs/mobile-vault-access-journey.md`
- `scripts/session-close/lib/paths.mjs`
- `scripts/hermes-skill-examples/vault-lint/SKILL.md`
- `specs/cns-vault-contract/README.md`
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- `specs/cns-vault-contract/shims/CLAUDE.md`
- `specs/cns-vault-contract/vault-lint.md` (relocated from modules/)
- `specs/cns-vault-contract/modules/hermes-desktop.md` (new)
- `specs/cns-vault-contract/modules/note-style-guide.md` (new)
- `specs/cns-vault-contract/modules/notebooklm-workflow.md` (new)
- `specs/cns-vault-contract/modules/routing.md` (new)
- `specs/cns-vault-contract/modules/run-chain.md` (new)
- `specs/cns-vault-contract/modules/mcp-operator-runbook.md` (updated from canonical)
- `specs/cns-vault-contract/modules/mobile-posture.md` (updated from canonical)
- `specs/cns-vault-contract/modules/security.md` (updated from canonical)
- `specs/cns-vault-contract/modules/vault-io.md` (updated from canonical)
- `tests/constitution.test.mjs`
- `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (untracked)
- `Knowledge-Vault-ACTIVE/AI-Context/modules/**` (untracked)

### AC#1 Reference Audit

| Path | Kind | Action |
|------|------|--------|
| `.cursor/rules/cns-specs-constitution.mdc` | rule | **updated** — sync specs ↔ canonical vault; in-repo fixture untracked |
| `project-context.md` | doc | **updated** — vault-first mirror principle |
| `specs/cns-vault-contract/README.md` | doc | **updated** — 11-file modules mirror; vault-lint at spec root |
| `specs/cns-vault-contract/CNS-Phase-1-Spec.md` | spec | **updated** — canonical vs git mirror paths |
| `specs/cns-vault-contract/shims/CLAUDE.md` | shim | **updated** — vault-lint path |
| `scripts/hermes-skill-examples/vault-lint/SKILL.md` | skill | **updated** — vault-lint path |
| `docs/mobile-vault-access-journey.md` | doc | **updated** — cite specs mirror for repo work |
| `scripts/session-close/lib/paths.mjs` | code | **updated** — fallback marker uses tracked fixture |
| `specs/cns-vault-contract/modules/vault-io.md` | module | **keep** — mcp-operator-runbook pointer unchanged |
| `tests/constitution.test.mjs` | test | **updated** — 11-module + vault-lint root assertion |
| `_bmad-output/implementation-artifacts/*.md` | artifact | **legacy-skip** |
| `HANDOFF-*.md` | handoff | **legacy-skip** (historical repo-mirror references) |
| `scripts/session-close/references/task-prompt.legacy.md` | legacy | **keep** — canonical `/mnt/c/...` paths (runtime vault) |

### AC#2 Verification commands

```bash
CANON="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules"
SPEC="specs/cns-vault-contract/modules"
diff -qr "$CANON" "$SPEC"   # empty — 11 identical files
ls -1 "$SPEC" | wc -l       # 11
test ! -f specs/cns-vault-contract/modules/vault-lint.md
test -f specs/cns-vault-contract/vault-lint.md
```

## Change Log

- 2026-07-09: Story 87-1 — vault-first mirror; 11 modules synced; vault-lint relocated; in-repo AI-Context constitution copies untracked.

## Story Completion Status

- **Status:** review
- **Completion note:** All ACs satisfied; `bash scripts/verify.sh` exit 0.
