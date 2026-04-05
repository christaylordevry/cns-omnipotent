# Story 8.1: Nexus coexistence documentation (Epic A — Phase 2.0)

Status: done

<!-- Sprint tracker: epic-8 / 8-1-nexus-coexistence-documentation. Phase 2 Epic A: documentation and vault manifests only. P3 dual-path permanent; no vault-io or Nexus code changes. -->

## Story

As an **operator and maintainer**,  
I want **the constitution, directory manifests, and operator references to explicitly describe Nexus (Discord bot plus Claude Code in tmux) as a trusted write surface outside Vault IO**,  
so that **all agents understand Nexus bypasses WriteGate, still loads `CLAUDE.md` and `AI-Context/AGENTS.md` at session start, may emit notes without full PAKE frontmatter, and does not append `vault_*` audit lines; IDE/MCP agents do not assume every note was created through governed tools**.

## Acceptance Criteria

1. **AGENTS.md dual-path acknowledgement (human-edited files only)**  
   **Given** `specs/cns-vault-contract/AGENTS.md` is the repo normative mirror of the vault constitution and `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` is the canonical vault copy  
   **When** a **human operator** updates both files so they stay identical (same content)  
   **Then** prose **adds a dedicated subsection** (recommended: new **§5.x** under Security Boundaries, or a short **§4** callout plus §5 pointer) that states clearly:
   - **Nexus** is a **trusted** write surface operating **outside** the Vault IO MCP path: **no WriteGate**, no PAKE validation, no secret scan, and **no** append to `_meta/logs/agent-log.md` for those filesystem writes.  
   - Nexus sessions run with the vault as working directory; **`CLAUDE.md`** at vault root is loaded and points agents at **`AI-Context/AGENTS.md`**, so behavioral rules still apply.  
   - Nexus-created notes **may omit full PAKE frontmatter**; treat them **like `00-Inbox/` captures** when schema is incomplete (triage before treating as canonical PAKE notes).  
   **And** existing §4/§5 language that implies **every** vault mutation is audit-logged is **scoped** so it is clear that **governed logging applies to the Vault IO (MCP) path**, not to Nexus direct filesystem writes.  
   **And** the file **version header and changelog** are bumped for traceability.  
   **And** `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` is updated to **byte-match** the specs mirror (required by `tests/constitution.test.mjs`).  

   **Policy — who may edit:** Paths under `AI-Context/**` are **WriteGate-protected** for Vault IO (`PROTECTED_PATH` in `src/write-gate.ts`). **Automated dev agents must not** apply this story by writing `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` or `specs/cns-vault-contract/AGENTS.md` on behalf of the operator. **Human operator** performs the edits (or approves an exact patch and applies it themselves). After edits, run `bash scripts/verify.sh`; if tests fail, a human (or agent **only** with explicit operator approval for non–AI-Context files) may update test expectations in the **same** change set as the constitution text.

