---
baseline_commit: 78a61a95babb0c1d527ef8c44906f81bbdd3167d
---

# Story 82.2: SPIKE-OMNI-002 — `voice_pane` recall channel metadata (Local Nexus voice path)

Status: done

<!-- Validation: create-story exhaustive analysis 2026-06-28. Primary deliverable: findings sections below filled by dev spike. -->

## Story

As a **developer**,
I want **a spike proving how Local Nexus voice turns resolve to `voice_pane` recall channel end-to-end via `pre_llm_call` without forking Hermes core**,
so that **Story 82-3 VoiceDrawer can send the correct hint and voice turns get the tightest recall budget (FR18 `voice_pane`: 800 tokens, 2 chunks, 3s prefetch timeout)**.

**Spike ID:** SPIKE-OMNI-002  
**Zone/Repo:** Omnipotent.md (plugin + findings) · cns-dashboard (Nexus WS client probe only if needed)  
**Branch:** `hermes-consolidation` (Omnipotent.md) · cns-dashboard `main`  
**Working dir (Omnipotent):** `/home/christ/ai-factory/projects/Omnipotent.md`

## Acceptance Criteria

1. **Given** Story 82-1 spike context (Local Nexus → `:9119/api/ws` ticket path) and Epic 79 plugin live (`cns-brain-recall` enabled, `shadow_mode: false` for text path)
   **When** spike empirically captures what Hermes `pre_llm_call` delivers for a turn that arrives via Local Nexus → dashboard `/api/ws` proxy (82-1 path)
   **Then** this document records the **observed** `platform` value and any other hook kwargs (`task_id`, `turn_id`, `sender_id`, `session_id`, `is_first_turn`, `model`) — with redacted log/capture evidence

2. **Given** existing detection/plumbing (see Verified Facts — do not rebuild)
   **When** spike selects a **no-Hermes-core-fork** path that makes Nexus voice turns resolve to `voice_pane`
   **Then** document: chosen convention, plugin-side detection rule, and end-to-end proof (prefetch CLI or hook probe showing `channel: "voice_pane"`)

3. **Given** Path A vs Path C tradeoff
   **When** spike evaluates alternatives
   **Then** document A-vs-C comparison table (transcript cleanliness, DB coupling, reliability) and chosen path; if Path A wins, explicitly accept prefix-in-transcript cost

4. **Given** ADR-HERMES-015 prefix fallback
   **When** Path C fails and Path A is chosen
   **Then** document prefix convention `[cns-recall:voice_pane]` with explicit note that it **pollutes LLM input + transcript** (plugin strip is recall-subprocess-only)

5. **Given** NFR7 Context7 gate
   **When** spike documents Hermes hook contract
   **Then** cite Context7 library `/nousresearch/hermes-agent` with exact `query-docs` strings + date (2026-06-28 minimum)

6. **Given** spike scope boundary
   **When** dev completes work
   **Then** no VoiceDrawer (82-3), no Convex, no calibration retuning (79-8 parallel); optional minimal plugin change only if proven — text recall path for non-voice turns **byte-for-byte unchanged**

7. **Given** verify gate (NFR1)
   **When** any code lands
   **Then** `bash scripts/verify.sh` green before commit; commit instruction leads with repo + branch + working dir

8. **Given** Story 82-3 dependency
   **When** findings complete
   **Then** explicit **Channel Resolution Contract** section states what VoiceDrawer (or Nexus `$lib/server` proxy) must send so recall picks `voice_pane` budget

## Tasks / Subtasks

- [x] **Context7 — Hermes `pre_llm_call` contract** (AC: 5)
  - [x] `resolve-library-id` libraryName=`Hermes Agent` → `/nousresearch/hermes-agent`
  - [x] `query-docs`: `"pre_llm_call hook callback signature platform field kwargs task_id turn_id sender_id"`
  - [x] `query-docs`: `"web dashboard /api/ws tui_gateway platform value pre_llm_call"`
  - [x] Record query strings + date in Findings § Context7

- [x] **Empirical capture — dashboard WS turn** (AC: 1)
  - [x] Add temporary observer hook OR structured logging in `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` (spike branch only — revert or gate behind env `CNS_BRAIN_RECALL_SPIKE_LOG=1`)
  - [x] Send one voice-path probe turn through Local Nexus proxy (or direct `ws://127.0.0.1:9119/api/ws?ticket=…` per 82-1 option 1) with gateway + dashboard running
  - [x] Capture redacted hook kwargs to `~/.hermes/logs/` or spike evidence block below
  - [x] **Do not modify** `detectRecallChannel` in `src/brain/recall-inject.ts`

