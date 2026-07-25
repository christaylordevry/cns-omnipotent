# Story 78-1 — Portal TTS and Push-to-Talk Evidence

**Story:** `78-1-portal-tts-and-push-to-talk-on-desktop`  
**Operator:** Chris  
**Date started:** 2026-06-25  
**Hermes WSL version:** v0.17.0 (2026.6.19)  
**Branch:** `hermes-consolidation`  
**FR-GATE:** CLEARED 2026-06-25 (Plus plan — `openai-audio`)

> **Redaction policy (NFR4):** No tokens, passwords, API keys, or OAuth client secrets below.

---

## AC #1 — WSL + Portal + dashboard preflight — PASS (agent 2026-06-25)

| Check | Result |
|-------|--------|
| `hermes --version` | **v0.17.0** (2026.6.19) |
| `hermes portal info` logged in | **Yes** — Nous inference provider |
| `systemctl --user is-active hermes-dashboard.service` | **active** |
| `auth_required` | **true** |
| `auth_providers` | **`["nous"]`** |
| `gateway_state` | **running** |
| `model.provider` | **nous** |
| Discord gateway separate PID | **Yes** — see gateway pgrep below |
| FR-GATE note | Plus plan / `openai-audio` cleared **2026-06-25** |

### Evidence

```text
hermes --version → Hermes Agent v0.17.0 (2026.6.19)

hermes portal info:
  Auth: ✓ logged in
  Model: ✓ using Nous as inference provider
  Tool Gateway:
    OpenAI TTS         via Nous Portal
    Speech-to-text     via Nous Portal

systemctl --user is-active hermes-dashboard.service → active

curl -s http://127.0.0.1:9119/api/status | jq '{auth_required, auth_providers, backend_ready: .gateway_running, gateway_state}':
  auth_required: true
  auth_providers: ["nous"]
  backend_ready: true
  gateway_state: "running"

pgrep -af 'hermes_cli.main gateway':
  1796894 ... python -m hermes_cli.main gateway run
```

---

## AC #2 — Tool Gateway audio (Nous Subscription) — PASS (agent 2026-06-25)

| Check | Result |
|-------|--------|
| `tts.use_gateway` | **true** |
| `stt.use_gateway` | **true** |
| `tts.provider` | **openai** (gateway-routed) |
| `stt.provider` | **openai** |
| `stt.openai.model` | **whisper-1** |
| Portal Tool Gateway TTS/STT | **via Nous Portal** (`hermes portal info`) |
| `hermes tools` interactive | **Skipped** — gateway already active per `portal info`; operator may re-run to confirm UI mapping |

### Config excerpt (redacted)

```yaml
tts:
  provider: openai
  openai:
    model: gpt-4o-mini-tts
    voice: alloy
  use_gateway: true

stt:
  enabled: true
  provider: openai
  openai:
    model: whisper-1
  use_gateway: true
```

### Evidence

```text
hermes portal info → OpenAI TTS via Nous Portal; Speech-to-text via Nous Portal
~/.hermes/config.yaml → tts.use_gateway: true; stt.use_gateway: true
```

---

## AC #3 — Push-to-talk config (Ctrl+B) — PASS (agent 2026-06-25)

| Check | Result |
|-------|--------|
| `voice.record_key` | **ctrl+b** |
| `voice.auto_tts` | **true** (updated from `false`) |
| `voice.max_recording_seconds` | **120** |
| `voice.beep_enabled` | **true** |
| `voice.silence_threshold` | **200** |
| `voice.silence_duration` | **3.0** |
| Dashboard restart | **systemctl --user restart hermes-dashboard.service** |

### Config excerpt (redacted)

```yaml
voice:
  record_key: ctrl+b
  max_recording_seconds: 120
  auto_tts: true
  beep_enabled: true
  silence_threshold: 200
  silence_duration: 3.0
```

---

## AC #4 — Hermes Desktop live voice E2E — **PARTIAL** (operator 2026-06-25)

