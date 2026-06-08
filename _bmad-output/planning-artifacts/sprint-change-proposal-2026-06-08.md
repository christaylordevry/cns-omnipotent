# Sprint Change Proposal — Epic 64/65 Scope Adjustment (Intelligence Scoring vs Source Adapters)

**Date:** 2026-06-08  
**Author:** Correct Course workflow (Chris brief — FINAL)  
**Status:** Approved (2026-06-08, Chris)  
**Repos affected:** Cross-repo epic — see **Cross-repo execution boundary** below

---

## Section 1: Issue Summary

### Problem statement

During the Epic 63 close session, `mvanhorn/last30days-skill` (MIT, v3.2.0, 25.5k stars) was identified as a mature reference implementation for Reddit public JSON, GitHub API, and HackerNews engagement patterns. The original Epic 64 scope implicitly combined **source adapter expansion** (GitHub, Reddit, RSS) with **intelligence scoring** in a single epic. That coupling creates three risks:

1. **Dependency creep** — temptation to install/import/run last30days instead of owning adapters natively
2. **Split-brain ingest** — Reddit strategy would be implemented in Epic 64 while Epic 44 already has Reddit collectors in the trend-ingest path
3. **Lost differentiator** — adapter work would crowd out the Nexus-native scoring engine (personal relevance, cross-source normalization, ranked "What Matters Now")

### Trigger

| Field | Value |
|-------|-------|
| Triggering context | Epic 63 close session discovery of `last30days-skill` |
| Trigger type | **Strategic pivot** — scope split and reference-code policy |
| Discovery | Operator brief 2026-06-08 with locked decisions |
| Evidence | last30days proves interactive fetch patterns; unattended cron risk profile differs; `digestSignals` schema exists (61-5) but has no per-dimension scores; `sourceMetadata` lacks engagement fields for cross-source normalization |

### Core change

1. **Epic 64** becomes **Intelligence Scoring Engine v1** — scoring, ranking, and existing-source fixes only
2. **Epic 65 (NEW)** becomes **Native Source Adapter Expansion v1** — GitHub, Reddit (spike-first), curated RSS
3. **last30days** is a **reference codebook only** — never installed, imported, or subprocess-called in CNS
4. **Epic 64+ Hermes AI wiring** (from `sprint-change-proposal-2026-06-06.md`) is **renumbered to Epic 66** to avoid ID collision

### Locked decisions (non-negotiable)

| # | Decision |
|---|----------|
| 1 | Node/TypeScript only for all new adapters; last30days Python read as logic reference, translated to Node |
| 2 | Personal relevance in Epic 64 v1 (thin keyword/entity match); vault-semantic scoring deferred |
| 3 | Reddit removed from Epic 64; Epic 65 owns all Reddit strategy (public-JSON spike → adapter or credential fallback) |
| 4 | `last30days` never in `package.json`, never imported, never subprocess-called |
| 5 | `resolveOperatorHome()` everywhere; no `os.homedir()` / `Path.home()` |
| 6 | Cross-source engagement normalization is Epic 64 scoring work, not polish |
| 7 | UI rendering of ranked feed is cns-dashboard work, separate from Epic 64 |

---

## Section 2: Impact Analysis

### Checklist summary

| Section | Key items | Status |
|---------|-----------|--------|
| **1 — Trigger** | Epic 63 close; last30days discovery; scope coupling problem | [x] Done |
| **2 — Epic impact** | Split Epic 64; add Epic 65; renumber old Epic 64+ → 66 | [x] Done |
| **3 — Artifacts** | epics.md, sprint-status, project-context, new PRDs/architecture | [!] Action-needed |
| **4 — Path forward** | Direct Adjustment (Option 1) | [x] Done |
| **5 — Proposal** | This document | [x] Done |
| **6 — Handoff** | Pending user approval | [!] Action-needed |

### Epic impact

