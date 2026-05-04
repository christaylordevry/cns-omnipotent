# Epic 26 — Mid-epic retrospective (HI-1 & HI-3 only)

**Date:** 2026-05-03  
**Scope:** Partial retrospective after **Story 26.1 (HI-1)** and **Story 26.3 (HI-3)** are marked **done** in `sprint-status.yaml`. Epic 26 remains **in-progress**; HI-2 and later Hermes stories were not in scope for this session.  
**Sources:** `26-1-hermes-wsl2-install-and-config.md`, `26-3-hermes-vault-io-mcp-write-path.md`, `sprint-status.yaml`, `epic-25-retro-2026-04-30.md` (continuity).

---

## Facilitation (party mode, condensed)

**Bob (Scrum Master):** "Christopher, we agreed this is a **checkpoint retro**, not a full epic close — HI-1 and HI-3 landed in tracking, and the governance bridge is the headline."

**Alice (Product Owner):** "HI-3 before HI-2 for vault wiring was the right lock — we did not let constitution work imply ungoverned writes."

**Charlie (Senior Dev):** "The artifact for 26.3 is what ‘done’ should look like: operator table, `hermes mcp test`, mutator smoke, audit grep, operator guide bump."

**Dana (QA Engineer):** "I’m flagging **evidence parity**: sprint says 26-1 is done, but the 26.1 story file still reads `Status: ready-for-dev` and the Operator verification table is blank. That’s a traceability gap for the next auditor."

**Bob (Scrum Master):** "Good catch — we’ll put that on the action list as process, not blame."

---

## What the artifact system shows as delivered

### Sprint tracking (`sprint-status.yaml`)

| Key | Status |
|-----|--------|
| `epic-26` | `in-progress` |
| `26-1-hermes-wsl2-install-and-config` | `done` |
| `26-3-hermes-vault-io-mcp-write-path` | `done` |

No `epic-26-retrospective` row yet — appropriate until the epic closes.

### HI-3 (Story 26.3) — strong closure record

From `26-3-hermes-vault-io-mcp-write-path.md`:

- **Governance:** Explicit sequencing (HI-3 before HI-2); no WriteGate / audit code changes in story scope.
- **Reality on disk:** Documents **`~/.hermes/`** for config vs empty **`~/ai-factory/hermes/`** — resolves the planning ambiguity called out in 26.1’s “path” AC.
- **Verification:** `hermes mcp test cns_vault_io`, Node MCP smoke for three mutators, disposable SourceNote path, daily append, frontmatter update, **`agent-log.md`** correlation.
- **Docs:** CNS Operator Guide Section 15, version history, cross-link to `mcp-operator-runbook.md`.
- **Repo health:** Completion notes cite green `npm test` and `bash scripts/verify.sh`.

**Themes:** “Registration is not verification” was applied; compat risk (AC7) was explicitly closed on this host (stdio works, no workaround).

### HI-1 (Story 26.1) — spec vs sprint vs file state

The **26.1** artifact is a **full story spec** with clear ACs and scope boundaries (defer vault writes to HI-3, SOUL.md removal, OpenRouter model id, vault root alignment).

**Gap:** The markdown file’s **header** still says `Status: ready-for-dev`, **tasks remain unchecked**, and **Operator verification** / **Dev Agent Record** tables are **unfilled**, while **sprint-status** marks the story **done**.

**Interpretation for retro:** Either (a) evidence was captured elsewhere and the story file was not reconciled, or (b) sprint was updated ahead of artifact closure. For the artifact system, this is **the main inconsistency** to fix before treating HI-1 as audit-complete.

---

## Deep story synthesis (HI-1 + HI-3)

### What went well

- **Clear handoff contract:** HI-1 explicitly deferred governed vault mutations; HI-3 owned first mutator verification — reduces duplicate work and accidental FS bypass.
- **Epic 25 continuity:** Epic 25 retro anticipated Epic 26 and operator-guide alignment; HI-3 delivered operator-facing Hermes + Vault IO documentation.
- **Path discovery encoded in 26.3:** Install-vs-config path mismatch is documented once and reused — valuable for HI-2 and operators.