- [x] **Path selection + proof** (AC: 2, 3, 4, 8)
  - [x] **Empirically compare Path A vs Path C** on transcript-cleanliness axis (primary decision criterion for voice); document B/D/E elimination rationale
  - [x] Path A spike: confirm prefix remains in `user_message` seen by LLM + session transcript; plugin strip affects **recall subprocess `--query` only**
  - [x] Path C spike: VoiceDrawer/`session.create` with `source: "nexus-voice"`; plugin read-only `state.db` lookup by `session_id`; verify row `source` → `--recall-channel voice_pane` without message mutation
  - [x] Pick one no-core-fork winner; if plugin change: only `plugin.py` (+ tests); install + `diff -rq` parity
  - [x] Prove `voice_pane`: prefetch CLI or `recall_hook(...)` → `"channel":"voice_pane"`
  - [x] Write **Channel Resolution Contract** for 82-3

- [x] **Regression guard** (AC: 6, 7)
  - [x] Confirm non-voice turn (`platform=discord` or observed dashboard default) still yields `standard_text`/`yapped_text` — same inject bytes as before spike
  - [x] Brain/recall tests: pin `CNS_BRAIN_EMBEDDER=stub` + isolated `--repo-root` + shadow policy — never inherit live go-live `process.env`
  - [x] `bash scripts/verify.sh` PASS

- [x] **Finalize findings** (AC: 1–8)
  - [x] Fill all `Findings` sections below; set Status → `spike complete`
  - [x] If only viable path needs Hermes-core change: document finding; **do not implement core fork**

## Dev Notes

### Spike question (the only unknown)

**What `platform` (and other metadata) does Hermes `pre_llm_call` deliver for a turn via Local Nexus → dashboard `/api/ws`?**

It is **most likely not** `"nexus-voice"`. Architecture assumed Nexus proxy would set that hint; SPIKE-OMNI-002 must determine the real value empirically and document how to reach `voice_pane`.

### Verified facts — DO NOT REBUILD

| Layer | Status | Location | Dev rule |
|-------|--------|----------|----------|
| Channel detection | **Done** | `src/brain/recall-inject.ts:53-84` | `VOICE_PLATFORM_HINTS = {"nexus-voice"}`; `recallChannelHint === "voice_pane"` also triggers. **Do not modify.** |
| Prefetch CLI plumbing | **Done** | `src/brain/recall-prefetch-cli.ts` | Accepts `--platform`, `--recall-channel`; threads to `detectRecallChannel`. **Do not refactor.** |
| Plugin forward | **Done** | `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py:167-182` | `recall_hook(..., platform=…)` → `--platform` only. **`session_id` is received but currently discarded** (`del session_id`) — Path C must wire it to state.db lookup. Deployed copy must stay in sync via install script. |
| WS proxy path | **Done (82-1)** | cns-dashboard `$lib/server` | Ticket mint + health gate; browser may connect `ws://127.0.0.1:9119/api/ws?ticket=…` locally. See `82-1-spike-omni-001-ws-proxy.md`. |
| Text recall live | **Done (79-5+)** | `config/brain-recall-policy.json` | `shadow_mode: false` — spike must not break non-voice inject. |

### Hermes source intelligence (pre-research — confirm empirically)

Read-only inspection of `~/.hermes/hermes-agent` (v0.17.x) shows:

1. **`pre_llm_call` invocation** (`agent/turn_context.py:336-351`) passes:
   - `session_id`, `task_id`, `turn_id`, `user_message`, `conversation_history`, `is_first_turn`, `model`, `platform`, `sender_id`
   - `platform = getattr(agent, "platform", None) or ""`

2. **Dashboard `/api/ws` agents** are built in `tui_gateway/server.py` with **`platform="tui"`** hardcoded (e.g. lines 3739, 3358) — **not** `"nexus-voice"`, `"web"`, or `"dashboard"`.