| Epic | Impact |
|------|--------|
| **Epic 64 (REDEFINED)** | Was implied as "Hermes AI wiring + adapters" in 2026-06-06 proposal. Now **Intelligence Scoring Engine v1** in Omnipotent.md digest pipeline + Convex schema extension in cns-dashboard. **No new source adapters.** |
| **Epic 65 (NEW)** | **Native Source Adapter Expansion v1** — GitHub, Reddit (spike-first), curated RSS/Substack. Reference clone at `~/ai-factory/projects/last30days-skill-reference` for reading only. |
| **Epic 66 (NEW, renumber)** | Absorbs deferred Epic 63 follow-ons from 2026-06-06: Hermes wiring for inspector AI actions, Agent Orchestration Workspace (Screen 10), `investigationSessions` table. |
| **Epic 63** | Done (shipped 2026-06-08, 405 tests). Nexus Intelligence Cockpit UI (cns-dashboard). Consumes ranked `digestSignals` when Epic 64 lands; not blocked by Epic 64. |
| **Epic 62** | Done — `keywordCandidates` derived from digest signals; feeds Epic 64 personal-relevance inputs. |
| **Epic 61** | Done — morning digest sources (arXiv, HN, Convex push). Epic 64 fixes arXiv env + NewsAPI tightening; Epic 65 adds GitHub/Reddit/RSS. |
| **Epic 56** | Done — `buildDigestSignals` NotebookLM routing; superseded for ranking by Epic 64 scoring engine (different purpose: notebook pick vs signal priority). |
| **Epic 44** | Trend-ingest Reddit collector exists (`44-3-2`); Epic 65 Reddit adapter is **morning-digest path**, distinct pipeline — document boundary in architecture. |

### Cross-repo execution boundary

Epic 64 is **not** Omnipotent.md-only. Work splits cleanly by responsibility:

| Layer | Repo | What runs there |
|-------|------|-----------------|
| **Schema + storage** | `cns-dashboard` | `convex/validators.ts`, `convex/schema.ts`, `convex/digest.ts` — accept and persist score fields; `getRecentDigestSignals` sorts by `rankScore` |
| **Scoring compute** | `Omnipotent.md` | Digest-side Node scripts (`score-digest-signals.mjs` or sibling) — compute all five dimensions, disposition, normalization, and `rankScore` **before** Convex push |
| **Push contract** | `Omnipotent.md` | `push-digest-convex.mjs` — sends pre-computed scores to Convex mutations (no server-side scoring in Convex) |

**ADR-E64-001 (normative):** Scoring engine executes in the morning-digest pipeline (Omnipotent.md), not in Convex functions. Convex is schema, persistence, and read-side ordering only.

**64-1 is primarily a cns-dashboard story** (`validators.ts` / `schema.ts` / `digest.ts`), with a paired Omnipotent.md push-contract update. Any cns-dashboard edit from WSL requires the operator's PowerShell launcher workaround for sibling-repo verify (`CNS_DASHBOARD_ROOT` / `bash scripts/verify.sh` from Omnipotent.md). Expect **one cross-repo touch per schema story** (64-1), not per scoring story (64-2..64-5 are Omnipotent.md only).

### Story impact (proposed)

#### Epic 64 — Intelligence Scoring Engine v1

| Story | Title | Repo | Depends on | Notes |
|-------|-------|------|------------|-------|
| 64-1 | `digestSignals` schema extension for per-signal scores | cns-dashboard + Omnipotent.md push contract | 61-5 | **First story — gate for all others** |
| 64-2 | Scoring engine v1 — five named dimensions (0–100) | Omnipotent.md | 64-1 | **Normative fields:** `relevance`, `personalRelevance`, `novelty`, `momentum`, `urgency` — five distinct scores; `personalRelevance` MUST NOT be folded into `relevance` |
| 64-3 | Derived disposition scores (priority/watch/ignore/escalate) | Omnipotent.md | 64-2 | Composite from dimension scores |
| 64-4 | Cross-source engagement normalization | Omnipotent.md | 64-2 | GitHub stars, Reddit upvotes, HN points → common scale before momentum |
| 64-5 | Morning digest ranked `digestSignals` ("What Matters Now") | Omnipotent.md | 64-3, 64-4 | Digest-side only; no dashboard UI |
| 64-6 | NewsAPI query tightening | Omnipotent.md | — | Can parallel 64-1 after brief review |
| 64-7 | arXiv empty results fix (`MORNING_DIGEST_ARXIV_*` env) | Omnipotent.md | 61-1 | Can parallel 64-1 |

