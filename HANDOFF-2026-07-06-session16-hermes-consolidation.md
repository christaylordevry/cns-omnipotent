# HANDOFF — Hermes Consolidation / Omniscient Session 16 (2026-07-06)

**For:** a fresh Claude Code session **scoping Epic 84 (Unified Loop, FR22)**.
**Role:** strategic verifier alongside the operator (Chris). He runs BMAD workflows in **Cursor** and runs **terminal commands you give him**; you read diffs/source/live state and give go/no-go. **You do NOT implement code** — when a fix/build is needed, write a paste-ready **Cursor BMAD prompt** (`/bmad-create-story` → `/bmad-dev-story`), lead with **repo + branch + working dir**, bake in root cause + ACs + constraints. Then independently verify what Cursor produces — re-run tests/live queries yourself, don't trust a summary. Auto-loaded memory has the standing rules; read `[[hermes-consolidation-initiative]]`, `[[project_honcho_deployment_decision]]`, `[[feedback_session_close_run_sparingly]]`, `[[feedback_verify_not_implement]]` first.

## 0. READ THIS FIRST — Epic 83 DONE; next is scoping Epic 84

**Epic 83 (v1.5 Operator Learning Loop, FR15) is complete and pushed.** All 3 stories done and independently verified (not rubber-stamped):
- **83-1** (`f6a3a5f`) — Honcho live on managed `app.honcho.dev` (workspace `cns-jarvis`). Caught + fixed an inert cost knob: `dialecticCadence: 3` was nested under `hosts.hermes` where the runtime never reads it (`cfg.raw.get` at `plugins/memory/honcho/__init__.py:320` reads top-level) — hoisted to top-level, verified `every 3 turns`. `HONCHO_API_KEY` in `~/.hermes/.env` only.
- **83-2** (`6af2b44`) — memory budgets raised `memory_char_limit 2200→4400`, `user_char_limit 1375→2750`; cross-session native recall PASS (verified at `state.db` message level — Session B recalled a preference written in Session A).
- **83-3** (`4afafa2`) — verified FR15 memory-compounding is **already automatic** (Honcho user peer card = **24 facts**, was 0; native flush on session exit/reset). **OQ-8 resolved: NO scheduled session-close cron** (would be ~$3–5/run, ~$90–150/mo). Operator guide §15.3.1 documents manual-vs-automatic split. Epic 83 closed.

**Also resolved this session:** the all-day Brain recall outage was **Portal out-of-credits returning HTTP 200 with empty `data[]`** (not a 402), surfacing as `cns-brain-recall: missing data[0].embedding`. Operator's Portal top-up fixed it; verified a real 4157-char recall injection. Not a code bug — see `[[project_honcho_deployment_decision]]` context and consider a low-priority `embedder-portal.ts` clearer-error story (deferred).

**Your job this session: SCOPE Epic 84 (Unified Loop, FR22)** — do NOT jump to create-story until the design questions in §2 are resolved with the operator.

## 1. Current git state

