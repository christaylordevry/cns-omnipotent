# Story 77-4 — awareness-sync data-accuracy fix evidence

**Date:** 2026-07-04  
**Root cause:** Hermes self-improvement loop auto-patched deployed-only files under `~/.hermes/skills/cns/awareness-sync/` with false sprint-status scope claim and a hand-frozen story table. Repo mirror at `scripts/hermes-skill-examples/awareness-sync/` had neither change — bypassed `verify.sh` skill-parity gate.

---

## 1. Live test that revealed the bug (Discord #hermes)

**Gateway log** (`~/.hermes/logs/gateway.log`):

```
2026-07-04 10:11:42,794 INFO gateway.run: inbound message: platform=discord user=Christopher chat=1500733488897462382 msg="what's the current state of the JARVIS project?" reply_to_id=None reply_to_text=''
2026-07-04 10:11:43,185 INFO gateway.run: [Gateway] Auto-loaded skill(s) [..., 'awareness-sync'] for session agent:main:discord:group:1500733488897462382:1429000334553911358
2026-07-04 10:13:18,441 INFO gateway.run: response ready: platform=discord chat=1500733488897462382 time=95.6s api_calls=17 response=1983 chars
```

**Observed failure mode:** Hermes cited the self-improvement reference `references/cns-epic-project-status.md` (deployed-only, not in repo) showing stale values vs live `sprint-status.yaml`:

| Story | Stale reference (2026-07-04 self-improvement) | sprint-status.yaml (authoritative) |
|-------|-----------------------------------------------|-------------------------------------|
| 77-2 | review | **done** (commit 7b0077a) |
| 78-2 | review | **cancelled** (superseded by Epic 80) |
| 77-5 | planned | **done** (cns-dashboard 1118ee4; Vercel live) |

**False claim injected into deployed `SKILL.md` Pitfalls:**

> `` `sprint-status.yaml` **only covers Epics 1–76** — do not use it for Epic 77+. ``

**Verification that sprint-status.yaml covers Epics 77+:**

```bash
grep -E 'epic-77|epic-78|epic-80|epic-82' _bmad-output/implementation-artifacts/sprint-status.yaml
# epic-77: in-progress
# epic-78: in-progress
# epic-80: done
# epic-82: in-progress
```

---

## 2. Before — deployed-only bad content (2026-07-04 pre-fix)

### SKILL.md Pitfalls (deployed `~/.hermes/...` only — NOT in repo)

```markdown
### Snapshot lacks story-level granularity for Epics 77+
...
`sprint-status.yaml` **only covers Epics 1–76** — do not use it for Epic 77+.
```

### cns-epic-project-status.md (deployed-only — file did not exist in repo)

Contained frozen tables dated "as of 2026-07-04" including Epic 77/78 story rows with wrong statuses (77-2 review, 77-5 planned, 78-2 review) and false note:

> `` sprint-status.yaml` only covers Epics 1–76. **Epics 77+ are NOT there** ``

---

## 3. After — repo mirror + deployed (post-fix)

### SKILL.md Pitfalls (corrected)

```markdown
### Snapshot lacks story-level granularity

The `awareness-snapshot.json` has **no story-level keys** (eight cockpit sections only: ...).

1. **Read `sprint-status.yaml` first** — authoritative for **all** epics and stories (including 77+). Grep epic and story keys live; never trust hand-copied status tables.
2. Fall back to the investigation pattern in `references/cns-epic-project-status.md` ...
```

### cns-epic-project-status.md (new repo mirror)

- Alias table for Epics 74–82 (static labels only — no status column)
- Investigation grep patterns pointing at `sprint-status.yaml`
- Explicit rule: **Do not maintain hardcoded story-status tables in this file.**

### task-prompt.md additions

- Routing row: JARVIS / epic story status → `sprint-status.yaml` via `terminal()` grep
- §Story-level status: sprint-status wins on conflict; snapshot supplements cockpit sections only

---

## 4. Parity + verify gate

```bash
bash scripts/install-hermes-skill-awareness-sync.sh
diff -rq scripts/hermes-skill-examples/awareness-sync ~/.hermes/skills/cns/awareness-sync
# (no output — PARITY OK)

bash scripts/verify.sh
# exit 0
```

---

## 5. Re-test — corrected skill output

**Method:** `hermes chat` with `-s awareness-sync -t terminal` (same skill files as Discord gateway loads from `~/.hermes/skills/cns/awareness-sync/` after install).

**Session:** `20260704_102434_a94bc2`  
**Query:** "what's the current state of the JARVIS project? Focus on stories 77-2, 78-2, and 77-5 — cite sprint-status.yaml grep results."

**Key excerpts (matches sprint-status.yaml):**

| Story | Reported status | sprint-status.yaml line |
|-------|-----------------|-------------------------|
| 77-2 | **done** | 637 |
| 78-2 | **cancelled** (superseded Epic 80) | 648 |
| 77-5 | **done** (Vercel live) | 640 |

**Operator Discord re-test:** Post the same question in `#hermes` after this fix; gateway loads skills from installed copy. Expected: same grep-backed statuses as above (no "review/planned" for 77-2/78-2/77-5).

---

## 6. Governance gap (flagged, not fixed here)

See `_bmad-output/implementation-artifacts/deferred-work.md` § "Hermes self-improvement ungoverned skill writes (2026-07-04)".

Self-improvement can write directly to `~/.hermes/skills/cns/` without mirroring to repo — future drift will bypass parity gate until install/diff catches it.