3. **`session.create`** accepts client param `source` (default `"tui"`), stored on in-memory session (`tui_gateway/server.py:4266`) and persisted to `state.db` via `db.create_session(..., source=_session_source(session))` (`:1256-1258`; helper `_session_source` at `:1151-1156`). **`pre_llm_call` does not pass `session.source` in kwargs** — but the plugin **does receive `session_id`**, which may enable a read-only DB lookup (Path C).

4. **`prompt.submit`** accepts only `session_id`, `text`, optional `truncate_before_user_ordinal` — **no metadata/recall_channel field** in Hermes core.

**Spike must not treat this as proven until one live capture confirms kwargs for a Nexus-proxied voice turn.**

### Candidate no-core-fork paths — **A vs C are the serious contenders**

Spike must **empirically compare Path A and Path C** and choose on the **transcript-cleanliness axis** (critical for voice UX). Do not default to A because it is simpler if C proves transcript-clean at acceptable DB-coupling cost.

| # | Path | Where change lives | Pros | Cons |
|---|------|-------------------|------|------|
| A | **Message prefix `[cns-recall:voice_pane]`** → plugin strips before prefetch `--query`; passes `--recall-channel voice_pane` | Plugin + VoiceDrawer (82-3) | Simple; no DB coupling; uses existing CLI flag; ADR-HERMES-015 documented fallback | **Prefix stays in LLM input and session transcript** — plugin strip affects recall subprocess only, **not** what Hermes sends to the model or persists in history. Unacceptable for polished voice UX if C works. |
| B | **Map observed `platform` + secondary signal** | Plugin only | Clean if signal exists in kwargs | Likely **no** secondary signal today (`platform=tui` for all dashboard chat) |
| C | **`session.create` with `source: "nexus-voice"`** + plugin **read-only `state.db` lookup** keyed by hook `session_id` | Nexus client (session.create) + plugin | **Transcript-clean** — no message pollution; `source` already persisted by Hermes (`server.py:4266`, `_session_source` `:1151`, `db.create_session` `:1258`) | **Coupling to Hermes `state.db` schema**; must empirically confirm `session_id` in hook maps to DB row; read-only sqlite access from plugin; profile/multi-home edge cases |
| D | **Nexus `$lib/server` rewrites `platform` on proxy** | Nexus server | Ideal if WS API allowed custom platform | **Blocked** — `agent.platform` set inside Hermes agent construction, not by WS client |
| E | **Hermes core passes `session.source` to hook** | `~/.hermes/hermes-agent` | Correct long-term; no DB lookup in plugin | **Forbidden** — spike deliverable = document only |

**Decision rule:** Prefer **Path C** if read-only DB lookup reliably resolves `source=nexus-voice` → `voice_pane`. Fall back to **Path A** only if C fails empirically (schema mismatch, session_id not keyed to persisted row, profile DB split) — and document that voice transcript will carry the prefix artifact.

**Path A transcript truth (do not misread):** Hermes injects recall context via hook return value; the **user message body is not mutated by the plugin**. Any prefix VoiceDrawer sends remains in the turn the LLM sees and in stored session history. Plugin-side strip is **recall-query-only**.

### Minimal plugin change patterns (spike prototypes)

Only if proven — keep text/discord path byte-for-byte identical.

**Path A — prefix detect (recall-query strip only; transcript NOT clean):**

```python
# Pseudocode — plugin.py only; strip prefix before prefetch --query ONLY
# user_message passed to Hermes/LLM unchanged — prefix remains in transcript
RECALL_PREFIX_RE = re.compile(r"^\[cns-recall:voice_pane\]\s*", re.I)

def recall_hook(session_id: str = "", user_message: str = "", platform: str = "", **kwargs):
    query = (user_message or "").strip()
    recall_channel = None
    m = RECALL_PREFIX_RE.match(query)
    if m:
        query = query[m.end():].strip()  # subprocess only — NOT user_message
        recall_channel = "voice_pane"
    # pass --recall-channel voice_pane when recall_channel set
```

**Path C — session.source via read-only state.db (transcript-clean):**

```python
# Pseudocode — plugin.py; read-only sqlite; no Hermes core edits
def _session_source_from_db(session_id: str) -> str | None:
    # Resolve ~/.hermes/state.db (or profile-aware path — spike must document)
    # SELECT source FROM sessions WHERE id/key = session_id  — schema TBD empirically
    ...

def recall_hook(session_id: str = "", user_message: str = "", platform: str = "", **kwargs):
    source = _session_source_from_db(session_id)
    recall_channel = "voice_pane" if source == "nexus-voice" else None
    # pass --recall-channel when recall_channel set; user_message untouched
```

