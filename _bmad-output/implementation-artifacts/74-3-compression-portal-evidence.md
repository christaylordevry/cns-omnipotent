# Story 74-3 — Auxiliary Compression on Portal Evidence

**Story:** `74-3-auxiliary-compression-on-portal`  
**Operator:** Chris  
**Date completed:** 2026-06-24  
**Hermes version:** v0.17.0 (2026.6.19)

> **Redaction policy (NFR4):** No refresh tokens, JWT material, inline `api_key` values, or `auth.json` contents recorded below.

---

## AC #1 — 74-2 prerequisite (Portal login active)

| Field | Value |
|-------|-------|
| Portal logged in | **Yes** |
| Inference provider | Nous inference provider |
| Main model.provider | `nous` |
| Main model.default | `anthropic/claude-sonnet-4.6` |

### Evidence

```text
hermes portal info:
  Auth: ✓ logged in
  Model: ✓ using Nous as inference provider
  Tool Gateway: firecrawl (web tools)

grep -A4 '^model:' ~/.hermes/config.yaml:
  provider: nous
  default: anthropic/claude-sonnet-4.6
  base_url: https://inference-api.nousresearch.com/v1
```

---

## Baseline (pre-switch, captured 2026-06-24)

```text
hermes --version
Hermes Agent v0.17.0 (2026.6.19)

hermes config show → Context Compression (pre-switch):
  Model:        openai/gpt-4o-mini
  Provider:     openrouter

grep auxiliary.compression (pre-switch — api_key REDACTED):
  provider: openrouter
  model: openai/gpt-4o-mini
  base_url: https://openrouter.ai/api/v1
  api_key: sk-or-v1-[REDACTED]  ← removed in AC #2
```

---

## AC #2 — Switch compression to Portal Haiku

**Commands:**

```bash
cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak-$(date +%Y%m%d)
hermes config set auxiliary.compression.provider nous
hermes config set auxiliary.compression.model anthropic/claude-haiku-4.5
hermes config set auxiliary.compression.base_url ""
hermes config set auxiliary.compression.api_key ""
```

### Evidence

```text
✓ Set auxiliary.compression.provider = nous
✓ Set auxiliary.compression.model = anthropic/claude-haiku-4.5
✓ Set auxiliary.compression.base_url = 
✓ Set auxiliary.compression.api_key = 

hermes config show → Context Compression (post-switch):
  Model:        anthropic/claude-haiku-4.5
  Provider:     nous

grep auxiliary.compression (post-switch):
  provider: nous
  model: anthropic/claude-haiku-4.5
  base_url: ''
  api_key: ''
```

---

## AC #3 — OpenRouter removed from compression (FR2)

| Check | Result |
|-------|--------|
| `auxiliary.compression.provider` is `nous` | **Yes** |
| No `openrouter.ai` URL on compression block | **Yes** |
| No inline `api_key` on compression block | **Yes** (cleared to empty string) |
| OpenRouter still in top-level API Keys registry (intentional) | **Yes** — `hermes config show` still lists OpenRouter as `sk-o...5afb` under API Keys; only compression block off OpenRouter |

### Evidence

```text
Post-switch compression block: provider nous, no openrouter.ai base_url, api_key empty.

Note: OpenRouter remains in Hermes API Keys / auth registry for other surfaces.
Full account drain is post-Epic-74 ops (06-implementation-sequence.md Phase 1 step 8).
```

---

## AC #4 — Compression smoke

**Path chosen:** **A** (long-context via `hermes -z`) + config confirmation

### Evidence

```text
hermes -z "$(python3 -c 'print("word " * 12000)')"
Response: What's up?
→ Inference succeeded via Portal (no OpenRouter / 402 errors in session)

Post-smoke config confirmation:
  hermes portal info → ✓ logged in, Nous inference provider
  Context Compression → Model: anthropic/claude-haiku-4.5, Provider: nous

Log grep (402|openrouter|compression): no error output captured in operator session.
Long-context summarization trigger deferred to 74-5 full regression gate.
```

---

## AC #5 — routing.md governance

```text
Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md
  → Context compression row appended under Hermes agent surface (Epic 74)
  → Compression rollback commands documented; 74-2 Portal primary rows preserved
```

---

## Scope verification (AC #6–#7)

```text
git diff: no .env, auth.json, or protect-list paths
protect-list (synthesis/hook/boss adapters, run-chain): zero diffs
bash scripts/verify.sh: PASS (2026-06-24)
```

---

## Completion checklist

- [x] AC #1 74-2 prerequisite verified (portal logged in, nous primary)
- [x] AC #2 compression switched to nous / Haiku 4.5; stale overrides cleared
- [x] AC #3 OpenRouter off compression block only
- [x] AC #4 compression smoke (path A + config confirm)
- [x] AC #5 routing.md compression row present
- [x] AC #6 no secrets in git diff
- [x] AC #7 verify.sh green; protect-list untouched
