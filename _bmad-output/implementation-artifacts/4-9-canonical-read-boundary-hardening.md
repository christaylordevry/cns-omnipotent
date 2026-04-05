# Story 4.9: Canonical read boundary hardening

Status: done

## Spec binding (normative)

This file is the **authoritative story spec** for Epic 4 Story 4.9: acceptance criteria, scope, implementation map, error table, and tests. The Phase 1 spec binds it here:

- `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (Deliverable 3) points to this artifact for canonical read-boundary detail.
- `specs/cns-vault-contract/modules/security.md` summarizes policy; **detailed AC and reviewer checks** live in this document.

## Story

As an **operator**,  
I want **vault read tools to reject paths whose canonical target lies outside the vault**,  
so that **symlinks cannot leak non-vault filesystem content through MCP reads**.

## Acceptance context (from 4.1 code review)

**Writes** are canonicalized with `realpathSync` (`assertWriteAllowed` → `resolveWriteTargetCanonical`). **`paths.ts` read helpers** use only `path.resolve` / `path.normalize`. That asymmetry was **accepted for Phase 1** with documented debt; this story closes the read-side gap using the **same canonical idea as WriteGate** (`realpath` / realpathSync before read IO where applicable).

## Scope (explicit)

**In scope — MCP read tools only**

- **`vault_read`** — canonical boundary immediately before file read (e.g. `readFile`), consistent with write-gate’s canonical target pattern.
- **`vault_list`** — canonical boundary on list roots / traversal so directory reads cannot escape via symlinks.
- **`vault_search`** — canonical boundary on search scope roots / walk roots so search cannot escape via symlinks.

**Covered without extra surface area**

- **`vault_read_frontmatter`** delegates to `vaultReadFile` today; once `vault_read`’s entry path is hardened in shared code, frontmatter inherits the same boundary **as long as** it keeps using that single read entry (do not add a second lexical-only path).

**Out of scope**

- **Story 4-8** error-boundary / `handleToolInvocationCatch` behaviour.
- **`vault_move` wikilink repair** and any other read paths that are not part of the three MCP read tools above — **do not expand** this story to wikilink repair unless a review shows those reads bypass the hardened helpers and are exploitable; if so, track a **separate** follow-up rather than creeping scope here.

## Acceptance criteria

1. **Given** a vault-relative path that lexically lies under `vaultRoot` but traverses a symlink whose **canonical** target is outside the vault  
   **When** `vault_read`, `vault_list`, or `vault_search` performs the relevant read / walk  
   **Then** the call fails with **`VAULT_BOUNDARY`** (or the agreed stable boundary code), and **no** content from outside the vault is returned.

2. **Given** a normal path with no symlink escape  
   **When** the same tools run  
   **Then** behaviour matches current semantics (successful read/list/search, or existing domain errors such as `NOT_FOUND` / `PROTECTED_PATH` as today).

3. **Given** resolution hits **`ENOENT`** (e.g. missing final segment, or symlink target missing so `realpath` fails in a “not found” way)  
   **When** canonical resolution runs  
   **Then** the tool fails with **`NOT_FOUND`**, **not** `IO_ERROR`, unless the failure is genuinely an unexpected filesystem error distinct from missing path (then `IO_ERROR` remains appropriate).

4. **Tests** cover at least one symlink-outside-vault read attempt for the read path (mirror the symlink-escape pattern in `tests/vault-io/write-gate.test.ts`), plus an explicit case for **broken / missing symlink target** expecting **`NOT_FOUND`** where applicable.

## Implementation notes

- Reuse or extract a shared **canonical read target** helper aligned with **`resolveWriteTargetCanonical`** in `src/write-gate.ts`; avoid duplicating `realpath` policy in three places.
- Apply **`realpathSync` (or async equivalent) before `readFile` / directory reads** on the resolved path under `vaultRoot`, consistent with what WriteGate already does for writes.

## Dependencies

- **Builds on:** Story 4.1 (`write-gate.ts`), Epic 3 read/list/search tools.

## Sources

- `specs/cns-vault-contract/modules/security.md` (Phase 1 read vs write boundary note).
- `_bmad-output/implementation-artifacts/4-1-writegate-boundary-and-protected-paths.md` (code review handoff).

## Planning alignment (confirm, do not supersede)

- Epic 4 Story 4.9 is listed in `_bmad-output/planning-artifacts/epics.md` for retro and reader parity.
- `sprint-status.yaml` key `4-9-canonical-read-boundary-hardening` tracks this story (`review` until closure; set `done` only after clean code review).

## Reviewer flags (explicit verification)

Ask the reviewer to **confirm in code**, not by assumption:

1. **`vault_list` child canonicalization.** Each child path is canonicalized before `stat` / `readFile` during recursion. Verify that a **symlink inside the vault** whose target is a **directory outside the vault** is caught at that **child** canonicalization step and returns **`VAULT_BOUNDARY`**, not silently omitted, not mistaken for **`IO_ERROR`**.

2. **`vault_search` and ripgrep cwd.** Ripgrep’s `cwd` is the **canonical** vault root. Confirm that the **canonical check before `readFile`** (frontmatter follow-up or any path derived from search) is applied to **paths returned by `rg`**, not only to the operator’s scope input. A result path could theoretically leave the vault if the vault root or internal layout used symlink tricks; every consumed hit path must pass the same boundary as scope.

3. **`vault_read_frontmatter` inheritance test.** “Covered by inheritance” is valid **only if** `vaultReadFile` always goes through `resolveReadTargetCanonical` (shared read boundary). The reviewer should **trace the call chain** (`vaultReadFrontmatter` → `vaultReadFile` → `resolveReadTargetCanonical` before `readFile`) and reject “inherited” coverage if a second read path appears later.

4. **`security.md` vs vault constitution (`AGENTS.md`).** After this review is **clean**, align **`specs/cns-vault-contract/AGENTS.md`** Section 5 (and changelog if needed) with the updated **read/write** paragraph in `specs/cns-vault-contract/modules/security.md`. Treat that as a **deliberate, separate human edit** (constitution is not an agent drive-by under protected-path rules), **not** part of the code-review diff.

## Closure after clean review (operator)

- [x] Code review signed off; implementation matches AC and reviewer flags above.
- [x] Set `4-9-canonical-read-boundary-hardening: done` in `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- [x] Human: update `specs/cns-vault-contract/AGENTS.md` to match `modules/security.md` on canonical read/write boundary (separate commit or edit from implementation). **Done 2026-04-02** (v1.1.1; planning mirror `_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md` synced).
- [x] Sync or copy mirror constitution into the live vault if your workflow requires it. **Done 2026-04-02:** `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` plus `AI-Context/modules/vault-io.md` and `security.md` (repo-relative paths from vault layout); constitution bumped to v1.2.0 with Phase 1 tool list and audit line semantics for Epic 6 verification readiness.

