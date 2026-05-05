# Task: `/triage` preview + `/approve` pattern + `/execute-approved` move (Stories 27.1 to 27.6)

## Hard constraints (must follow)

1. **Channel scope**: this runs only for Discord `#hermes` (per operator config).
2. **Mutations are command-gated**: do **not** call any mutating Vault IO tool during `/triage` or `/approve`. The only allowed mutating tool in this skill is `vault_move`, and only for a valid `/execute-approved` command.
   - Forbidden tools in every mode: `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_log_action`
3. **Approvals are non-mutating**: `/approve` is allowed (Story 27.4), but it must never call Vault IO tools and must never execute moves.
4. **Execution is narrow and governed**: `/execute-approved` is allowed (Story 27.5), but it may call only `vault_move` exactly once after validation. Do not call `vault_log_action`; successful `vault_move` emits the audit line.
5. **Scoped discovery**: every Vault IO call used to discover or preview candidates must stay **at or under** `00-Inbox/` only. Do **not** list, search, or read `AI-Context/`, `_meta/logs/`, or other paths outside Inbox for this task.
6. **`vault_search` rule**: call **`vault_search` only if** the operator provided a **non-empty** literal `query` per `references/trigger-pattern.md`. When calling it, set **`scope` exactly to `00-Inbox/`** and **`max_results` ≤ 50**. If there is **no** query, use **listing-only** discovery (no `vault_search`).
7. **Bounded output**: cap page size and excerpt size; avoid spamming Discord.
8. **Routing suggestions are advisory**: any routing suggestions in Story 27.3 are **read-only** and must not propose execution. Do not infer “project context” for `WorkflowNote`.
9. **Deterministic signals only**: routing suggestions must use only `vaultPath`, `modified` timestamps from `vault_list`, and optional `vault_read_frontmatter` results. Do not use note body excerpts as routing signals.

### Story 27.4 addition: approvals are allowed but still non-mutating

- `/approve` commands are now supported as a **non-mutating approval interaction pattern**.
- Approval handling in 27.4 must not call any Vault IO tools (read or write). It is purely parse + validate + acknowledge.

### Story 27.5 addition: approved moves can execute through `vault_move`

- `/execute-approved` commands are now supported as the **only** mutating path in this skill.
- Execution handling must validate input first, derive `destination_path`, call `vault_move` exactly once, and stop.
- Do not call `vault_log_action`. `vault_move` owns the audit line.

### Story 27.6 addition: discard safety and non-destructive guarantees

- Hermes must **not** delete, truncate, or “discard” notes via MCP delete tools (**Phase 1 does not expose `vault_delete` / `vault_trash`**—do not assume them), shell **`rm`**, or filesystem bypasses.
- The **only** automated relocation remains **`/execute-approved … --to …/`** → exactly **one** **`vault_move`**.
- **Routing suggestions** must never propose deletion, discard-as-delete, or archive-as-delete; the **stale** bucket still appends “stale capture, review relevance” only (no automated discard language).

## Discard / delete / archive safety (Story 27.6)

**Vocabulary mapping (operator colloquial → allowed automation):**

- **“Move” / “file” / “route”** (to a stated vault directory): use the canonical **`/execute-approved <00-Inbox/path.md> --to <destination_dir>/`** grammar → **`vault_move`** once; destination is operator-chosen (WriteGate/PAKE apply when leaving **`00-Inbox/`**).
- **“Discard” / “delete” / “archive”** meaning **remove from Inbox**: treat as **optional relocation**—same **`/execute-approved`** pattern to an operator-chosen folder (vault-neutral; no canonical “discard pile” required)—**or** tell the operator to remove the note **only** via **human** steps (Obsidian UI, manual filesystem) **outside** Hermes. Never imply silent destruction or automated permanent deletion.
- **Bulk** “clear the inbox” / **rename-only** shortcuts / **implicit archive folders**: **not** automated here—each item needs its own explicit **`/execute-approved`** if relocating; no batch orchestration.

**Non-destructive guarantees (repeatable copy):**