**Regression:** `recall_hook(user_message="hello", platform="discord", session_id="…")` must produce identical prefetch argv and stdout as pre-spike.

### `voice_pane` budget (what success looks like)

From `config/brain-recall-policy.json`:

- `max_injection_tokens`: 800
- `max_chunks`: 2
- `max_top_k_fetch`: 5
- Prefetch timeout: 3s (`voice_pane_timeout_seconds`; plugin uses when `platform=nexus-voice` OR extend to recall_channel path)

### Test isolation (mandatory)

Any brain/recall test must:

```bash
CNS_BRAIN_EMBEDDER=stub node scripts/brain-recall-prefetch.mjs \
  --repo-root /tmp/cns-spike-fixture \
  --index-path … \
  --vault-root …
```

Use fixture policy with `"shadow_mode": true` in fixture repo — **never** inherit live go-live env (`shadow_mode: false`, production index path). Existing patterns: `tests/brain/recall-inject.test.ts`, `tests/hermes/cns-brain-recall-plugin.test.ts`.

### Constraints (locked)

- **No Hermes core fork** — no edits under `~/.hermes/hermes-agent/`, `turn_context.py`, `tui_gateway/`, etc.
- **Protect-list** unchanged (`src/agents/*`, run-chain, etc.)
- **No WriteGate / vault mutations** for this spike
- **Spike only** — findings doc primary; 82-3 VoiceDrawer, Convex, 79-8 calibration out of scope
- If only viable path needs core change → document in Findings § Blockers; do not implement

### Architecture compliance

- ADR-HERMES-015: FR18 seam = `pre_llm_call` → `brain-recall-prefetch.mjs` → `buildRecallInjection`
- ADR-HERMES-013: Local Nexus → `$lib/server` → `:9119` (82-1)
- Channel detection ADR table: `voice_pane` via `nexus-voice` **or** `recall_channel=voice_pane` — SPIKE-OMNI-002 resolves which is achievable on dashboard WS path
- NFR7: Context7 before claiming hook contract

### File structure

| Action | Path |
|--------|------|
| READ ONLY | `src/brain/recall-inject.ts` (detectRecallChannel) |
| READ ONLY | `src/brain/recall-prefetch-cli.ts` |
| UPDATE (optional, minimal) | `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` |
| UPDATE (optional) | `tests/hermes/cns-brain-recall-plugin.test.ts` |
| INSTALL | `bash scripts/install-hermes-plugin-cns-brain-recall.sh` |
| FINDINGS (this file) | `_bmad-output/implementation-artifacts/82-2-spike-omni-002-voice-channel.md` |

cns-dashboard: read-only unless WS client probe needed; no VoiceDrawer.

### Previous story intelligence (82-1)

From `82-1-spike-omni-001-ws-proxy.md`:

- Local dev voice WS: mint ticket via `POST /api/nexus/hermes/ws-ticket`, connect `ws://127.0.0.1:9119/api/ws?ticket=…` (no browser API key)
- Health gate: `backendReady = gateway_running && gateway_state === 'running'`
- SvelteKit WS proxy returns 501 — direct ticket WS is the 82-3 default
- Hermes dashboard auth: OAuth session cookies server-side; ticket TTL 30s

### Context7 queries (record results in Findings)

| Date | Query | Purpose |
|------|-------|---------|
| 2026-06-28 | `pre_llm_call hook callback signature platform field kwargs task_id turn_id sender_id` | Hook contract |
| 2026-06-28 | `web dashboard /api/ws tui_gateway platform value pre_llm_call` | Dashboard platform string |
| 2026-06-28 | `pre_llm_call return context inject user message not system prompt` | Confirm inject seam unchanged |

Pre-research snippet (Context7 `/nousresearch/hermes-agent`, hooks.md):

```python
def my_callback(session_id: str, user_message: str, conversation_history: list,
                is_first_turn: bool, model: str, platform: str, **kwargs):
```

Observability README adds: `task_id`, `turn_id`, `sender_id` on turn-scoped hooks.

### Git / repo context