## Developer context (bmad-create-story merge)

**Intent:** Extend the existing story with implementation anchors. Do not delete or rewrite sections above; extend shared helpers instead of duplicating `realpath` policy.

### Code map (expected touchpoints)

| Area | File | Today | Hardening intent |
|------|------|-------|------------------|
| Shared canonical resolve | `src/write-gate.ts` | `resolveWriteTargetCanonical(realVaultRoot, resolvedPath)` — sync `realpathSync`, ENOENT walk-up, `VAULT_BOUNDARY` | Reuse or extract a **read-safe** variant (sync or async) so reads and writes share one policy for “canonical must stay under vault root”. |
| Lexical boundary | `src/paths.ts` | `resolveVaultPath`, `assertWithinVault` — comment notes lexical-only reads | Keep lexical step for `..` / prefix escape; **add canonical check** after resolve for MCP read entry points (or inside a single helper used by reads). |
| Read file | `src/tools/vault-read.ts` | `vaultReadFile` → `resolveVaultPath` → `readFile` | Canonical boundary immediately before `readFile`; map missing path / broken symlink to **`NOT_FOUND`** per AC3 (match existing `ENOENT` handling style). |
| List | `src/tools/vault-list.ts` | `resolveVaultPath` for list root; `readdir` / `stat` / `readFile` under `path.join` | Canonical check on **list root** and on **each directory** opened during recursion so a symlinked dir cannot pivot the walk outside the vault. |
| Search | `src/tools/vault-search.ts` | `resolveVaultPath` for scope; `walkMarkdownFiles` joins `dirAbs` + name | Same as list: canonical boundary on **scope root** and **each traversed directory** before yielding or reading files. |
| Frontmatter | `src/tools/vault-read-frontmatter.ts` | Delegates to `vaultReadFile` | No second path: **must** keep using `vaultReadFile` only so boundary is single-sourced. |
| Errors | `src/errors.ts` | `VAULT_BOUNDARY`, `NOT_FOUND`, `IO_ERROR` | No new code required unless you introduce a separate code (prefer stable **`VAULT_BOUNDARY`** per AC1). |

