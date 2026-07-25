# Story 83-1 — Honcho dialectic configuration evidence

**Story:** `83-1-honcho-dialectic-configuration`  
**Date:** 2026-07-05 (AEDT)  
**Operator approval:** 2026-07-05 — workspace `cns-jarvis`, peerName `chris`, pinUserPeer true, contextTokens 1200, dialecticDepth 1, dialecticReasoningLevel low, **dialecticCadence 3** (revision)

---

## Hermes baseline

```
Hermes Agent v0.17.0 (2026.6.19)
Portal: ✓ logged in — Nous inference provider
Prior memory.provider: '' (empty)
Post-change memory.provider: honcho
```

Config backup: `~/.hermes/config.yaml.bak-2026-07-05-83-1`

---

## Applied configuration (redacted)

### `~/.hermes/config.yaml` (memory + plugins excerpt)

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: false
  memory_char_limit: 2200
  user_char_limit: 1375
  provider: honcho
  nudge_interval: 10
  flush_min_turns: 6
honcho: {}
plugins:
  enabled:
  - cns-brain-recall
  disabled: []
```

### `~/.hermes/honcho.json` (no apiKey — env only)

`dialecticCadence` is read by the runtime at the **top level** of `honcho.json` (`cfg.raw.get('dialecticCadence')` in `plugins/memory/honcho/__init__.py:320`); it is **not** extracted from the `hosts.hermes` block. As originally written (nested under `hosts.hermes` only), it was inert and the runtime defaulted to cadence 1 (dialectic every turn, ~3× cost). Fixed by hoisting `dialecticCadence: 3` to the top level; verified runtime effective cadence: 3 and `hermes honcho status` → `Dialectic cad: every 3 turns`.

```json
{
  "dialecticCadence": 3,
  "hosts": {
    "hermes": {
      "enabled": true,
      "aiPeer": "hermes",
      "peerName": "chris",
      "workspace": "cns-jarvis",
      "recallMode": "hybrid",
      "writeFrequency": "async",
      "sessionStrategy": "global",
      "contextCadence": 1,
      "contextTokens": 1200,
      "dialecticCadence": 3,
      "dialecticDepth": 1,
      "dialecticReasoningLevel": "low",
      "dialecticDynamic": true,
      "dialecticMaxChars": 600,
      "saveMessages": true,
      "pinUserPeer": true,
      "observation": {
        "user": { "observeMe": true, "observeOthers": true },
        "ai": { "observeMe": true, "observeOthers": true }
      }
    }
  }
}
```

CLI applied: `hermes config set memory.provider honcho`

---

## Honcho connection status

```
hermes honcho status (2026-07-05, post-live):
  Host:           hermes
  Enabled:        True
  API key:        set (env — redacted)
  Workspace:      cns-jarvis
  Config:         /home/christ/.hermes/honcho.json
  AI peer:        hermes
  User peer:      chris
  Session strat:  global
  Recall mode:    hybrid
  Context budget: 1200 tokens
  Dialectic cad:  every 3 turns
  Reasoning:      base=low, cap=high, heuristic=on
  Connected (managed cloud)