### Challenges / systemic themes

- **Dual source of truth (spec path vs runtime path):** Planning assumed `~/ai-factory/hermes/`; live Hermes used **`~/.hermes/`** for MCP and config. The system adapted in HI-3; **planning templates** should allow “record actual paths” without fighting the AC table.
- **Story file vs sprint-status drift:** 26.1 shows the risk — **tracking** and **narrative evidence** can diverge.
- **AC3 on 26.3 (Hermes runtime vs MCP):** Governed writes at LLM runtime are **policy + documentation**, not a Hermes fork in-repo; future stories should re-verify if Hermes gains path sandboxing.

### Technical debt / follow-ups

- **26.1 artifact closure:** Backfill or refresh Operator verification + set `Status: done` when evidence matches sprint (or correct sprint if story is not actually complete).
- **Optional hardening:** Periodic operator check for vault FS writes outside `00-Inbox/` (already documented as policy where Hermes cannot enforce).

### Testing insights

- Operator-led epics benefit from **mirroring Epic 16.1 style** (tables, dates, no secrets) — 26.3 did this thoroughly.
- **`hermes mcp test`** as a first gate before mutator smoke is a repeatable pattern for MCP-on-Hermes stories.

---

## Previous epic (25) action item cross-check (lightweight)

| Epic 25 retro action | Relevance to HI-1 / HI-3 |
|----------------------|-------------------------|
| Real chain run spot-check | Orthogonal; no conflict |
| `skipInboxDraft` default for new stages | Still relevant for future Hermes stories that touch ingest |
| Keep `verify.sh` green | Cited in 26.3 completion notes — **aligned** |

---

## Next work preparation (Epic 26 remainder)

**Not a full next-epic preview** — within Epic 26, after this checkpoint:

- **HI-2:** Constitution wiring to `AI-Context/AGENTS.md` — now safe from a **governed-write** perspective because HI-3 established MCP path and audit evidence.
- **Remaining Hermes stories (HI-4+):** Should assume Vault IO mutators for governed paths; re-use Section 15 of the operator guide as the normative operator surface.

**Dependencies satisfied by HI-1 + HI-3:** Runnable Hermes, SOUL.md policy, `CNS_VAULT_ROOT` on MCP child process, live mutator proof, agent-log correlation.

---

## Action items (SMART; no calendar estimates per retro workflow)

| # | Action | Owner | Success criteria |
|---|--------|--------|------------------|
| 1 | Reconcile **26-1** story file with reality: fill Operator verification + Dev Agent Record, check all task boxes, set `Status: done` **or** set sprint story back to `ready-for-dev` / `in-progress` until fixed | SM + Operator | Story header, tasks, and tables match sprint and machine evidence |
| 2 | Add a **one-line rule** to create-story / dev-story checklist: “On story close, `Status` in story file must match `sprint-status.yaml`” | SM | Checklist in workflow or AGENTS note |
| 3 | Before HI-2 dev: skim **CNS-Operator-Guide** Hermes section + `mcp-operator-runbook.md` for any drift if Hermes YAML schema changes | Dev / Operator | Doc dates or version row updated when behavior changes |
| 4 | When Epic 26 **fully** completes: run full `bmad-retrospective` workflow, add `epic-26-retrospective` to sprint-status if missing, mark **done** | SM |

---

## Significant discoveries

Nothing here **invalidates** Epic 26 sequencing (HI-3 before HI-2 for vault). **Stdio works** on the operator host — no relay workaround required (document if another host differs).

---

## Readiness assessment (checkpoint only)

| Dimension | Assessment |
|-----------|--------------|
| Governance bridge (MCP + audit) | **Strong** — evidenced in 26.3 |
| Artifact traceability for HI-1 | **Weak until** story file matches sprint |
| Epic closure | **Not ready** — epic intentionally still `in-progress` |

---

*Facilitator notes: Partial retro per operator request; psychological safety — drift between sprint and story file is treated as a **process** fix, not individual fault.*