**Parallelism:** 64-6 and 64-7 can start immediately. 64-2+ blocked on 64-1 schema.

#### Epic 65 — Native Source Adapter Expansion v1

| Story | Title | Repo | Depends on | Notes |
|-------|-------|------|------------|-------|
| 65-1 | GitHub adapter (Node) | Omnipotent.md | 64-1 (soft) | Emits `digestSignals` with engagement metadata for Epic 64 normalization |
| 65-2 | Reddit public-JSON spike (Node) | Omnipotent.md | — | Unattended cron risk validation before full adapter |
| 65-3 | Reddit public-JSON adapter OR credential fallback | Omnipotent.md | 65-2 | Branch on spike outcome |
| 65-4 | Curated RSS / Substack adapter (Node) | Omnipotent.md | 64-1 (soft) | `rss-parser`; config in `~/.hermes/trend-ingest.env` |
| 65-5 | HN engagement scoring upgrade (optional) | Omnipotent.md | 64-4 | Assess last30days HN logic; not required for epic completion |

**Sequencing:** Epic 64 scoring engine (64-2..64-5) should land before or in parallel with Epic 65 adapters so engagement metadata has a normalization target. Adapters can emit raw metadata before scoring is live; ranking requires 64-5.

#### Epic 66 — Nexus Agent Orchestration (deferred from 2026-06-06)

| Story | Title | Repo | Status |
|-------|-------|------|--------|
| 66-1 | Hermes wiring for inspector AI actions (Explain/Compare/Trace/Ask) | cns-dashboard + Omnipotent.md | backlog |
| 66-2 | Agent Orchestration Workspace (Screen 10) | cns-dashboard | backlog |
| 66-3 | `investigationSessions` Convex table | cns-dashboard | backlog |

### Artifact conflicts

| Artifact | Conflict | Required update |
|----------|----------|-----------------|
| `sprint-change-proposal-2026-06-06.md` | Epic 64+ = Hermes AI wiring | Add supersession note; renumber to Epic 66 |
| `epics.md` | No Epic 64/65/66 entries | Add three epic sections (or companion files) |
| `sprint-status.yaml` | Ends at Epic 63 | Add epic-64, epic-65, epic-66 backlog entries |
| `project-context.md` | No last30days principle; Epic 63 only in phase status | Add principle + Epic 64/65/66 status |
| `deferred-work.md` | Epic 64+ references | Update to Epic 66 |
| **Missing** | No PRD/architecture for Epic 64/65 | Create `prd-epic-64-intelligence-scoring-engine.md`, `prd-epic-65-native-source-adapters.md`, `architecture-epic-64-scoring-engine.md` |
| `cns-dashboard/convex/validators.ts` | `digestSignal*Validator` has optional `score` only; no dimension fields | Extend in 64-1 |
| `keywordSourceTypeValue` | No `github`/`reddit`/`rss` literals | Extend when Epic 65 adapters land (65-1+) |

### Technical impact

**Schema extension (64-1) — proposed `digestSignals` fields** (primary file: `cns-dashboard/convex/validators.ts`):

```typescript
// NEW fields on digestSignals (all optional for backward compat during migration)
// Five NAMED dimensions — personalRelevance is explicit, not implicit in relevance
scores: v.optional(v.object({
  relevance: v.number(),           // 0–100 topical fit to watchlist themes
  personalRelevance: v.number(),     // 0–100 fit to active sprint / projects / watchlist (thin v1: keyword/entity)
  novelty: v.number(),               // 0–100 genuinely new vs already-surfaced
  momentum: v.number(),              // 0–100 acceleration across sources (uses normalizedEngagement)
  urgency: v.number(),               // 0–100 time sensitivity / near-term action need
})),
disposition: v.optional(v.union(
  v.literal('priority'),
  v.literal('watch'),
  v.literal('ignore'),
  v.literal('escalate'),
)),
normalizedEngagement: v.optional(v.number()), // 0–100 after cross-source normalization
rankScore: v.optional(v.number()),              // composite for "What Matters Now" ordering
```

