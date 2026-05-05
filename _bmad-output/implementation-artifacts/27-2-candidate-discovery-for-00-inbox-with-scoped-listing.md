# Story 27.2: Candidate discovery for `00-Inbox/` with scoped listing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **operator**,
I want **`/triage` to discover Inbox candidates using explicit Vault IO listing semantics under `00-Inbox/` (including nested notes), deterministic ordering, and optional paging**,
so that **large or nested Inboxes produce a predictable, bounded review queue without scanning the rest of the vault**.

## Acceptance Criteria

1. **Scoped discovery root (AC: scope)**

   - **Given** the operator runs `/triage` in `#hermes`
   - **When** Hermes gathers candidates
   - **Then** every Vault IO read (`vault_list`, `vault_read`, `vault_read_frontmatter`, optional `vault_search`) uses a path or scope **at or under** `00-Inbox/` only
   - **And** no tool call targets `AI-Context/`, `_meta/logs/`, or other governed zones outside Inbox for discovery

2. **Recursive file census (AC: recursive-list)**

   - **Given** `00-Inbox/` contains markdown notes in subdirectories (not only at the top level)
   - **When** `/triage` runs with default discovery settings
   - **Then** Hermes calls `vault_list` with `path: "00-Inbox/"` and `recursive: true` (or equivalent documented sequence that yields the same file set)
   - **And** the candidate set includes **only file entries** whose `vaultPath` ends with `.md` (skip directories and non-markdown files for preview rows)

3. **Deterministic ordering (AC: sort)**

   - **Given** more than one markdown candidate exists under `00-Inbox/`
   - **When** candidates are selected for display
   - **Then** they are ordered by **modified time descending** using the `modified` ISO field from `vault_list` entries (newest first)
   - **And** ties break lexicographically by `vaultPath` ascending so output is stable across runs

4. **Bounded paging (AC: paging)**

   - **Given** more markdown candidates exist than the configured page size
   - **When** the operator runs `/triage` with **no paging arguments**
   - **Then** Hermes shows the first page only (default page size **10**, same as Story 27.1 unless you document a deliberate change)
   - **And** the footer states **how many candidates matched** and that more pages exist

   - **Given** the operator runs `/triage` with an explicit **offset** approved by Hermes parsing (pick **one** canonical form and document it in `references/task-prompt.md`, e.g. `/triage --offset 10` **or** trailing token `offset 10`)
   - **Then** Hermes skips the first `offset` candidates after sorting and shows the next page (still capped at the page size)
   - **And** invalid offsets (negative, non-numeric, or beyond the list end) produce a **single clear error message** without mutations

5. **Optional keyword narrowing (AC: scoped-search)**

   - **Given** the operator includes a **single literal query string** in the `/triage` command (syntax fixed in `references/trigger-pattern.md`)
   - **When** discovery runs
   - **Then** Hermes may call `vault_search` with `query` set to that string and **`scope` exactly `00-Inbox/`**, `max_results` at most **50** per Phase 1 cap
   - **And** candidate paths are the intersection of search hits with markdown files under `00-Inbox/` (still apply the same sort and paging rules as non-search mode)
   - **If** the operator does not provide a query, **do not** call `vault_search` (listing-only path stays cheap)