```

`HONCHO_API_KEY` set in `~/.hermes/.env` (value redacted). Gateway restarted; `hermes honcho status` reports connected. `hermes doctor` Honcho check passes post-credential.

---

## Cost lever (dialectic tuning)

Per Story 57-4 eval, Honcho managed API dialectic queries cost roughly **~$0.001–$0.50 per query** depending on `dialecticReasoningLevel` and dynamic scaling.

| Knob | Active value | Cost effect |
|------|--------------|-------------|
| `dialecticCadence` | **3** | Dialectic fires every 3 turns (cheaper than default 2) |
| `dialecticReasoningLevel` | `low` | Caps base reasoning cost per `.chat()` pass |
| `dialecticDynamic` | `true` | Allows model to request higher reasoning on long queries (+cost on those turns only) |
| `dialecticDepth` | `1` | Single pass per dialectic cycle (no multi-pass audit/reconcile) |
| `contextTokens` | `1200` | Caps injected Honcho context size per turn |

**Raise cost later:** lower `dialecticCadence` (e.g. 2 or 1), raise `dialecticDepth` or `dialecticReasoningLevel`. **Lower cost:** raise cadence, set `dialecticDynamic: false`, or switch `recallMode: tools` (no auto-inject).

Ingestion pricing (separate): ~$2/M tokens of message content (~$0.001 minimum per call) per 57-4.

---

## Managed → self-host migration

**v1.5 posture:** Managed Honcho cloud (`api.honcho.dev`) via `HONCHO_API_KEY`. Self-host **deployment** is a future story; this subsection documents the **config escape hatch** only.

### What stays identical

- `memory.provider: honcho`
- `plugins.enabled: [cns-brain-recall]` — Brain recall unchanged
- `hosts.hermes` identity: `peerName`, `workspace`, `aiPeer`, `pinUserPeer`, observation block
- Dialectic knobs: `dialecticCadence`, `dialecticDepth`, `dialecticReasoningLevel`, `dialecticDynamic`, `contextTokens`, `recallMode`, `sessionStrategy`
- Native Hermes memory (`memory_enabled`, MEMORY.md, SQLite) — unchanged

### What changes (managed → self-host)

1. **Add `baseUrl`** at honcho.json root (or host block for local-only creds):

```json
{
  "baseUrl": "http://localhost:8000",
  "hosts": {
    "hermes": {
      "enabled": true,
      "aiPeer": "hermes",
      "peerName": "chris",
      "workspace": "cns-jarvis",
      "...": "all other knobs unchanged"
    }
  }
}
```

2. **Swap authentication:**
   - **Remove or comment out** `HONCHO_API_KEY` in `~/.hermes/.env` (cloud key not used against local server).
   - **If** self-hosted Honcho runs with auth enabled (`AUTH_USE_AUTH=true`): paste JWT signed with server `AUTH_JWT_SECRET` into `hosts.hermes.apiKey` in `honcho.json` (separate from cloud root `apiKey` per Hermes docs).
   - **If** `AUTH_USE_AUTH=false`: leave `apiKey` unset; local URLs auto-skip API key auth.

3. **Restart** Hermes gateway / new session.

4. **Verify:** `hermes honcho status` shows `baseUrl` / connected; `hermes doctor` Honcho check passes.

### Rollback from self-host to managed

1. Remove `baseUrl` from `honcho.json`.
2. Restore `HONCHO_API_KEY` in `~/.hermes/.env`.
3. Remove local JWT from `hosts.hermes.apiKey` if set.
4. Restart gateway.

**Reference:** Context7 `/nousresearch/hermes-agent` — `memory-providers.md`, `plugins/memory/honcho/README.md`; `/plastic-labs/honcho` — Hermes integration guide (self-hosted `baseUrl` + optional JWT).

---

## Epic 79 Brain recall — unchanged

| Check | Result |
|-------|--------|
| `plugins.enabled` includes `cns-brain-recall` | ✓ before and after |
| `config/brain-recall-policy.json` `shadow_mode` | `false` (unchanged) |
| Plugin install path | not modified |
| `npm run test:vitest -- tests/hermes/cns-brain-recall-plugin.test.ts` | **22/22 PASS** |

Architecture: Honcho = `MemoryProvider.prefetch_all`; Brain = `pre_llm_call` plugin — orthogonal (ADR-HERMES-015).

Plugin contract verified via vitest e2e hook test (22/22). **AC #3 live verification** below confirms both seams on one gateway turn.

### AC #3 live verification (turn `20260705_230038_7b625e1e`)

Live gateway turn after Honcho activation (2026-07-05 ~23:00 AEDT):

| Event | Log evidence |
|-------|----------------|
| Honcho memory provider registered / activated | Honcho plugin loaded; `memory.provider: honcho` active on turn |
| `cns-brain-recall` on `pre_llm_call` | Brain recall hook fired **same turn** (orthogonal to Honcho `prefetch_all`) |
| Honcho session created | Global session established for user peer `chris` / workspace `cns-jarvis` |

**Seam intact:** Honcho `MemoryProvider.prefetch_all` and Brain `pre_llm_call` both executed on turn `20260705_230038_7b625e1e` — no slot conflict per ADR-HERMES-015.

**Prefetch note:** On this turn `cns-brain-recall` fired on `pre_llm_call` (seam intact) but its **prefetch failed (`rc=1`)** for a **pre-existing Portal-embeddings reason** (`Portal embeddings response missing data[0].embedding` — the Brain embedder, not Honcho; identical failures logged at 13:38/15:55/20:09 before Honcho was activated), so **no vault content was injected**. **Honcho succeeded independently**: session created + `MEMORY.md`/`USER.md` uploaded. This confirms orthogonality — the Portal outage degrades Brain recall but leaves Honcho unaffected, and Honcho leaves the Brain seam firing.

---

## Data egress (v1.5)

On first Honcho session, Hermes uploaded native memory files to managed cloud (`api.honcho.dev`) for user peer `chris`:

- `MEMORY.md`
- `USER.md`

Operator accepted v1.5 egress posture per Story 57-4. No raw vault bodies or `AGENTS.md` routed through Honcho in 83-1.

---

## Rollback (disable Honcho, keep Brain recall)

| Setting | Prior (pre-83-1) | Current |
|---------|------------------|---------|
| `memory.provider` | `''` | `honcho` |
| `~/.hermes/honcho.json` | absent | present |
| `HONCHO_API_KEY` | commented in `.env` | set in `.env` (redacted) |

```bash
hermes config set memory.provider ""
mv ~/.hermes/honcho.json ~/.hermes/honcho.json.disabled-83-1
# comment HONCHO_API_KEY if set
cp ~/.hermes/config.yaml.bak-2026-07-05-83-1 ~/.hermes/config.yaml   # optional full restore
# restart gateway — cns-brain-recall stays in plugins.enabled
```

---

## Verify gate

| Suite | Result |
|-------|--------|
| `npm test` (Omnipotent.md) | **781/781 PASS** |
| `cns-dashboard` `npm test` | **702/702 PASS** |
| `bash scripts/verify.sh` | **PASS** (`==> VERIFY PASSED`; independent re-run 2026-07-05; `notebookQueries.test.ts` 11/11 incl. 100-row cap) |

---

## Out of scope (explicit)

- `memory-pillars-verification.md` Honcho row still **GATED** until operator constitution follow-up
- No edits to `AI-Context/**`, AGENTS.md, MEMORY.md (WriteGate)
- No self-host Honcho server deployment (future story)
- No git commit (operator review)

---

## Context7 sources used

- `/nousresearch/hermes-agent` — memory provider activation, honcho.json schema, prefetch vs pre_llm_call
- `/plastic-labs/honcho` — managed vs self-hosted integration
