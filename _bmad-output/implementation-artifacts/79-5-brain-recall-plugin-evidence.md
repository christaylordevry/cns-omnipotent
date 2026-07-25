# Story 79-5 — Production `cns-brain-recall` plugin + prefetch CLI evidence

**Story:** `79-5-production-cns-brain-recall-plugin-prefetch-cli`  
**Operator:** Chris  
**Date:** 2026-06-26  
**Hermes WSL version:** v0.17.0 (2026.6.19)  
**Branch:** `hermes-consolidation`  
**Baseline commit:** `94c6c75`

> **Redaction policy (NFR4):** No tokens, passwords, API keys, or OAuth client secrets below.

---

## AC — Context7 `pre_llm_call` return shape + kwargs — PASS

Context7 `/nousresearch/hermes-agent` confirms hook callback signature includes **`user_message`** and **`platform`**:

```python
def my_callback(session_id: str, user_message: str, conversation_history: list,
                is_first_turn: bool, model: str, platform: str, **kwargs):
```

Return contract:

```python
return {"context": "..."}  # appended to user message at API-call time
return None / {}           # no injection (observer-only or shadow empty)
```

Production `plugin.py` reads `user_message` (not a different kwarg). Shadow path returns `{}` when `shadow: true` in prefetch JSON.

---

## AC — `pre_llm_call` hook probe via `user_message` (real subprocess) — PASS

Vitest integration test `recall_hook end-to-end passes user_message to prefetch CLI` runs the **real** prefetch subprocess (no mock) with:

- Query: `Hermes pre_llm_call hook probe for Story 79-5 evidence.`
- `recall_hook(user_message=query, platform="discord", session_id="probe-s")`
- Stub index + vault fixture; `CNS_NODE_BIN` set to resolved node path

**Result:** hook returns `{}` (shadow_mode), prefetch stderr contains `[cns-brain-recall:shadow]` would-inject block with citation `notes/hook-probe.md` — proves `user_message` reaches `buildRecallInjection` through the plugin path.

```text
$ npm run test:vitest -- tests/hermes/cns-brain-recall-plugin.test.ts
✓ recall_hook end-to-end passes user_message to prefetch CLI (shadow + real citations)
12 passed
```

---

## AC — Prefetch timeout policy (fail-open) — PASS

Policy defaults in `config/brain-recall-policy.json`:

```json
"prefetch": {
  "timeout_seconds": 5,
  "voice_pane_timeout_seconds": 3
}
```

Env overrides: `CNS_BRAIN_RECALL_PREFETCH_TIMEOUT_S`, `CNS_BRAIN_RECALL_VOICE_PREFETCH_TIMEOUT_S`.

Live resolution on WSL gateway host:

```text
node_bin: /home/christ/.nvm/versions/node/v24.14.0/bin/node
timeouts: (5.0, 3.0)
timeout_discord: 5.0
timeout_voice: 3.0
```

`recall_hook` wraps body in `try/except Exception` → `{}`; `subprocess.TimeoutExpired` and `OSError` (node missing) handled inside `_run_prefetch`.

---

## AC — Node binary resolution (gateway PATH) — PASS

Plugin resolves node via `CNS_NODE_BIN` / `NODE_BIN`, then latest NVM `~/.nvm/versions/node/*/bin/node` (same pattern as `scripts/run-awareness-pull-cron.sh`), then `shutil.which("node")`.

On live WSL (Hermes gateway host): resolves to `/home/christ/.nvm/versions/node/v24.14.0/bin/node`.

Operator should set `CNS_NODE_BIN` in `~/.hermes/.env` if systemd/cron gateway PATH lacks nvm.

---

## AC — Install script — PASS

```text
$ bash scripts/install-hermes-plugin-cns-brain-recall.sh
Installed Hermes plugin to: /home/christ/.hermes/plugins/cns-brain-recall
Next: hermes plugins enable cns-brain-recall
Config snippet: /home/christ/.hermes/plugins/cns-brain-recall/references/config-snippet.md
```

---

## AC — `hermes plugins enable` + list — PASS

