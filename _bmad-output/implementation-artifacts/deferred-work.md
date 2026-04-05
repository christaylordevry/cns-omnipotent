# Deferred work

**Triaged:** 2026-04-02 (before Epic 6).  
**Classification key:** **(a)** Epic 6 scope, **(b)** Phase 2 backlog (or operator-only docs), **(c)** closed or resolved by shipped work (Epics 4–5 and earlier).

**For Epic 6 story authors:** Do not open Epic 6 implementation until the **Epic 6 intake** rows are mapped to stories (6.1–6.3 or explicit follow-ups). The two highest-impact items for an honest verification gate are **`IO_ERROR` / `CnsError` message hygiene** and **`vault_move` Obsidian CLI success-path verification** (source `ENOENT` after exit 0).

---

## Summary table

| Item (short) | Class |
|--------------|-------|
| `vault_move` + Obsidian CLI: after exit 0, assert source gone (`ENOENT`) | (a) Epic 6 |
| Intentional `IO_ERROR` / `CnsError` messages not sanitised (4-8) | (a) Epic 6 |
| `vaultRootFromHost` not wired at stdio (3-1) | (a) Epic 6 (when host config exists) or document as known gap in 6.x |
| `vault_append_daily` double `safeParse` in register handler | (a) Epic 6 (consistency / hygiene) |
| Optional regression: two identical H2 headings, first-wins splice (4-6) | (a) Epic 6 optional (fixture / integration tests) |
| `normalizeAbsolute` duplicated (`audit-logger` / `vault-move`) | (a) Epic 6 optional or (b) if timeboxed out |
| Error-path `vaultMove` tests omit `_meta/logs` pre-create | (c) Accepted Phase 1 risk; reopen if audit runs earlier |
| `vault_move` wikilink repair O(n) per move | (b) Phase 2 at scale |
| Duplicated PAKE type enums (register + tools) | (a) Epic 6 or (b) pre–Phase 2 hygiene |
| Vault root at filesystem `/` (meaningless boundary) | (b) operator docs + optional hardening; (a) only if Epic 6 adds explicit rejection tests |
| Nexus trust-guard: detect `needs_configure` after Claude Code updates (NEXUS repo script) | (b) Phase 2 |
| `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`: Symptom E + trust-guard post-update reconnection | (b) Phase 2 |
| `vault_create_note` routes by `pake_type` only; ignores subdirectory path — use `vault_move` after creation for project subfolders | (b) Phase 2 / operator workflow |
| Symlink / `realpath` on reads | (c) Resolved: Story 4-9 |
| “Deferred to Epic 5.2” audit wiring in mutators | (c) Resolved: Epic 5 |

---

## Epic 6 intake (detail)

### `vault_move` Obsidian CLI success path (4-7 review)

After CLI exit 0 and destination checks, **verify the source path no longer exists** (`stat` → `ENOENT`) so a broken CLI cannot leave a duplicate at the source while appearing successful.

- **Class:** (a) Epic 6 (verification / move correctness; pair with integration or unit tests in 6.2).

### `IO_ERROR` / `CnsError` message sanitisation (4-8)

`handleToolInvocationCatch` normalises non-`CnsError` throws; **domain `CnsError("IO_ERROR", …)` messages may still embed internal paths or backend detail**. Review before trusting the verification gate on “safe” error text for operators or future external surfaces.

- **Class:** (a) Epic 6 (6.3 verification gate or a tight hygiene story).

### `vaultRootFromHost` not wired at stdio (3-1)

Optional MCP host `vaultRoot`; defer until host/SDK exposes initialization config for the server process.

- **Class:** (a) Epic 6 as config contract + docs when feasible; otherwise document “env-only” in gate docs and keep (b) for full host-driven root.

### `vault_append_daily` double `safeParse` (code review)

Handler uses `vaultAppendDailyInputSchema.safeParse` while other tools rely on MCP/schema validation only.

- **Class:** (a) Epic 6 (align on one validation pattern).

### Optional regression: `vault_append_daily` identical H2 headings (4-6)

Assert first-wins splice when two level-2 headings share the same title.

- **Class:** (a) Epic 6 optional (good fit for fixture integration tests).

### `normalizeAbsolute` duplication (5-1 review)

Identical helper in `audit-logger.ts` and `vault-move.ts`; consolidate in a shared utility when touching either area.

- **Class:** (a) Epic 6 optional or (b) if not picked up.

---

## Phase 2 backlog (detail)

### `vault_move` wikilink repair is O(number of `.md` files)

Known operational characteristic; acceptable for Phase 1-scale vaults.

- **Class:** (b)

### Duplicated PAKE type enums

Same literals in `register-vault-io-tools.ts` and tool modules; refactor to shared schema/constants.

- **Class:** (b) if not addressed in Epic 6; else fold into (a).

### Vault root at filesystem root (`/`)

Boundary checks are meaningless; prefer operator documentation and optional explicit rejection in a later hardening pass.

- **Class:** (b) default; (a) only if Epic 6 verification adds a concrete test and product decision.

### Nexus trust-guard patch (`nexus-discord-trust-guard.sh`)

Update `nexus-discord-trust-guard.sh` (NEXUS repo) to detect **`needs_configure`** state after Claude Code updates. Patch is documented. Apply after testing in a non-critical session.

- **Class:** (b) Phase 2 (operator / NEXUS repo maintenance; not Omnipotent vault-io code).

### Nexus Full Guide: Symptom E and post-update reconnection

Update `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md` with **Symptom E** and a **trust-guard post-update reconnection** section (so operators know what to do after Claude Code or plugin changes).

- **Class:** (b) Phase 2 (documentation in this repo).

### `vault_create_note` placement vs project subfolders (NotebookLM / MCP workflow)

`vault_create_note` routes by `pake_type` only and ignores subdirectory path in the requested target — use `vault_move` after creation to place notes in project subfolders.

- **Class:** (b) Phase 2 / operator workflow (documented workaround; Story 10-1 smoke verified).

---

## Closed / resolved (detail)

### Symlink / realpath for reads (3-1 deferral)

Read tools used lexical resolution only; symlink escape on read was deferred. **Resolved** by Story **4-9** (`read-boundary.ts`, canonical read path aligned with WriteGate policy).

- **Class:** (c)

### Pre–Epic 5 “deferred to Epic 5.2” audit comments

Mutators now call `AuditLogger` / `appendRecord`; `vault_log_action` registered. **Resolved** by Epic **5**.

- **Class:** (c)

### Error-path `vaultMove` tests without `_meta/logs` (5-1 review)

Passes because errors throw before audit; fragile if audit moves earlier in the flow. **Accepted for Phase 1.**

- **Class:** (c) (explicitly accepted debt; not blocking Epic 6 unless behaviour changes)

---

## Historical notes (archived context)

The following paragraphs record **pre-triage** notes (2026-04-02) for audit trail only; the tables above supersede them.

<details>
<summary>Pre–Epic 5 triage excerpt (superseded)</summary>

Epic 5 audit scope from code: no `TODO.*audit` in `src/`; deferrals were “deferred to Epic 5.2” in mutator tools (now closed). Placement table previously suggested CLI move verification and `IO_ERROR` hygiene for Epic 6; this file now classifies them formally as **(a)**.

</details>