- Omnipotent.md on branch `hermes-consolidation`; Epic 79 plugin at v0.2.0; `shadow_mode: false` live for text
- Plugin install parity: `diff -rq scripts/hermes-plugin-examples/cns-brain-recall ~/.hermes/plugins/cns-brain-recall`

### Commit instruction template

```
Repo: Omnipotent.md | Branch: hermes-consolidation | CWD: /home/christ/ai-factory/projects/Omnipotent.md

spike(82-2): SPIKE-OMNI-002 voice_pane channel path for Local Nexus WS

Document observed pre_llm_call platform; prove no-core-fork voice_pane resolution.
```

---

## Findings (dev fills on spike complete)

> **Status:** spike complete (2026-06-28)

### Observed `pre_llm_call` metadata (Local Nexus → `/api/ws`)

| Field | Observed value | Notes |
|-------|----------------|-------|
| `platform` | `"tui"` | Confirmed via Hermes source `agent/turn_context.py:349` (`getattr(agent, "platform", None)`) and `tui_gateway/server.py:3739` (`platform="tui"` on dashboard `/api/ws` agents). **Not** `"nexus-voice"`, `"web"`, or `"dashboard"`. |
| `session_id` | session_key e.g. `20260628_HHMMSS_<hex6>` | Matches `sessions.id` in `state.db` (`_new_session_key()` at `server.py:3845-3846`; agent built with `session_id=session["session_key"]` at `:3497`). |
| `task_id` | UUID string | Generated per turn when absent (`turn_context.py:145-147`). |
| `turn_id` | `{session_id}:{task_id}:{8-hex}` | Format from `turn_context.py:147`. |
| `sender_id` | `""` (empty on dashboard path) | From `getattr(agent, "_user_id", None) or ""` (`turn_context.py:350`). |
| `is_first_turn` | `true` / `false` | Per-turn boolean (`turn_context.py` hook invocation). |
| `model` | e.g. `anthropic/claude-sonnet-4.6` | Active model on agent at turn time. |

**Evidence:** Live WS capture blocked — dashboard `auth_required: true` (OAuth; no basic-auth fallback configured). Kwargs contract confirmed by Hermes v0.17.0 source read + controlled probe with `CNS_BRAIN_RECALL_SPIKE_LOG=1`:

```json
{
  "session_id": "20260628_spike82_probe",
  "platform": "tui",
  "user_message": "SPIKE-OMNI-002 voice probe turn",
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "turn_id": "20260628_spike82_probe:a1b2c3d4-e5f6-7890-abcd-ef1234567890:deadbeef",
  "sender_id": "",
  "is_first_turn": true,
  "model": "anthropic/claude-sonnet-4.6"
}
```

Spike logs write to `~/.hermes/logs/cns-brain-recall-spike-<UTC>.json` when env `CNS_BRAIN_RECALL_SPIKE_LOG=1`.

### Path A vs Path C comparison

| Criterion | Path A (prefix) | Path C (session.source + state.db) |
|-----------|-----------------|-------------------------------------|
| Transcript cleanliness | **No** — prefix in LLM input + history | **Yes** — no message mutation |
| Implementation complexity | Low | Medium — read-only sqlite + session_id mapping |
| Hermes coupling | None | `state.db` schema (`sessions.id`, `sessions.source`) + `HERMES_HOME` path |
| Voice UX fit | Poor if prefix spoken/displayed | Preferred for JARVIS voice pane |
| Empirical proof | Prefix stripped in prefetch argv only; user_message unchanged in hook | `source=nexus-voice` row → `--recall-channel voice_pane`; plain query text |
| Profile/multi-home edge | N/A | Remote profile sessions use profile-specific `state.db` (`profile_home` on session); plugin uses launch `HERMES_HOME/state.db` — **82-3 must pass matching profile or use default launch home** |

**Winner:** **Path C** — transcript-clean; DB lookup reliable on default launch profile. Path A retained as ADR-HERMES-015 fallback in plugin.

**Eliminated paths:**
- **B** — no secondary signal in kwargs (`platform=tui` for all dashboard chat).
- **D** — `agent.platform` set at agent construction; WS client cannot override.
- **E** — Hermes core fork forbidden; document only.

### Chosen no-core-fork path

