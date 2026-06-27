# Story 74-2 — Portal OAuth + Provider Switch Evidence

**Story:** `74-2-portal-oauth-login-and-provider-switch`  
**Operator:** Chris  
**Date completed:** 2026-06-24  
**Hermes version:** v0.17.0 (2026.6.19)

> **Redaction policy (NFR4):** No refresh tokens, JWT material, or `auth.json` contents recorded below.

---

## AC #1 — Pre-4 Portal subscription (FR-GATE)

| Field | Value |
|-------|-------|
| Paid tier confirmed | **Yes** — $30 paid tier |
| Confirmation date | 2026-06-24 |
| Tool Gateway | Active (operator saw picker on upgrade screen) |
| Notes | No payment secrets recorded |

---

## Baseline (pre-switch, captured 2026-06-24)

```text
hermes --version
Hermes Agent v0.17.0 (2026.6.19)

hermes portal info
  Auth:    not logged in
  Model:   currently openai-codex

model.provider → openai-codex (via config.yaml)
model.default  → gpt-5.4-mini

~/.hermes/config.yaml model.base_url → https://chatgpt.com/backend-api/codex

hermes auth list → openai-codex (device_code); no nous entry
```

**v0.17 note:** `hermes config get` subcommand does not exist — use `hermes config show` or `grep` on `~/.hermes/config.yaml`.

---

## AC #2 — Portal OAuth login

**Command:**

```bash
hermes auth add nous --type oauth --manual-paste
```

### Evidence

```text
hermes portal info (post-OAuth):
  Auth: ✓ logged in
  Nous inference provider

stat -c '%a %n' ~/.hermes/auth.json → 600

Flow: device_code (gio loopback error cosmetic — token saved successfully)
```

---

## AC #3 — Provider switch + default model

**Commands:**

```bash
hermes config set model.provider nous
hermes model   # selected anthropic/claude-sonnet-4.6
grep -A4 '^model:' ~/.hermes/config.yaml
hermes portal info
```

### Evidence

```text
model.provider: nous
model.default: anthropic/claude-sonnet-4.6
model.base_url: https://inference-api.nousresearch.com/v1

hermes portal info: ✓ using Nous as inference provider

Config verification: grep on ~/.hermes/config.yaml + portal info
(v0.17 has no `hermes config get` — use `hermes config show` or grep)
```

---

## AC #4 — Smoke inference

**Command:**

```bash
hermes -z "Reply with exactly: portal-smoke-ok"
```

### Evidence

```text
Response: portal-smoke-ok  ✅
Inference via Portal (nous provider) — no openai-codex / Cloudflare errors
```

---

## AC #5 — Fallback governance

```text
Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md
  → Hermes agent surface (Epic 74 — Portal primary) subsection appended
  → Rollback commands documented; Epic 15 IDE routing preserved
```

---

## Scope verification (AC #6–#7)

```text
git diff: no .env, .env.live-chain, auth.json, or protect-list paths
protect-list (synthesis/hook/boss adapters, run-chain): zero diffs
bash scripts/verify.sh: PASS (2026-06-24)
```

---

## Completion checklist

- [x] AC #1 Pre-4 subscription recorded
- [x] AC #2 OAuth complete + portal info logged in
- [x] AC #3 provider nous + Sonnet 4.6 default
- [x] AC #4 smoke inference succeeded
- [x] AC #5 routing.md subsection present
- [x] AC #6 no secrets in git diff
- [x] AC #7 verify.sh green; protect-list untouched
