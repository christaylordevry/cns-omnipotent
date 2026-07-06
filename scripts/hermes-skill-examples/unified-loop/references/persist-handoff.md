# Persist handoff — operator procedure (Story 84-3)

**SSOT for Persist stage invocation.** Hermes does **not** run session-close or vault mutators inline. After operator completes Build (`unified-loop build-complete` → Verify handoff) and Verify (three BMAD review skills per `verify-handoff.md`), the operator follows this handoff for **governed** vault persistence.

## When Persist runs (HARD gate)

| Path | Persist allowed? |
|------|------------------|
| Post-approval: `approve-build` → Build → `build-complete` → Verify complete | **YES** (#2B minimal proof) |
| `unified-loop` (Discover only — pauses at gate) | **NO** |
| `unified-loop cron:discover` | **NO** |
| WSL cron tag `cns-unified-loop-discover` | **NO** |
| Before `unified-loop approve-build` | **NO** (forbidden row #5: `vault_log_action`) |

Persist is **never** auto-fired on recurring schedule or cron (DDR Decision 4a: prove once, then dormant).

## Governance (NFR-GOV-1, Story 5.2)

**No silent vault mutation.** Every Persist write is governed:

| Layer | Mechanism |
|-------|-----------|
| WriteGate | `assertWriteAllowed` on protected paths (`AI-Context/**`, audit log) |
| Audit | `vault_log_action` MCP → `appendRecord` in `audit-logger.ts` |
| Normative spec | `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` |

**No alternate write path** to `_meta/logs/agent-log.md` outside `audit-logger.ts`.

### Forbidden #7 interaction

Row 7 (session-close apply paths) is forbidden **pre-approval**. Persist **is** session-close apply — allowed **only** after Build + Verify on the `approve-build` path.

For **#2B E2E proof scope:** execute **one** real `vault_log_action` via MCP; **do not** fire full session-close during the dry-run. Governance module delta (`AI-Context/modules/unified-loop.md` Build/Persist sections) is drafted in evidence and applied via **batched session-close WriteGate** later.

## Composition (not new logic)

| Path | Role |
|------|------|
| **#2B proof** | Single `vault_log_action` MCP call — minimal audit line |
| **Full Persist (production)** | session-close orchestrator (`scripts/session-close/`, Hermes `session-close` skill) — WriteGate/PAKE/audit on all `AI-Context/` mutations |

Persist composes existing surfaces — no alternate write path to `AI-Context/` or `_meta/logs/agent-log.md`.

## Operator steps — #2B minimal proof (Cursor / MCP)

1. **Confirm chain complete:** `approve-build` → Build handoff → EnterWorktree + `bmad-dev-story` → `build-complete` → Verify handoff → three review skills (or reference `84-2-verify-evidence.md`).
2. **Invoke `vault_log_action`** via `cns_vault_io` MCP:

   ```json
   {
     "action": "unified_loop_persist_proof",
     "tool_used": "unified-loop",
     "target_path": "AI-Context/modules/unified-loop.md",
     "details": "84-3 E2E #2B — governed persist proof; session-close apply deferred"
   }
   ```

3. **Capture response** `{ logged_at: "<ISO-8601 UTC>" }`.
4. **Verify audit line** in vault `_meta/logs/agent-log.md` — six pipe-separated fields per Story 5.1/5.2; `surface: mcp`.
5. **Record in evidence:** `_bmad-output/implementation-artifacts/84-3-e2e-evidence.md` — audit line verbatim.
6. **Do not** fire session-close for governance module during this proof.

## Operator steps — full Persist (post-E2E, session-close)

After #2B proof and batched session-close:

1. Run `/session-close` in `#hermes` with governance module delta from `84-3-e2e-evidence.md`.
2. Session-close WriteGate validates `AI-Context/modules/unified-loop.md`.
3. Apply updates **both** copies per AGENTS.md sync rule.
4. Post-apply: `diff -q` repo mirror vs canonical vault.

## Hermes reference template (operator-driven — no Hermes trigger token for #2B)

Persist in #2B scope is **operator-driven in Cursor/MCP** after Verify — no new Hermes line-1 token required.

```markdown
## Unified Loop — Persist handoff

**Stage:** Persist (post Build + Verify only)
**Procedure:** `references/persist-handoff.md`
**Proof scope:** #2B — single `vault_log_action`; session-close deferred

Operator action (Cursor MCP):
1. `vault_log_action` with unified_loop_persist_proof payload
2. Confirm audit line in `_meta/logs/agent-log.md`
3. Append to `84-3-e2e-evidence.md`

Full governance module apply: batched session-close WriteGate (not in E2E).
```

## 4a dormant-after-proof posture

- One Persist dry-run satisfies Decision 4a for Persist
- Do **not** wire session-close or vault mutators to cron or recurring schedule
- Capability documented and dormant until operator explicitly invokes via this handoff

## References

- Task prompt §7: `references/task-prompt.md`
- Build handoff: `references/build-handoff.md`
- Verify handoff: `references/verify-handoff.md`
- Story 5.2: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
- WriteGate: `src/write-gate.ts`
- Evidence: `_bmad-output/implementation-artifacts/84-3-e2e-evidence.md`
- Story 84-3: `_bmad-output/implementation-artifacts/84-3-approval-gated-build-governed-persist.md`