> **Environment constraints:** Voice **config verified correct** on WSL; live Desktop E2E blocked by missing native app + WSL audio path. Revisit when Hermes Desktop Electron is built/packaged (see `deferred-work.md` § Hermes Desktop Electron build).

```
AC#4 STATUS: PARTIAL — config verified correct; Desktop E2E blocked pending:
  (a) WSL sounddevice audio path (browser UI)
  (b) Hermes Desktop Electron build (native Windows)
TTS config: auto_tts=true, use_gateway=true, whisper-1 ✓
```

### Operator findings (2026-06-25)

| Finding | Detail |
|---------|--------|
| Native Desktop app on Windows | **Not installed** — Microsoft Store search only; no packaged `.exe` |
| `%LOCALAPPDATA%\hermes` | Exists but is **WSL-side config mount**, not a native Windows Desktop install |
| Windows `install.ps1` | Pulled upstream (12,701 commits incl. `apps/desktop` Electron source) — **no packaged Desktop binary** |
| Electron source | Present at `apps/desktop` in hermes-agent repo — **requires separate build** (out of 78-1 scope) |
| Browser UI voice (`localhost:9119`) | **Blocked** — WSL sounddevice / audio device limitation for mic capture |
| Voice config on WSL | **Verified** — see AC #2–#3 |

| Step | Status |
|------|--------|
| 1. Desktop → Remote gateway `http://localhost:9119` | **N/A** — no native Desktop app |
| 2. OAuth sign-in (Nous Research) | **N/A** — browser path blocked on audio |
| 3. Microphone permission granted | **Not tested** |
| 4. Voice mode enabled | **Not tested** |
| 5. Ctrl+B push-to-talk test phrase | **Not tested** |
| 6. Streaming TTS heard sentence-by-sentence | **Not tested** |
| Discord gateway PID unchanged post-test | **N/A** — no voice test run |

| Field | Operator entry |
|-------|----------------|
| Date assessed | **2026-06-25** |
| **Result** | **PARTIAL** — config ✓; E2E deferred |

---

## AC #5 — v1 scope documentation — PASS (agent 2026-06-25)

| Check | Result |
|-------|--------|
| `78-1-voice-scope-and-failure-modes.md` exists | **Yes** |
| v1 = push-to-talk in, streaming TTS out | **Documented** |
| #35750 duplex gap noted | **Yes** |
| Discord voice OOS | **Yes** |
| Browser fallback vs Desktop primary | **Yes** |
| 78-3 operator guide draft bullets | **Yes** (in scope doc) |

---

## AC #6 — Failure modes table — PASS (agent 2026-06-25)

| Check | Result |
|-------|--------|
| Failure modes table in scope doc | **Yes** — 7 rows minimum |
| `openai-audio` pricing note | **Yes** — Whisper $0.0063/min + TTS speech tokens |
| Graceful text fallback when gateway down | **Yes** |

---

## AC #7 — Verify gate + repo hygiene — PASS (agent 2026-06-25; AC#4 PARTIAL documented)

| Check | Result |
|-------|--------|
| `bash scripts/verify.sh` | **PASS** (see below) |
| No secrets in git diff | **Yes** — evidence + scope docs + sprint-status + story only |
| Protect-list zero diffs | **Yes** |
| No `src/` changes | **Yes** |
| Config mutation path | **`~/.hermes/config.yaml` only** (`voice.auto_tts: false → true`) |

### verify.sh output

```text
bash scripts/verify.sh → VERIFY PASSED (2026-06-25)
```

---

## Completion checklist

- [x] AC #1 WSL prerequisites verified
- [x] AC #2 Tool Gateway audio — gateway flags + portal info
- [x] AC #3 Voice block — `auto_tts: true`, Ctrl+B, dashboard restart
- [x] AC #4 **PARTIAL** — config verified; Desktop E2E deferred (Electron build + WSL audio)
- [x] AC #5 v1 scope doc
- [x] AC #6 Failure modes table
- [x] AC #7 verify.sh + protect-list; evidence complete with AC#4 PARTIAL

**Story status:** `in-progress` — config work done; AC#4 E2E closes when native Desktop is built/packaged.
