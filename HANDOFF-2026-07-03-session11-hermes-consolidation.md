# HANDOFF — Hermes Consolidation / Omniscient Session 11 (2026-07-03)

**For:** a fresh Claude Code session continuing this initiative.
**Role:** strategic verifier alongside the operator (Chris). He runs BMAD workflows in **Cursor** and runs **terminal commands you give him**; you read diffs/source/live state and give go/no-go. **You do NOT implement code** — when a fix is needed, write a paste-ready **Cursor BMAD prompt** (`/bmad-create-story` → `/bmad-dev-story`), lead with repo+branch+dir, bake in the verified root cause + ACs + constraints. Then verify the diff Cursor produces. Chris's standing prefs: paste-ready terminal/Cursor commands (repo+branch+dir first); don't fuss about secrets pasted in transcript (his call); be concise; verify against source, never rubber-stamp.

## 1. Read first
- This handoff, then auto-loaded memory (esp. `project-voice-recall-env-gap`, `feedback-verify-not-implement`, `project-haiku-cost-cut-groundwork`, `feedback-wsl-bash-exec`).
- Prior: `HANDOFF-2026-06-30-session10` for the pre-voice state.

## 2. Shipped + pushed this session (all reviewed via /bmad-code-review, verified against source)
- **82-5** (Omnipotent `0e1aec0`, `hermes-consolidation`) — bare-PATH prefetch toolchain (`scripts/lib/resolve-node-toolchain.mjs`, resolves npx/tsx from `CNS_NODE_BIN` dir) + `install-hermes-brain-recall-env.sh` installs `hermes-dashboard.service.d/{brain-recall.conf,env.conf}` so the :9119 dashboard has the same brain env + nvm PATH as the gateway. **Root cause fixed:** the :9119 voice server lacked brain-recall env → recall prefetch fail-opened silently.
- **82-6** (Omnipotent `422e1aa`) — voice prefetch cold-start (4.95s) exceeded the 3s budget → raised `voice_pane_timeout_seconds` 3→6 (policy v0.2.1) + config-gated embedder warm-keep (`install-brain-embedder-warm-cron.sh`, default off).
- **82-7** (cns-dashboard `2d6c030`, **branch `master`**) — persists rotated session cookie to `~/.hermes/nexus-voice-session.json` (0600) so the RT lineage survives dashboard/vite restart. Hermes middleware already auto-refreshes via RT (30-day TTL); earlier 502s were ORPHANED RTs (in-memory lineage lost on restart + superseded static `.env.local` RT → Portal reuse-detection), not time-expiry.

**🎯 VOICE RECALL PROVEN LIVE (2026-07-01):** Two PTT turns on `localhost:5173/nexus` each wrote a real sidecar `channel=voice_pane, injected=true` with 2 vault citations; prefetch 2.0s < 6s; JARVIS confirmed recall auto-injected "on every turn." **82-5 AC5 + 82-6 AC3 functionally done.** The whole env-gap that started this thread is closed and demonstrated end-to-end.

## 3. Current state
- **Omnipotent.md** `hermes-consolidation` HEAD `68531e6` → pushed origin (feeds PR #1). Clean tree except 3 untracked `HANDOFF-*.md`.
- **cns-dashboard** `master` HEAD `2d6c030` → pushed origin/master. Clean.
- **Live:** hermes-gateway `:9119` + portal-embed-proxy `:8645` UP. **vite dev `:5173` DOWN** (start it: harness `run_in_background` → `cd cns-dashboard && export PATH=<nvm bin>:$PATH && npm run dev`; a one-shot `wsl bash -c ... &` dies on WSL teardown). Voice needs 5173.
- Sprint (`_bmad-output/implementation-artifacts/sprint-status.yaml`): 82-5 in-progress, 82-6 review, 82-7 done. (82-5/82-6 can flip to done now that live PTT proved AC5/AC3 — operator's call.)

## 4. NEXT — parked queue (pick per priority; operator wants real gains today)
1. **82-8 (cosmetic, small, satisfying) — fix the false "degraded" voice chip.** Recall WORKS; the chip lies. Root cause (confirmed): plugin keys the sidecar by the AGENT session id (e.g. `20260701_220523_0b91d9`) but `VoiceDrawer.svelte:177-180` fetches `fetchRecallStatus(client.currentSessionId)` where currentSessionId is the voice-WS id (e.g. `d6cb1ebe`, shown in the drawer's Diagnostics panel) → 404 → heuristic "degraded". Fix = reconcile the two ids (VoiceDrawer query the agent-session id, or plugin also key by the WS id). Needs a quick source dig for where the agent session id is exposed to the client over the WS. Single fetch, no retry. cns-dashboard change (+ maybe plugin). Write as a Cursor BMAD prompt.
2. **82-7 restart-recovery evidence** — persist seeds on first cookie ROTATION (first refresh ~15min in), NOT first mint. To prove AC3: keep a voice session alive past one refresh so the persist file appears, then restart the dashboard and confirm a voice turn auto-recovers with no `.env.local` paste. Low effort; closes 82-7 fully.
3. **#3 Haiku cost-cut — UPSTREAM-BLOCKED** (see `project-haiku-cost-cut-groundwork`): Hermes has NO per-skill model routing in v0.17.0 OR origin/main; `smart_model_routing` config is inert. session-close stays on Sonnet unless global default switch (forbidden) or manual `/model` toggle. Don't reopen unless upstream ships a routing consumer.
4. **Next substantive epic** — run `bmad-sprint-status` / read the epics list to pick the next real feature story if the operator wants to move past voice polish. Voice recall is the milestone; the JARVIS/Portal build continues.

## 5. Voice live-test procedure (for any voice work)
1. Start vite dev on 5173 (harness bg, nvm PATH).
2. Token is 15-min TTL: operator re-logins at `localhost:9119`, grabs `hermes_session_at` + `hermes_session_rt` from DevTools, pastes to you → splice into `cns-dashboard/.env.local` `HERMES_LOCAL_SESSION_COOKIE=hermes_session_at=<jwt>; hermes_session_rt=<rt>` (vite HMR-reloads env). Verify remaining >120s.
3. Warm embedder if you want a snappy turn: `cd Omnipotent.md; set -a; source ~/.hermes/brain-recall.env; set +a; export PATH=$(dirname $CNS_NODE_BIN):$PATH; node scripts/brain-recall-prefetch.mjs --query x --platform nexus-voice --recall-channel voice_pane`. (NOTE: `~/.hermes/brain-recall.env` `CNS_VAULT_ROOT` has an unquoted space — `source` warns but CNS_BRAIN_INDEX_PATH/CNS_NODE_BIN still set; harmless. systemd EnvironmentFile handles it fine.)
4. Operator PTTs; you verify the newest `~/.hermes/recall-status/*.json` shows `channel=voice_pane, injected=true`.

## 6. Verify-gate note
`bash scripts/verify.sh` has a known pre-existing red: `session-close` skill parity drift (`scripts/hermes-skill-examples/session-close/SKILL.md` vs `~/.hermes/skills/cns/session-close/SKILL.md`). Story-specific tests must be green; that drift is unrelated. cns-dashboard `npm test` (vitest, ~686 tests) is the real signal for dashboard work. Push/PR auth: WSL as `christaylordevry` (Windows Git Bash = christaylorau23 → 403).

## 7. WSL exec gotcha
Inline `$(...)`/quotes to `wsl bash -c "..."` get mangled — write a `.sh` to `\\wsl…\home\christ\` and run `wsl bash -c "tr -d '\r' < ~/x.sh | bash"`. Node needs nvm on PATH.