- **`/triage`** and **`/approve`**: **non-mutating** (no Vault IO writes).
- **`/execute-approved`**: **only** **`vault_move`** (once); **no** **`vault_log_action`** on the success path for that move (**`vault_move`** emits the audit line).
- **No** bulk moves, **no** rename-without-**`vault_move`**, **no** archive-folder automation unless the destination appears explicitly in **`--to`**.

**Valid structured commands vs destructive colloquial examples:**

- **Valid:** `/triage`, `/triage --offset 10`, `/approve 00-Inbox/x.md --to 03-Resources/`, `/execute-approved 00-Inbox/x.md --to 03-Resources/`.
- **Refuse (fail-closed, no Vault IO):** “delete this note”, “discard all stale captures”, “archive via rm”, “run rm on 00-Inbox”, “use vault_delete”, natural-language move/delete without valid **`/execute-approved`** grammar—except when the message **starts with** valid **`/execute-approved`**, in which case follow **Execute approved move handling** instead.

## Inputs

- A Discord message that matches the positive trigger grammar in `references/trigger-pattern.md` after trimming.
- If the message starts with `/approve`, follow **Approval handling (Story 27.4)** and stop.
- If the message starts with `/execute-approved`, follow **Execute approved move handling (Story 27.5)** and stop.
- Otherwise, treat it as `/triage` and parse **`offset`** (default `0`) and optional **`query`** from the message.
- If parsing fails because the input is syntactically invalid (negative offset, non-numeric offset, non-integer offset, missing offset value, duplicate `--offset`, ambiguous query, etc.), emit **only** the **single early error block** below and **stop** before any Vault IO call.
- If parsing succeeds but the offset is later found to be past the end of the discovered candidate list, follow the **Offset past end** handling below instead. That case requires discovery first so Hermes can know `total`.

### Early invalid input (no tools run)

```markdown
## Triage input error

<message: one short sentence explaining the syntactic problem (e.g. invalid offset, ambiguous multi-query).>

No vault tools were run; no actions taken.
```

For syntactically invalid offsets specifically (negative, non-numeric, not an integer, missing value, or duplicate `--offset`): use one clear sentence that states the problem. Do not call `vault_list`, `vault_search`, or `vault_read`.

## Session header (emit first on successful `/triage` parse)

Return a triage session header in-channel with:

- Timestamp: ISO 8601 UTC (e.g. `2026-05-04T13:43:00.000Z`)
- Session id: stable unique id for this run (UUID preferred). If you cannot generate one via a tool, generate a UUID-like string and keep it consistent for the entire response.

Use this exact header shape:

```markdown
## Hermes triage session

- **timestamp_utc:** `<ISO8601>`
- **session_id:** `<id>`
- **mode:** read-only (mutations disabled)
```

## Approval handling (Story 27.4, non-mutating)

If the operator message matches the `/approve` grammar:

1. Parse the single-line command:
   - Tokens are split on ASCII whitespace and the command must have exactly four tokens: `/approve`, `source_path`, `--to`, `destination_dir`
   - `source_path` is the token immediately after `/approve`
   - `--to` must appear exactly once and must be followed by `destination_dir`
2. Validate (strict, bounded):
   - `source_path` must start with `00-Inbox/` and end with `.md`
   - `source_path` must not contain `..` segments
   - `destination_dir` must end with `/`
   - `destination_dir` must not start with `/` and must not contain `..`
   - `destination_dir` must not be under protected prefixes: `AI-Context/`, `_meta/`
3. On validation failure, emit only:

```markdown
## Approval input error

<one short sentence explaining the problem.>

No vault tools were run; no actions taken.
```

4. On success, emit:

```markdown
## Approval recorded (no mutations)

- **source:** `<source_path>`
- **destination:** `<destination_dir>`
- **note:** Approved for later execution only (Story 27.5). No actions taken.
```

Then stop. Do not emit a triage session header and do not run any Vault IO tools.

## Execute approved move handling (Story 27.5)

If the operator message matches the `/execute-approved` grammar:

1. Parse the single-line command:
   - Tokens are split on ASCII whitespace and the command must have exactly four tokens: `/execute-approved`, `source_path`, `--to`, `destination_dir`
   - `source_path` is the token immediately after `/execute-approved`
   - `--to` must appear exactly once and must be followed by `destination_dir`
2. Validate before any Vault IO call:
   - `source_path` must start with `00-Inbox/` and end with `.md`
   - `source_path` must not start with `/`
   - `source_path` must not contain `..` segments
   - `destination_dir` must end with `/`
   - `destination_dir` must not start with `/` and must not contain `..`
   - `destination_dir` must not be under protected prefixes: `AI-Context/`, `_meta/`
3. Derive:
   - `destination_path = destination_dir + basename(source_path)`
   - `basename(source_path)` is the final path segment after `/`
   - Do not preserve any `00-Inbox/` subfolder structure unless the operator explicitly encodes it in `destination_dir`
4. Call **`vault_move`** exactly once:

```json
{
  "source_path": "<source_path>",
  "destination_path": "<destination_path>"
}
```

Do not call `vault_log_action`. vault_move emitted the audit line on success through the shared Vault IO audit logger.

5. On validation failure, emit only:

```markdown
## Execute-approved input error

<one short sentence explaining the problem.>

No vault tools were run; no actions taken.
```

6. On successful `vault_move`, emit:

```markdown
## Approved move executed

- **source:** `<source_path>`
- **destination:** `<destination_path>`
- **backlinks_updated:** `<true|false if present>`
- **partial_wikilink_repair:** `<true|false if present>`
- **wikilink_repair_warnings:** `<count and short summary, or none>`
- **audit:** `vault_move` emitted the audit line in `_meta/logs/agent-log.md`.
```

Then stop. Do not emit a triage session header and do not call any other mutating Vault IO tool.

7. If `vault_move` returns or throws an error, emit only:

```markdown
## Approved move failed

- **source:** `<source_path>`
- **destination:** `<destination_path>`
- **error:** `<short error class/message only>`
- **note:** No fallback filesystem mutation was attempted.
```

Then stop. Do not retry with raw filesystem writes, do not call `vault_log_action`, and do not call another mutator.

## Discovery pipeline (must run in order)

### A) Enumerate markdown files under Inbox (always)

1. Call **`vault_list`** with:
   - `path: "00-Inbox/"`
   - **`recursive: true`**
   - Do **not** require `filter_by_type` / `filter_by_status` unless the operator explicitly asks in a future story.
2. From `entries`, keep **only file rows** where **`vaultPath`** ends with **`.md`** (skip directories and non-markdown files).
3. **Sort** the kept rows:
   - Primary: **`modified`** ISO timestamp **descending** (newest first).
   - Secondary tie-break: **`vaultPath`** ascending (lexicographic).
4. Let **`inventory_paths`** be the ordered list of `vaultPath` strings after sort.

### B) Optional keyword narrowing

- If **`query`** is empty: set **`candidate_paths = inventory_paths`** (same order).
- If **`query`** is non-empty:
  1. Call **`vault_search`** with `query`, **`scope: "00-Inbox/"`**, and `max_results` at most **50**.
  2. Collect hit paths from the search result that reference markdown files under `00-Inbox/` (normalize to vault-relative paths consistent with `vault_list`).
  3. **`candidate_paths`** = hits **intersected** with **`inventory_paths`**, preserving the **order** of `inventory_paths` (search only filters; it does not redefine sort order).

### C) Paging constants

- **`page_size`:** **10** (same as Story 27.1 unless deliberately changed in spec).
- **`total`** = `candidate_paths.length`.

Validate the already-parsed **`offset`** against **`total`**:

- Syntactic offset errors should already have stopped before discovery. Do not reclassify them here.
- If **`total == 0`** and **`offset != 0`**: emit the **Offset past end** block and stop before any `vault_read`.
- If **`total > 0`** and **`offset >= total`**: emit the **Offset past end** block and stop before any `vault_read`.
- If **`total == 0`** and **`offset == 0`**: skip preview reads; still emit session header and the empty-candidate message below.

Otherwise **`page_paths`** = slice `candidate_paths[offset .. offset + page_size)`.

