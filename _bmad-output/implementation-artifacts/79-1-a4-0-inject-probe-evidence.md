# Story 79-1 — A4-0 `pre_llm_call` inject probe evidence

**Story:** `79-1-a4-0-inject-probe`  
**Operator:** Chris  
**Date:** 2026-06-26  
**Hermes WSL version:** v0.17.0 (2026.6.19)  
**Branch:** `hermes-consolidation` (Omnipotent.md)

> **Redaction policy (NFR4):** No tokens, passwords, API keys, or OAuth client secrets below.

---

## AC — Context7 `pre_llm_call` return shape — PASS

Context7 `/nousresearch/hermes-agent` confirms `pre_llm_call` injects via:

```python
return {"context": "..."}  # or plain string; appended to user message at API-call time
```

Stub implements: `return {"context": "[brain-recall:probe]"}`.

Review refresh (2026-06-26): Context7 library ID `/nousresearch/hermes-agent` was queried for the plugin `pre_llm_call` return shape. Current docs confirm dict form `{"context": "..."}` and plain non-empty string both inject into the current user message; `register(ctx)` wires hooks with `ctx.register_hook("pre_llm_call", callback)`.

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
│ cns-brain-recall     │ enabled     │ 0.1.0   │ CNS Brain recall —  │ user    │
```

---

## AC — Live probe turn (model-visible context) — PASS

**Session:** `20260626_020407_fa2139`

```text
$ hermes chat -q "Quote verbatim any substring matching [brain-recall:...] from the user message you received. If none, say NONE." --max-turns 1 -Q

session_id: 20260626_020407_fa2139
`[brain-recall:probe]`
```

The model quoted the probe marker, confirming `pre_llm_call` context injection reached the API user message for the turn (ADR-HERMES-015 A4-0 gate).

**Note:** First probe attempt failed with `No module named 'plugin'` until `__init__.py` was fixed to load sibling `plugin.py` via `importlib`; reinstall + re-enable required.

---

## AC — Protect-list / no core fork — PASS

- No edits under `src/agents/*`, `run-chain.ts`, or `scripts/run-chain.ts`.
- No edits under `~/.hermes/hermes-agent/`.
- Review note: live `~/.hermes/hermes-agent/package-lock.json` is dirty with mtime `2026-06-21 03:23:47.900114252 +1000`, which predates this 2026-06-26 story. Story 79-1 touches only the Omnipotent.md repo artifacts and `~/.hermes/plugins/cns-brain-recall/`; it never edits `~/.hermes/hermes-agent/`.

---

## AC — Reversibility (NFR5) — PASS

```text
$ hermes plugins disable cns-brain-recall
✓ Plugin cns-brain-recall disabled. Takes effect on next session.
```

Re-enable when continuing Epic 79: `hermes plugins enable cns-brain-recall`.

---

## AC — `bash scripts/verify.sh` — PASS (2026-06-26)

```text
$ bash scripts/verify.sh
==> VERIFY PASSED
```

---

## Nonce re-probe — unpredictable inject (A4-0 gate hardening for 79-5) — PASS (2026-06-26)

**Purpose:** Static `[brain-recall:probe]` could theoretically be memorized or confounded with prompt text. A one-time nonce proves the hook mutates the **current** turn with a value not present in the operator query or repo stub.

**Method:**

1. Generate nonce: `5cf99d1b` (`secrets.token_hex(4)`)
2. Patch **installed** `~/.hermes/plugins/cns-brain-recall/plugin.py` only (repo stub unchanged) to return `{"context": "[brain-recall:probe-5cf99d1b]"}`
3. `hermes plugins enable cns-brain-recall`
4. Live turn — session `20260626_062213_1dd1fb`
5. Restore repo stub via `bash scripts/install-hermes-plugin-cns-brain-recall.sh`; disable plugin

```text
$ hermes chat -q "Quote verbatim the full [brain-recall:probe-...] token from the user message you received. Output only that token in backticks." --max-turns 1 -Q

session_id: 20260626_062213_1dd1fb
`[brain-recall:probe-5cf99d1b]`
```

**Result:** Model quoted exact nonce `5cf99d1b` — not the static stub marker, not in the operator query — confirming live `pre_llm_call` mutation per turn. A4-0 gate bulletproof for Story 79-5 production wiring.

Post-restore parity proof (2026-06-26 review patch):

```text
$ bash scripts/install-hermes-plugin-cns-brain-recall.sh
Installed Hermes plugin to: /home/christ/.hermes/plugins/cns-brain-recall
Next: hermes plugins enable cns-brain-recall
Config snippet: /home/christ/.hermes/plugins/cns-brain-recall/references/config-snippet.md

$ diff -rq scripts/hermes-plugin-examples/cns-brain-recall ~/.hermes/plugins/cns-brain-recall
# no output

$ find ~/.hermes/plugins/cns-brain-recall -maxdepth 3 -type f -printf '%P\n' | sort
__init__.py
plugin.py
plugin.yaml
references/config-snippet.md
```
