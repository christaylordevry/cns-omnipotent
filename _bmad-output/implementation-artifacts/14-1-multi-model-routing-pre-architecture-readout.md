# Story 14.1: Multi-model routing pre-architecture readout

Status: done

<!-- Sprint: epic-14 / 14-1-multi-model-routing-pre-architecture-readout. Planning-only: publish readout under planning artifacts. Pattern: Epic 12.1 Brain charter — freeze design space before implementation. No router code, no new MCP tools, no src/ changes; verify.sh unchanged unless someone adds a new check (do not). -->

## Story

As a **maintainer**,  
I want **a readout that maps surfaces, policies, and configuration boundaries for model selection**,  
so that **Phase 3 stories can be sliced without retrofitting security or secrets handling**.

## Expanded survey brief (operator)

This story is **pure research / documentation**. Deliverable is an **informed design-options readout** for a future Phase 3 epic — **not** a final architecture decision.

- **No** implementation: **no** `src/` changes, **`bash scripts/verify.sh` untouched** (same gate as 12.1: lint, test, typecheck only; markdown alone does not change the gate).
- **Survey explicitly:**
  - **LLM-as-router** (model or small LLM classifies task → picks downstream model) **vs** **rules-based / deterministic** routing (policy tables, allowlists, static fallbacks).
  - **Latency vs cost** tradeoffs (extra hop for routing, caching of decisions, when a cheap classifier is enough).
  - **Stack placement:** how routing sits **above** the existing **Vault IO** read/write boundary and the **Brain** (retrieval / context) layer — dependencies **none / soft / hard** with rationale.
- **Outcome:** a **design options** doc (pros/cons, when to use which pattern) that feeds story slicing — **not** a single chosen design.

Canonical acceptance criteria remain those in `epics.md` (Epic 14, Story 14.1); the brief above is **additional** content the readout must cover or explicitly reconcile if already partially present.

## Acceptance Criteria

1. **Given** Phase 1 and Phase 2.0 completion assumptions (vault contract + Vault IO stable)  
   **When** the readout is published under `_bmad-output/planning-artifacts/` (standalone or architecture addendum)  
   **Then** it lists **in-scope surfaces** (e.g., Cursor, Claude Code, future CLI or daemon mentioned only as placeholders) and, for each, whether routing is **per-session**, **per-task**, or **per-tool**

2. **Given** CNS security posture expectations  
   **When** secrets and policy placement are described  
   **Then** it classifies **secrets**: where API keys and org policies live (env, vault-stored config, host keychain) and what must **never** be logged or echoed

3. **Given** routing needs to be policy-driven not vendor-driven  
   **When** model routing policy is specified at design level  
   **Then** it defines **policy dimensions**: default model, fallback on rate limit or outage, allowed model list, operator override rules

4. **Given** Phase 2.1 Brain and mobile work may influence routing inputs  
   **When** dependencies are assessed  
   **Then** it calls out **dependencies** on Brain or mobile epics if routing must know about retrieval context or device class (explicit **none / soft / hard** dependency statement)

5. **Given** Phase 3 should be sliceable and staged  
   **When** the readout concludes  
   **Then** it ends with a **recommended epic breakdown** (ordered list of candidate Phase 3 epics or stories) without implementing code, daemons, or new MCP transports

6. **Given** this is a planning-only story  
   **When** work is complete  
   **Then** **no** OpenClaw, always-on daemon, or router implementation ships in this story; **repository product code** may remain untouched (BMAD tracking files may still update for story workflow)

7. **Survey dimensions (brief)**  
   **Given** the operator design-options brief  
   **When** the readout is read  
   **Then** it includes a **comparative** treatment of **LLM-mediated routing** vs **deterministic / rules-based** routing (strengths, failure modes, auditability, operational complexity)  
   **And** it discusses **latency and cost** implications at a design level (not benchmarks — qualitative tradeoffs)  
   **And** it states how routing relates to **Vault IO** (tool boundary, audit summaries) and **Brain** (optional retrieval/context inputs), without implying Phase 1 MCP semantic changes

## Tasks / Subtasks

- [x] Reconcile or create planning artifact (AC: 1–7)
  - [x] Primary path: `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` — if it already exists, **diff** against AC + brief; add or refactor sections so every AC and survey bullet is explicitly satisfied (do not rely on implicit coverage).
  - [x] Add or strengthen **§ comparative routing mechanisms** (LLM-as-router vs rules/policy engine): when each fits, failure modes, audit story.
  - [x] Add or strengthen **§ latency / cost** (routing hop, decision caching, cheap vs expensive model paths).
  - [x] Add or strengthen **§ stack placement**: Vault IO boundary, Brain soft inputs, no new MCP tools in this story.
- [x] Surface matrix + secrets placement + policy dimensions (AC: 1–3) — verify tables/lists match epics wording.
- [x] Dependencies: explicit **Hard: none** where applicable + soft Brain/Mobile (AC: 4, 7).
- [x] End document on **recommended Phase 3 epic/story breakdown** (AC: 5); no trailing appendices that violate “concludes with breakdown.”
- [x] Confirm **no** `src/` router implementation; no new MCP transports (AC: 6).
- [x] Run `bash scripts/verify.sh` before marking done; record outcome in Dev Agent Record (attach or describe — avoid unauditable claims).

