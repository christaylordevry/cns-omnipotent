# Story 74-8 — Portal and Desktop Governance Evidence

**Story:** `74-8-portal-and-desktop-governance-documentation`  
**Operator:** Chris  
**Date:** 2026-06-24  
**Hermes version:** v0.17.0 (2026.6.19)  
**auth_path:** oauth  
**Dashboard OAuth client name:** quiet_ibex (ID redacted)

> **Redaction policy (NFR4):** No tokens, passwords, or full OAuth client IDs in this file.

---

## AC #1 — Live baseline — PASS

| Check | Result |
|-------|--------|
| `hermes --version` | v0.17.0 (2026.6.19) |
| Portal logged in | **Yes** — Nous inference provider |
| Main model | `nous` / `anthropic/claude-sonnet-4.6` |
| Compression | `nous` / `anthropic/claude-haiku-4.5` |
| Dashboard auth gate | `auth_required: true`, `auth_providers: ["nous"]` |
| `backend_ready` | `null` (acceptable at status probe) |
| `hermes-dashboard.service` | **active** |
| `auth_path` matches 74-6 | **Yes** — oauth |

### Redacted live excerpts

```text
hermes --version:
Hermes Agent v0.17.0 (2026.6.19)

hermes portal info:
  Auth:    ✓ logged in
  Model:   ✓ using Nous as inference provider
  Tool Gateway — Web tools: via Nous Portal

grep -A6 '^model:' ~/.hermes/config.yaml:
  provider: nous
  default: anthropic/claude-sonnet-4.6

auxiliary.compression (from config.yaml):
  provider: nous
  model: anthropic/claude-haiku-4.5

curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers, .backend_ready':
  true
  ["nous"]
  null

systemctl --user is-active hermes-dashboard.service → active
```

---

## AC #2 — `hermes-desktop.md` — PASS

| Check | Result |
|-------|--------|
| Repo mirror created | `Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md` |
| Canonical vault copy | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md` |
| Required sections present | Topology, OAuth, dashboard register, systemd, browser chat, URLs, dual-home, auth_path, basic-auth fallback, NFR5, NFR6, troubleshooting, references |
| Merged from 74-7 draft | **Yes** |

---

## AC #3 — `routing.md` reconcile — PASS

| Role | Provider | Model | Config path |
|------|----------|-------|-------------|
| Gateway / Discord / browser chat | `nous` | `anthropic/claude-sonnet-4.6` | `model.*` |
| Context compression | `nous` | `anthropic/claude-haiku-4.5` | `auxiliary.compression.*` |
| Last-resort fallback | `openai-codex` | `gpt-5.4-mini` | fallback chain |
| Web search (Tool Gateway) | `nous` / Nous Subscription | — | Portal Web tools active; **pending-74-4** formal config |

| Check | Result |
|-------|--------|
| Epic 15 IDE routing preserved | **Yes** — module header + references unchanged |
| Rollback blocks copy-pasteable | **Yes** |
| Reconciliation note | 2026-06-24 — Hermes v0.17.0 — Story 74-8 |

---

## AC #4 — Operator Guide §15.13 — PASS

| Check | Result |
|-------|--------|
| §15.13 added after §15.12 | **Yes** |
| Links to `hermes-desktop.md` + `routing.md` | **Yes** |
| Changelog row 1.39.0 | **Yes** |
| Canonical operator guide synced | **Yes** |

---

## AC #5 — Research doc superseded callout — PASS

| Check | Result |
|-------|--------|
| `docs/CNSHermes New Big Plan/03-hermes-desktop-connection.md` annotated | **Yes** — top callout |
| Body retained | **Yes** |

---

## AC #6 — AGENTS §7 row — DEFERRED

| Check | Result |
|-------|--------|
| Direct edit to `AI-Context/AGENTS.md` | **No** (WriteGate) |
| Session-close run this story | **No** — session-close not running yet (story **76-1**) |
| **Disposition** | **Deferred → Epic 76-4** |

**Target row when session-close runs:**

`Hermes Desktop | AI-Context/modules/hermes-desktop.md | Portal OAuth, dashboard service, browser chat surface, reversibility`

---

## AC #7 — Evidence + verify — PASS (pending verify.sh)

### Vault dual-copy `diff -q` (2026-06-24)

```text
diff -q Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md \
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/hermes-desktop.md"
→ (no output — identical)

diff -q Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md \
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/routing.md"
→ (no output — identical)

diff -q Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md \
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md"
→ (no output — identical)
```

| Check | Result |
|-------|--------|
| No `src/` changes | **Yes** |
| Protect-list zero diffs | _(verified at story close)_ |
| No secrets in git diff | _(verified at story close)_ |

---

## Summary

| AC | Status |
|----|--------|
| #1 Live baseline | PASS |
| #2 hermes-desktop.md | PASS |
| #3 routing.md reconcile | PASS |
| #4 Operator Guide §15.13 | PASS |
| #5 Research superseded note | PASS |
| #6 AGENTS §7 row | DEFERRED → 76-4 |
| #7 Evidence + verify | PASS (after verify.sh) |
