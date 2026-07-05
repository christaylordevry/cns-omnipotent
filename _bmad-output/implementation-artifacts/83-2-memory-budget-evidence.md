# Story 83-2 — Memory budget raise + cross-session verification evidence

**Story:** `83-2-memory-budget-raise-cross-session-verification`  
**Date:** 2026-07-05 (AEDT)  
**Operator approval:** 2026-07-05 — `memory_char_limit: 4400`, `user_char_limit: 2750`

---

## Hermes baseline

```
Hermes Agent v0.17.0 (2026.6.19)
Portal: ✓ logged in — Nous inference provider
Prior caps: memory_char_limit 2200, user_char_limit 1375
Post-change caps: memory_char_limit 4400, user_char_limit 2750
memory.provider: honcho (unchanged from 83-1)
memory_enabled / user_profile_enabled: true / true
flush_min_turns: 6
```

Config backup: `~/.hermes/config.yaml.bak-2026-07-05-83-2`

---

## Applied configuration (redacted)

### `~/.hermes/config.yaml` (memory excerpt)

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: false
  memory_char_limit: 4400
  user_char_limit: 2750
  provider: honcho
  nudge_interval: 10
  flush_min_turns: 6
```

CLI applied:
```bash
hermes config set memory.memory_char_limit 4400
hermes config set memory.user_char_limit 2750
```

**Unchanged:** `honcho.json`, `brain-recall-policy.json`, `plugins.enabled: [cns-brain-recall]`

---

## Context7 semantics (NFR7)

Source: `/nousresearch/hermes-agent` — `memory.md`, `configuration.md`, `memory_tool.py`

| Setting | Semantics |
|---------|-----------|
| `memory_char_limit` | Max chars for `MEMORY.md` store injection ceiling |
| `user_char_limit` | Max chars for `USER.md` store injection ceiling |
| Injection | Frozen `_system_prompt_snapshot` at **session start** from on-disk files |
| Tool writes | `memory(action=add|replace|remove)` persists to disk **immediately** (mid-session snapshot unchanged until next session) |
| At-cap | Tool returns capacity error; agent must consolidate — not silent truncation |

Post-apply tool feedback confirmed new cap live: **1,147/2,750 chars** (41%) on Session A memory add.

---

## Cross-session verification

### Test design

| Parameter | Value |
|-----------|-------|
| Test marker | `83-2-CS-TEST` (non-secret, attributable preference) |
| Preference | Chris prefers exactly 3 bullet takeaways for research summaries |
| Store | `user` (USER.md) |
| Flush strategy | **Explicit `memory` tool add** (Session A = 1 user turn; below `flush_min_turns: 6`) |

**Flush point rationale:** Per `memory_tool.py` module docstring, mid-session memory tool writes update files on disk immediately. `flush_min_turns` governs automatic auxiliary memory flush on session exit/reset — not required when the agent invokes `memory(action=add)` directly. Forced tool write avoids false-fail from an unflushed conversational preference.

### Pre-Session-A disk baseline

| File | Chars | mtime |
|------|-------|-------|
| USER.md | 1056 | 2026-05-04 14:54 AEDT |
| MEMORY.md | 984 | 2026-07-05 22:21 AEDT |
| Marker `83-2-CS-TEST` | absent | — |

### Session A — write

| Field | Value |
|-------|-------|
| session_id | `20260705_234227_192363` |
| Method | `hermes chat -Q -q` (CLI, new session) |
| User turns | 1 (explicit memory tool instruction) |
| Tool result (redacted) | Entry added to user store; usage **1,147/2,750** chars |

**Post-Session-A disk (flush confirmed):**

| File | Chars | Marker on disk |
|------|-------|----------------|
| USER.md | **1148** (+92) | ✓ `83-2-CS-TEST: Chris prefers exactly 3 bullet takeaways...` |
| MEMORY.md | 984 (unchanged) | — |

**Flush point:** Immediate on `memory(action=add, store=user)` — char count delta 1056→1148; marker grep-positive before Session B started.

### Session B — recall (fresh session)

| Field | Value |
|-------|-------|
| session_id | `20260705_234251_5bdc2b` (≠ Session A — new snapshot load) |
| Method | `hermes chat -Q -q` recall probe (no `--resume`) |
| Operator re-stated preference? | **No** |

**Response (redacted excerpt):**
> From user profile memory, specifically the entry tagged `83-2-CS-TEST`: Chris prefers exactly 3 bullet takeaways when asked for research summaries.

**Result:** **PASS** — native USER.md preference recalled across sessions without re-statement.

### Honcho vs native

Session B cited **user profile memory** and the `83-2-CS-TEST` tag — consistent with native USER.md injection at session start, not Honcho-only paraphrase.

---

## Scope compliance

| Check | Result |
|-------|--------|
| protect-list untouched | ✓ |
| honcho.json untouched | ✓ |
| brain-recall-policy.json untouched | ✓ |
| AI-Context/AGENTS.md untouched | ✓ |
| USER.md content | Changed only via Hermes `memory` tool during test (WriteGate-compliant) |
| Git commit | **None** (operator review) |

---

## Reversibility (NFR5)

| Setting | Prior | Current |
|---------|-------|---------|
| `memory_char_limit` | 2200 | 4400 |
| `user_char_limit` | 1375 | 2750 |

```bash
hermes config set memory.memory_char_limit 2200
hermes config set memory.user_char_limit 1375
# or: cp ~/.hermes/config.yaml.bak-2026-07-05-83-2 ~/.hermes/config.yaml
# restart gateway / new session
```

To remove test entry (optional operator cleanup):
```bash
# Via Hermes: memory(action=remove, store=user, match="83-2-CS-TEST")
```

---

## Verify gate

| Suite | Result |
|-------|--------|
| `bash scripts/verify.sh` | **PASS** (`==> VERIFY PASSED`, 2026-07-05) |

---

## OQ-7 resolution

Operator-approved ceilings at v1.5 gate: **4400 / 2750** (~2× prior caps). Marginal injection cost $0 at apply time (files under old caps); headroom for USER.md growth (was 77% of 1375 cap pre-raise).

---

## Out of scope (explicit)

- `memory-pillars-verification.md` char-limit row update — separate constitution follow-up
- Removal of `83-2-CS-TEST` entry — operator discretion
- No git commit