6. **Read-only + excerpt discipline (AC: no-mutations)**

   - **Given** Story 27.1 guardrails remain in force
   - **When** previews are produced
   - **Then** Hermes uses only read-class tools (`vault_list`, `vault_read`, `vault_read_frontmatter`, optional `vault_search`)
   - **And** excerpt rules stay bounded (**max 400 characters** per note unless you document a new cap in this story's Dev Agent Record)
   - **And** approval or mutation attempts still receive the Story 27.1 refusal copy (“approval flow not enabled yet; no actions taken”) before any preview continuation where applicable

7. **Failure isolation (AC: errors)**

   - **Given** one candidate path fails `vault_read`
   - **When** the batch preview runs
   - **Then** that item surfaces as an error row and remaining items still render (same pattern as Story 27.1)

## Tasks / Subtasks

- [x] **Update triage skill docs for discovery pipeline** (AC: scope, recursive-list, sort, paging)
  - [x] Edit `scripts/hermes-skill-examples/triage/SKILL.md` version/metadata if behavior materially changes.
  - [x] Rewrite `references/task-prompt.md` so the model follows: recursive `vault_list` → filter `.md` files → sort → slice page → `vault_read` excerpts.
  - [x] Align `references/trigger-pattern.md` with optional query + offset parsing rules (refuse ambiguous multi-query strings).

- [x] **Implement paging UX copy** (AC: paging)
  - [x] Footer must include total eligible markdown count (after filters), current offset, page size, and how to request the next page.

- [x] **Optional scoped search path** (AC: scoped-search)
  - [x] Document exact Discord syntax for “triage with keyword”.
  - [x] Ensure `vault_search` never runs without explicit `scope: "00-Inbox/"`.

- [x] **Regression guardrails** (AC: no-mutations)
  - [x] Confirm skill text still forbids `vault_move`, `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_log_action`.

- [x] **Install + operator docs** (standing task)
  - [x] Re-run or verify `scripts/install-hermes-skill-triage.sh` still copies all referenced files.
  - [x] Update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3 for paging and optional keyword discovery if user-visible behavior changes.

## Dev Notes

### Epic / sequencing context

- **Depends on:** Story 27.1 (entrypoint, session header, read-only defaults). Extend the repo-mirrored skill under `scripts/hermes-skill-examples/triage/`; operator install path remains `~/.hermes/skills/cns/triage/`.
- **Do not implement:** heuristic routing targets (Story **27.3**), Discord approval buttons or per-item approve flows (**27.4**), `vault_move` execution (**27.5**), discard semantics (**27.6**).

### Architecture and Vault IO guardrails

- **NFR-P2 (scoped search):** Any `vault_search` call must pass **`scope: "00-Inbox/"`** (or a subdirectory path under Inbox only). Never rely on default global scope for triage.
- **`vault_list` implementation:** Recursive listing and optional `filter_by_type` / `filter_by_status` are implemented in `src/tools/vault-list.ts` and registered in `src/register-vault-io-tools.ts`. For Inbox captures, **optional PAKE filters often match nothing**; default discovery should **not** require `filter_by_type` unless the operator explicitly asks for it in a future story. Story 27.2 assumes **unfiltered** recursive listing unless you add an explicit optional flag documented in the trigger pattern.
- **Sort source:** Use `modified` from each `VaultListEntry` (`vault_list` JSON). Do not infer order from filesystem locale alone.

### Previous story intelligence (27.1)

- Repo carries the canonical skill mirror at `scripts/hermes-skill-examples/triage/` with install helper `scripts/install-hermes-skill-triage.sh`.
- Story 27.1 **did not** recurse subfolders and capped at 10 items with a “pagination later” note; **27.2 owns recursion + offset paging**.
- Session header shape and refusal messages should remain consistent unless this story explicitly revises them (prefer minimal copy churn).

### Git / recent patterns

- Epic 26 closed with Hermes installer/digest/triage scaffolding; keep changes **skill-doc-first**, small commits, and run **`bash scripts/verify.sh`** before marking done (repo gate expectation).

### Latest technical specifics

- Phase 1 tool caps and semantics: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (`vault_list`, `vault_search`).
- Canonical read boundary: `specs/cns-vault-contract/modules/security.md` (Story 4.9).

### Project context reference

- No `project-context.md` located in-repo; follow `CLAUDE.md` and `specs/cns-vault-contract/AGENTS.md` for vault boundaries.

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If paging or keyword discovery changes operator-visible behavior: update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (Section 15.3 + Version History table per local convention).
- [ ] If no user-facing change: note “Operator guide: no update required” in Dev Agent Record. _(N/A — §15.3 updated.)_

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

- Targeted regression: `node --test tests/hermes-triage-skill.test.mjs` (2026-05-04) — PASS.
- Repo gate: `bash scripts/verify.sh` (2026-05-04) — PASS.

### Completion Notes List

- Skill bumped to **v1.1.0**; discovery pipeline is normative in `references/task-prompt.md`: `vault_list` with `path: "00-Inbox/"`, `recursive: true` → `.md` files only → sort by `modified` desc / `vaultPath` asc → page size **10** → optional `vault_search` only with non-empty query and **`scope: "00-Inbox/"`**, `max_results` ≤ 50, intersected with inventory paths (order preserved).
- **Canonical paging flag:** `--offset <n>` anywhere on the Discord line; ambiguous multi-query patterns refused per `references/trigger-pattern.md`.
- **Paging footer** and **invalid-offset** single-message behavior documented in task prompt; excerpt cap remains **400** characters per note (unchanged from 27.1).
- Regression coverage: `tests/hermes-triage-skill.test.mjs`; `bash scripts/verify.sh` passed (includes install script smoke to `~/.hermes/skills/cns/triage`).
- Canonical vault copy synced: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (matched repo mirror content).
- Code review follow-up: split syntactic offset errors from post-discovery offset-past-end handling. Malformed offsets now refuse before any Vault IO call; offset-past-end runs scoped discovery first, reports the discovered total, and stops before note preview reads. Added focused regression checks for invalid-offset copy, exact `scope: "00-Inbox/"`, and listing-only discovery with no query.

### File List

- `scripts/hermes-skill-examples/triage/SKILL.md`
- `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- `scripts/hermes-skill-examples/triage/references/trigger-pattern.md`
- `scripts/hermes-skill-examples/triage/references/config-snippet.md`
- `tests/hermes-triage-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/27-2-candidate-discovery-for-00-inbox-with-scoped-listing.md`

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-04 | Story 27.2: recursive Inbox discovery, sort, `--offset` paging, optional scoped `vault_search`, paging footer UX; operator guide §15.3 + v1.17.0; Hermes triage skill regression tests. |
| 2026-05-04 | Code review fixes: clarified offset validation phases and strengthened 27.2 prompt-contract regression tests. |

---

## Story completion status

Story **27.2** (`27-2-candidate-discovery-for-00-inbox-with-scoped-listing`) completed and marked done after code review fixes.

## Open questions (saved for post-story review)

1. Should `/triage` expose optional `filter_by_type` / `filter_by_status` passthrough to `vault_list`, or stay unfiltered until a dedicated story asks for it?
2. Canonical paging syntax: prefer Discord-slash style `--offset 10` vs Hermes-native patterns; align with what the gateway reliably tokenizes.