2. **Spec §8 parity (verify)**  
   **Given** `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §8 (Phase 2 Preview) documents the dual-path for Discord/Nexus  
   **When** this story is executed  
   **Then** the implementer **verifies** §8 text matches the locked decision (Nexus direct vault write; vault-io governs IDE; no shared enforcement; `AGENTS.md` plus manifests; escape hatch = shared library if multi-operator or audit needed; P3 permanent for single-operator)  
   **And** if `_bmad-output/planning-artifacts/cns-vault-contract/CNS-Phase-1-Spec.md` or other stale copies disagree, they are **aligned or called out** in the completion record (single source of truth remains `specs/cns-vault-contract/`).

3. **`_README.md` manifest updates (Nexus write targets — four directories only)**  
   **Given** Nexus may write anywhere the operator or Discord session directs (vault-wide cwd; see Nexus guides)  
   **When** manifests are updated for **each** of: `00-Inbox/`, `01-Projects/`, `02-Areas/`, `03-Resources/`  
   **Then** each affected `*/_README.md` includes a short **“Nexus / dual-path”** (or equivalent) subsection stating that **notes may appear here from Nexus without full PAKE frontmatter** and should be **triaged** per Inbox conventions before promotion to canonical PAKE shape  
   **And** manifests keep **FR4** contract frontmatter keys (`purpose`, `schema_required`, `allowed_pake_types`, `naming_convention`) and existing Story 2.1 section structure  
   **And** prose does **not** claim that every file in the folder passed WriteGate  
   **And** repo operator references **`docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`** and **`docs/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md`** remain authoritative for stack, flags, vault paths, watchdog, and trust-guard  
   **Scope note:** This story **does not** require Nexus subsections in `04-Archives/` or `DailyNotes/` unless the operator later expands scope; Epic A default is the four directories above.

4. **Optional: `pake_type` prompt enhancement**  
   **Given** optional alignment without code changes  
   **When** the story is completed  
   **Then** **`docs/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md`** and/or **`docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`** documents a **one-line-style** prompt addition: when Nexus emits YAML frontmatter, include **`pake_type`** (and minimal fields it already produces) to ease routing/triage  
   **And** this item is explicitly **optional**; skipping it does not fail the story.

5. **Section 7 (Current Focus) housekeeping**  
   **When** Nexus coexistence is documented in the constitution  
   **Then** **Parking Lot** / Phase 2 bullets in `AGENTS.md` are adjusted so “Discord / Nexus” is not described as an undocumented future bridge when the dual-path is now explicit (for example: pointer to the new Nexus subsection and “documentation complete for P3 coexistence”).

6. **Scope guard**  
   **Given** Epic A is **documentation and manifests only**  
   **When** work is submitted  
   **Then** **no** changes under `src/`, **no** Nexus bot code changes, **no** new MCP tools, and **no** WriteGate changes  
   **And** `bash scripts/verify.sh` passes after all human-applied constitution and planning-artifact mirror updates.

## Tasks / Subtasks

### Human operator (constitution and mirrors)

- [ ] Read **`docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`** and **`docs/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md`** for vault cwd model, launcher flags, tmux session, and path examples (keep normative AGENTS prose path-agnostic).
- [ ] Edit **`specs/cns-vault-contract/AGENTS.md`** per AC1 and AC5 (Nexus subsection; scope audit/logging language to Vault IO path; version/changelog; no em dashes).
- [ ] Copy/sync **`Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`** to match the specs mirror (AC1).
- [ ] Update **`_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md`** to match specs mirror exactly (constitution test).
- [ ] Verify **`specs/cns-vault-contract/CNS-Phase-1-Spec.md`** §8 per AC2; align stale mirrors if needed.
- [ ] Run **`bash scripts/verify.sh`**; fix **`tests/constitution.test.mjs`** expectations only if the human constitution edit requires it (same change set).

### Manifest updates (repo paths; not under AI-Context)

- [ ] Patch **`Knowledge-Vault-ACTIVE/00-Inbox/_README.md`**, **`01-Projects/_README.md`**, **`02-Areas/_README.md`**, **`03-Resources/_README.md`** with Nexus/dual-path triage notes per AC3 (preserve Story 2.1 manifest pattern from **`_bmad-output/implementation-artifacts/2-1-per-directory-manifests-for-the-folder-contract.md`**).

### Optional

- [ ] Add optional **`pake_type`** prompt note to Nexus operator/full guide per AC4.

### Completion

- [ ] Record touched paths in **Dev Agent Record → File List** (or operator completion record if executed entirely by human).

## Dev Notes

### WriteGate and human-only `AI-Context/`

Vault IO rejects writes under `AI-Context/**` with **`PROTECTED_PATH`** (`assertWriteAllowed` in `src/write-gate.ts`). So **MCP tools cannot** mutate `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`. Combined with constitution sensitivity, **this story treats all `AGENTS.md` edits (specs mirror, planning-artifacts mirror, and vault `AI-Context/` copy) as operator-owned**, not autonomous agent writes.

### Operator context (bind to documentation)

- **Nexus** runs **Claude Code** in **tmux** with **`--dangerously-skip-permissions`** and **`--permission-mode bypassPermissions`**: filesystem writes **do not** go through Vault IO **WriteGate**, **PAKE** validation, **secret scan**, or **`vault_log_action`** audit pipeline. [Source: `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`; `docs/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md`]
- **Startup context:** Launcher **`cd`s to the vault root**; **`CLAUDE.md`** at vault root references **`@AI-Context/AGENTS.md`** (see `specs/cns-vault-contract/shims/CLAUDE.md`). Nexus therefore loads the same constitution as IDE agents, but writes bypass MCP governance. [Source: sprint proposal §4.4; shim templates]
- **Process model:** Discord → official Discord plugin → `claude --channels plugin:discord@claude-plugins-official` in tmux (e.g. session **`nexus-global`**, override via `NEXUS_TMUX_SESSION`). [Source: Nexus guides]
- **Reliability:** watchdog **`nexus-discord-bridge-watchdog.sh`**, **trust-guard** for prompts. [Source: Nexus guides]
- **P3 permanent:** Dual-path coexistence by design for single-operator use; convergence **not** planned unless requirements change (see architecture escape hatch).

### Architecture compliance

- [Source: `docs/architecture.md` — **P3 Dual-Path Model** (approved 2026-04-03): Nexus trusted surface, triage, optional `pake_type`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` — Epic A scope, §3.3 Nexus decision]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §8]

### Technical requirements (guardrails)

- **Do not** imply IDE agents should bypass Vault IO to “match Nexus”; IDE agents should still prefer **Vault IO** when configured.
- **Do not** encourage Nexus to write into **`AI-Context/**`** or **`_meta/**`** beyond existing human-only policy; manifests in this story target **00–03** only.
- **Prose style:** no em dashes (per `AGENTS.md`).
- **Line budget:** `AGENTS.md` must stay **≤500 lines** (`tests/constitution.test.mjs`).

### File structure requirements

| Role | Path |
|------|------|
| Constitution mirror (normative in repo) | `specs/cns-vault-contract/AGENTS.md` |
| Planning-artifacts mirror (must match specs) | `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` |
| Vault constitution (canonical in active vault) | `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` |
| Phase 1 spec | `specs/cns-vault-contract/CNS-Phase-1-Spec.md` |
| Directory manifests (Epic A scope) | `Knowledge-Vault-ACTIVE/00-Inbox/_README.md`, `01-Projects/_README.md`, `02-Areas/_README.md`, `03-Resources/_README.md` |
| Nexus operator references | `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`, `docs/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md` |

### Testing requirements

- After constitution/mirror edits: **`bash scripts/verify.sh`** must pass.
- If **`tests/constitution.test.mjs`** fails on AGENTS equality or line count, fix in the **same** change set as the constitution update.

### References

- `docs/architecture.md` (P3 dual-path)
- `specs/cns-vault-contract/CNS-Phase-1-Spec.md` §8
- `specs/cns-vault-contract/AGENTS.md` (Sections 4–6, changelog)
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md`
- `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`, `docs/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/2-1-per-directory-manifests-for-the-folder-contract.md`
- `src/write-gate.ts` (`isUnderAiContext`, `PROTECTED_PATH`)

## Previous story intelligence (manifest pattern)

From **Story 2.1**: Each `_README.md` uses contract YAML frontmatter plus body sections: directory heading, **What Goes Here** / **What Does Not Go Here**, **Frontmatter Requirements**. Epic A adds a **Nexus / dual-path** subsection without removing those sections.

## Dev Agent Record

### Agent Model Used

_(filled by executor)_

### Debug Log References

### Completion Notes List

### File List

_(constitution mirrors, vault AGENTS, manifests, optional doc edits, tests if any)_

---

**Story completion status:** Ultimate context engine analysis completed — comprehensive developer/operator guide for Epic A (documentation-only Nexus coexistence), with **human-only** `AGENTS.md` edits and **four-directory** manifest scope per operator input.
