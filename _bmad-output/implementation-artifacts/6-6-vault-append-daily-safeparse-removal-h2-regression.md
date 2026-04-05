# Story 6.6 (E6-D): `vault_append_daily` — remove double `safeParse` + duplicate H2 regression test

Status: done

**Label:** E6-D — Epic 6 hygiene from [`deferred-work.md`](./deferred-work.md): (1) **`vault_append_daily` double `safeParse`** in the register handler, (2) **optional identical-H2 regression** (4-6 review), folded into one small story.

**Out of scope:** `vault_log_action` still uses an explicit `safeParse` in [`src/register-vault-io-tools.ts`](../../src/register-vault-io-tools.ts); do **not** change it here unless you file a separate story for register-layer consistency across **all** tools.

---

## Story

As a **maintainer**,  
I want **`vault_append_daily` to validate input once at the MCP boundary and a regression test for duplicate level-2 headings**,  
so that **register handlers stay consistent with other tools and section splice semantics stay pinned when two H2 titles match**.

---

## Acceptance Criteria

### AC1 — Single validation path for `vault_append_daily` (register layer)

**Given** [`src/register-vault-io-tools.ts`](../../src/register-vault-io-tools.ts) `vault_append_daily` handler (today ~282–299)

**When** the MCP server invokes the handler with tool arguments

**Then** the handler **does not** call `vaultAppendDailyInputSchema.safeParse` (remove the duplicate parse block and the manual `SCHEMA_INVALID` return that mirrors Zod issues).

**And** the handler passes **`args`** through to `vaultAppendDaily(cfg.vaultRoot, …, { surface: "mcp" })` the same way **`vault_update_frontmatter`** and **`vault_move`** pass `args` — relying on **`inputSchema: vaultAppendDailyInputSchema`** (MCP SDK + Zod JSON schema) as the sole registration-layer validation.

**And** TypeScript types remain sound: if the SDK types `args` loosely, narrow with `VaultAppendDailyInput` / `z.infer<typeof vaultAppendDailyInputSchema>` or an explicit cast **only** where the compiler cannot see the schema link (match patterns used elsewhere in this file for other tools).

**And** behaviour for **invalid** tool input remains acceptable for Phase 1: either the **SDK rejects** before the handler, or the failure surfaces as today’s stable codes via existing catch paths — **do not** silently accept malformed shapes into `vaultAppendDaily`.

---

### AC2 — Duplicate H2 heading regression (`appendContentToDailyBody`)

**Given** [`appendContentToDailyBody`](../../src/tools/vault-append-daily.ts) (Story 4-6 AC2 — first matching H2, insert before next `/^##\s+/`)

**When** the markdown body contains **two level-2 headings with the same normalized title** (e.g. two `## Agent Log` blocks)

**Then** an append with `section` targeting that title inserts **into the first section’s span** (the region after the **first** matching H2 line and **before** the **next** `##` line), not the second — i.e. **first-wins** for `findIndex` / scan semantics already implemented.

**Test requirement:** Add **one** focused unit test in [`tests/vault-io/vault-append-daily.test.ts`](../../tests/vault-io/vault-append-daily.test.ts) under the existing `vaultAppendDaily helpers` `describe` (or adjacent) that:

- Builds a minimal `body` string with **duplicate** H2 titles and distinct filler text in each section.
- Calls `appendContentToDailyBody(body, "<unique marker>", "<section>")`.
- Asserts the **unique marker** appears **after** the first section’s filler and **before** the second `## …` heading line (regex or substring order assertions are fine).

**Note:** This locks behaviour that [`lines.findIndex`](../../src/tools/vault-append-daily.ts) already implies; the test is documentation + regression guard, not a semantic change unless production code is wrong.

---

### AC3 — No regressions in integration paths

**Given** [`tests/vault-io/fixture-vault-integration.test.ts`](../../tests/vault-io/fixture-vault-integration.test.ts) and existing [`vault-append-daily.test.ts`](../../tests/vault-io/vault-append-daily.test.ts) cases

**When** the suite runs

**Then** all existing `vault_append_daily` tests still pass unchanged unless a test was explicitly coupled to the **double-parse** error shape (if so, update assertions to match SDK-validated error behaviour).

---

### AC4 — Verification gate

**Then** `bash scripts/verify.sh` passes.

---

## Tasks / Subtasks

- [x] AC1: Edit `register-vault-io-tools.ts` — remove inner `safeParse` for `vault_append_daily`; pass `args` through; fix types as needed
- [x] AC2: Add one helper test for duplicate H2 / first-wins splice
- [x] AC3: Run full Vitest / spot-check integration test for append daily
- [x] AC4: `bash scripts/verify.sh`

---

## Dev Notes

### References

- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — `vault_append_daily` double `safeParse`; identical H2 optional regression]
- [Source: `_bmad-output/implementation-artifacts/4-6-vault-append-daily.md` — AC2 section splice rules]
- [Source: `src/register-vault-io-tools.ts` — compare `vault_update_frontmatter` handler (~261–271)]
- [Source: `src/tools/vault-append-daily.ts` — `appendContentToDailyBody`, `normalizeDailySectionHeading`]

### Risk note

If a future MCP host bypasses JSON-schema validation, removing `safeParse` could push invalid shapes into `vaultAppendDaily`. Phase 1 assumes the **registered `inputSchema`** is authoritative for stdio MCP, consistent with other tools in this file.

---

## Dev Agent Record

### Agent Model Used

Cursor agent

### Debug Log References

### Completion Notes List

- Removed duplicate `vaultAppendDailyInputSchema.safeParse` and manual `SCHEMA_INVALID` branch from `vault_append_daily`; handler passes MCP-validated `args` to `vaultAppendDaily` with `as VaultAppendDailyInput` for the SDK callback typing gap.
- Added `appendContentToDailyBody` regression test for duplicate `## Agent Log` headings (first-wins splice before the second H2).
- `bash scripts/verify.sh` passed (Vitest 164 tests).

### File List

- `src/register-vault-io-tools.ts`
- `tests/vault-io/vault-append-daily.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-6-vault-append-daily-safeparse-removal-h2-regression.md`
