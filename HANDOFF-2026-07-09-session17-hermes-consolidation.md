# HANDOFF — 2026-07-09 (session 17) — hermes-consolidation

Branch: `hermes-consolidation`. Long session; context filled. This is the pickup doc for the next chat.

## ⚡ Immediate next actions (do these first)

1. **87-2 code review → reply `1` (apply all 4 patches).** Verified verdict already given. Finding **#1 is critical and confirmed**: `runSyncVaultModules` has NO `usingRepoVaultFallback` guard (`sync-vault-modules.mjs`), so on a machine without the `/mnt/c` vault mount, session-close would sync the 10 stale repo-mock modules into `specs/` — **deleting `note-style-guide.md` and clobbering 5 others**. Same fallback-safety class as 87-1's Option A. #2 (empty-vault mass-delete guard), #3 (`rm` at `sync-vault-modules.mjs:175` lacks `{force:true}`), #4 (real-mode + fallback-skip pipeline tests) all valid. After patches: re-verify the sync **skips under fallback**, #4 test locks it, and the ambient red/green gate probe still passes (didn't regress activation).

2. **Push the unpushed stack** (devry cred, WSL): `634c831 → a85d59a` — several vault/constitution commits sitting local. `christaylorau23` 403s; must push as `christaylordevry`.

3. **Note-frontmatter schema investigation** (operator's next feature focus). Fully scoped + grounded. See memory `project_note_frontmatter_schema_conflict` and the paste-ready `/bmad-investigate` prompt in the session-17 chat log. Crux: `src/pake/schemas.ts:44-46` REQUIRES `confidence_score`/`verification_status`/`creation_method`; `note-style-guide.md:39-45` PROHIBITS them → Hermes (MCP) and Nexus (FS) write different note shapes. Investigate blast radius (esp. `src/brain/retrieval/quality-weighting.ts`) BEFORE changing the validator. Hypothesis: note-style-guide wins → make the 3 fields optional in Zod, align AGENTS §3.

## ✅ Completed this session

- **58-3 NotebookLM PDF fix** — DONE + verified live. `drive_write_error` (was 134s native-Doc write vs ~60s budget) fixed via Drive PDF media upload. All 3 notebooks migrated to `word_doc` PDF source; env `NOTEBOOKLM_DRIVE_DOC_ID=1olnj…`. Watch-item: drive-sync PHASE 90s timeout on flaky-NLM nights (deferred-work — decide only if it recurs).
- **SOUL.md owned** — replaced generic Nous default with CNS-aligned identity that defers to AGENTS.md (reverses Epic-26 "delete it" which was a losing fight vs `_ensure_default_soul_md`). Gateway restarted on it. Memory: `project_hermes_soul_md_own_not_delete`.
- **Epic 87 vault cohesion (the big one)** — 3-way module drift fixed. Real vault = SSOT, `specs/` = byte-clean mirror, repo `AI-Context/{AGENTS,modules,personas}` untracked. Restored 2 broken module refs to the live vault (`mobile-posture`, `mcp-operator-runbook`). 11 canonical modules.
  - **87-1** (`59fe78c` + patches `4d4902e`): dedup + untrack. Reviewed, patched (Option A constitution fallback so session-close never writes the gitignored repo copy; module count-lock `=== 11`). Status `done`.
  - **87-2** (`89f6033`): session-close auto-syncs vault→specs modules + `verify.sh` drift gate that actually activates (caught + fixed a "theater" bug where it silently skipped). Status `review` → applying review patches (action #1).
  - **§7 registration** (`a85d59a`, AGENTS v2.1.52): registered all 6 previously-unregistered modules so §7 = the 11-module registry. All 3 AGENTS copies synced (vault, specs, planning-artifacts-is-a-symlink).
  - `.gitattributes` LF pin (kills CRLF churn); memory `project_vault_module_ssot`.

## 🔑 Key facts / gotchas (see memory index)

- **Real vault** = `C:\Users\Christopher Taylor\Knowledge-Vault-ACTIVE\` (`CNS_VAULT_ROOT`, on `/mnt/c`). Repo copy can be stale. Path has a SPACE — quote it.
- **My WSL-exec gremlin:** `wsl bash -c '…$VAR…'` mangles variables intermittently. Reliable pattern: write a `.sh` to `/home/christ/…` (via Write to UNC path) and run `wsl bash -c 'bash /home/christ/x.sh'`, or hardcode paths. Glob/Read tools handle the spaced Windows path fine.
- **AGENTS.md has 3 copies** kept in sync: real vault (SSOT), `specs/cns-vault-contract/AGENTS.md`, and `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` (a **symlink** to specs). `constitution.test.mjs` enforces specs==planning + ≤500 lines. §8 auto-synced by `apply-section8.mjs`; §1-7 are operator-direct edits.
- **Verifier role:** hand code fixes to Cursor as paste-ready BMAD prompts (lead repo/branch/dir); verify results hard, don't implement. Every auto-generated story got a real bug caught this session by verifying before dev/commit.

## 📋 Open backlog (not blocking)

- **86-1** (review) — session-close project-status SSOT; closing it fixes AGENTS §8 staleness. Good "close a near-done epic" pick.
- **58-2** (reserved) — WatchedSurface / Tier 2 multi-surface; not scoped.
- **78-1** (in-progress) — Portal TTS/push-to-talk; Desktop Electron build deferred (heavy).
- **MCP health** — deferred-work flags 2/7 healthy, `vault-io` stale, 4 unknown. Worth a health check.
- **Session-close auto-commit** — recommended but not scoped: session-close should commit its own constitution writes so they stop piling up uncommitted.
- deferred-work.md has the full list (orphaned vault MEMORY.md, run-chain dormant 25d, Inbox 23 triage, etc.).
