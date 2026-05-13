# Epic 29 — Knowledge Quality + Agent Memory

BMAD planning artifact: epic brief, story cards (29-0 … 29-10), sprint sequence, and AGENTS.md §8 draft.

**Parent phase:** Phase 6 (first epic)  
**Locked shape:** Do not merge stories (especially keep 29-1 stable identity separate from 29-2 rolling memory).

---

## Step 1 — Epic brief (BMAD)

### Epic summary

Epic 29 delivers **agent memory** (USER.md, MEMORY.md, cold-start verification), **vault quality** (deterministic lint spec, `/vault-lint` skill, ingest-time dedup guard alignment), and **housekeeping / cognition** (CLAUDE.md shim parity, token budget policy in constitution, `vault_request_disambiguation` MCP tool, fast-scan index + session-close, on-demand Hermes thinking commands). It encodes **token efficiency** as a **hard acceptance criterion** on every story that injects context, reflecting overhead analysis (Cherny-style token budget discipline).

### Business value

- **Continuity:** Rolling MEMORY.md and stable USER.md reduce cold-start confusion and repeat operator narration.
- **Quality:** Report-only vault lint and forward dedup lower duplicate noise and structural debt without risky auto-fix.
- **Operator trust:** Explicit disambiguation MCP tool and read-only thinking skills avoid silent wrong routing.
- **Cost / latency:** Token budgets cap always-on context; on-demand skills avoid paying cognition tax every turn.

### Success criteria (epic level)

1. Hermes cold-start loads **USER.md** (≤1200 chars) and **MEMORY.md** (≤2000 chars) at agreed positions; session-close regenerates MEMORY.md each run within cap.
2. Deterministic **vault lint** (four rules) runs **on demand**; output goes to **Discord** and **`_meta/logs/vault-lint-YYYY-MM-DD.md`** (report-only, Option A).
3. **Ingest-time dedup** prevents forward duplicate URLs (and agreed normalization) across **all** governed ingest entrypoints aligned with `src/ingest/duplicate.ts` / pipeline.
4. **Token Budget Policy** is normative in constitution (**`specs/cns-vault-contract/AGENTS.md`** + canonical vault copy, synced).
5. **`vault_request_disambiguation`** exists with **zero always-on** token cost (tool invoked only when needed).
6. **Fast-scan index** integrated with session-close with **≤2000 tokens** total for the injected index artifact per acceptance tests.
7. **Thinking commands** skill: **zero always-on** overhead; **read-only** vault operations unless explicitly using Vault IO writes.

### Out of scope (explicit)

- **Epic 30 — Research Pipeline Auto-Synthesis** (approval-time trigger, `03-Resources/`, `verification_status: pending`). Pre-scoped only; not part of Epic 29 delivery.
- **Phase 3** items from `CNS-Phase-1-Spec.md` deferred table and constitution parking lot, including: OpenClaw daemon, pgvector / Archon-class RAG, multi-model consensus routing, and related Phase 3+ backlog unless pulled in by a future epic.
- **LLM-assisted contradiction detection** for vault lint (deferred past Option A).
- **Auto-fix** lint (report-only first).

### Dependencies

