# HANDOFF — Hermes Consolidation / Omniscient Session 15 (2026-07-05)

**For:** a fresh Claude Code session continuing this initiative.
**Role:** strategic verifier alongside the operator (Chris). He runs BMAD workflows in **Cursor** and runs **terminal commands you give him**; you read diffs/source/live state and give go/no-go. **You do NOT implement code** — when a fix is needed, write a paste-ready **Cursor BMAD prompt** (`/bmad-create-story` → `/bmad-dev-story` → `/bmad-code-review`), lead with repo+branch+dir, bake in the verified root cause + ACs + constraints. Then independently verify the diff Cursor produces — re-run tests yourself, re-run live queries yourself, don't trust a summary at face value. Auto-loaded memory has the standing rules; read `[[hermes-consolidation-initiative]]` and `[[project_honcho_deployment_decision]]` first.

## 0. READ THIS FIRST — session-14 incident RESOLVED; one thing in-flight

**The session-14 MEMORY.md/AGENTS.md pollution incident is fully resolved.** Root cause was found at code level (NOT the "standalone-vs-pipeline" theory the session-14 handoff guessed — that was wrong): `scripts/session-close/lib/read-sources.mjs` `readProjectStatusLine()` read the status line from `CLAUDE.md`'s `## Phase Status` block (hand-stale "Phase 6 … Epics 38+43") instead of `sprint-status.yaml`. Because that's **shared library code the full pipeline uses too**, re-running the real `/session-close` did NOT fix it — it re-propagated the stale line (AGENTS.md v2.1.48 regression). Fixed via **Story 86-1** (`deriveProjectStatusLine` derives from sprint-status SSOT, handles N in-progress epics). A subsequent real `/session-close` then healed AGENTS.md to **v2.1.49** with the correct derived line (`76 epics done; 2 in-progress (78, 86)`), both copies byte-synced, Hermes memory (`~/.hermes/memories/MEMORY.md`) clean. All verified.

**IN-FLIGHT — pick up here:** **Story 83-1 (Honcho dialectic configuration)** — the first story of Epic 83 (v1.5 Operator Learning Loop) — is at its Cursor operator-review gate. The operator **approved with 2 revisions** and sent them back to Cursor:
1. **(required)** Add a documented **managed→self-host migration path** to the evidence file — Cursor wrongly marked self-hosting "out of scope"; operator decision is managed-first WITH a documented self-host escape hatch (actual self-host is a future story; only the doc is required now).
2. **(tune)** `dialecticCadence` 2 → **3** for a cheaper start; note the `~$0.001–$0.50/query` range in evidence.