### Canonical `realpath` outcome → error code (non-negotiable)

Use this decision order so implementers do not infer from WriteGate alone:

| Outcome | Meaning | Error code |
|--------|---------|------------|
| **A. `realpath` fails with `ENOENT` (or equivalent “path does not exist”)** | Final segment missing, or **symlink target missing / dangling symlink**, or any case where canonical resolution stops on “not found” | **`NOT_FOUND`** |
| **B. `realpath` succeeds** and the resulting absolute path is **outside** the resolved vault root (symlink escape, or any canonical exit) | Canonical target is not under vault | **`VAULT_BOUNDARY`** |
| **C. `realpath` succeeds** and the path is **inside** the vault | Proceed with read / list / walk | _(no boundary error)_ |
| **D. `realpath` fails with a code other than `ENOENT`** (e.g. `EACCES`, `EIO`), or an unexpected throw | Genuine IO / permission / system fault | **`IO_ERROR`** |

**Rule of thumb:** *Dangling or missing symlink target* falls under **row A** → **`NOT_FOUND`**. *Symlink resolves to a real path outside the vault* falls under **row B** → **`VAULT_BOUNDARY`**. Do not map row A to `VAULT_BOUNDARY` and do not map row B to `NOT_FOUND`.

### Other behavioural hints

- **`resolveWriteTargetCanonical`** (writes) uses an ENOENT walk-up for creating new paths; **read tools** must follow the table above for user-visible errors (especially row A vs B).
- `loadGitignore` in `vault-search.ts` reads `.gitignore` via `path.join(vaultRoot, ...)` — ensure that path does not bypass the same vault-root trust model if you treat it as part of the read surface (keep under vault; no symlink escape for config reads).

### Tests

- Mirror the symlink pattern in `tests/vault-io/write-gate.test.ts` (“symlink to outside the vault”) for **`vault_read`**, **`vault_list`**, and **`vault_search`** (at least one escape attempt on the read path per AC4).
- Add **broken / missing symlink target** → **`NOT_FOUND`** where `realpath` fails in an ENOENT-class way, consistent with AC3.
- Existing lexical escape tests in `vault-read.test.ts` / `vault-list.test.ts` / `vault-read-frontmatter.test.ts` should still pass; extend rather than replace.

### Spec follow-up after implementation

- `specs/cns-vault-contract/modules/security.md` (read vs write boundary paragraph) updated for canonical read enforcement. **Constitution mirror** (`AGENTS.md`) waits for the human closure step above.

## Tasks / Subtasks

**Single-pass rule:** All four MCP read tools must use the same canonical read boundary in one change set (no tool left on lexical-only reads): `vault_read`, `vault_list`, `vault_search`, `vault_read_frontmatter`.

- [x] Extract or reuse canonical read helper aligned with `resolveWriteTargetCanonical` (error table rows A–D). (AC: 1–3)
- [x] **`vault_read`:** Harden `vaultReadFile` before `readFile`; preserve non-escape semantics and domain errors. (AC: 1–3)
- [x] **`vault_list`:** Harden list root and recursive directory traversal (canonical each directory before `readdir` / `stat` / `readFile`). (AC: 1–3)
- [x] **`vault_search`:** Harden search scope root and walk; canonical `.gitignore` read path; keep `.gitignore` and `_meta/logs` rules intact; Node scanner and ripgrep follow-up reads must not bypass canonical checks. (AC: 1–3)
- [x] **`vault_read_frontmatter`:** Confirm it uses only `vaultReadFile` (no second lexical-only read path); add or extend a test if only assertion in code. (AC: 2)
- [x] Add tests: symlink outside vault for read/list/search + broken symlink → `NOT_FOUND` where applicable; frontmatter inherits via `vaultReadFile`. (AC: 4)
- [x] Adjust `security.md` mirror when behaviour is shipped. (Sources / spec debt)
- [x] Human: `AGENTS.md` alignment with `security.md` after clean review (see Reviewer flags / Closure). **Done 2026-04-02.**