- **Epics 1–28 complete** (Vault IO MCP, Hermes Discord, session-close, triage, NotebookLM registration, #general capture).
- **Hermes** `~/.hermes/config.yaml` channel bindings and skill install paths per `CNS-Operator-Guide` §15.
- **Vault IO** WriteGate and PAKE norms (`specs/cns-vault-contract/`, `CNS-Phase-1-Spec.md`).
- **Pre-work 29-0** before implementation stories.

### Risks

| Risk | Mitigation |
|------|------------|
| Constitution / vault **dual sync** drift | Session-close and manual edits follow two-file rule; verify byte match before commit. |
| **MEMORY.md** regeneration overwrites operator intent | Schema + template; cap enforced in tests; session-close contract explicit. |
| **Lint** false positives erode trust | Report-only; narrow deterministic rules; document exclusions in spec story. |
| **MCP tool** signature changes need operator approval | Story 29-8 stays within safe patterns; no audit/WriteGate changes without approval. |
| **Hermes** SOUL.md re-seed | Standing rule: remove `~/.hermes/SOUL.md` after `hermes version` or gateway restart. |
| **Token budgets** gamed by unicode / compression | Define measurement method (UTF-8 byte length or Hermes char limits) in 29-7 policy. |

### Token efficiency principle (standing constraint)

Every story with context injection **must** state a **testable** token or character budget in acceptance criteria. Exceeding budget **fails DoD**. On-demand skills must document **zero always-on** overhead. Cross-reference Cherny-style overhead awareness: prefer smaller context, progressive disclosure, and module loading over bloating AGENTS.md.

---

## Step 2 — Story cards

### 29-0 — Token audit + MCP always-on cleanup

| Field | Content |
|-------|---------|
| **Theme** | Pre-work ops |
| **Persona story** | As an **operator**, I want a **baseline token audit and MCP always-on configuration cleanup**, so that **Epic 29 implementation does not inherit hidden context bloat or redundant MCP load**. |
| **Acceptance criteria** | (1) Document current cold-start ordering and char limits for MEMORY/USER (today: Hermes `memory_char_limit` / `user_char_limit` per config; positions 7–8 per prior readout). (2) Inventory **always-on** vs **on-demand** MCP servers in Cursor/Hermes configs used for CNS work. (3) Produce a short **audit note** (repo or `_bmad-output/`) listing findings and **recommended** cleanup actions; no production behavior change required in 29-0. (4) Confirm **`~/.hermes/SOUL.md`** absent after any Hermes restart used during audit. |
| **Technical notes** | Read-only inspection of `~/.hermes/config.yaml`, Cursor MCP config, `src/agents/operator-context.ts` (`DEFAULT_OPERATOR_CONTEXT`). Optional: compare to vault `AI-Context/MEMORY.md` / `USER.md` symlink targets. |
| **Dependencies** | None |
| **Complexity** | S |
| **Definition of done** | Audit artifact checked in or linked from sprint; operator sign-off that cleanup list is actionable; 29-0 complete before 29-1. |

---

### 29-1 — USER.md — write and wire operator identity

| Field | Content |
|-------|---------|
| **Theme** | Memory |
| **Persona story** | As an **operator**, I want **stable, human-edited USER.md** within a **hard cap of 1200 characters**, so that **Hermes cold-start position 8 reflects durable identity without drift**. |
| **Acceptance criteria** | (1) `AI-Context/USER.md` contains **stable** operator identity: name, role, preferences, constraints (no secrets). (2) **UTF-8 length ≤ 1200 characters** (or project-chosen measure documented in 29-7; consistent with Hermes `user_char_limit` trajectory). (3) Hermes loads USER at **position 8** after session start (evidence: redacted `build_context` or gateway log snippet in story record). (4) **No** Vault IO mutators for initial content per HI-4/26-8 class: **operator FS** for human-owned file unless future policy changes. |
| **Technical notes** | Symlink `~/.hermes/memories/USER.md` → vault path if not already. Align with `operator-context.ts` only as documentation; USER.md is source of truth for Hermes layer. |
| **Dependencies** | 29-0 |
| **Complexity** | S |
| **Definition of done** | USER.md populated, cap verified, Hermes proof captured; SOUL.md hygiene verified. |

**Hermes / skill capture:** Not a new skill; no §15 capture beyond optional Operator Guide bullet if paths change.

---

### 29-2 — MEMORY.md schema + session-close integration

| Field | Content |
|-------|---------|
| **Theme** | Memory |
| **Persona story** | As an **operator**, I want **MEMORY.md regenerated each session-close** with a **defined schema** and **≤2000 characters**, so that **rolling session learnings compress without polluting USER.md**. |
| **Acceptance criteria** | (1) **Schema** documented (YAML or markdown template): what session-close may write (e.g. last sprint focus, open risks, next actions — **compressed**). (2) **`/session-close`** (or dedicated step it calls) **rewrites** `AI-Context/MEMORY.md` each run within **≤2000 chars**. (3) **Separation:** USER.md never overwritten by session-close. (4) **Token budget:** MEMORY body fits **≤ ~500 tokens** equivalent per epic table; enforce in tests or script assertion. |
| **Technical notes** | Touch `scripts/hermes-skill-examples/session-close/` and related prompts; respect WriteGate: session-close already uses **operator FS** for `AGENTS.md`; MEMORY.md likely same class unless migrated to governed MCP path by explicit decision. **Skill capture:** Follow **`CNS-Operator-Guide` §15.4** patterns and **26-8** workflow; reference **`hermes-url-ingest-vault`** for SKILL frontmatter, `metadata.hermes`, and guardrail structure. |
| **Dependencies** | 29-1 (identity stable before rolling memory content references it) |
| **Complexity** | M |
| **Definition of done** | Session-close dry-run and real-run tested; MEMORY.md cap enforced; Operator Guide §15.4 updated if behavior changes. |

---

### 29-3 — Cold-start verification

| Field | Content |
|-------|---------|
| **Theme** | Memory |
| **Persona story** | As a **developer**, I want **automated or scripted cold-start verification**, so that **AGENTS → … → MEMORY → USER ordering and caps are regression-safe**. |
| **Acceptance criteria** | (1) Test or script asserts **presence and order** of context slices (AGENTS, MEMORY, USER) in Hermes assembly. (2) Assert **char limits** enforced (1200 / 2000 per epic). (3) CI or `npm test` / dedicated test includes this where feasible without live Discord. |
| **Technical notes** | Reuse patterns from Epic 26 proof (`build_context_files_prompt`, `MemoryStore.load_from_disk` mentioned in 26-4 story). May live under `tests/` as Hermes-adjacent smoke. |
| **Dependencies** | 29-1, 29-2 |
| **Complexity** | M |
| **Definition of done** | Verification passes in `bash scripts/verify.sh` scope or documented gate; failure explains which layer broke. |

---

### 29-4 — Vault lint rules spec and output format

| Field | Content |
|-------|---------|
| **Theme** | Quality |
| **Persona story** | As an **operator**, I want a **normative spec for four deterministic lint rules** and **output format**, so that **implementation and Discord reporting stay consistent**. |
| **Acceptance criteria** | (1) Spec in **`specs/cns-vault-contract/`** (new or extended module) defines: **duplicate URLs**, **orphan notes** (definition explicit), **stale pending >30 days** (field + scope), **missing frontmatter** (governed paths). (2) **Report-only**; no mutator requirements. (3) Output schema: machine-readable section + human summary; paths relative to vault root. |
| **Technical notes** | PAKE normative; align with `AGENTS.md` Section 2 routing. Coordinate with 29-5 for Discord + `_meta/logs/vault-lint-YYYY-MM-DD.md`. |
| **Dependencies** | 29-0; **after** 29-2 recommended so lint log pattern can mirror session-close file discipline (epic sequencing). |
| **Complexity** | M |
| **Definition of done** | Spec reviewed; linked from constitution or modules table if required; ready for 29-5 implementation. |

---

### 29-5 — `/vault-lint` Hermes skill + vault log write

| Field | Content |
|-------|---------|
| **Theme** | Quality |
| **Persona story** | As an **operator**, I want **`/vault-lint` in Discord** to run the linter and **write reports to Discord and `_meta/logs/vault-lint-YYYY-MM-DD.md`**, so that **I see vault health without full manual search**. |
| **Acceptance criteria** | (1) On-demand skill only (**no** always-on binding unless operator opts in). (2) Implements **four rules** from 29-4. (3) Posts summary to **Discord** (`#hermes` or operator-chosen channel per config). (4) Writes **`_meta/logs/vault-lint-YYYY-MM-DD.md`** via **Vault IO** (`vault_create_note` or appropriate tool) **or** operator FS if path under WriteGate; **must not** bypass audit rules. (5) **Read-only** vault traversal except the log write. |
| **Technical notes** | **Skill capture (§15 / 26-8):** Mirror **`scripts/hermes-skill-examples/hermes-url-ingest-vault/SKILL.md`**: YAML frontmatter, `metadata.hermes.tags`, trigger section, guardrails, `references/` for normative blocks. Install under `~/.hermes/skills/cns/vault-lint/`. Add install script pattern like `install-hermes-skill-session-close.sh`. |
| **Dependencies** | 29-4; 29-2 complete recommended (shared “generated artifact” conventions). |
| **Complexity** | L |
| **Definition of done** | Skill installed, proof in Dev Agent Record, Operator Guide §15 subsection for `/vault-lint`. |

---

### 29-6 — Dedup guard at ingest time

| Field | Content |
|-------|---------|
| **Theme** | Quality |
| **Persona story** | As a **knowledge steward**, I want **URL-level duplicate prevention at every governed ingest entrypoint**, so that **the same canonical source is not filed twice forward**. |
| **Acceptance criteria** | (1) **`governedNoteExistsWithSourceUri`** in `src/ingest/duplicate.ts` (or successor) is invoked for **all** paths that create governed notes with `source_uri` (including **Hermes URL ingest** if it currently bypasses `runIngestPipeline`). (2) **URL normalization** policy documented (trailing slash, default scheme, lowercase host, etc.) and tested with golden cases. (3) On duplicate: **no** new governed note; caller returns clear **duplicate** status to operator or channel. (4) Existing pipeline behavior: `src/ingest/pipeline.ts` already calls `governedNoteExistsWithSourceUri` before write; story **closes gaps** for other surfaces. |
| **Technical notes** | **`duplicate.ts` today:** `governedNoteExistsWithSourceUri` uses `vault_search` scoped to `03-Resources` with `source_uri: "<exact>"` query, then verifies YAML on disk. **`pipeline.ts`:** returns `{ status: "duplicate", source_uri }` when match. **Title collisions:** `findGovernedResourceNotesByTitle` also returns duplicate; clarify whether Hermes ingest should share this path. **MCP / WriteGate:** ingest uses internal vault APIs; no WriteGate relaxation. |
| **Dependencies** | 29-4 optional (lint duplicates rule may reference same normalization); 29-0 helps map all ingest surfaces. |
| **Complexity** | M |
| **Definition of done** | Tests cover normalization + at least one non-pipeline entrypoint; `verify.sh` passes. |

---

### 29-7 — CLAUDE.md shim update + Token Budget Policy in AGENTS.md

| Field | Content |
|-------|---------|
| **Theme** | Housekeeping |
| **Persona story** | As a **CNS maintainer**, I want **`specs/cns-vault-contract/shims/CLAUDE.md` to match post–Epic-28 `CLAUDE.md`** and a **Token Budget Policy** in the constitution, so that **all surfaces share one shim truth and token limits are normative**. |
| **Acceptance criteria** | (1) **`specs/cns-vault-contract/shims/CLAUDE.md`** byte-aligned or logically equivalent to repo **`CLAUDE.md`** (implementation rules + pointers). (2) **Token Budget Policy** added as **new subsection under constitution Section 6** (current title: **Security Boundaries**; user asked “Governance” — use **§6.x Token budget policy** unless constitution is restructured). (3) Policy references: MEMORY/USER caps, on-demand skills, fast-scan index cap, measurement method. (4) **Dual sync:** `specs/cns-vault-contract/AGENTS.md` **and** canonical vault `AI-Context/AGENTS.md` identical per repo rule. |
| **Technical notes** | Do **not** change audit logging or WriteGate. Version bump + changelog row in constitution. |
| **Dependencies** | 29-1, 29-2, 29-9 (index cap policy) for accurate numbers — can draft policy early and **finalize** after 29-9. |
| **Complexity** | S–M |
| **Definition of done** | Both AGENTS copies match; shims reviewed; `verify.sh` passes. |

---

### 29-8 — `vault_request_disambiguation` MCP tool

| Field | Content |
|-------|---------|
| **Theme** | Housekeeping |
| **Persona story** | As an **IDE agent**, I want a **`vault_request_disambiguation` tool** that **returns structured questions** without silent routing, so that **WorkflowNote project ambiguity is resolved with zero always-on cost**. |
| **Acceptance criteria** | (1) New tool registered in Vault IO MCP server (`src/`, `dist/` via build). (2) **No** always-on context; tool invoked only when the model calls it. (3) **Read-only** with respect to vault mutations (returns options / prompts). (4) Behavior spec’d in `CNS-Phase-1-Spec.md` tool table. (5) Aligns with **AGENTS.md** WorkflowNote disambiguation rules. |
| **Technical notes** | Follow existing tool patterns in `src/tools/`; respect `realpath` boundary and error codes; **no** audit line if no mutation (confirm against audit playbook). |
| **Dependencies** | 29-0 |
| **Complexity** | M |
| **Definition of done** | Tests + spec updated; verify passes; operator approval if tool shape is sensitive. |

---

### 29-9 — Fast-scan index + session-close integration

| Field | Content |
|-------|---------|
| **Theme** | Housekeeping |
| **Persona story** | As an **operator**, I want a **compact fast-scan index** refreshed on session-close, so that **agents get broad vault orientation without full-text dumps**. |
| **Acceptance criteria** | (1) Index artifact generated or updated during **session-close** (or subprocess it invokes). (2) **Total injected context from index ≤ 2000 tokens** (per epic; measure per 29-7 policy). (3) Index is **summary / pointers**, not full note bodies. (4) Location and format documented (e.g. under `AI-Context/` or `_meta/` per spec decision). |
| **Technical notes** | Coordinate with MEMORY.md regeneration to avoid duplication; may reference index from MEMORY template. |
| **Dependencies** | 29-2 |
| **Complexity** | L |
| **Definition of done** | Session-close proof; token count recorded in story; verify passes. |

---

### 29-10 — Hermes thinking commands

| Field | Content |
|-------|---------|
| **Theme** | Cognition |
| **Persona story** | As an **operator**, I want **on-demand Hermes skills** for thinking patterns (**challenge, emerge, trace, ideas, ghost, connect, drift** or agreed subset), so that **Obsidian + Claude Code style cognition is available with zero always-on overhead**. |
| **Acceptance criteria** | (1) **Slash or phrase triggers** documented; **not** auto-loaded on every message. (2) **Read-only** vault operations unless explicitly calling Vault IO write tools. (3) Each command: short system prompt + optional `references/` blocks. (4) **Token budget:** document max reply / context pull per command. (5) **Skill capture:** §15 + **26-8**; reference **`hermes-url-ingest-vault`** for layout and Hermes metadata. |
| **Technical notes** | Install under `~/.hermes/skills/cns/thinking-commands/` (example); bind only if operator invokes or uses narrow free-response rule. |
| **Dependencies** | **Last story:** 29-9 (indexed vault), 29-7 (policy), 29-5 optional (pattern parity). |
| **Complexity** | L |
| **Definition of done** | Operator Guide §15 documents commands; smoke test from Discord; SOUL.md hygiene checked. |

---

## Step 3 — Sprint plan (dependency-respecting)

**Constraint:** 29-0 precedes all. Memory chain **29-1 → 29-2 → 29-3** before Quality **29-4 → 29-5 → 29-6** (MEMORY/session-close informs lint log pattern). Housekeeping **29-7, 29-8, 29-9** may run **in parallel** with Quality after 29-2 lands (29-7 finalizes token policy after 29-9). **29-10 last.**

### Suggested waves

| Wave | Stories | Notes |
|------|---------|-------|
| **W0** | 29-0 | Gate |
| **W1** | 29-1, 29-2 | Strict sequence inside Memory |
| **W2** | 29-3 | After W1 |
| **W3 (parallel)** | 29-4 → 29-5 → 29-6 | Quality chain; 29-6 can start after 29-4 spec exists |
| **W3b (parallel)** | 29-8 | Can start after 29-0 |
| **W4 (parallel)** | 29-9 | After 29-2 |
| **W5 (parallel)** | 29-7 | Draft early; **finalize** after 29-9 for index token numbers |
| **W6** | 29-10 | After 29-9 (and preferably 29-5 for skill pattern parity) |

### Linear sequence (single developer)

29-0 → 29-1 → 29-2 → 29-3 → 29-4 → 29-5 → 29-6 → 29-8 ∥ 29-9 (choose order) → **finalize** 29-7 → 29-10  

(If strictly single-threaded: 29-0 → 29-1 → 29-2 → 29-3 → 29-4 → 29-5 → 29-6 → 29-8 → 29-9 → 29-7 → 29-10.)

---

## Step 4 — Draft AGENTS.md §8 (Current Focus)

Replace the body of **§8. Current Focus** (from `### Project Status` through the end of §8, before `## 9. Agent Behavior Guidelines`) with:

```markdown
### Project Status

- **CNS Phases 1–5: COMPLETE.** All epics 1–28 done. Phase 5 (Hermes operator closure and session automation) shipped end-to-end.
- **Phase 6: IN PROGRESS.** **Epic 29 — Knowledge Quality + Agent Memory** is the active initiative (agent memory, vault quality lint, ingest dedup guard, token budget policy, disambiguation MCP tool, fast-scan index, on-demand thinking commands).
- **Epic 28: CLOSED.**
- **Epic 30: PRE-SCOPED, WAITING.** Research Pipeline Auto-Synthesis (approval-time trigger, `03-Resources/`, `verification_status: pending`) is explicitly **out of scope** for Epic 29.

### Current Priorities

1. **Execute Epic 29** in sprint order: pre-work **29-0**, then Memory (**29-1–29-3**), Quality (**29-4–29-6**) with Housekeeping (**29-7–29-9**) allowed in parallel after **29-2**, then **29-10** last.
2. **Token efficiency:** Treat stated **character/token budgets** as **acceptance criteria**, not guidelines; on-demand Hermes skills must stay **zero always-on** overhead unless operator opts in.
3. **NotebookLM freshness.** Run `/session-close` at end of each session to regenerate **Section 8**, **MEMORY.md** (once 29-2 lands), sync constitution copies, and refresh NotebookLM sources.
4. **SOUL.md hygiene.** Remove `~/.hermes/SOUL.md` after every `hermes version` or gateway restart.

### Recent Session Context

- **Epic 29 planning (2026-05-11):** Locked epic shape — USER.md (≤1200 chars), MEMORY.md (≤2000 chars, session-close), vault lint Option A (four deterministic rules, Discord + `_meta/logs/vault-lint-YYYY-MM-DD.md`), ingest dedup alignment with `src/ingest/duplicate.ts`, `vault_request_disambiguation`, fast-scan index (≤2000 tokens), Hermes thinking commands (on-demand).
- **28-3 (done):** `#general` URL auto-capture to Inbox.
- **28-2 (done):** NotebookLM MCP in Hermes via `uvx`.
- **28-1 (done):** `/session-close` automates AGENTS.md Section 8 + NotebookLM fan-out.

### Phase 2 Backlog (Sequenced, Not Active)

- Mobile read path: Tailscale + Blink Shell (next meaningful phase after Phase 6 stabilises)
- Context7 ↔ CNS repo indexing via GitHub (low effort, revisit when repo visibility decided)
- Context7 ↔ Brain service deeper integration (planning session needed)
- Nexus full governance hardening (post-trust-guard stabilisation)

### Parking Lot (Phase 3+)

- **Epic 30 — Research Pipeline Auto-Synthesis** (pre-scoped; not Epic 29)
- OpenClaw autonomous daemon (Phase 3)
- pgvector / Archon-class RAG (Phase 3)
- nexus-discord-trust-guard.sh watchdog automation (auto-run on WSL startup)
```

**Apply note:** Update **both** `specs/cns-vault-contract/AGENTS.md` and `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (and canonical vault path on host) in one operation; bump **Version** / **Changelog** row when promoting from draft.

---

## Appendix — ingest dedup implementation snapshot (for 29-6)

- **`governedNoteExistsWithSourceUri`:** `vault_search` on `03-Resources` with `source_uri: "<uri>"`, verify YAML on each hit.
- **`runIngestPipeline`:** duplicate early-return before inbox/governed write when `normalized.source_uri` set.
- **Gap closure target:** Hermes **`vault_create_note`** URL ingest path (and any other writer) must share normalization + duplicate check with pipeline policy.