**Extend `sourceMetadataValidator` (64-1 / 64-4):**

```typescript
stars: v.optional(v.number()),
forks: v.optional(v.number()),
upvotes: v.optional(v.number()),
points: v.optional(v.number()),
commentCount: v.optional(v.number()),
```

**Extend `digestSourceTypeValue` (Epic 65, not 64):**

```typescript
v.literal('github'),
v.literal('reddit'),
v.literal('rss'),
```

**Existing code touchpoints:**

| Path | Epic | Change |
|------|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` | 64-1, 64-5 | Push score fields + ranked order |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | 64-2 | Scoring engine module (or sibling `score-digest-signals.mjs`) |
| `scripts/session-close/hermes-run-newsapi.sh` | 64-6 | Query tightening |
| `scripts/session-close/fetch-arxiv-rss.mjs` | 64-7 | Env var diagnosis |
| `cns-dashboard/convex/digest.ts` | 64-1 | Accept new fields; `getRecentDigestSignals` sort by `rankScore` |

**Out of scope (Epic 64):**

- GitHub, Reddit, RSS adapters → Epic 65
- Dashboard 8-feed UI rendering → separate cns-dashboard epic/story
- Vault-semantic personal relevance → post-Epic 64 epic
- ProductHunt, X/Twitter → follow-on backlog

---

## Section 3: Recommended Approach

### Selected path: **Option 1 — Direct Adjustment** (with epic split)

| Criterion | Assessment |
|-----------|------------|
| Effort | **Medium** — 7 Epic 64 stories + 4–5 Epic 65 stories; 2 PRDs + 1 architecture doc |
| Risk | **Low–Medium** — Reddit cron spike is highest risk; mitigated by spike-before-adapter pattern |
| Timeline | Epic 64 can start immediately (64-6, 64-7 parallel); 64-1 gates scoring; Epic 65 after 64-1 or parallel on spike |
| Rollback (Option 2) | **Not viable** — Epic 61 digest push is foundational; no rollback benefit |
| MVP review (Option 3) | **Not required** — CNS Phase 1 vault IO unchanged; Layer 3 intelligence scope refinement |

### Rationale

The operator brief already contains locked decisions. Splitting ingest (65) from scoring (64) preserves the Nexus differentiator, prevents last30days dependency creep, and isolates Reddit's unattended-cron risk. Direct adjustment is strictly better than rollback or MVP reduction.

### Source roadmap (post Epic 64 + 65)

| Source | Status after change |
|--------|---------------------|
| Google Trends | ✅ Live |
| NewsAPI | ✅ Live (tightened in Epic 64) |
| Perplexity | ✅ Live |
| arXiv | ✅ Live (fixed in Epic 64) |
| HackerNews | ✅ Live (optional scoring upgrade in Epic 65) |
| GitHub | ⏳ Epic 65 |
| Reddit | ⏳ Epic 65 (spike-first) |
| Curated RSS / Substack | ⏳ Epic 65 |
| X / Twitter | ⏳ Medium term |
| ProductHunt | ⏳ Open target |
| TikTok / Instagram / Polymarket | ❌ Out of scope |

---

## Section 4: Detailed Change Proposals

### 4.1 `project-context.md` — add principle

**Section:** After `## System` or new `## Nexus intelligence` subsection

**OLD:** (no last30days principle)

**NEW:**

```markdown
## Nexus intelligence principle

> `last30days` is a codebook, not a dependency. CNS owns every adapter it runs,
> in Node, with every signal scored for personal relevance — not just market motion.

Reference clone (read-only): `~/ai-factory/projects/last30days-skill-reference`. Never install, import, or subprocess-call in CNS builds.
```

**Rationale:** Encode locked decision for all future agent sessions.

---

### 4.2 `project-context.md` — phase status

**OLD:**

```markdown
- Omnipotent.md: Phase 6 complete; Epics 1–62 done; Epic 63 (Nexus Intelligence Cockpit) in backlog
```

**NEW:**

```markdown
- Omnipotent.md: Phase 6 complete; Epics 1–62 done; Epic 63 (Nexus Cockpit UI) in-progress; Epic 64 (Intelligence Scoring Engine v1) backlog; Epic 65 (Native Source Adapters v1) backlog; Epic 66 (Agent Orchestration) backlog
```