## Dev Agent Record

### Agent Model Used

Cursor agent (Claude) — dev-story workflow 2026-04-02.

### Debug Log References

### Completion Notes List

- Added `src/read-boundary.ts` with `getRealVaultRoot` and `resolveReadTargetCanonical` implementing error table rows A–D (ENOENT → `NOT_FOUND`, outside real vault root → `VAULT_BOUNDARY`, other resolve failures → `IO_ERROR`).
- **`vault_read`:** `vaultReadFile` resolves lexically then canonicalizes before `readFile`.
- **`vault_list`:** Root and every listed entry use canonical paths; recursion queues canonical directory paths.
- **`vault_search`:** Canonical scope root; `walkMarkdownFiles` canonicalizes each traversed entry and uses `stat` on canonical paths; `loadGitignore` and ripgrep follow-up reads use `resolveReadTargetCanonical`; ripgrep `cwd` uses real vault root.
- **`vault_read_frontmatter`:** Unchanged implementation (still only `vaultReadFile`); covered by inheritance test and checklist confirmation.
- Tests: `tests/vault-io/canonical-read-boundary.test.ts` (symlink escape + dangling symlink + in-vault symlink + frontmatter).
- Spec: `specs/cns-vault-contract/modules/security.md` updated to describe canonical read enforcement.

### File List

- `src/read-boundary.ts` (new)
- `src/tools/vault-read.ts`
- `src/tools/vault-list.ts`
- `src/tools/vault-search.ts`
- `tests/vault-io/canonical-read-boundary.test.ts` (new)
- `specs/cns-vault-contract/modules/security.md`
- `_bmad-output/implementation-artifacts/4-9-canonical-read-boundary-hardening.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-02: Story 4-9 implemented — canonical read boundary for all four MCP read tools; tests and security spec updated.
- 2026-04-02: Bound this artifact as normative spec from Phase 1 spec and `security.md`; added reviewer flags, ripgrep-path and frontmatter call-chain checks, and post-review closure checklist (sprint `done` + human `AGENTS.md` sync).
- 2026-04-02: Code review complete — clean; sprint status set to `done`. Human: sync `specs/cns-vault-contract/AGENTS.md` with `modules/security.md` (tracked in Closure / Reviewer flag 4).

### Review Findings

**Code review (2026-04-02):** Clean review — 0 decision-needed, 0 patch, 0 defer, 0 substantive dismissed. `scripts/verify.sh` passed.

**Reviewer flags (verified in code):**

1. **vault_list children** — `buildEntry` calls `resolveReadTargetCanonical` before `stat` / `readFile` (`vault-list.ts`); recursive queue uses canonical parent `abs` with per-name canonicalization in `buildEntry`.
2. **vault_search + ripgrep** — `spawn(..., { cwd: realVaultRoot })` (`vault-search.ts`); each hit applies `resolveReadTargetCanonical` before `readFile` for frontmatter summary.
3. **vault_read_frontmatter call chain** — `vaultReadFrontmatter` → `vaultReadFile` → `resolveReadTargetCanonical` before `readFile`:

```27:28:src/tools/vault-read-frontmatter.ts
    const raw = await vaultReadFile(vaultRoot, userPath);
```

```9:18:src/tools/vault-read.ts
export async function vaultReadFile(vaultRoot: string, userPath: string): Promise<string> {
  const absolute = resolveVaultPath(vaultRoot, userPath);
  const realRoot = await getRealVaultRoot(vaultRoot);
  const canonical = await resolveReadTargetCanonical(realRoot, absolute, {
    path: userPath,
    notFoundMessage: `No file at vault path: ${userPath}`,
  });

  try {
    return await readFile(canonical, "utf8");
```

4. **AGENTS.md vs security.md** — Not a finding: intentional post-review human step (see Reviewer flags §4 in this story).