### D) Offset past end after discovery

If a syntactically valid offset is past the end of the candidate list, discovery has already run. Keep the session header, then emit:

```markdown
## Triage input error

Requested offset `<offset>` is past the end of `<total>` matching markdown candidate(s).

Discovery ran under `00-Inbox/`; no note previews were read; no actions taken.
```

Then stop. Do not call `vault_read` or `vault_read_frontmatter`.

### E) Empty candidate set

If **`total == 0`** after filters:

```markdown
## No matching candidates

No markdown notes matched the current triage filters under `00-Inbox/`.
```

Then emit the **Paging footer** with zeros / offset as appropriate and **stop** (no `vault_read`).

## Preview each candidate on this page (bounded)

For each path in **`page_paths`**:

1. Call **`vault_read`** on that vault path.
2. Optionally call **`vault_read_frontmatter`** if you need structured metadata; excerpts below still follow the body rule.
3. Extract an excerpt from the note body:
   - **Max 400 characters** (hard cap).
   - Prefer the first non-empty paragraph after frontmatter if present; otherwise the first non-empty lines.
4. If **`vault_read`** fails for one path: emit an **error row** for that item and continue the rest (failure isolation for Story 27.1).

## Routing suggestions (Story 27.3)

Attach a **routing suggestion** to each successfully previewed candidate (and to error rows when possible using listing metadata only).

### Inputs for suggestions

- **Primary**: `pake_type` from `vault_read_frontmatter` when present and valid.
- **Secondary**: filename and path tokens from `vaultPath` (lowercased).
- **Tertiary**: age bucket computed from the `modified` timestamp returned by `vault_list`.

If you can, call `vault_read_frontmatter` in **bulk** with `paths: page_paths` to reduce calls. If that fails for any path, treat `pake_type` as missing for that item.

### A) Age bucket rules (deterministic)

Compute age in whole days from `timestamp_utc` (session header) minus the `modified` ISO timestamp from `vault_list`:

- `fresh`: age_days ≤ 2
- `recent`: age_days ≤ 14
- `stale`: age_days > 14

### B) Routing defaults by PAKE type (Phase 1)

If `pake_type` is present and one of:

- `SourceNote`, `InsightNote`, `SynthesisNote`, `ValidationNote`:
  - suggested `pake_type`: the same value
  - suggested destination: `03-Resources/`
  - confidence: `high`
  - reason: “frontmatter pake_type=<type>; age=<bucket>”

- `WorkflowNote`:
  - suggested `pake_type`: `WorkflowNote`
  - suggested destination:
    - If the operator supplied explicit project context in the triage command line (not supported yet by trigger grammar), then `01-Projects/<project>/`
    - Otherwise `02-Areas/` (fallback)
  - confidence: `medium` (or `high` only when explicit project context is present)
  - reason: “frontmatter pake_type=WorkflowNote; no explicit project context; age=<bucket>”

If `pake_type` is missing or invalid, proceed to filename heuristics.

### C) Filename and path heuristics (when `pake_type` missing)

Use these deterministic token rules over `vaultPath` (lowercased). If multiple rules match, use the first match in this order:

1. **WorkflowNote-ish** tokens: `workflow`, `checklist`, `plan`, `spec`, `roadmap`, `todo`
   - suggested `pake_type`: `WorkflowNote`
   - destination: `02-Areas/`
   - confidence: `medium`
   - reason: “no pake_type; filename/path matched WorkflowNote token `<matched-token>`; age=<bucket>”
2. **Synthesis-ish** tokens: `synthesis`, `summary`, `overview`
   - suggested `pake_type`: `SynthesisNote`
   - destination: `03-Resources/`
   - confidence: `medium`
   - reason: “no pake_type; filename/path matched SynthesisNote token `<matched-token>`; age=<bucket>”
3. **Insight-ish** tokens: `insight`, `idea`, `analysis`
   - suggested `pake_type`: `InsightNote`
   - destination: `03-Resources/`
   - confidence: `medium`
   - reason: “no pake_type; filename/path matched InsightNote token `<matched-token>`; age=<bucket>”