- Omnipotent.md `hermes-consolidation` @ **`4afafa2`** (pushed, feeds PR #1). Working tree: benign CRLF/file-mode noise on ~130 bmad skill files (never `git add -A`; stage by pathspec). Handoff docs are untracked (this one too).
- cns-dashboard `master` @ **`9d75da4`** — untouched since Epic 81.
- Push auth: WSL as `christaylordevry` (Windows Git Bash = `christaylorau23` → 403 read-only).
- Sprint: `epic-83: done` (83-1/2/3 done). `epic-84`, `epic-85` next in `_bmad-output/implementation-artifacts/sprint-status.yaml`.

## 2. Epic 84 — Unified Loop (FR22): what it is + what to scope

**Spec:** `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` §666–723. **PRD:** FR22 = "Unified Loop (approval-gated)". **Core principle: COMPOSE, don't rewrite** — the loop wires *existing* pieces; **zero edits to the protect-list** (`src/agents/*-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`) per NFR2, and **no silent vault mutation** per NFR-GOV-1.

The loop: **Schedule → Discover → Build → Verify → Persist**, approval-gated. Three stories as written:
- **84-1 — Unified Loop governance + schedule shell.** A governance module documenting the 5 moves + approval gates, and a cron/skill *shell* that invokes the stages **without editing run-chain**. Discover reuses the **Epic 81 collector**; Build is approval-gated.
- **84-2 — Adversarial verify wiring.** Wire existing BMAD review skills into the Verify move: `bmad-code-review`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`. One **dry-run** documenting invocation paths/outputs. No new review logic.
- **84-3 — Approval-gated Build + governed Persist.** Build requires explicit operator approval before any destructive/WriteGate path; Persist reuses existing audit / `vault_log_action` (Story 5.2 bound spec). Uses an `EnterWorktree` handoff. One E2E dry-run **with an approval pause** documented.

**Open design questions to resolve WITH the operator before create-story (this is the scoping work):**
1. **What is the "shell"?** A Hermes skill (`~/.hermes/skills/cns/`), a cron entry, or a `run-chain`-style scripted orchestrator that *calls* stages? Must not touch the protect-list — so it's a composition layer, not an engine edit. Decide the concrete mechanism.
2. **Approval-gate mechanism.** How does "Build requires approval" actually pause? Hermes `approvals:` config (mode manual), a Discord confirm, `EnterWorktree` + operator review, or a kanban gate? FR22 is approval-gated by design — this is the crux.
3. **Cost model.** The loop composes Discover (Epic 81 collector) + Build + Verify (paid review skills) + Persist (session-close-ish). **Verify uses paid adversarial review skills**, and Persist may invoke session-close (~$3–5). Operator is cost-sensitive (`[[feedback_session_close_run_sparingly]]`). Scope must pin per-run cost and trigger frequency **before** building — same trap we avoided in 83-3. Strong propose-then-stop candidate.
4. **Scheduling vs manual.** Is the loop scheduled (cron) or operator-invoked? Given cost, likely operator-invoked/approval-gated, not autonomous cron. Confirm.
5. **Scope for v1.5:** is 84 a *documentation + dry-run shell* (like the lean 83-3), or a genuinely executing loop? The ACs lean toward **governance + dry-runs** ("one dry-run documents…", "E2E dry-run with approval pause documented") — i.e., 84 may be mostly **governance + proven-but-not-autonomous** wiring, not a live autonomous agent. Clarify the ambition with the operator early — it changes everything.

**Recommended first move:** a scoping conversation (or `bmad-spec`/design pass) that resolves the 5 questions above, THEN `/bmad-create-story` for 84-1. Don't let create-story invent the approval mechanism — that's an operator decision (propose-then-stop).

## 3. Standing rules (in memory — reload, don't re-derive)
- **Verifier, not implementer** (`[[feedback_verify_not_implement]]`): hand code/build to Cursor as paste-ready BMAD prompts; independently verify output. Catch Cursor mischaracterizations — this session caught 3 (inverted prefetch note, false "CLI display label", phantom verify.sh "failure"). Always re-derive "unrelated"/"out of scope"/"pre-existing" claims against source.
- **Propose-then-stop** for any config/data-shape/scoring/cost decision (`[[feedback_operator_review_gate_before_scoring_logic]]`) — paid off repeatedly (86-1, 83-1, 83-2, 83-3).
- **Session-close costs ~$3–5/run** (`[[feedback_session_close_run_sparingly]]`) — never casually recommend it; hold notes for one consolidated run. Held notes for next real session-close: remove `83-2-CS-TEST` marker from vault `USER.md`; Portal empty-200 gotcha; Honcho egress; Epic 83 done.
- **Skip paid `/bmad-code-review` on config/doc-only stories** — verify directly instead (did this for 83-1/2/3).

## 4. Gotchas (still true)
- **Bash tool = Windows Git Bash.** `/home/christ` and `/mnt/c` do NOT resolve to WSL. Use UNC `//wsl.localhost/Ubuntu-24.04/home/christ/...` or `wsl bash -c`.
- **WSL exec:** inline double-quotes to `wsl.exe` get mangled, AND nested heredocs / `\$VAR` escaping inside `wsl bash -c "..."` break — **write a `.sh` via the Write tool to `\\wsl.localhost\…\home\christ`, run via `wsl bash -c "tr -d '\r' < /home/christ/x.sh | bash"`**. Export node PATH (`$HOME/.nvm/versions/node/v24.14.0/bin`). See `[[feedback_wsl_bash_exec]]`.
- **verify.sh** is local (no API cost); prints intentional `FAIL:`/`FATAL:` fixture lines then `==> VERIFY PASSED` — look for that. `research-agent.test.ts` is a known flaky timeout.
- **Honcho:** live, learning (24 facts). NEVER touch the `pre_llm_call` Brain recall seam — orthogonal per ADR-HERMES-015. `honcho.json` needs `dialecticCadence` at **top-level** (runtime quirk).
- **Commit:** stage by pathspec, `git commit -F -` heredoc; canonical vault edits (`/mnt/c/.../Knowledge-Vault-ACTIVE`) are outside the repo — repo has its own `Knowledge-Vault-ACTIVE/` copy; keep both synced but only the repo copy commits.
