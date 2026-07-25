# HANDOFF — Hermes Consolidation / Omniscient Session 10 (2026-06-30)

**For:** a fresh Claude Code session continuing this initiative.
**Role:** strategic verifier alongside the operator (Chris). He runs BMAD workflows in **Cursor** and runs **terminal commands you give him**; you read diffs/source/live state and give go/no-go. Never rubber-stamp — verify against source. Chris's standing prefs: always hand him paste-ready terminal commands (lead with repo + branch + dir); don't fuss about secrets pasted into the transcript (his call); be concise.

## 1. Read first
- This handoff, then `HANDOFF-2026-06-29-session9-hermes-consolidation.md` (note: its §5 token-rotation drill was CORRECTED this session — Nous logout is a no-op; revoke via portal.nousresearch.com → Hermes Agent → Sessions; §6 has the "no plugin→client WS emit without core fork" constraint).
- Auto-loaded memory covers gotchas: WSL bash exec, brain-test isolation, push auth, Context7, paste-ready prompts, Haiku groundwork.

## 2. Shipped this session (all reviewed + pushed)
- **env-hardening** (cns-dashboard `b25a560`) — `$env/static/private`→`$env/dynamic/private`, deleted committed `.env.production` + gitignore whitelist.
- **Token leak** rotated + verified dead; handoff §5/§6 corrected.
- **82-4 SPIKE-OMNI-003** — recall-status sidecar (Omnipotent `9a968db`) + dashboard endpoint/chip ground truth (cns-dashboard `8b3c8c1`). Chip reads real channel/injected, not a regex heuristic.
- **79-8** (Omnipotent `cd57f06`) — recall injection budget split across `max_chunks`; two-pass collect-then-fit, lone note keeps full budget, continuation past fit-time BUDGET drops. **Live-verified**: "morning digest" query now cites Operator-Guide + a 2nd note.
- **ElevenLabs TTS** — key in `cns-dashboard/.env.local` (`ELEVENLABS_API_KEY`, restricted to TTS), verified 200/audio after Chris upgraded the EL plan (free tier 402s on library voices). Also added `HERMES_LOCAL_HOME=/home/christ/.hermes` (82-4 chip needs it).
- **nexus-local-session-cookie-gate** (cns-dashboard `d2f6d28`) — `src/hooks.server.ts` mints a loopback-only `cns_local_session` cookie so the dashboard proxy auth gate passes in local dev (was 401 → Nexus panels + VoiceDrawer dead). NOTE: this one was verified end-to-end by me but never got a formal `/bmad-code-review` — low risk (loopback-only, cross-origin still rejected).
- **nexus-voice-proxy-session-rotation** (cns-dashboard `6ded840`) — `hermes-local-proxy.ts` now persists the gateway-rotated cookie instead of re-pinning the static `.env.local` one each mint; 401→clear→one static-retry self-heal. Stops the ~15-min voice-token re-paste.

Epic 79 = 8/8 done (`epic-79: done`; retrospective optional, not run). Epic 82 nexus stories done.

## 3. Current state
- **cns-dashboard** `master` HEAD ~`6ded840` (+ a sprint-status `done` flip commit) → pushed origin/master.
- **Omnipotent.md** `hermes-consolidation` HEAD `cd57f06` → pushed; feeds open PR #1.
- Hermes gateway live at `127.0.0.1:9119` (loopback; `gateway_running:true`, provider `nous`). Vercel prod `cns-dashboard-three.vercel.app` has rich Convex data but CANNOT do voice (can't reach loopback gateway). **Voice = localhost only.**

## 4. NEXT — parked queue (pick per priority)
1. **#3 Haiku cost-cut** — move session-close + crons/digests off the sonnet-4.6 default to Haiku. **Live-ops, NOT a Cursor story** (operator runs `hermes` CLI; you verify). Groundwork in memory `project-haiku-cost-cut-groundwork`: crons run via Nous chronos cloud (no local model pin), don't switch the global default (degrades interactive chat); first command `~/.hermes/hermes-agent/venv/bin/hermes cron list` to see if per-job `--model` exists.
2. **Voice live-smoke** — needs ONE fresh token paste into `cns-dashboard/.env.local` `HERMES_LOCAL_SESSION_COOKIE` (grab from DevTools at localhost:9119). The rotation fix (`6ded840`) keeps it alive after that. Then: localhost:5173/nexus → Voice → PTT "what time does the morning digest cron run?" → should speak + chip `voice_pane`.
3. **Optional rigor**: `/bmad-code-review nexus-local-session-cookie-gate` (skipped this session).
4. **Hermes-side TTS** (agent/Discord voice) — deferred; bigger config surface (`voice:` mode vs `tts:` provider), do via Context7 on `/nousresearch/hermes-agent` if wanted.

## 5. Verify-gate note
`bash scripts/verify.sh` has a known pre-existing red: `session-close` skill parity drift (`scripts/hermes-skill-examples/session-close/SKILL.md` vs `~/.hermes/skills/cns/session-close/SKILL.md`). Story-specific tests must be green; that drift is unrelated. cns-dashboard full vitest is the real signal there (677 passing as of `6ded840`).
