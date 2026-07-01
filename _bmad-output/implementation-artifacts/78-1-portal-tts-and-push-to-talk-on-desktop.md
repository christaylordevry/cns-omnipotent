---
baseline_commit: 8d4ea80
branch: hermes-consolidation
---

# Story 78.1: Portal TTS and push-to-talk on Desktop

Status: in-progress

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. Operator-first config story: ~/.hermes/config.yaml only. Zero Omnipotent.md src/ changes. Protect-list untouched. FR10 + ADR-HERMES-001 + FR-GATE (CLEARED 2026-06-25). -->

## Story

As an **operator**,
I want **push-to-talk input and streaming TTS output on Hermes Desktop via Portal**,
so that **I can talk to JARVIS locally (FR10, ADR-HERMES-001, FR-GATE)**.

## Acceptance Criteria

1. **FR-GATE + Epic 74 prerequisites (mandatory — do not skip)**
   **Given** Pre-4 Portal **Plus/paid tier** confirmed (**FR-GATE CLEARED 2026-06-25** — Tool Gateway includes `openai-audio`: Whisper STT + TTS speech tokens)
   **And** Epic **74** Desktop connection is **done** (74-6 dashboard OAuth, 74-7 remote gateway / live WebSocket chat)
   **When** this story begins
   **Then** WSL baseline passes:
   ```bash
   hermes --version                    # expect v0.17.x
   hermes portal info                  # logged in, Nous inference provider
   systemctl --user is-active hermes-dashboard.service   # → active
   curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers, .backend_ready'
   pgrep -af 'hermes_cli.main gateway' # Discord gateway still running (separate PID)
   ```
   **And** live `~/.hermes/config.yaml` shows Portal primary (`model.provider: nous`)
   **And** if any prerequisite fails, **stop** — restore Epic 74 state before voice work

2. **Portal Tool Gateway — openai-audio (Whisper + TTS)**
   **Given** FR-GATE cleared and operator session on WSL
   **When** operator configures Tool Gateway for audio (interactive — **cannot** pipe `hermes tools`):
   ```bash
   hermes tools
   # → TTS              → "Nous Subscription"
   # → Speech-to-text   → "Nous Subscription"  (if listed; else use config per AC #3)
   ```
   **Or** guided setup:
   ```bash
   hermes setup voice
   # → TTS: "Nous Subscription"
   # → STT: openai via gateway (Portal Whisper) — NOT local-only if Portal path required
   ```
   **Then** `tts.use_gateway: true` and `stt.use_gateway: true` in `~/.hermes/config.yaml`
   **And** `tts.provider: openai` (gateway-routed — no standalone `VOICE_TOOLS_OPENAI_KEY` required when gateway active)
   **And** `stt.provider: openai` with `stt.openai.model: whisper-1` (or current Portal-supported Whisper model)
   **And** evidence records redacted config excerpts proving gateway flags (no API keys in git)

3. **Push-to-talk config (Ctrl+B)**
   **Given** AC #2 gateway audio configured
   **When** `~/.hermes/config.yaml` `voice:` block is set for Desktop push-to-talk
   **Then** minimum live values:
   ```yaml
   voice:
     record_key: ctrl+b           # push-to-talk (Hermes Desktop + CLI voice mode)
     max_recording_seconds: 120
     auto_tts: true               # enable spoken replies when voice mode active (streaming sentence-by-sentence)
     beep_enabled: true
     silence_threshold: 200
     silence_duration: 3.0
   ```
   **And** `hermes gateway restart` **or** dashboard service restart if config hot-reload does not pick up voice block:
   ```bash
   systemctl --user restart hermes-dashboard.service
   ```
   **Note:** Baseline at story prep already had `record_key: ctrl+b`, `tts.use_gateway: true`, `stt.use_gateway: true`, `auto_tts: false` — dev must set `auto_tts: true` (or document operator enables `/voice tts` manually if keeping `auto_tts: false`).