4. **Validation-ish** tokens: `validate`, `verification`, `fact-check`
   - suggested `pake_type`: `ValidationNote`
   - destination: `03-Resources/`
   - confidence: `medium`
   - reason: “no pake_type; filename/path matched ValidationNote token `<matched-token>`; age=<bucket>”
5. **Source-ish** tokens: `source`, `clip`, `article`, `paper`, `pdf`, `link`, `http`, `https`
   - suggested `pake_type`: `SourceNote`
   - destination: `03-Resources/`
   - confidence: `low` (raise to `medium` only when the path clearly encodes a source, e.g. contains `http` or `https`)
   - reason: “no pake_type; filename/path matched SourceNote token `<matched-token>`; age=<bucket>”

If nothing matches:

- suggested `pake_type`: `unknown`
- destination: `00-Inbox/`
- confidence: `low`
- reason: “no pake_type; no filename heuristics matched; age=<bucket>”

### D) Stale copy rule

If age bucket is `stale`, append one short clause to the reason: “stale capture, review relevance” (do not propose deletion, discard, or archive).

## Output schema (reply)

After the session header, output:

```markdown
## Candidates (read-only preview)

<numbered list>

## Notes

- This is a **read-only** preview. No notes were moved, renamed, edited, deleted, or truncated.
- `/approve` is a **non-mutating** approval pattern (no Vault IO calls).
- `/execute-approved` executes exactly one governed move through **`vault_move`** only (no other mutators; no **`vault_log_action`** for that move).
- Hermes does **not** automate deletion or “discard-as-delete”; relocation is **`vault_move`** via **`/execute-approved`** only; permanent removal is **human-only** outside this skill.

## Paging

- **matching_notes:** `<total>` markdown file(s) under `00-Inbox/` (after filters).
- **this_page:** offset `<offset>`, showing `<shown>` item(s), page size `<page_size>` (`<page_size>` default **10**).
- **next_page:** `<explicit command, e.g. /triage --offset <next>`, repeating the same literal query if one was used>`
```

Rules for **Paging** section:

- **`shown`** = number of items listed this turn (including error rows for failed reads).
- If **`offset + shown < total`** (more candidates remain): state explicitly that **more pages exist**.
- If **`total ≤ page_size`** or **`offset + shown ≥ total`**: state that this is the **last page** (no further items).
- Always include **`matching_notes`** = **`total`** after filters.

Each numbered list item must follow:

```markdown
1. `<path>`
   - excerpt: `<short excerpt...>`
   - routing_suggestion:
     - pake_type: `<SourceNote|InsightNote|SynthesisNote|WorkflowNote|ValidationNote|unknown>`
     - destination: `<03-Resources/|02-Areas/|00-Inbox/|01-Projects/<project>/>`
     - confidence: `<low|medium|high>`
     - reason: `<one short sentence>`
   - approve: `/approve <path> --to <destination>/` (edit `<destination>/` to override; no actions taken)
   - execute: `/execute-approved <path> --to <destination>/` (calls `vault_move` for this one item)
```

If an item errored:

```markdown
1. `<path>`
   - error: `<error class/message>`
   - routing_suggestion:
     - pake_type: `<...>`
     - destination: `<...>`
     - confidence: `<...>`
     - reason: `<...>`
```

## Refusal handling (approval/mutation attempts)

If the operator message starts with valid `/execute-approved`, follow **Execute approved move handling (Story 27.5)** above (**Story 27.6**: this branch takes precedence over keyword checks—do not refuse valid **`/execute-approved`** because the substring “execute” appears).

If the operator message includes any of these (case-insensitive): `move`, `rename`, `discard`, `delete`, `archive`, or `execute`, or looks like an execution action outside valid `/execute-approved` (e.g. `/move`, “go ahead and move it”, “execute approvals”),
respond with:

```markdown
## Mutations disabled

Mutations are disabled except for one valid `/execute-approved` command; no actions taken.
```

Then continue with the read-only preview **only if** the message still satisfies the triage trigger grammar; otherwise do not run this skill.
