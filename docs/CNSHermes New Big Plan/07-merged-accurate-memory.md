# Merged Accurate MEMORY.md
_What both MEMORY files should contain after /session-close runs_
_This is reference content — do NOT paste directly. /session-close generates it._

---

## Why this file exists

Two MEMORY.md files currently diverge:
- `~/.hermes/memories/MEMORY.md` — Hermes cold-start, says Story 53.3 next / 642 tests
- `vault AI-Context/MEMORY.md` — vault copy, says Epics 38+43 in progress

Neither reflects current reality. This document records what accurate
content would look like, so the session-close output can be verified
and any gaps caught immediately.

---

## What accurate MEMORY.md should contain

Both files should converge to the same state after `/session-close`.
The Hermes copy (`~/.hermes/memories/MEMORY.md`) is what matters most
for agent cold-start context.

### Accurate content

```markdown
## CNS State (auto — /session-close)
Closed: [timestamp of next session-close] | AGENTS v2.1.43 | failure_class: [tests or none]
Hermes: v0.17.0 | provider: nous / anthropic/claude-sonnet-4.6
Epics: 1–71 done. 72: done (72-1–72-8 all complete). 73: in-progress (73-1–73-6 done, 73-7 in-progress).
Tests: 1317 pass / [0 or 7] fail
Vault: 632 notes | lint 2026-06-02: 0 errors, 3 warnings | STALE >21d — run /vault-lint
Dashboard: cns-dashboard-three.vercel.app | Entity Intelligence live

## Last Session Decisions
- Epic 72 complete: source adapters — TikTok, Instagram, Pinterest, Polymarket, Threads, LinkedIn
- Epic 73: Entity Intelligence shipped — Convex schema, extraction, pipeline, dashboard UI (73-1–73-6)
- Epic 70: Morning digest moved to deterministic Node orchestrator (no Hermes agent in cron path)
- Provider: moved to Nous Portal (nous / anthropic/claude-sonnet-4.6) from openai-codex
- Hermes Desktop: dashboard service installed, Windows Desktop connected via http://localhost:9119
- run-chain: proxy path via hermes proxy :8645/v1, adapters migrated

## Environment
- Gateway: WSL @reboot cron — active
- Dashboard: systemd user unit hermes-dashboard.service — :9119
- Proxy: hermes proxy start — :8645/v1 (for run-chain)
- Vault MCP: cns_vault_io live child of gateway
- Vault: /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/
- Nous Portal: logged in, Tool Gateway active

## Next Session
Complete 73-7 (digest entity sections). Run /vault-lint.
Scope Epic 74 (Hermes consolidation cleanup + vault governance).
```

---

## What will be DIFFERENT until Portal migration is done

Until Phase 1 of the consolidation epic is complete, the accurate
post-session-close MEMORY will say:

```markdown
provider: openai-codex / gpt-5.4-mini [FRAGILE — migrate to Portal]
```

And the next-session pointer will be:
```markdown
Next Session: Subscribe and login to Nous Portal (Phase 1 of consolidation epic).
Complete 73-7. Run /vault-lint.
```

---

## Token budget reminder

Both MEMORY.md files have a hard limit:
- `~/.hermes/memories/MEMORY.md` — ≤2,000 chars (~500 tokens)
- `vault AI-Context/MEMORY.md` — ≤2,000 chars (~500 tokens)

The content above fits within budget. Session-close enforces this automatically.

---

## The USER.md file

`~/.hermes/USER.md` was not flagged as stale in the audit.
Do not update it as part of this work unless session-close naturally updates it.

---

## Verification after session-close runs

After `/session-close` completes, verify:

```bash
# Hermes copy
cat ~/.hermes/memories/MEMORY.md | head -20

# Vault copy
VAULT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"
cat "$VAULT/AI-Context/MEMORY.md" | head -20

# Both should show:
# - Epics 72 done, 73 in-progress (73-7 in-progress)
# - Tests: 1317 (or clean if fixture was fixed)
# - AGENTS v2.1.43
# - Correct last-session decisions
# - No mention of Story 53.x or Epics 38+43
```

If either file still shows old content, session-close may have used
the Hermes cold-start stale MEMORY as its input. Run `/session-close --dry-run`
first to preview output before committing.
