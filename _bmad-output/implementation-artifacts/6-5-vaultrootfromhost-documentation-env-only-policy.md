# Story 6.5 (E6-C): `vaultRootFromHost` documentation + env-only policy note

Status: done

**Label:** E6-C — Epic 6 documentation closure for deferred **3-1** intake ([`deferred-work.md`](./deferred-work.md) — `vaultRootFromHost` not wired at stdio).

**Scope boundary:** **Documentation and inline code comments only.** Do **not** wire `vaultRootFromHost` into [`src/index.ts`](../../src/index.ts) or change MCP SDK startup in this story; that remains deferred until a host exposes initialization config. Do **not** change precedence in [`src/config.ts`](../../src/config.ts) (`CNS_VAULT_ROOT` already overrides `vaultRootFromHost` — preserve and document).

---

## Story

As an **operator or integrator**,  
I want **clear docs that Phase 1 stdio MCP uses `CNS_VAULT_ROOT` only and that `vaultRootFromHost` is a programmatic hook**,  
so that **I do not assume IDE “MCP config vault root” is read by the server today, and I know where to look when host-driven root lands**.

---

## Acceptance Criteria

### AC1 — Operator index (`specs/cns-vault-contract/README.md`)

**Given** the grounding checklist and MCP bullets in [`specs/cns-vault-contract/README.md`](../../specs/cns-vault-contract/README.md)

**When** an operator configures Cursor / Claude Code Vault IO

**Then** the doc **explicitly states**:

1. **Phase 1 stdio server** (`src/index.ts`): vault root comes **only** from the **`CNS_VAULT_ROOT` environment variable** for the MCP server process (plus validation in `loadRuntimeConfig`). IDE JSON “env” blocks are the supported way to set this on most hosts.

2. **`vaultRootFromHost`** on `loadRuntimeConfig` inputs exists for **embedded use, tests, and future host wiring** — it is **not** passed from the current stdio entrypoint.

3. **Precedence** (already implemented): when both are applicable in programmatic calls, **`CNS_VAULT_ROOT` wins** over `vaultRootFromHost` ([`tests/vault-io/config.test.ts`](../../tests/vault-io/config.test.ts) covers this).

**Format:** Add a short dedicated subsection (for example **“Vault IO MCP: vault root (Phase 1)”**) near the grounding checklist MCP items, or expand those bullets in place so the three facts are visible without reading source.

---

### AC2 — Developer surfaces

**Given** [`src/config.ts`](../../src/config.ts) and [`src/index.ts`](../../src/index.ts)

**When** a maintainer reads the API and entrypoint

**Then**:

- `ConfigInputs` / `loadRuntimeConfig` carry **JSDoc** (or adjacent block comment) describing `vaultRootFromHost`, env precedence, and that stdio `main` does not supply it.

- `src/index.ts` includes a **single-line comment** at the `loadRuntimeConfig()` call stating **env-only** vault root for this entrypoint (pointer to `CNS_VAULT_ROOT`).

---

### AC3 — Implementation repo rules

**Given** [`CLAUDE.md`](../../CLAUDE.md) (implementation-repo project rules)

**When** an agent implements or configures the MCP package

**Then** one concise sentence (or bullet) states that **stdio startup uses `CNS_VAULT_ROOT` only** and that **`vaultRootFromHost` is for programmatic/tests/future host config** — with optional pointer to `specs/cns-vault-contract/README.md` for operators.

---

### AC4 — Optional root README

**Given** root [`README.md`](../../README.md)

**When** useful without duplicating the spec index

**Then** add at most **one or two sentences** (for example under Verification gate or a tiny “MCP” line) pointing operators to **`CNS_VAULT_ROOT`** and **`specs/cns-vault-contract/README.md`** for full MCP env policy — **or** explicitly defer to the spec README only if the sentence in AC3 + spec update is enough (choose one approach; avoid three full copies of the same paragraph).

---

### AC5 — Planning-artifact mirror (if applicable)

**If** your workflow keeps [`_bmad-output/planning-artifacts/cns-vault-contract/README.md`](../../_bmad-output/planning-artifacts/cns-vault-contract/README.md) as a duplicate of the specs operator README:

**Then** refresh it from `specs/cns-vault-contract/README.md` after AC1 so BMAD readers see the same policy (the specs file remains **canonical** per existing README footer).

---

### AC6 — Verification

**Then** `bash scripts/verify.sh` passes (documentation-only change; no new tests required unless you add a constitution-style check, which is **out of scope** for this story).

---

## Tasks / Subtasks

- [x] AC1: Update `specs/cns-vault-contract/README.md`
- [x] AC2: JSDoc + `index.ts` comment
- [x] AC3: Update `CLAUDE.md`
- [x] AC4: Root `README.md` one-liner or explicit “spec README is canonical” choice
- [x] AC5: Refresh planning mirror if present / required by workflow
- [x] AC6: `bash scripts/verify.sh`

---

## Dev Notes

### Traceability

- [Source: `_bmad-output/implementation-artifacts/3-1-mcp-package-scaffold-and-vault-root-configuration.md` — Review Findings, `vaultRootFromHost` defer]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — `vaultRootFromHost` not wired at stdio]
- [Source: `src/config.ts` — `loadRuntimeConfig`, `ConfigInputs`]

### Anti-patterns (do not do)

- Do not implement host config parsing in `index.ts` without a separate story and SDK contract.
- Do not imply `vaultRootFromHost` is read from Cursor MCP JSON today unless the doc clearly labels that as **future**.

---

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude)

### Debug Log References

### Completion Notes List

- AC1–AC5: Documented Phase 1 stdio **env-only** vault root (`CNS_VAULT_ROOT`), `vaultRootFromHost` scope, and precedence in spec README, `security.md` (specs + vault `AI-Context` copy), `CLAUDE.md`, root `README.md`, JSDoc/`index.ts`, and planning README mirror.
- AC6: `bash scripts/verify.sh` green. Copied `specs/cns-vault-contract/AGENTS.md` → `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` to clear pre-existing constitution parity drift (required by `tests/constitution.test.mjs`), not a story content change.

### File List

- `specs/cns-vault-contract/README.md`
- `specs/cns-vault-contract/modules/security.md`
- `Knowledge-Vault-ACTIVE/AI-Context/modules/security.md`
- `src/config.ts`
- `src/index.ts`
- `CLAUDE.md`
- `README.md`
- `_bmad-output/planning-artifacts/cns-vault-contract/README.md`
- `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` (parity sync)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-5-vaultrootfromhost-documentation-env-only-policy.md`

## Change Log

- 2026-04-03: Story 6.5 documentation and comments; planning `AGENTS.md` synced to specs for verify parity.
