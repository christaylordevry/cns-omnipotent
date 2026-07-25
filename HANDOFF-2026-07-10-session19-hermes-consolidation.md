# HANDOFF — 2026-07-10 (session 19) — hermes-consolidation

Branch: `hermes-consolidation`, HEAD `34167bb` (== origin). Clean tree, everything pushed. Continues session 18. AGENTS constitution now at **v2.1.57**.

## ⚡ Immediate next actions (do these first)

1. **Orient:** read the memory index (esp. `project_note_frontmatter_schema_conflict` [now RESOLVED], `reference_canonical_vs_repo_vault_path`, `project_stale_agents_md_drift`, `feedback_git_status_via_wsl`, `feedback_verify_not_implement`, `feedback_always_prompt_code_review_after_dev`, `feedback_cursor_paste_ready_prompt`).
2. **Verify board** via WSL git (Windows git faults autocrlf): `git log --oneline -3` + `git status`, confirm HEAD == origin, tree clean.
3. **Pick from backlog** (all non-blocking): (a) **86-1 fast-follow** — 4 LOW items, quick; (b) **fixture repoint** — locate where Claude Code's vault-io MCP sets `CNS_VAULT_ROOT` to the repo and point it at canonical (now self-surfacing via the new startup warning); (c) **session-close changelog-dup fix**; (d) **78-1 Desktop voice** (needs operator at the Electron app). Recommend a pick with one-line rationale each and wait for the operator to choose.

## ✅ Completed this session (all verified + pushed)

Roles held all session: **operator runs skills in Cursor + Discord; I (Claude Code) verify hard against source at every hop and commit/push via WSL**. Caught real issues each time (see lessons).