**Your first job next session:** the operator will paste Cursor's `/bmad-dev-story` results for 83-1. Verify them independently:
- Config matches the approved `honcho.json` block (managed cloud, `HONCHO_API_KEY` in `~/.hermes/.env` — never in git/evidence, key redacted).
- The **self-host migration path is actually documented** in `83-1-honcho-config-evidence.md` (revision 1 — confirm it wasn't dropped again).
- `dialecticCadence: 3` applied.
- **CRITICAL:** post-activation smoke shows `cns-brain-recall` **still fires** (`memory.provider: honcho` must NOT disturb the live `pre_llm_call` recall — they're orthogonal seams per ADR-HERMES-015; Honcho is a MemoryProvider, NOT a `plugins.enabled` entry).
- `bash scripts/verify.sh` passes.

## 1. Shipped + verified this session (5 commits, all pushed, verify.sh green throughout)

On `hermes-consolidation`, on top of session-14's `fb8ba2a`:
- **`0b363a3`** — `fix(session-close): derive project status from sprint-status SSOT (86-1)`. New `deriveProjectStatusLine(entries)` in `read-sources.mjs`; `readProjectStatusLine` now a thin wrapper; `readSprintSnapshot` dropped `repoRoot`; callers (`prepare-context.mjs`, `write-memory.mjs`) rewired. 3 new node tests (plural/singular/none). Live line verified `76 epics done; 2 in-progress (78, 86)`. **89/89 node tests pass.**
- **`2931df2`** — `fix(session-close): handle CRLF in vault AGENTS.md changelog insertion`. `apply-section8-body.mjs` regex `/^\|[-|\s]+\|\r?$/` (from this session's own `/session-close` self-patch) + mirrored the CRLF pitfall note into `scripts/hermes-skill-examples/session-close/SKILL.md` to restore install-gate parity (Cursor had mis-called this drift "pre-existing" — it was fresh this session).
- **`5e50d88`** — `docs(constitution): Epic 76 governance modules; close epic-76`. `specs/cns-vault-contract/personas/` (+_README, code-review-adversarial-layers), `modules/two-bot-vault-boundary.md`, `modules/memory-pillars-verification.md` (Honcho documented GATED). `sprint-status.yaml`: epic-76 + 76-4/5/6 → done.
- **`cf89643`** — `chore(session-close): regenerate AGENTS.md §8 to v2.1.49`. The heal. (Raw stat 440/441 is a benign whole-file LF→CRLF flip; real change 12/13 lines — see deferred-work `.gitattributes` item.)
- **`bf51846`** — `docs(deferred): log session-15 hygiene items post-incident`.

Also: memory updated (`[[hermes-consolidation-initiative]]` session-15 entry; corrected the disproven theory in `[[feedback_dont_handrun_session_close_scripts]]`; new `[[project_honcho_deployment_decision]]`). Epic 83 added to sprint tracking; **83-1 story file created** (`_bmad-output/implementation-artifacts/83-1-honcho-dialectic-configuration.md`, thorough + Context7-backed).

## 2. Current git state

- Omnipotent.md `hermes-consolidation` @ **`bf51846`** (pushed to origin, feeds PR #1). Working tree clean except: CRLF/file-mode noise on ~130 files (benign, `core.autocrlf=true` — never `git add -A`; stage by pathspec), and the updated `deferred-work.md`/story files already committed. This handoff doc is untracked (prior handoffs are too).
- cns-dashboard `master` @ **`9d75da4`** — untouched this session.
- Push auth: WSL as `christaylordevry` (Windows Git Bash = `christaylorau23` → 403 read-only).

## 3. Next steps, in order

1. **Verify Cursor's 83-1 dev-story results** (operator will paste them) — see §0 checklist. This is the immediate task.
2. **After 83-1 lands:** Story 83-2 (memory budget raise + cross-session verification) → 83-3 (automated session-close feeding memory). Plan: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §630-662.
3. **Deferred hygiene** (all logged in `deferred-work.md`, none blocking — knock out opportunistically):
   - **Delete the dead vault `AI-Context/MEMORY.md`** — orphaned, no live consumer (current session-close SKILL.md has no regen step; Hermes grounds off `~/.hermes/memories/MEMORY.md`). Operator-direct (WriteGate path).
   - **§7 Active Modules registration** for the 2 Epic 76 modules — operator-direct constitution edit (both AGENTS copies + version bump to 2.1.50 + changelog row). Drafted rows in session-15 transcript.
   - **`.gitattributes` EOL pin** for `specs/cns-vault-contract/AGENTS.md` — stop the LF/CRLF flip-flop.
   - **NotebookLM drive-sync 60s timeout** on the ~1.5 MB export (OAuth 403 already fixed session-14; this is a separate large-payload timeout).
   - **Formally flip `86-1` / `epic-86` → done** (committed + verified, sitting in `review`).

## 4. Process lessons from this session

1. **"Re-run the real pipeline" only fixes STALE artifacts, not a BUGGY generator.** The session-14 handoff prescribed re-running `/session-close`; but the bug was in shared lib (`readProjectStatusLine` reading CLAUDE.md), so the real pipeline reproduced it. When a session-close artifact looks wrong, trace the input builder (`.session-close/section8-input.json` ← `read-sources.mjs`) before assuming a re-run heals it.
2. **The `section8-input.json` is the smoking-gun surface** — it shows exactly what the LLM Section 8 pass was fed. If AGENTS.md §8 is wrong, read that JSON first; the LLM usually rendered its input faithfully.
3. **Don't paste multi-command blocks that contain an interactive command.** `git add -p` consumes stdin, so any commands pasted after it get eaten as prompt answers (happened twice — mangled the buffer, left a stale `.git/index.lock`). Run `git add -p` alone; use `git commit -F -` heredocs for multi-line messages.
4. **Cursor mischaracterization patterns to catch (2 more this session):** it called a `verify.sh` skill-parity failure "pre-existing/unrelated" when it was a fresh drift from this session's own CRLF self-patch; and it marked the self-host migration path "out of scope" when it was a required operator deliverable. Always re-derive "unrelated"/"out of scope"/"pre-existing" claims against source + the actual requirement. (Consistent with `[[feedback_dev_story_spec_rewrite_risk]]`, `[[feedback_verify_committed_codegen_not_working_tree]]`.)
5. **The propose-then-stop gate keeps paying off** — used on 86-1 (caught the need to handle N in-progress epics, not hardcode 1) and on 83-1 (surfaced the dropped escape hatch + cost knobs before any `~/.hermes` write). Keep using it for any config/data-shape/scoring story.

## 5. Standing facts / gotchas (still true)

- **session-close runs on `model.default` (sonnet-4.6)** — it's a *skill*, and Hermes v0.17.0 has **no per-skill model routing**. Epic 80's `auxiliary:` Haiku pins (`config.yaml` §196-297: compression/mcp/approval/triage/skills_hub/title_generation) cover framework sub-tasks only, not skills. Cheapening session-close would need re-architecting Section 8 into a scripted direct-to-Haiku call (deferred-work item). Don't switch the global default. See `[[project_haiku_cost_cut_groundwork]]`.
- **WSL bash exec from Windows:** inline double-quotes to `wsl.exe` get mangled; write a `.sh` to `\\wsl.localhost\…\home\christ`, run via `wsl bash -c "tr -d '\r' < /home/christ/x.sh | bash"`, export node PATH (`$HOME/.nvm/versions/node/v24.14.0/bin`). See `[[feedback_wsl_bash_exec]]`.
- **The Bash tool is Windows Git Bash** — `/home/christ` and `/mnt/c` do NOT resolve to WSL; use UNC `//wsl.localhost/Ubuntu-24.04/home/christ/...` or `/c/Users/...`, or shell out via `wsl bash -c`.
- **verify.sh:** `tests/vault-io/research-agent.test.ts` is a known flaky timeout (re-run if only that fails); the trend-audit tests print intentional `FAIL:`/`FATAL:` fixture lines then report `Ran N tests … OK` — look for `==> VERIFY PASSED`. cns-dashboard `npm run build` triggers an interactive Convex deploy prompt — use `npx vite build` / `npm test`.
- **Honcho (Epic 83):** managed `app.honcho.dev` first ($100 free credits, then $2/M tokens), documented self-host escape hatch. It's the LEARNING pillar (models the operator) — orthogonal to Brain RECALL (`cns-brain-recall` on `pre_llm_call`). NEVER let Honcho work touch that recall seam. Managed egresses conversation content to `api.honcho.dev` (operator accepts at v1.5). See `[[project_honcho_deployment_decision]]`.