---

### 4.3 `sprint-status.yaml` — add epics

**ADD after epic-63 block:**

```yaml
  # Epic 64 — Intelligence Scoring Engine v1 (Omnipotent.md digest pipeline + Convex schema)
  epic-64: backlog
  # Stories: 64-1 schema → 64-2 scoring → 64-3 disposition → 64-4 normalization → 64-5 ranked push
  # Parallel: 64-6 NewsAPI tightening, 64-7 arXiv env fix

  # Epic 65 — Native Source Adapter Expansion v1 (reference: last30days codebook only)
  epic-65: backlog
  # Stories: 65-1 GitHub → 65-2 Reddit spike → 65-3 Reddit adapter → 65-4 RSS → 65-5 HN optional

  # Epic 66 — Nexus Agent Orchestration (renumbered from sprint-change-proposal-2026-06-06 Epic 64+)
  epic-66: backlog
```

---

### 4.4 `epics.md` — Epic 64 section (summary)

**ADD new section:**

```markdown
### Epic 64: Intelligence Scoring Engine v1

**Goal:** Every `digestSignal` receives five normalized dimension scores (0–100), cross-source engagement normalization, derived disposition, and ranked "What Matters Now" ordering in the morning digest pipeline. No new source adapters.

**Repo:** Omnipotent.md (scoring engine, digest integration) + cns-dashboard (Convex schema extension via 64-1)

**Stories:** 64-1 (schema gate) → 64-2 (five dimensions) → 64-3 (disposition) → 64-4 (engagement normalization) → 64-5 (ranked push); parallel: 64-6 (NewsAPI), 64-7 (arXiv env)

**Out of scope:** GitHub/Reddit/RSS adapters (Epic 65), dashboard UI feed rendering, vault-semantic personal relevance
```

---

### 4.5 `epics.md` — Epic 65 section (summary)

**ADD new section:**

```markdown
### Epic 65: Native Source Adapter Expansion v1

**Goal:** CNS-native Node/TypeScript adapters for GitHub, Reddit (public-JSON spike first), and curated RSS/Substack. Reference `last30days-skill` logic only — never install or import.

**Repo:** Omnipotent.md

**Stories:** 65-1 GitHub adapter, 65-2 Reddit spike, 65-3 Reddit adapter (or credential fallback), 65-4 RSS adapter, 65-5 HN scoring upgrade (optional)

**Constraints:** `resolveOperatorHome()` everywhere; fixture-tested; `verify.sh` gate; config in `~/.hermes/trend-ingest.env`
```

---

### 4.6 `epics.md` — Epic 66 section (renumber)

**ADD new section:**

```markdown
### Epic 66: Nexus Agent Orchestration (deferred from Epic 63)

**Goal:** Hermes wiring for Intelligence Inspector AI actions, Agent Orchestration Workspace (Screen 10), `investigationSessions` table.

**Repo:** cns-dashboard (primary) + Omnipotent.md (Hermes skills)

**Origin:** Previously "Epic 64+" in sprint-change-proposal-2026-06-06.md
```

---

### 4.7 New PRD — `prd-epic-64-intelligence-scoring-engine.md`

**Create with sections:**

1. Problem: `digestSignals` exist but lack Nexus-native multi-dimensional scoring
2. Goals: five v1 dimensions, disposition, cross-source normalization, ranked output
3. Non-goals: adapters, UI, vault-semantic relevance
4. Scoring dimension definitions (normative tables for each 0–100 dimension)
5. Personal relevance v1 inputs: active sprint, watchlist, current projects (keyword/entity)
6. Engagement normalization algorithm requirements
7. Acceptance: morning digest pushes ranked signals; `verify.sh` green

---

### 4.8 New PRD — `prd-epic-65-native-source-adapters.md`

**Create with sections:**

1. Problem: GitHub, Reddit, high-signal RSS not in morning digest
2. Goals: three adapters, spike-first Reddit, last30days as reference only
3. Non-goals: ProductHunt, X, Python runtime, last30days dependency
4. MIT attribution policy (clean reimplementation preferred)
5. Per-adapter acceptance criteria (fixture tests, cron integration, engagement metadata shape)
6. Reddit spike success/failure criteria for unattended scheduled use

