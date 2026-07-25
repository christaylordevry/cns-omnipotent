# HANDOFF — Hermes Consolidation / Omniscient Session 9 (2026-06-29)

**For:** a fresh Claude Code session continuing this initiative.
**Role:** strategic verifier alongside the operator (Chris), who runs BMAD workflows in **Cursor**. You verify Cursor/Hermes outputs against the locked plan by **reading actual diffs/artifacts/source — never rubber-stamping**. That discipline repeatedly caught real problems this session.

---

## 1. Read first
- This handoff, then the prior chain: `HANDOFF-2026-06-28-session8-hermes-consolidation.md`.
- Auto-loaded memory covers recurring gotchas (push auth, brain-test env isolation, WSL paths, Context7, paste-ready prompts) — trust those.
- Plan: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md`; `architecture-hermes-omniscient.md` (ADRs 013/014/015).

## 2. What session 9 accomplished — **Epic 82 (Local Nexus JARVIS Voice) COMPLETE**
All three stories implemented, code-reviewed (2 independent reviewers), **smoke-verified live**, committed, pushed:
1. **82-1 SPIKE-OMNI-001** (cns-dashboard) — `$lib/server` Hermes proxy: health gate, WS ticket mint, 501 ws stub. ADR-013 (no browser secrets). Verified against live Hermes source.
2. **82-2 SPIKE-OMNI-002** (Omnipotent.md) — `voice_pane` recall channel via **Path C**: `cns-brain-recall` plugin reads session `source` from `state.db` (read-only `mode=ro`) and threads `--recall-channel voice_pane` to the prefetch CLI; Path A prefix is fallback. Text/discord path byte-for-byte unchanged. Tests pin isolated `HERMES_HOME`.
3. **82-3 VoiceDrawer** (cns-dashboard) — health-gated drawer on `/nexus`, Web Speech PTT, ticketed gateway WS client (`session.create` with `source: "nexus-voice"`), ElevenLabs TTS via server proxy. Close-code recovery (4401 re-mint / 4403 / retry-exhausted) wired to UI.

**Live smoke (2026-06-29):** drawer mounted → PTT → Hermes reply streamed → **`voice_pane` channel confirmed at the source** (session `20260629_101522_ec20fc` = `source=nexus-voice` in `state.db`; deployed plugin resolves it to `voice_pane`). TTS showed "text-only" (no ElevenLabs key — expected).

## 3. Current state (commits live)
- **Omnipotent.md** branch `hermes-consolidation`, HEAD **`2e4e056`** → pushed; feeds open **PR #1** (hermes-consolidation → master).
- **cns-dashboard** branch `master`, HEAD **`05a7d60`** → pushed to origin/master (repo convention: stories land on master).
- Both sprint trackers: 82-1/82-2/82-3 = `done`.
- Recall **live** (`shadow_mode: false`); `voice_pane` path proven end-to-end.
- Hermes services survived the last reboot (gateway `:9119` + embedding proxy `:8645` both active).

## 4. NEXT — open queue (none blocking; pick per priority)
1. **env-hardening** — background task `task_c8e614af`. The 82-1 `.env.production` + `.gitignore` whitelist (`!.env.production`) is now **committed** (empty, but a latent secret-leak footgun). Fix: switch `HERMES_LOCAL_*` (`src/lib/server/hermes-local-proxy.ts`) + `ELEVENLABS_*` (`src/lib/server/elevenlabs-tts.ts`) from `$env/static/private` → `$env/dynamic/private`, delete `.env.production`, drop the gitignore whitelist, update `tests/mocks/`. **Do this early** — it's the one committed footgun.
2. **Degraded-chip fix** — VoiceDrawer's budget chip uses a *client-side heuristic* (flags "degraded" when a reply >80 chars has no visible vault-citation string). It false-positives on most valid answers (saw it on the smoke). Replace with ground truth: have the `cns-brain-recall` plugin emit the resolved channel back over the WS (a `recall.injected`-style event with `channel`) so the chip shows the **actual** budget. The story already anticipated this as the "future hook."
3. **79-8** (Omnipotent.md, parallel) — distribute injection budget across `max_chunks` so voice cites 2+ notes. This is the recall-*quality* lever (the smoke answered "morning digest time" from cron config, not the vault Operator-Guide note — tight 800-tok voice budget). Separate from 82-x plumbing.
4. **ElevenLabs key** — add `ELEVENLABS_API_KEY` to cns-dashboard `.env.local` (and `~/.hermes/.env` per ADR-014 — currently absent) for real TTS audio. Optional.
5. **Haiku cost optimization** — move session-close + crons/digests to Haiku (Portal balance was low: ~$2.33, topped up). Per memory `project_session_close_cost.md`, the "after Epic 75" gate has passed. Separate focused task; don't do mid-feature.

## 5. Security to-do — token rotation (CORRECTED)
The operator pasted live `:9119` session tokens (`hermes_session_at` JWT + `hermes_session_rt`) into the chat transcript. They live in `cns-dashboard/.env.local` (gitignored — not committed). The access token is short-lived (~15 min); the rotating, reuse-detected refresh token is the sensitive one (24h TTL).

**DO NOT "just log out/in at :9119" — that does NOT revoke the token.** Verified from source: the Nous provider's `revoke_session` is a documented **no-op** (`~/.hermes/hermes-agent/plugins/dashboard_auth/nous/__init__.py:368`) — Portal exposes no token-endpoint revoke; revocation is driven from the authenticated Sessions UI. Local logout only clears the browser cookie.

**Correct rotation drill (server-side, immediate):**
1. **Portal → revoke.** https://portal.nousresearch.com → **Hermes Agent → Sessions** → **Sign out** the row whose APP = `agent:{instance_id}` (this instance: `agent:cmqrdynox0042jd0bf56r1t6j`, = the dashboard's `HERMES_DASHBOARD_OAUTH_CLIENT_ID`). **Leave the `hermes-cli` row alone** (separate session). Safe: agent replies go via OpenRouter, embeddings via `CNS_BRAIN_EMBED_API_KEY` — neither depends on this OAuth session.
2. **Re-login** at http://localhost:9119 → fresh session.
3. **Update** `cns-dashboard/.env.local` `HERMES_LOCAL_SESSION_COOKIE=hermes_session_at=<new>; hermes_session_rt=<new>` (grab from browser DevTools → Application → Cookies; **paste into the file, never the chat**).
4. **Verify dead/live:** old cookie → POST `127.0.0.1:9119/api/auth/ws-ticket` returns **401 `invalid_or_expired_session`**; new cookie returns **200** with a `ticket`.

**Status (session 10, 2026-06-29):** original leaked pair rotated + verified dead (401) / new pair live (200). ⚠️ The replacement pair *also* touched the transcript during the `.env.local` update — **one more rotation needed at session-close**.

## 6. Locked decisions / constraints (do not re-litigate)
- Protect-list, zero edits: `src/agents/{synthesis,hook,boss}-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`. No Hermes core fork (`~/.hermes/hermes-agent/**`).
- `bash scripts/verify.sh` / `npm test` before every commit (Omnipotent.md verify has some pre-existing unrelated failures — skill parity, digest, trend thresholds; story-specific tests must be green). Context7 before any lib/API. No npm/pip package <14 days.
- **No plugin→client WS emit without a core fork.** Verified: `PluginContext` (`hermes_cli/plugins.py`) has no event/emit/broadcast API and `inject_message` is CLI-only. A `pre_llm_call` hook returns `{"context":…}` only. So voice-recall ground truth (degraded-chip, SPIKE-OMNI-003) must use a non-core side channel (e.g. per-session sidecar read by the dashboard), NOT a `recall.injected` WS event.
- Push/PR for cns-omnipotent must run **in WSL** (write creds there; commit author label shows `christaylorau23` but push auth works from WSL). cns-dashboard pushes to origin/master.
- Brain/recall tests must isolate env (`CNS_BRAIN_EMBEDDER=stub`, own `shadow:true` policy via `--repo-root`/isolated `HERMES_HOME`) — go-live env breaks tests that inherit `process.env`. See memory.

## 7. Hermes voice plumbing facts (verified from source this session — reuse, don't re-derive)
- `pre_llm_call` hook (`agent/turn_context.py:341`) passes `session_id, task_id, turn_id, user_message, conversation_history, is_first_turn, model, platform, sender_id`; `platform=agent.platform` is **hardcoded `"tui"`** for dashboard/WS turns (`tui_gateway/server.py:3358,3739`) — NOT `nexus-voice`.
- Hook `session_id` == `sessions.id` (all `_make_agent` call sites; `db.create_session(key,...)` stores `key` as `sessions.id`). Row written **before** `pre_llm_call` (`tui_gateway/server.py:6141` before turn) → first turn covered.
- Cross-origin WS (`localhost:5173 → 127.0.0.1:9119`) is **allowed**: host/origin guard strips ports + treats loopback names as equal, and the dashboard binds `0.0.0.0` (guard permissive). 4403 only if rebound to an explicit non-loopback host (no client recovery → would need the 501 byte-bridge).
- Gateway WS = JSON-RPC, **one JSON object per WS frame** (not newline-delimited on the WS path). Mirror `~/.hermes/hermes-agent/web/src/lib/gatewayClient.ts`.
- WS ticket: `POST /api/auth/ws-ticket` → `{ ticket, ttl_seconds: 30 }`, single-use; close codes 4401 (bad/expired) / 4403 (host-origin).

## 8. Working style
- Operator runs BMAD in Cursor / Hermes; verifier reads diffs/evidence/source and gives clear go/no-go before code-review and before dev-story.
- Always write the full paste-ready Cursor prompt for the next story (constraints baked in); lead commit/terminal instructions with repo + branch + working dir.
- Be concise and decisive; recommend, don't survey.
