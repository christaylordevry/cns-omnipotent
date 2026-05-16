# Epic 30 — Live E2E evidence (Story 30-3)

**Date:** 2026-05-16  
**Channel:** Discord `#hermes`  
**Gateway:** `hermes gateway run` with `.env.live-chain`, `DISCORD_ALLOW_ALL_USERS=true`  
**Operator:** Christopher Taylor (live run; results relayed to Cursor dev agent)

## AC3 — Synthesis on execute-approved (PASS)

**Trigger:** `execute-approved` (leading slash omitted — see deferred-work; Hermes gateway built-in intercepts `/approve`).

**Input note (moved from Inbox):** `00-Inbox/e2e-epic30-20260516-cursor-dev.md`  
**`source_uri`:** `https://en.wikipedia.org/wiki/Model_Context_Protocol`

### Discord / pipeline sequence

1. **`vault_move`** — succeeded after PAKE repair on destination.
2. **Post-move synthesis gate (30-1)** — `source_uri` present and http(s)-qualified.
3. **Dedup `vault_search` (03-Resources/)** — only self-hit on moved note; excluded per prompt.
4. **Gate clear** — `SYNTHESIS_CLEAR` emitted; chain queued.
5. **`run-chain`** — invoked shallow depth; **~272s**, all stages green.
6. **`vault_update_frontmatter`** — `verification_status: pending` stamped on synthesis output.

### Output artifacts

| Role | Vault path |
|------|------------|
| **SynthesisNote (primary AC3)** | `03-Resources/synthesis-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md` |
| Hooks | `03-Resources/hooks-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md` |
| Weapons check | `03-Resources/weapons-check-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md` |

**`verification_status`:** `pending` (confirmed via `vault_update_frontmatter` after successful chain).  
**`source_uri` on synthesis output:** matches input `https://en.wikipedia.org/wiki/Model_Context_Protocol`.

## AC4 — Dedup gate (PASS)

**Second input:** `00-Inbox/e2e-epic30-dedup-test.md` (identical `source_uri`, moved via `execute-approved`).

**Observed Discord message (exact pattern):**

```text
⚠️ Synthesis skipped — SynthesisNote already exists for https://en.wikipedia.org/wiki/Model_Context_Protocol: 03-Resources/synthesis-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md
```

**Outcome:** Synthesis gate fired; dedup hit found (excluding self-hit). No second `run-chain` invocation. No duplicate synthesis note in `03-Resources/`.

## AC7 — Session close (PASS)

**Command:** `session-close` in `#hermes` (operator).

**Result:** `AGENTS.md` bumped to **v2.0.1**; **Section 8** updated to reflect **Epic 30 — Research Pipeline Auto-Synthesis** complete. Constitution mirror sync via session-close workflow (no manual `AI-Context/AGENTS.md` edit in repo).

## SKILL.md documentation (AC1–AC2)

Repo mirror and live skill: `scripts/hermes-skill-examples/triage/SKILL.md` ↔ `~/.hermes/skills/cns/triage/SKILL.md` at **v1.6.0** with `## Post-move synthesis trigger` and **auto-synthesis on approval** capability summary.

## Automated gates (pre-closeout)

- `npm test` — pass  
- `bash scripts/verify.sh` — pass  

## Deferred findings (Epic 31 candidates)

Logged in `_bmad-output/implementation-artifacts/deferred-work.md`:

| Issue | Impact |
|-------|--------|
| `/approve` intercepted by Hermes gateway built-in | Triage `/approve` routing conflict; operator must use workaround or Epic 31 fix |
| `/execute-approved` requires omitting leading `/` | Same class — gateway slash-command routing |
| `vault_create_note` routes by `pake_type` only; ignores caller path | E2E Inbox fixtures must use direct filesystem write under `00-Inbox/` |