4. **Hermes Desktop live voice E2E (Windows native app — primary surface)**
   **Given** AC #1–#3 complete and **Hermes Desktop** installed (74-7 pattern: remote gateway → WSL `http://localhost:9119`, OAuth sign-in)
   **When** operator on Windows:
   1. Opens Hermes Desktop → Settings → Gateway → **Remote gateway** → `http://localhost:9119` (already from 74-7)
   2. Signs in with **Nous Research** (same Portal account as WSL)
   3. Grants **microphone** permission when prompted (Windows privacy settings)
   4. Enables voice mode (composer microphone and/or `/voice on` in chat if exposed)
   5. Holds **Ctrl+B** push-to-talk, speaks a short phrase (e.g. "What is two plus two? Reply briefly.")
   6. Releases Ctrl+B — expects Whisper transcription → Portal inference (`anthropic/claude-sonnet-4.6`) → **streaming TTS** plays response **sentence-by-sentence**
   **Then** operator hears synthesized speech without manual paste of API keys
   **And** chat shows transcribed user text + model reply (not auth/connection errors)
   **And** evidence records: test phrase, transcription summary, TTS heard (Y/N), model provider confirmation
   **And** Discord gateway **still running** after voice test (NFR2 / FR4 regression spot-check)

5. **v1 scope documentation (not duplex always-on)**
   **Given** AC #4 voice E2E passes or fails with documented cause
   **When** story closes
   **Then** `_bmad-output/implementation-artifacts/78-1-voice-scope-and-failure-modes.md` exists with:
   - **v1 = push-to-talk in, streaming TTS out** — operator holds Ctrl+B to speak; not always-on duplex listening
   - **Upstream gap:** true duplex voice tracked as [hermes-agent#35750](https://github.com/NousResearch/hermes-agent/issues/35750) — explicitly **not** v1
   - **Discord voice:** explicitly **out of scope** for v1 (Discord = text chat + gateway; no Discord voice channel requirement)
   - **Browser-only fallback:** `http://localhost:9119` chat works for text; native Desktop app is the **primary** FR10 voice surface per ADR-HERMES-001
   **And** draft Voice subsection bullets prepared for **78-3** operator guide (full vault section deferred to 78-3 / session-close)

6. **Failure modes — openai-audio / Tool Gateway unavailable**
   **Given** the failure-modes doc from AC #5
   **When** documenting operator recovery
   **Then** table includes at minimum:

   | Symptom | Likely cause | Operator action |
   |---------|--------------|-----------------|
   | No transcription after Ctrl+B | Mic permission / wrong input device | Windows Settings → Privacy → Microphone; retry Desktop |
   | STT error / "gateway" / 402 | `stt.use_gateway: false` or FR-GATE lapse | Set `stt.use_gateway: true`; confirm Portal paid tier; `hermes portal info` |
   | TTS silent but text reply OK | `auto_tts: false` or TTS not on Nous Subscription | `auto_tts: true` or `/voice tts`; `hermes tools` → TTS → Nous Subscription |
   | `openai-audio` / Tool Gateway error | Gateway down, subscription expired, or tool not enabled | `hermes portal info`; re-run `hermes tools`; check Portal billing |
   | Whisper works, no inference | Portal session expired | Re-auth WSL: `hermes auth add nous --type oauth --manual-paste` |
   | Voice works on CLI, not Desktop | Desktop not on remote WSL backend | Confirm remote URL + OAuth; status bar shows WSL `~/.hermes` path |
   | High latency / cost surprise | Portal metering | Whisper ≈ **$0.0063/min** (`openai-audio`); TTS = speech tokens via `openai-audio` — monitor Portal usage |

   **And** doc states: when Tool Gateway unavailable, **text chat remains functional**; voice degrades gracefully (no silent fallback to paid standalone OpenAI key unless operator explicitly configures one)

7. **Verify gate + repo hygiene (NFR1, NFR2)**
   **Given** AC #2–#6 complete
   **When** story closes
   **Then** `_bmad-output/implementation-artifacts/78-1-voice-e2e-evidence.md` exists with dated PASS/FAIL per AC (redacted)
   **And** `bash scripts/verify.sh` passes **unchanged** (no Omnipotent.md `src/` edits expected)
   **And** git diff contains **no** secrets (`.env`, `auth.json`, OAuth tokens, `~/.hermes/.env`)
   **And** protect-list paths have **zero** diffs:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** only permitted config mutation path: **`~/.hermes/config.yaml`** (+ operator-interactive `hermes tools` / `hermes setup voice` which writes config)

## Tasks / Subtasks

- [x] **AC #1 — WSL + Portal + dashboard preflight** (AC: #1)
  - [x] Run baseline commands; capture redacted excerpts in evidence scaffold
  - [x] Confirm FR-GATE note: Plus plan / openai-audio cleared 2026-06-25

- [x] **AC #2 — Tool Gateway audio (Nous Subscription)** (AC: #2)
  - [x] Run `hermes tools` interactively → TTS (+ STT if offered) → Nous Subscription *(gateway already active per `hermes portal info`; operator may re-run `hermes tools` to confirm UI)*
  - [x] Verify `tts.use_gateway: true`, `stt.use_gateway: true` in config
  - [x] Restart dashboard/gateway if required

- [x] **AC #3 — Voice block tuning** (AC: #3)
  - [x] Set `voice.record_key: ctrl+b`, `auto_tts: true` (or document `/voice tts` operator path)
  - [x] Confirm `stt`/`tts` provider blocks match Context7 Portal voice guide

- [ ] **AC #4 — Windows Desktop voice E2E** (AC: #4) — **PARTIAL (2026-06-25)** — config ✓; E2E blocked: no packaged Desktop `.exe`, browser voice blocked by WSL audio
  - [ ] Remote gateway + OAuth (reuse 74-7 connection) — deferred until native Desktop built
  - [ ] Ctrl+B push-to-talk test + streaming TTS confirmation — deferred
  - [ ] Discord gateway PID unchanged — N/A (no voice test run)

- [x] **AC #5 — v1 scope doc** (AC: #5)
  - [x] Write `78-1-voice-scope-and-failure-modes.md` (#35750, Discord voice OOS)

- [x] **AC #6 — Failure modes table** (AC: #6)
  - [x] Include openai-audio pricing note + graceful text fallback

- [x] **AC #7 — Evidence + verify** (AC: #7)
  - [x] Complete `78-1-voice-e2e-evidence.md` — AC#4 logged as PARTIAL with environment gap
  - [x] `bash scripts/verify.sh` green; protect-list clean

## Dev Notes

### Epic and sequencing context

- **Epic 78 (JARVIS Voice + Model Routing)** — story **78-1** is the **first** story; enables FR10 before **78-2** (per-skill routing) and **78-3** (operator guide vault section).
- **Depends:** Epic **74** complete (Portal + Desktop connection). Epic **77** awareness work is parallel — no hard dependency.
- **Does not include:** **78-2** model routing, **78-3** full CNS-Operator-Guide section (WriteGate vault), **74-4** web search Tool Gateway, Discord voice channels, duplex always-on voice (#35750), Omnipotent.md `src/` changes.
- **Branch:** `hermes-consolidation`.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Story 78-1; `sprint-status.yaml` Epic 78]

### Architecture compliance (ADR-HERMES-001, FR-GATE, D2)

| Decision | Requirement for this story |
|----------|---------------------------|
| **ADR-HERMES-001** | Voice on **Hermes Desktop** (primary) + Discord text; `/nexus` = awareness only — no cockpit voice |
| **ADR-HERMES-006 / FR-GATE** | Paid Portal tier with Tool Gateway — **CLEARED 2026-06-25** (Plus plan: `openai-audio`) |
| **D2 Voice** | Config-only on WSL `~/.hermes/`; Portal routes Whisper + TTS — no standalone TTS API key |
| **NFR2** | Discord gateway + morning-digest cron must remain operational (spot-check after voice test) |
| **NFR5** | No reversibility regression — Portal primary unchanged; voice is additive config |
| **Protect-list** | Zero edits to `src/agents/*`, `scripts/run-chain.ts` |

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §ADR-HERMES-001, §D2, §FR-GATE; `project-context.md` §ADR table]

### Current live config baseline (story prep 2026-06-25)

Captured from `~/.hermes/config.yaml` at story creation — **verify before mutating**:

| Key | Current value | Story target |
|-----|---------------|--------------|
| `model.provider` | `nous` | unchanged |
| `voice.record_key` | `ctrl+b` | keep |
| `voice.auto_tts` | `false` | **`true`** (or operator `/voice tts`) |
| `tts.provider` | `openai` | keep (gateway-routed) |
| `tts.use_gateway` | `true` | keep |
| `stt.provider` | `openai` | keep |
| `stt.openai.model` | `whisper-1` | keep |
| `stt.use_gateway` | `true` | keep |
| `stt.enabled` | `true` | keep |

**Gap vs AC:** Operator must still confirm `hermes tools` maps TTS/STT to **Nous Subscription** and run Desktop E2E — config flags alone are not proof.

### Hermes Desktop vs browser (74-7 clarification)

- **74-7 / 74-8** validated **browser** chat at `http://localhost:9119` (Hermes v0.17 dashboard UI).
- **78-1 FR10** targets the **native Hermes Desktop app** (Windows `install.ps1`) in **remote gateway** mode — same WSL backend, adds **microphone + Ctrl+B + TTS**.
- Upstream docs: Desktop voice uses the same `voice-mode.md` stack; composer has microphone control; Ctrl+B from `voice.record_key` applies in voice-capable surfaces.

[Source: Context7 `/nousresearch/hermes-agent` — `desktop.md`, `voice-mode.md`, `configuration.md`; `74-7-hermes-desktop-live-chat-connection.md`; vault `hermes-desktop.md`]

### Technical requirements (Context7 — implement from docs, not training data)

**Portal voice setup path:**
```bash
hermes setup voice
# TTS → "Nous Subscription"
# STT → openai via gateway (Portal Whisper)

hermes tools
# TTS → "Nous Subscription"
```

**Required YAML (after gateway setup):**
```yaml
voice:
  record_key: ctrl+b
  auto_tts: true          # streaming TTS on voice replies

stt:
  enabled: true
  provider: openai
  use_gateway: true
  openai:
    model: whisper-1

tts:
  provider: openai
  use_gateway: true
  openai:
    model: gpt-4o-mini-tts
    voice: alloy
```

**CLI voice commands (WSL debug only — not primary AC proof):**
```bash
/voice on
/voice tts
/voice status
```

**Optional voice extras (if Desktop mic fails on WSL CLI debug):**
```bash
pip install "hermes-agent[voice]"
```

[Source: Context7 `/nousresearch/hermes-agent` — `run-hermes-with-nous-portal.md`, `voice-mode.md`, `tts.md`, `tool-gateway.md`, `configuration.md`]

### Portal tool pricing (operator-confirmed 2026-06-25)

| Tool | Metering |
|------|----------|
| Whisper STT | `openai-audio` — **$0.0063/min** |
| TTS | `openai-audio` speech tokens |

Include in failure-modes doc so operator can detect bill shock.

### File structure requirements

| Path | Action |
|------|--------|
| `~/.hermes/config.yaml` | **UPDATE** — voice/stt/tts gateway settings only |
| `_bmad-output/implementation-artifacts/78-1-voice-e2e-evidence.md` | **NEW** — PASS/FAIL evidence |
| `_bmad-output/implementation-artifacts/78-1-voice-scope-and-failure-modes.md` | **NEW** — v1 scope + failure matrix |
| `Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md` | **Optional** — Voice subsection stub only if operator approves pre-78-3; else defer to **78-3** (WriteGate) |
| `src/**` | **DO NOT TOUCH** |
| `scripts/run-chain.ts`, `src/agents/*` | **PROTECT-LIST — DO NOT TOUCH** |

### Testing requirements

- **Primary test:** Manual operator E2E on Windows Hermes Desktop (AC #4) — no automated vitest in Omnipotent.md for voice.
- **Regression gate:** `bash scripts/verify.sh` must pass with **no** repo code changes.
- **Discord regression:** `pgrep` gateway still running post-test.
- **Do not** add Omnipotent.md tests that mock Portal audio — out of scope.

### Previous story intelligence (Epic 74 Desktop — direct prerequisite)

From **74-7** (done):
- Windows Desktop install: `iex (irm https://hermes-agent.nousresearch.com/install.ps1)` → `%LOCALAPPDATA%\hermes`
- **Remote gateway** URL: `http://localhost:9119` — WSL canonical `~/.hermes/` backend
- OAuth sign-in (not basic-auth) — `auth_path: oauth`
- WebSocket `/api/ws` required for live chat — status page alone insufficient
- Dual-home anti-pattern: do **not** run second Windows agent

From **74-8** (done / review):
- Vault module `hermes-desktop.md` is SSOT for connection topology — **Voice section not yet written** (this story + 78-3)
- `routing.md` Tool Gateway row still `pending-74-4` for web search — voice uses **openai-audio**, separate from 74-4
- Subscription cost note: cancel standalone TTS only after **78-1** confirms Tool Gateway coverage

[Source: `74-7-hermes-desktop-live-chat-connection.md`, `74-8-portal-and-desktop-governance-documentation.md`, `Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md`]

### Git intelligence (recent hermes-consolidation work)

Recent commits are Epic **77** awareness (`77-2` pull client, `77-4` skill, `77-5` dashboard UI). No prior voice work in repo — this story is **greenfield config** on existing Portal stack. Pattern from Epic 74/75: operator evidence files in `_bmad-output/implementation-artifacts/`, `verify.sh` unchanged, config-only when possible.

### Latest tech information (Hermes v0.17.0)

- **Hermes Agent v0.17.0** (2026.6.19) — Desktop native app with voice mode + remote backend support.
- **Tool Gateway** bundles OpenAI TTS into `text_to_speech` tool via Nous Subscription — no separate OpenAI key when `use_gateway: true`.
- **STT gateway:** `stt.use_gateway: true` + `stt.provider: openai` routes Whisper through Portal token.
- **Streaming TTS:** Native sentence-by-sentence playback when voice mode + TTS enabled (not batch-only).
- **Duplex:** Not shipped — track #35750; v1 expectation must be documented.
- **`hermes tools`:** Requires **interactive terminal** — dev agent cannot pipe; operator must run locally.

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — no WriteGate mutation this story unless 78-3 vault docs explicitly scoped
- CNS Phase 1 spec: **not applicable** (no Vault IO MCP changes)
- Deferred work: no Epic 78 blockers in `deferred-work.md`
- Sprint: `78-1` gates Epic 78 start; **78-2** may proceed after 78-1 done

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 78, Story 78-1]
- [Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR10, §FR-GATE, G6]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §ADR-HERMES-001, §D2]
- [Source: `Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md`]
- [Source: Context7 `/nousresearch/hermes-agent` — voice-mode, tts, tool-gateway, desktop, run-hermes-with-nous-portal]
- [Source: `74-7-connection-steps-draft.md`, `74-7-desktop-connection-evidence.md`]
- [Upstream: https://github.com/NousResearch/hermes-agent/issues/35750]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- AC#1 preflight: hermes v0.17.0, portal logged in, dashboard active, gateway PID 1796894
- AC#3: set `voice.auto_tts: false → true`; restarted `hermes-dashboard.service`
- AC#4: **PARTIAL (operator 2026-06-25)** — no native Desktop `.exe`; Electron source at `apps/desktop` needs build; browser voice blocked by WSL sounddevice

### Completion Notes List

- WSL baseline PASS (AC#1): Portal Nous provider, Tool Gateway shows OpenAI TTS + STT via Nous Portal
- Gateway audio config verified (AC#2): `tts.use_gateway: true`, `stt.use_gateway: true`, whisper-1, gpt-4o-mini-tts
- Voice block updated (AC#3): `auto_tts: true`; dashboard restarted and active
- AC#4 **PARTIAL**: voice config correct; Desktop E2E blocked — (a) WSL browser audio path, (b) Hermes Desktop Electron not built/packaged
- Scope + failure modes doc created (AC#5, AC#6); known Desktop gap documented
- `bash scripts/verify.sh` → VERIFY PASSED; protect-list clean; no `src/` changes
- **Story remains `in-progress`:** AC#4 E2E closes when native Desktop is available; **78-2 unblocked** (pure config)

### File List

- `~/.hermes/config.yaml` — `voice.auto_tts: true` (operator config, not in git)
- `_bmad-output/implementation-artifacts/78-1-voice-e2e-evidence.md` — NEW (AC#4 PARTIAL)
- `_bmad-output/implementation-artifacts/78-1-voice-scope-and-failure-modes.md` — NEW
- `_bmad-output/implementation-artifacts/78-1-portal-tts-and-push-to-talk-on-desktop.md` — UPDATED
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 78-1 in-progress
- `_bmad-output/implementation-artifacts/deferred-work.md` — Hermes Desktop Electron build ops item

### Change Log

- 2026-06-25: Dev agent — WSL voice config (`auto_tts: true`), evidence scaffold, scope/failure-modes docs, verify green. AC#4 operator gate open.
- 2026-06-25: Operator — AC#4 PARTIAL; no packaged Desktop app; Electron build deferred; story stays in-progress; 78-2 unblocked.