## Dev Notes

### Epic and program context

Epic 14 is **Phase 3 preview**: multi-model routing as **CNS control-plane** concern (sessions, credentials, quotas, policy across IDEs/CLIs). This story **only** produces the readout. [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 14, Story 14.1]

**Pattern reference (same class of work):** Story **12.1** Brain charter — planning artifact under `_bmad-output/planning-artifacts/`, explicit inclusions/exclusions, no indexer code. [Source: `_bmad-output/implementation-artifacts/12-1-brain-service-scope-charter-phase-21.md`]

### Technical requirements (guardrails)

- **Phase 1 implementation scope** in `CLAUDE.md` still applies: do not implement deferred Phase 3 routing in `src/` here.
- **Audit / secrets:** Align with Phase 1 posture — truncated summaries, never full payloads; no API keys in docs. [Source: `_bmad-output/planning-artifacts/architecture.md` — MCP stack, audit expectations]
- **Story 5.2** remains the binding reference for any future mutators; this story does not add mutators. [Source: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`]

### Architecture compliance

- Readout is **vendor-neutral**: model **aliases**, policy dimensions, not a single provider’s SDK shape.
- **Vault IO MCP** today is **not** an LLM router; any “per-tool routing at host boundary” is **future / placeholder** language only (avoid implying Phase 1 tool behavior changes).

### File structure requirements

| Artifact | Path |
|----------|------|
| Planning readout (primary deliverable) | `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` |
| Story tracking (this file) | `_bmad-output/implementation-artifacts/14-1-multi-model-routing-pre-architecture-readout.md` |
| Epics source of truth | `_bmad-output/planning-artifacts/epics.md` |

### Testing requirements

- **No new automated tests** required for markdown-only work.
- **Verification gate:** `bash scripts/verify.sh` must pass unchanged in behavior; record result in Dev Agent Record.

### Previous story intelligence (Epic 13)

Story **13.1** was documentation-led: planning artifact under `_bmad-output/planning-artifacts/`, constitution pointer pattern, **no** new Vault IO tools. Reuse that discipline: one authoritative planning doc, explicit non-goals. [Source: `_bmad-output/implementation-artifacts/13-1-mobile-vault-access-journey-and-governance-posture.md`]

### Git intelligence (recent repo activity)

Recent commits emphasize docs/constitution and BMAD templates — no conflicting routing implementation in `src/` expected. Keep this story **planning-only** to match repo phase boundaries.

### Project context reference

No `project-context.md` found in repo; use `CLAUDE.md`, `specs/cns-vault-contract/AGENTS.md`, and planning artifacts as grounding.

### Project Structure Notes

- If the planning readout already contains strong material, **extend and reconcile** rather than duplicating files. Preserve frontmatter conventions (`title`, `date`, `tags`, `status`, `source`) if present.
- Align `status` in planning frontmatter with team convention (`draft` / `review` / `final`) — document in Dev Agent Record if you change it.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 14, Story 14.1]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` — §3.1 multi-model routing, if present]
- [Source: `CLAUDE.md` — scope boundaries]
- [Source: `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` — existing readout, if present]

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If this story changes any user-facing behavior (new tool, workflow, constraint, panel, integration): update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` via Vault IO, bump `modified`, Version History §12.
- [x] If **no** user-facing behavior: note **“Operator guide: no update required”** in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

None.

### Completion Notes List

- Reconciled `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` against Story 14.1 AC 1–7 and the expanded survey brief. **Gap closed for AC 7:** added dedicated sections for **LLM-mediated vs deterministic routing** (strengths, failure modes, auditability, operational complexity, hybrid note), **latency and cost** (qualitative: extra hop, caching keys, cheap vs expensive paths, fallback amplification), and **stack placement** (Vault IO as data-plane tool boundary — routing in host; separate audit channel; Brain/Mobile as optional policy inputs; explicit **no Phase 1 MCP contract changes** in this planning story).
- Clarified in Overview that the readout is **design options, not a mandated architecture**; updated abstract and planning frontmatter `status` to **final**.
- Cross-linked **Dependencies** to the new stack-placement section to avoid duplicate narrative.
- **Operator guide: no update required** (planning artifact only; no new tools or operator workflows).
- **Verification:** `bash scripts/verify.sh` completed successfully (exit 0): npm test, vitest, lint, typecheck, build — **VERIFY PASSED** (2026-04-14).

### File List

- `_bmad-output/planning-artifacts/multi-model-routing-pre-architecture-readout.md` (modified)
- `_bmad-output/implementation-artifacts/14-1-multi-model-routing-pre-architecture-readout.md` (modified — story tracking only)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status)

### Change Log

- 2026-04-14: Story 14.1 — Finalized multi-model routing pre-architecture readout (AC 1–7); sprint status → review.
- 2026-04-14: Story 14.1 — Code review passed; sprint status → done; Epic 14 closed; retrospective recorded.

---

**Story completion status:** Done (`done`).