- **Story 86-1 + epic-86 CLOSED** (`e84c48f`). 3-lens `/bmad-code-review` (Blind + Edge + Auditor) + hard source verify + full `verify.sh`. All 5 ACs met; the SSOT `deriveProjectStatusLine` derivation is correct. 4 LOW review findings → deferred-work; 1 defer. **Payoff proven** (see below).
- **epic-87 CLOSED** (`7d20b93`). Ground-truthed that 87-3 already resolved the core note-frontmatter conflict (Zod enrichment fields `.optional()`, `schemas.ts:44-46`). Only optional retrospective remained.
- **PAKE frontmatter reconciliation — FULLY DONE** (the residual 6 defers from 87-3):
  - **Fork A** — migrated the lone `status: stable` note `CNS-Operator-Guide.md` → `reviewed` in BOTH trees (repo `c699d44` + governed canonical write); also fixed a co-located `created`-as-date PAKE invalidity. **Surfaced the repo↔canonical vault divergence** (logged).
  - **Lane A** (`a2f32c0`) — `bulk_scan.py` drop `stable` from STATUSES; `task-prompt.md` §8 Rule-4 core-ERROR/enrichment-WARNING split; added run-chain types `HookSetNote`+`WeaponsCheckNote` to `vault-lint.md:167` + `CNS-Phase-1-Spec.md` (union `:155`, schema tree `:111-112`). Formal `/bmad-code-review` caught 2 real intra-file stragglers (routing table + "all five" checklist) → fixed. verify.sh green.
  - **Lane B** (`fb67e03`) — AGENTS **v2.1.56** §2 routing + §3 PAKE-Standard scope/enum (HookSet/WeaponsCheck → 03-Resources, cited **Epic 75**), all 3 copies byte-identical (constitution.test 6/6); `note-style-guide` module (`date→created`, `source→source_uri`, `reference→reviewed` incl. Clippings, 7-type list; vault-modules-parity 9/9). Operator-direct edit + specs→vault byte-sync (NOT session-close).
  - **Gap 3 (scalar tags)**: keep-ERROR **by decision** (Zod coerces on ingress so on-disk MCP notes are always arrays; lint correctly flags external scalar tags — no change).
  - **Skipped**: `vault-lint-remediate-34-2.ts` (dated 2026-05-17 one-shot, won't re-run).
- **Vault-topology investigation + guard** — investigation (`ee2ca60`); guard/contract (`237625f`): `src/config.ts` `warnIfCiFixtureVaultRoot()` warn-only guard (fires only when `CNS_VAULT_ROOT` == `<repoRoot>/Knowledge-Vault-ACTIVE`; canonical never false-warns; never throws) + 4 tests; `README` client-root matrix + frozen-fixture policy; `CLAUDE.md:10` disambiguated. verify.sh green.
- **Investigation docs committed** (`c3b59e8`, `ee2ca60`).
- **`/session-close` ran clean** (Discord, `mode: real`, `failure_class: none`) → §8 regenerated (`a68e6e8`, **v2.1.57**). Logged session-close changelog-dup bug (`34167bb`).

## 🎯 The 86-1 payoff (verified in production)

`/session-close` regenerated AGENTS §8 and `project_status_line` came out **`79 epics done; 2 in-progress (58, 78)`** — the SSOT `deriveProjectStatusLine` format, NOT the years-stale "Phase 6… Epics 1–37… 38+43" boilerplate that used to regress every close. **That regression is permanently fixed.**

## 🔑 Key facts / lessons

- **Vault topology (BIG):** there are TWO `Knowledge-Vault-ACTIVE` trees. **Canonical** `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` = the full live vault (Hermes/Nexus/brain; `CNS_VAULT_ROOT` in `~/.hermes/config.yaml:729`). **Repo** `./Knowledge-Vault-ACTIVE` = a 21-file **CI fixture** (tests read `03-Resources/CNS-Operator-Guide.md` + `_README` manifests; must NOT delete). `CNS_VAULT_ROOT` is env-only + client-configured (`src/config.ts`). **A Claude Code session's vault-io MCP writes to the repo FIXTURE, not canonical** — the new `237625f` guard warns at startup when this happens. `reference_canonical_vs_repo_vault_path`.
- **`sync-vault-modules` goes vault→specs, NOT specs→vault** (`sync-vault-modules.mjs:216`). Running it after a specs-only module edit **clobbers** the edit with stale vault content. For a specs-first module edit: edit specs → copy specs→canonical vault byte-identical → verify `vault-modules-parity`. Do NOT `npm run sync-vault-modules`.
- **`/session-close` is §8-ONLY** (still true) — it does NOT author §1-7/module content; those are deliberate operator-direct specs edits + vault byte-sync + version bump (`project_stale_agents_md_drift`). **New bug:** session-close duplicates the prior changelog row under the new version instead of a descriptive §8-regen entry (pairs `2.1.50/51`, `2.1.52/53`, `2.1.56/57`) — fix in `apply-section8.mjs`, logged in deferred-work.
- **AGENTS §3 pake_type / routing enumerations live in multiple spots** — routing table (§2 `:73-77`), scope sentence (§3 `:107`), template enum (`:112`); and separately in `CNS-Phase-1-Spec.md` (union + schema tree + routing + checklist) and `note-style-guide.md`. Change one → sweep all (code-review caught two misses this session).
- **HookSetNote/WeaponsCheckNote** are run-chain PAKE types (`hook-agent.ts`/`boss-agent.ts`, ranked 0.8 in `quality-weighting.ts`, route to `03-Resources`). Cite **Epic 75** (matches AGENTS `:258`), not Epic 17.
- **Git via WSL, stage by pathspec, never `-A`** (`feedback_git_status_via_wsl`). Windows git faults autocrlf (~135-file phantom churn). Push as `christaylordevry` in WSL (`reference_cns_omnipotent_push_auth`).

## 📋 Open backlog (all logged in deferred-work.md, none blocking)

- **Fixture repoint** — find where Claude Code's vault-io MCP config sets `CNS_VAULT_ROOT` to the repo (not in `~/.cursor/mcp.json` or `~/.claude.json` global — likely a project/SDK-scoped config) and point it at canonical. Now self-surfacing via the startup warning.
- **session-close changelog-dup fix** — `apply-section8.mjs` should emit a self-descriptive §8-regen changelog row.
- **86-1 fast-follow** (4 LOW) — stale `@param repoRoot` JSDoc, dup-key dedup in `deriveProjectStatusLine`, dead `readProjectStatusLine` export, none-case test stale-marker loop.
- **78-1 Desktop voice AC#4** (in-progress) — PTT keybind collision + Desktop misroutes to direct-Anthropic OAuth instead of Nous Portal. Needs operator at the Electron app.
- **Stale repo `Vault-Intelligence-Discovery-Workflow.md`** — `stable` in fixture vs `reviewed` canonical (frozen-fixture policy says this is fine; sync only if a test needs it).
- **NotebookLM 3 pending fan-out targets** — recurring best-effort drive-sync 60s timeout; self-heals on next nlm refresh. Decide only if chronic.
- **epic-58** legitimately open (58-2 `reserved`/unscoped).