---

### 4.9 New Architecture — `architecture-epic-64-scoring-engine.md`

**ADRs to include:**

| ADR | Decision |
|-----|----------|
| ADR-E64-001 | Scoring engine lives in Omnipotent.md digest scripts, not Convex compute |
| ADR-E64-002 | `digestSignals.scores` object is SSOT for dimension scores; `rankScore` for ordering |
| ADR-E64-003 | Raw engagement never compared cross-source; `normalizedEngagement` required before momentum |
| ADR-E64-004 | Personal relevance v1 = keyword/entity against sprint/watchlist/projects; vault-semantic deferred |
| ADR-E64-005 | last30days is reference codebook only — no package.json, import, or subprocess |

---

### 4.10 `sprint-change-proposal-2026-06-06.md` — supersession note

**ADD at top (after Status line):**

```markdown
**Supersession (2026-06-08):** "Epic 64+" Hermes AI wiring references in this document are renumbered to **Epic 66**. Epic 64 is redefined as Intelligence Scoring Engine v1 per `sprint-change-proposal-2026-06-08.md`.
```

---

## Section 5: Implementation Handoff

### Change scope classification: **Moderate**

Requires backlog reorganization (new epics 64/65/66), PRD/architecture authoring, and coordinated Omnipotent.md + cns-dashboard schema work. No fundamental replan of CNS Phase 1 or Epic 63.

### Handoff recipients

| Role | Agent / workflow | Responsibility |
|------|------------------|----------------|
| **Scrum Master** | `/bmad-sprint-planning` or manual | Update `sprint-status.yaml`, `epics.md` after approval |
| **PM / Tech Writer** | `/bmad-prd` | Author `prd-epic-64-*.md`, `prd-epic-65-*.md` |
| **Architect** | `/bmad-create-architecture` | Author `architecture-epic-64-scoring-engine.md` |
| **Developer** | `/bmad-create-story` → `/bmad-dev-story` | 64-6, 64-7 can start immediately; 64-1 is schema gate |
| **Operator** | Manual | Clone `last30days-skill` to `~/ai-factory/projects/last30days-skill-reference` (read-only reference) |

### Recommended execution order

```
1. Approve this proposal
2. Update sprint-status.yaml + epics.md + project-context.md
3. Author PRD + architecture for Epic 64
4. /bmad-create-story 64-6, 64-7 (quick wins, parallel)
5. /bmad-create-story 64-1 (schema gate — cns-dashboard + push contract)
6. /bmad-create-story 64-2 → 64-3 → 64-4 → 64-5 (sequential core)
7. Author PRD for Epic 65; /bmad-create-story 65-2 (Reddit spike, no schema dep)
8. Epic 65 adapters after 64-1 lands
9. Epic 66 remains backlog — lower priority behind Epic 64/65 (Epic 63 shipped 2026-06-08; no open dependency)
```

### Success criteria

- [ ] `digestSignals.scores` includes all five named dimensions: `relevance`, `personalRelevance`, `novelty`, `momentum`, `urgency` (personalRelevance populated independently of relevance)
- [ ] `digestSignals` rows include `scores`, `disposition`, `rankScore` after morning digest run
- [ ] Signals sorted by `rankScore` in Convex query (digest-side SSOT)
- [ ] NewsAPI returns on-topic headlines; arXiv returns papers when env configured
- [ ] No `last30days` entry in any CNS `package.json` or import graph
- [ ] Epic 65 adapters pass fixture tests and `bash scripts/verify.sh`
- [ ] Reddit spike documents pass/fail for unattended cron before full adapter

---

## Approval

**Approved:** 2026-06-08 (Chris)

**Artifacts updated:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — epic-64, epic-65, epic-66 backlog
- `_bmad-output/planning-artifacts/epics.md` — Epic 64/65/66 sections
- `project-context.md` — Nexus intelligence principle + phase status
- `sprint-change-proposal-2026-06-06.md` — supersession note (Epic 64+ → Epic 66)
