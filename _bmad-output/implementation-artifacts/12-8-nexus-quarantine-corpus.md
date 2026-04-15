# Story 12.8: Nexus quarantine corpus (index-build-time exclusion)

Status: done

<!--
Sprint tracker: epic-12 / 12-8-nexus-quarantine-corpus.

Key intent for 12.8:
- Prevent **silent promotion** of Nexus-origin notes into the primary Brain index even when they have well-formed PAKE frontmatter.
- Enforce **corpus-level exclusion at index-build time** (WriteGate-style boundary decision), not query-time filtering.

Precondition risk:
- The Nexus inbound path prefix/pattern is NOT currently locked down in repo docs with an exact, testable pattern.
  This story MUST establish that exact pattern before code+tests can be deterministic.
-->

## Story

As an **operator**,  
I want **Nexus-origin notes excluded from the primary Brain index at index-build time based on a documented inbound path prefix**,  
so that **dual-path content cannot be silently promoted into the primary retrieval corpus even if it includes PAKE metadata**.

## Acceptance Criteria

### 0. Precondition (must be satisfied before “done” can be claimed)

0.1 **Nexus inbound path pattern is documented and exact**  
**Given** Story 12.8 acceptance must be testable and deterministic  
**When** this story is executed  
**Then** the repo contains an **exact, unambiguous, vault-relative POSIX path prefix** (or a small ordered list of prefixes) that defines “Nexus inbound notes”  
**And** that exact pattern is documented in **at least**:
- `specs/cns-vault-contract/AGENTS.md` Section 5 (Nexus), and the mirrored vault copy `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`
- One Nexus operator doc under `docs/` (guide or operator landing page)
**And** the pattern is written in a form suitable for code+tests, e.g. one of:
- `NEXUS_INBOUND_PREFIX = "00-Inbox/_nexus"` (prefix match: exact dir or startsWith `"00-Inbox/_nexus/"`)
- Or an explicit glob-equivalent described in plain language plus its code translation rules (but tests must use the code translation)

> If the inbound prefix is not currently known, this story must first define it (by updating the docs above) before implementation proceeds.

### 1. No silent promotion (primary corpus exclusion)

1.1 **Index-build-time exclusion for Nexus path prefix**  
**Given** a note whose vault-relative path matches the documented Nexus inbound prefix  
**When** `build-index` discovers candidates and produces `brain-index.json`  
**Then** that note is **not included** in `brain-index.json.records`  
**And** it is not embedded (no call to embedder for that note)  
**And** the build result includes an exclusion record for that note with a stable machine reason code (see AC 1.2)

1.2 **Stable reason code for Nexus-origin exclusions**  
**Given** Brain index artifacts include exclusions for operator inspection and manifest reason breakdown (Story 12.5)  
**When** a note is excluded due to Nexus-origin prefix match  
**Then** the exclusion `reasonCode` is stable and machine-oriented (e.g. `EXCLUDED_NEXUS_ORIGIN`)  
**And** it does not expose secrets or note contents

1.3 **PAKE metadata does not override Nexus-origin exclusion**  
**Given** a Nexus-origin note may include valid PAKE frontmatter (including `pake_type`, `status`, `confidence_score`, etc.)  
**When** the indexer evaluates the note  
**Then** the Nexus-origin exclusion rule still applies (excluded from primary index regardless of quality metadata)

### 2. Clean architecture: exclude at discovery boundary (not query-time)

2.1 **Exclusion happens before canonical read + secret gate**  
**Given** the indexer currently applies a pipeline (discover → canonical read → frontmatter → optional `pake_types` filter → secret gate → embed)  
**When** a path matches Nexus inbound prefix  
**Then** it is excluded **during discovery** (or at latest immediately after discovery, before any reads)  
**And** query-time ranking or filtering logic does not need to special-case Nexus paths

2.2 **Hard exclusion is independent of corpus allowlist inclusion**  
**Given** an operator might allowlist `00-Inbox/**` or other broad subtrees  
**When** the effective corpus roots include a parent of the Nexus inbound prefix  
**Then** Nexus-origin notes are still excluded from the primary index by default

### 3. Optional: Quarantine corpus artifact (separate index)

3.1 **Optional quarantine corpus is explicit opt-in**  
**Given** the operator may want Nexus-origin notes retrievable sometimes  
**When** quarantine corpus mode is enabled by configuration  
**Then** Nexus-origin notes are indexed into a **separate artifact** (e.g. `brain-index.quarantine.json`)  
**And** they remain excluded from the primary `brain-index.json`  
**And** the manifest distinguishes primary vs quarantine counts and outcomes

3.2 **Default posture: no quarantine corpus**  
**Given** the charter and constitution treat Nexus writes as a trusted but ungoverned surface  
**When** no quarantine corpus configuration is present  
**Then** Nexus-origin notes are excluded from indexing entirely (no embedding, no record)

> If implementing quarantine as a separate artifact meaningfully expands scope beyond “exclude from primary index,” it is acceptable to ship AC 1–2 first and leave AC 3 as a follow-on story, **only if** Epic 12 agrees and the sprint tracker is updated accordingly. Default goal is to implement AC 3 if it is small and testable.