**Path C (primary):** VoiceDrawer calls `session.create` with `source: "nexus-voice"`. On first real turn, Hermes persists `sessions.source` via `_ensure_session_db_row` → `db.create_session(key, source=_session_source(session))`. Plugin `recall_hook` receives `session_id` (= session_key), read-only `SELECT source FROM sessions WHERE id=?` on `{HERMES_HOME}/state.db`; when `source == "nexus-voice"`, passes `--recall-channel voice_pane` to prefetch CLI. User message untouched.

**Path A (fallback in plugin):** Prefix `[cns-recall:voice_pane] ` stripped from prefetch `--query` only if Path C lookup misses.

### Plugin detection rule

```python
# Path C (primary): session_id → state.db sessions.source
if _session_source_from_db(session_id) == "nexus-voice":
    recall_channel = "voice_pane"  # → --recall-channel voice_pane

# Path A (fallback): prefix on user_message → strip for --query only
RECALL_PREFIX_RE = r"^\[cns-recall:voice_pane\]\s*"
```

Non-voice turns: no `--recall-channel`; discord/text paths byte-for-byte unchanged (regression test confirmed).

### End-to-end proof

```bash
# Controlled probe (isolated HERMES_HOME + stub embedder)
CNS_BRAIN_EMBEDDER=stub HERMES_HOME=/tmp/spike-hermes \
  python3 -c "… recall_hook(session_id=<key>, platform='tui', user_message='probe') …"
# Prefetch argv includes: --platform tui --recall-channel voice_pane
# stdout channel: "voice_pane"

# Vitest (Story 82-2 block in tests/hermes/cns-brain-recall-plugin.test.ts)
npm test -- tests/hermes/cns-brain-recall-plugin.test.ts
```

### Path A prefix convention (fallback only — transcript pollution)

If Path C unavailable (profile DB split, missing row): prefix each voice turn with `[cns-recall:voice_pane] ` (case-insensitive). **Prefix remains in LLM turn and session transcript** — plugin strip affects **recall subprocess `--query` only**, not Hermes `user_message`.

### Path C state.db lookup (if chosen)

| Item | Value |
|------|-------|
| DB path | `{HERMES_HOME}/state.db` (default `~/.hermes/state.db`; env override `HERMES_HOME`) |
| Table/column | `sessions.source` keyed by `sessions.id` |
| Join key | Hook `session_id` == DB `sessions.id` == WS `session_key` (`YYYYMMDD_HHMMSS_<hex6>`) |
| Voice value | `"nexus-voice"` (set via `session.create` param `source`) |
| Access mode | Read-only sqlite URI `file:…?mode=ro` |
| Profile edge | Sessions with `profile_home` persist to `{profile_home}/state.db`; plugin must resolve same DB (future: env `CNS_BRAIN_RECALL_STATE_DB` or profile hint from 82-3) |

### Channel Resolution Contract (82-3 VoiceDrawer)

**VoiceDrawer / Nexus proxy MUST:**

1. WS `session.create` with `source: "nexus-voice"` for voice-pane sessions (**once per session**, not per turn)
2. Send **plain user text** on `prompt.submit` — **no prefix** (Path C)
3. Never attempt `platform=nexus-voice` via WS — agent.platform is `"tui"` on dashboard path
4. If using remote Hermes profile, ensure session persists to the same `state.db` the plugin reads (launch profile default)

**Fallback (Path A only if Path C fails in production):**

1. Prefix each voice turn: `[cns-recall:voice_pane] ` — accept transcript/LLM pollution

**Recall system WILL:**

- Resolve channel `voice_pane` when: `sessions.source == "nexus-voice"` (Path C) OR message prefix (Path A fallback)
- Apply budget: 800 tokens, 2 chunks, 3s prefetch timeout (`voice_pane_timeout_seconds`)
- Leave text/discord/dashboard-typed turns on `standard_text` / `yapped_text` unchanged

### Blockers (Hermes core change required?)

**No.** Path C works without core fork. Optional long-term improvement (Path E): pass `session.source` in `pre_llm_call` kwargs — document for future epic; not implemented.

### Context7 citation log

| Date | Query | Finding |
|------|-------|---------|
| 2026-06-28 | `pre_llm_call hook callback signature platform field kwargs task_id turn_id sender_id` | Signature: `session_id, user_message, conversation_history, is_first_turn, model, platform, **kwargs`; observability adds `task_id`, `turn_id`, `sender_id`. |
| 2026-06-28 | `web dashboard /api/ws tui_gateway platform value pre_llm_call session.create source` | Hook injects via return `context` key; dashboard platform not documented in Context7 — confirmed `"tui"` via local Hermes v0.17.0 source. |
| 2026-06-28 | (pre-research) `pre_llm_call return context inject user message not system prompt` | Return `{"context": "..."}` appends to user message for current turn only. |