```text
$ hermes plugins enable cns-brain-recall
✓ Plugin cns-brain-recall enabled. Takes effect on next session.

$ hermes plugins list  (excerpt)
│ cns-brain-recall     │ enabled     │ 0.2.0   │ CNS Brain recall —  │ user    │
```

Plugin version **0.2.0** (production wiring; replaces 79-1 probe 0.1.0).

---

## AC — Shadow-mode prefetch CLI probe (logs, no inject) — PASS

Policy: `config/brain-recall-policy.json` → `"shadow_mode": true` (Story 79-5 ships shadow until 79-4 calibration gate).

Prefetch CLI with stub index + vault fixture:

```text
$ CNS_BRAIN_EMBEDDER=stub node scripts/brain-recall-prefetch.mjs \
    --query "Shadow probe recall body for Story 79-5 evidence." \
    --index-path <tmp>/brain-index.json \
    --vault-root <tmp>/vault

=== stdout ===
{"context":null,"citations":[{"path":"notes/shadow-probe.md","score":0.25}],"channel":"standard_text","shadow":true}

=== stderr (would-inject block — NOT injected) ===
[cns-brain-recall:shadow] would-inject channel=standard_text policy=0.1.0
<!-- cns-brain-recall policy_version=0.1.0 channel=standard_text -->

### vault:notes/shadow-probe.md (score: 0.250)

Shadow probe recall body for Story 79-5 evidence.
```

**Result:** `context` is `null` on stdout (Hermes receives no inject). Full cited block logged to stderr only — FR19 shadow behavior.

---

## AC — Repo-to-installed parity (`diff -rq`) — PASS

```text
$ diff -rq scripts/hermes-plugin-examples/cns-brain-recall \
    ~/.hermes/plugins/cns-brain-recall --exclude='__pycache__'
(no differences)
```

Re-run after code-review patches (2026-06-26): exit 0, no differences.

---

## AC — Reversibility (NFR5) — PASS

```text
$ hermes plugins disable cns-brain-recall
Plugin 'cns-brain-recall' is already disabled.   # or: disabled successfully

$ hermes plugins enable cns-brain-recall
✓ Plugin cns-brain-recall enabled. Takes effect on next session.
```

Additional rollback without uninstall: set `shadow_mode: true` in `config/brain-recall-policy.json` (current default for this story).

---

## AC — Required operator env (redacted keys only)

| Env var | Purpose |
|---------|---------|
| `CNS_OMNIPOTENT_ROOT` | Path to Omnipotent.md repo (prefetch script) |
| `CNS_BRAIN_INDEX_PATH` | Absolute path to `brain-index.json` |
| `CNS_VAULT_ROOT` | Knowledge-Vault-ACTIVE root |
| `CNS_BRAIN_EMBEDDER` | `stub` or `portal` — must match index build |
| `CNS_NODE_BIN` | Explicit node path when gateway PATH lacks nvm (recommended in `~/.hermes/.env`) |
| `CNS_BRAIN_RECALL_PREFETCH_TIMEOUT_S` | Optional override of policy `prefetch.timeout_seconds` (default 5) |
| `CNS_BRAIN_RECALL_VOICE_PREFETCH_TIMEOUT_S` | Optional override for `nexus-voice` (default 3) |

No secrets recorded in this evidence file.

---

## AC — Protect-list + no core fork — PASS

- No edits to protect-list paths (`src/agents/*`, `run-chain.ts`, etc.)
- No edits under `~/.hermes/hermes-agent/`
- Plugin lives at `~/.hermes/plugins/cns-brain-recall/` only

---

## AC — Verify gate — PASS

```text
$ bash scripts/verify.sh
Factory verify gate — PASS (2026-06-26, post code-review patches)
$ npm run test:vitest -- tests/hermes/cns-brain-recall-plugin.test.ts — 12/12 PASS
```

---

## Gate note (Story 79-4)

Live injection (`shadow_mode: false`) is **not** enabled by this story. Operator enables after `_bmad-output/implementation-artifacts/79-4-calibration-pass.md` or documented waiver.

**Forward flag (deferred):** Per-turn node cold-start + index load + Portal embed latency — measure at 79-4 live cutover; consider persistent helper if p95 exceeds budget.