### 4. Automated verification

4.1 **Unit/integration tests assert exclusion**  
**Given** fixture vault content with at least:
- one “normal” note under an allowlisted subtree
- one “Nexus-origin” note under the documented inbound prefix with **valid** PAKE frontmatter (to prove no silent promotion)
**When** `npm test` runs  
**Then** tests assert:
- Nexus-origin note is not present in primary index records
- exclusion reason code is present and correct
- embedder is not invoked for the excluded note(s) (use deterministic test embedder spy/fake)
**And** `bash scripts/verify.sh` passes

## Tasks / Subtasks

- [ ] **Precondition (doc lock-in):** Establish the exact Nexus inbound prefix pattern:
  - [ ] Update `specs/cns-vault-contract/AGENTS.md` Section 5 with the exact prefix/pattern (vault-relative POSIX)
  - [ ] Mirror the same line(s) into `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` Section 5
  - [ ] Update one `docs/Nexus-*` guide to include the exact inbound prefix/pattern and brief rationale (quarantine boundary; no silent promotion)
- [ ] **Path utility:** Add `isNexusInboundVaultPath(vaultRelPosix: string)` in `src/brain/brain-path-utils.ts` (mirrors `isMetaLogsVaultPath` style).
- [ ] **Discovery exclusion:** Apply the check in `discoverMarkdownCandidates` (`src/brain/build-index.ts`) so excluded paths never enter the candidates set.
- [ ] **Exclusion recording:** Ensure build result records excluded Nexus-origin paths with stable reason code `EXCLUDED_NEXUS_ORIGIN`.
- [ ] **(Optional) Quarantine index:** If in-scope, implement a separate artifact build for the quarantine corpus with separate manifest counts.
- [ ] **Tests:** Add/extend tests under `tests/brain/**` and add fixture notes to `tests/fixtures/minimal-vault/**` (or a dedicated fixture vault) to cover:
  - PAKE-valid Nexus note excluded
  - Non-Nexus note included
  - Allowlisted parents don’t override Nexus exclusion
- [ ] **Verify gate:** Run `bash scripts/verify.sh` and record outcome in Dev Agent Record.

## Dev Notes

### Why this story exists (risk statement)

Nexus is a **trusted write surface outside Vault IO governance**. A dual-path risk exists where Nexus could write a note that *appears* PAKE-compliant and achieves a high quality score, which would otherwise cause it to enter the Brain index and be retrieved as if it were governed, triaged content.

This story implements “no silent promotion” as a **positive exclusion signal**: paths matching the Nexus inbound prefix are excluded from the primary index *regardless of frontmatter or score*.

### Findings (Option C — close as superseded)

The charter’s “no silent promotion” requirement is **structurally satisfied** without introducing a brittle Nexus-origin filter.

- **AC #0 (inbound prefix) is unresolvable without a Nexus behavior change**: there is no stable, repo-documented, testable inbound prefix/pattern for Nexus-written notes today. Attempting to infer or guess this signal would create a maintenance trap whenever Nexus write behavior changes.
- **Charter requirement is satisfied by Story 12.7’s missing-quality penalty**: notes with **absent PAKE quality metadata** are down-ranked with a flat **0.25 floor**, preventing silent promotion of incomplete dual-path content into top results.
- **Decision**: Story **12.8 is closed as superseded** by 12.7 for the “no silent promotion” requirement. If a dedicated Nexus staging path is later established (or Nexus emits a durable marker such as `source_surface: nexus`), a **targeted follow-on** can add path-based exclusion or quarantine corpus with deterministic tests.

### Implementation guardrails (match existing indexer structure)

- Prefer exclusion at **candidate discovery** time to avoid IO/embedding cost and to keep query logic clean.
- Mirror the existing “hard exclusion” pattern used for `_meta/logs/**`:
  - [Source: `src/brain/brain-path-utils.ts` — `isMetaLogsVaultPath`]
  - [Source: `src/brain/build-index.ts` — discover + canonical read + secret gate chain]
- Keep the exclusion reason code stable; future manifest breakdowns will rely on it.
- Do not change Vault IO / WriteGate behavior in this story. This is Brain indexing policy only.

### Source hints

- Constitution Nexus section (trust boundary and incomplete notes):  
  - [Source: `specs/cns-vault-contract/AGENTS.md` Section 5]
  - [Source: `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` Section 5]
- Index build pipeline and existing hard exclusions:  
  - [Source: `src/brain/build-index.ts` — `discoverMarkdownCandidates`, `_meta/logs/**` hard exclude]
  - [Source: `src/brain/indexing-secret-gate.ts`]
- Retrieval should not special-case Nexus if exclusion is correct:  
  - [Source: `src/brain/retrieval/query-index.ts`]

## Standing tasks (every story)

### Standing task: Update operator guide

- [ ] If this story changes any operator-facing workflow or configuration knobs, update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` with:
  - the documented Nexus inbound prefix
  - how to enable quarantine corpus (if implemented)
  - where to find primary vs quarantine artifacts and manifests

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

