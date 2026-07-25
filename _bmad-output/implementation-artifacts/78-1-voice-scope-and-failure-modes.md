# Story 78-1 — Voice v1 Scope and Failure Modes

**Story:** `78-1-portal-tts-and-push-to-talk-on-desktop`  
**Operator:** Chris  
**Date:** 2026-06-25  
**Hermes version:** v0.17.0 (2026.6.19)  
**FR-GATE:** CLEARED 2026-06-25 (Plus plan — Tool Gateway `openai-audio`)

> **Redaction policy (NFR4):** No API keys, OAuth tokens, or full client secrets in this document.

---

## v1 scope (what ships in 78-1)

| In scope | Out of scope |
|----------|--------------|
| **Push-to-talk in** — operator holds **Ctrl+B** to speak | Always-on duplex listening |
| **Streaming TTS out** — sentence-by-sentence playback on voice replies | Discord voice channels |
| **Hermes Desktop** (Windows native app) in **remote gateway** mode → WSL `http://localhost:9119` | Omnipotent.md `src/` changes |
| Portal Tool Gateway **`openai-audio`** — Whisper STT + TTS speech tokens | Standalone OpenAI TTS API key (unless operator explicitly opts in) |
| Config on WSL `~/.hermes/config.yaml` only | Full CNS-Operator-Guide vault section (deferred to **78-3** / WriteGate) |

### v1 interaction model

**v1 = push-to-talk in, streaming TTS out.** The operator holds **Ctrl+B** to record; release triggers Whisper transcription → Portal inference (`anthropic/claude-sonnet-4.6`) → streaming TTS playback. This is **not** always-on duplex listening.

### Upstream gap — duplex voice

True duplex (always-on bidirectional voice) is tracked upstream as [hermes-agent#35750](https://github.com/NousResearch/hermes-agent/issues/35750). That issue is **explicitly not v1** for CNS.

### Discord voice

**Out of scope for v1.** Discord remains text chat + gateway (`#hermes`). No Discord voice channel requirement.

### Browser vs Desktop

| Surface | Role in v1 |
|---------|------------|
| **Hermes Desktop** (Windows native) | **Primary** FR10 voice surface per ADR-HERMES-001 |
| **Browser** `http://localhost:9119` | Text chat fallback; not primary voice proof |

### Known gap — 78-1 environment (2026-06-25)

| Blocker | Detail |
|---------|--------|
| Native Desktop `.exe` | **Not present** after `install.ps1` — Electron source at `apps/desktop` requires separate build/packaging |
| `%LOCALAPPDATA%\hermes` | WSL config mount, not a native Desktop install |
| Browser UI voice | **Blocked** on this setup — WSL sounddevice / audio device path cannot capture mic for push-to-talk |

Voice **config on WSL is verified correct** (`auto_tts: true`, gateway STT/TTS). AC#4 E2E deferred until Desktop Electron is built — see `deferred-work.md`.

---

## Portal tool pricing (operator awareness)

| Tool | Metering |
|------|----------|
| Whisper STT | `openai-audio` — **$0.0063/min** |
| TTS | `openai-audio` speech tokens |

Monitor Portal usage to avoid bill shock after voice sessions.

---

## Failure modes and operator recovery

| Symptom | Likely cause | Operator action |
|---------|--------------|-----------------|
| No transcription after Ctrl+B | Mic permission / wrong input device | Windows Settings → Privacy → Microphone; retry Desktop |
| STT error / "gateway" / 402 | `stt.use_gateway: false` or FR-GATE lapse | Set `stt.use_gateway: true`; confirm Portal paid tier; `hermes portal info` |
| TTS silent but text reply OK | `auto_tts: false` or TTS not on Nous Subscription | `auto_tts: true` or `/voice tts`; `hermes tools` → TTS → Nous Subscription |
| `openai-audio` / Tool Gateway error | Gateway down, subscription expired, or tool not enabled | `hermes portal info`; re-run `hermes tools`; check Portal billing |
| Whisper works, no inference | Portal session expired | Re-auth WSL: `hermes auth add nous --type oauth --manual-paste` |
| Voice works on CLI, not Desktop | Desktop not on remote WSL backend | Confirm remote URL `http://localhost:9119` + OAuth; status bar shows WSL `~/.hermes` path |
| High latency / cost surprise | Portal metering | Whisper ≈ **$0.0063/min** (`openai-audio`); TTS = speech tokens via `openai-audio` — monitor Portal usage |

### Graceful degradation

When the Tool Gateway is unavailable, **text chat remains functional**. Voice degrades gracefully — Hermes does **not** silently fall back to a paid standalone OpenAI key unless the operator explicitly configures one.

---

## Draft bullets for 78-3 operator guide (Voice subsection)

_Deferred to story **78-3** for full vault WriteGate publish. Use these as seed content:_

- **Primary surface:** Hermes Desktop (Windows) → Remote gateway `http://localhost:9119` → WSL `~/.hermes` backend.
- **Push-to-talk:** Hold **Ctrl+B** to speak; release to send. Config key: `voice.record_key: ctrl+b`.
- **Spoken replies:** `voice.auto_tts: true` enables streaming TTS on voice-mode replies (sentence-by-sentence). Alternative: `/voice tts` in chat.
- **Portal audio:** `tts.use_gateway: true` and `stt.use_gateway: true` route Whisper + TTS through Nous Subscription (`openai-audio`) — no standalone OpenAI key required when gateway active.
- **Setup:** `hermes setup voice` or `hermes tools` → TTS / Speech-to-text → **Nous Subscription**.
- **v1 limits:** Push-to-talk only; not duplex always-on ([#35750](https://github.com/NousResearch/hermes-agent/issues/35750)). Discord voice channels out of scope.
- **Fallback:** Browser chat at `http://localhost:9119` for text; voice troubleshooting table in `78-1-voice-scope-and-failure-modes.md`.

---

## References

- ADR-HERMES-001 — Desktop primary voice surface
- Context7 `/nousresearch/hermes-agent` — `voice-mode.md`, `configuration.md`, `run-hermes-with-nous-portal.md`
- Story 74-7 — Desktop remote gateway + OAuth baseline
- Story 78-3 — full operator guide vault section (pending)