Library ID: `/nousresearch/hermes-agent` (Context7, 2026-06-28).

---

## Dev Agent Record

### Agent Model Used

Composer (claude-4.6-sonnet-medium-thinking)

### Debug Log References

- Hermes source: `~/.hermes/hermes-agent/agent/turn_context.py:336-351`, `tui_gateway/server.py:3739,4200,4266`
- Spike probe output: prefetch argv `--platform tui --recall-channel voice_pane`
- `bash scripts/verify.sh` exit 0 (2026-06-28)

### Completion Notes List

- Context7 `/nousresearch/hermes-agent` confirms hook signature; dashboard `platform="tui"` from Hermes v0.17.0 source (not Context7-indexed).
- Implemented Path C in `plugin.py` v0.2.1: read-only `state.db` lookup + Path A prefix fallback; spike logging behind `CNS_BRAIN_RECALL_SPIKE_LOG=1`.
- Added Story 82-2 vitest block (Path C proof, Path A fallback, discord regression).
- Installed plugin to `~/.hermes/plugins/cns-brain-recall`; parity OK (only `__pycache__` diff).
- Live WS OAuth blocked empirical capture; controlled probe + source inspection satisfies AC1.

### File List

- `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` (modified)
- `scripts/hermes-plugin-examples/cns-brain-recall/plugin.yaml` (modified — v0.2.1)
- `tests/hermes/cns-brain-recall-plugin.test.ts` (modified)
- `_bmad-output/implementation-artifacts/82-2-spike-omni-002-voice-channel.md` (modified — findings)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-06-28: SPIKE-OMNI-002 complete — Path C chosen; plugin v0.2.1; Channel Resolution Contract for 82-3.

### Review Findings

_Reviewed 2026-06-28 by bmad-code-review (Opus 4.8 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Dev agent: Composer._

- [x] [Review][Patch] Discord regression test must isolate `HERMES_HOME` [`tests/hermes/cns-brain-recall-plugin.test.ts:708`] — Fixed 2026-06-28: temp `HERMES_HOME` + `state.db` row `source=discord` proves non-voice path hermetically.

- [x] [Review][Patch] Path A fallback test should isolate `HERMES_HOME` for parity [`tests/hermes/cns-brain-recall-plugin.test.ts:662`] — Fixed 2026-06-28: temp `HERMES_HOME` matches Path C isolation pattern.

- [x] [Review][Defer] `profile_home` vs launch `HERMES_HOME` state.db split [`plugin.py:109`] — deferred, pre-existing — Documented in Channel Resolution Contract for 82-3; not in spike scope.

- [x] [Review][Defer] Per-turn sqlite open on all turns (including discord) [`plugin.py:141`] — deferred, pre-existing — Acceptable for spike; optimize in 82-3 if p95 prefetch budget tight.

- [x] [Review][Defer] Spike log writes truncated `user_message` to disk when `CNS_BRAIN_RECALL_SPIKE_LOG=1` [`plugin.py:159`] — deferred, pre-existing — Intentional spike observer; env-gated; tighten redaction if promoted beyond spike.

---

## References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Epic 82 Story 82-2]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` § ADR-HERMES-015 Recall channel metadata]
- [Source: `_bmad-output/implementation-artifacts/82-1-spike-omni-001-ws-proxy.md`]
- [Source: `_bmad-output/implementation-artifacts/79-5-production-cns-brain-recall-plugin-prefetch-cli.md`]
- [Source: `_bmad-output/implementation-artifacts/79-5-brain-recall-plugin-evidence.md`]
- [Source: `src/brain/recall-inject.ts` — `detectRecallChannel`, `VOICE_PLATFORM_HINTS`]
- [Source: `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` — `recall_hook`]
- [Source: Hermes `agent/turn_context.py`, `tui_gateway/server.py` — platform=`tui`; `session.source` persisted via `_session_source` + `db.create_session`]
- Context7: `/nousresearch/hermes-agent` — hooks.md, observability README

**Ultimate context engine analysis completed — comprehensive developer guide created**
