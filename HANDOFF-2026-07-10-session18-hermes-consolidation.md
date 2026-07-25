# HANDOFF — 2026-07-10 (session 18) — hermes-consolidation

Branch: `hermes-consolidation`, HEAD `4636f6a` (== origin). Clean tree, everything pushed. Pickup doc for next chat.

## ⚡ Immediate next actions (do these first)

1. **Note-frontmatter follow-ups (deferred from 87-3 review, logged in deferred-work.md).** Six defers, all pre-existing/out-of-scope: `status: stable` lint-vs-Zod mismatch; 5-vs-7 `pake_type` table drift; scalar `tags` cross-layer mismatch; `task-prompt.md` + `vault-lint-remediate-34-2.ts` still ERROR-on-missing-enrichment (should be WARNING now); note-style-guide legacy `date`/`reference` keys. Optional cleanup epic if the two-bot note shapes need full reconciliation.

## ✅ Completed this session (all verified + pushed)

- **87-2 review patches** (`607509c`) + sprint tracker (`720e723`) — the critical fallback-guard finding + empty-vault guard + `rm force` + tests. Verified 100/100 + verify.sh, pushed.
- **87-3 PAKE quality-enrichment tier — FULLY DONE** (`44e0da0` code+patches, `4636f6a` AC8 constitution). Investigation → create-story (propose-then-stop) → dev-story → code-review (2 real patches: `.strip()` crash-the-whole-scan guard + empty-list ERROR) → AC8 §3 reclassification at v2.1.54. Made confidence_score/verification_status/creation_method `.optional()` in Zod (Nexus-shaped notes now pass governed mutations; Hermes keeps stamping); vault-lint Rule 4 core-ERROR/enrichment-WARNING split; CNS-Phase-1-Spec + note-style-guide + AGENTS §3 all reclassified. All 3 constitution copies content-identical at v2.1.54, constitution.test 6/6, verify.sh green. Story + sprint → done.
- **Epic-84 unified-loop governance module — DONE** (registered v2.1.55). Authored `AI-Context/modules/unified-loop.md` (reconciled from 84-1/84-2/84-3 evidence; Build/Verify/Persist wired as operator handoffs), synced vault→specs, registered in AGENTS §7 (all 3 copies byte-identical), constitution.test count-lock 11→12. constitution.test + vault-modules-parity + verify.sh all green. This was the item /session-close couldn't author (§1-7/module content). **Epic 84 fully closed.**
- **cns-dashboard flaky test fixed** (`167598e`, cns-dashboard master, pushed). `notebookQueries` 100-row-cap test was flaky from `queriedAt` timestamp ties (NOT DB leakage) — fixed with fake-timers monotonic clock. Verified 5 consecutive clean full-suite runs. `verify.sh` gate now reliably green.

## 🔑 Key facts / lessons (see memory index)

- **BIG LESSON — `/session-close` scope is §8-ONLY.** It regenerates Section 8 (current-focus) + bumps version + syncs the copies together (`apply-section8.mjs` writes SAME bytes to specs AND canonical vault `/mnt/c/.../Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`; planning is a symlink→specs). It reads existing §1-7 and does **NOT** author §1-7 content changes or new module files. So §1-7 edits + new modules **require a deliberate operator-direct edit** (edit git-tracked specs + sync vault byte-identical), NOT session-close. Don't waste a paid close (~$3-5) expecting content application. Memory: `project_stale_agents_md_drift` (corrected).
- **Version-collision trap:** session-close consumed our intended 2.1.53 for its §8 re-stamp, forcing the AC8 §3 edit to 2.1.54. Check the live `> Version:` line before bumping.
- **Git status via WSL, not the Windows Bash tool** — Windows git (`autocrlf=true`) fakes a ~135-file CRLF churn AND hides real changes. WSL git is truth. Stage by explicit pathspec, never `git add -A`. Memory: `feedback_git_status_via_wsl`.
- **AGENTS.md line-endings:** git-tracked = LF (`.gitattributes`); working/vault copies may be CRLF — content-identical, benign, self-heals on next session-close.
- **Verifier role held all session:** every auto-generated artifact (87-2 sync guard, 87-3 story, dev output, code-review patches, AC8) was checked against source before trusting; caught the AC8-not-applied gap + the misdiagnosed flaky-test root cause. Continue: hand code to Cursor, verify hard.

## 📋 Open backlog (not blocking)

- **86-1** (review) — session-close project-status SSOT; closing it fixes AGENTS §8 staleness. Good "close a near-done epic" pick.
- **78-1** (in-progress) — Desktop voice AC#4 PARTIAL (PTT keybind collision + Desktop misroutes to direct Anthropic OAuth instead of Portal). See deferred-work.md.
- **NotebookLM drive-sync 60s timeout** — recurred this session-close (best-effort; 3 targets pending fan-out). Decide only if chronic.
- deferred-work.md has the full list (87-3 review defers, note-style-guide secondary divergences, etc.).
