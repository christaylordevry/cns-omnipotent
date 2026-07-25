---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
readinessStatus: READY-with-operator-gates
assessmentScope: hermes-consolidation
documentsIncluded:
  prd: prd-hermes-consolidation.md
  architecture: architecture-hermes-consolidation.md
  epics: epics-hermes-consolidation.md
  ux: N/A
  uxReference: ux-designs/ux-CNS-2026-06-21/
  uxEmbeddedInEpics: UX-DR1 through UX-DR5 (D1 UI requirements)
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-24
**Project:** CNS

## Document Inventory

| Document Type | File | Notes |
|---------------|------|-------|
| PRD | `prd-hermes-consolidation.md` | Primary requirements source |
| Architecture | `architecture-hermes-consolidation.md` | Technical design |
| Epics & Stories | `epics-hermes-consolidation.md` | Work breakdown; includes UX-DR1–5 for D1 |
## PRD Analysis

### Functional Requirements

**FR-GATE:** Confirm the Portal plan tier includes Tool Gateway **before** any Firecrawl-cancellation or TTS-dependent work.

**FR1:** Hermes authenticates to Portal via OAuth; provider→`nous`, default model→`anthropic/claude-sonnet-4.6`; openai-codex retained as last-resort fallback.

**FR2:** `auxiliary.compression` → Portal (`anthropic/claude-haiku-4.5`); removes last OpenRouter dependency.

**FR3:** Hermes web search → Portal Tool Gateway ("Nous Subscription") — gated on FR-GATE (paid tier confirmed).

**FR4:** Discord gateway + morning-digest cron remain operational throughout (regression-tested, not assumed).

**FR5:** A `hermes dashboard` service runs persistently (systemd user unit + watchdog), authenticated via **Nous OAuth** (`hermes dashboard register` after Portal login — verify exact command live; writes `HERMES_DASHBOARD_OAUTH_CLIENT_ID` to `~/.hermes/.env`), reachable from Windows; Hermes Desktop signs in via the same OAuth flow. **Fallback only:** `HERMES_DASHBOARD_BASIC_AUTH_*` on trusted WSL localhost if register/OAuth Desktop login fails — must be documented in governance, not the default. **Live `curl` reachability test precedes any assumption about WSL mirrored-networking localhost.**

**FR6:** Hermes Desktop (Windows) connects to the WSL backend; live chat works (WebSocket, not just status).

**FR7:** Run-chain documented as a governance module (`AI-Context/modules/run-chain.md`) + vault project folder, so Hermes cold-starts knowing it (zero engine code).

**FR8:** A Hermes skill triggers run-chain via `terminal()` and reports results to Discord/Desktop (zero adapter code).

**FR9:** *(Scope locked by ADR-HERMES-001: the inline embedded pane is **Epic D3 — dev-local/tunnel opt-in only, NOT production**. Production "Hermes in the cockpit" = FR12 awareness + the async ask box. The embed pattern below applies to D3.)* Embed a live Hermes agent pane in the Nexus `/nexus` cockpit via Hermes API Server, using `X-Hermes-Session-Id` (session continuity) + `X-Hermes-Session-Key` (long-term memory scoping); SSE streaming; approval flow handled. **Researched (2026-06-24):** `API_SERVER_KEY` bearer is mandatory (loopback included — closes unauthenticated-RCE issue #6439); CORS off by default (`API_SERVER_CORS_ORIGINS` allowlist). Browser must never hold the key — proxy through a SvelteKit `$lib/server` route (the existing `api/trends/*` Claude-proxy pattern, ADR-E46-003). **HOSTING CONSTRAINT:** the cockpit is deployed on **Vercel (cloud)** while Hermes runs on **WSL (home machine)** — a Vercel serverless function cannot reach `127.0.0.1:9119`. The embedded-pane topology must be resolved in architecture (see §10.8).

**FR10:** Voice: push-to-talk in + streaming TTS out, available from the cockpit and/or Desktop, via Portal.

**FR11 (STUB — deferred decision):** Run-chain credential migration off the dead Anthropic key. **No implementation** until operator selects **Option A** (keep one Anthropic key, zero engine code) or **Option B** (additive, non-destructive provider branch). Portal is OpenAI-format only, so there is no zero-code Portal path for Boss's `tool_choice`.

**FR12:** Bidirectional dashboard awareness — Hermes can read live Convex state (digest, entities, trends, investigations, run-chain status) and the dashboard can surface notable events into Hermes's session. **Mechanism researched (2026-06-24) — two proven, complementary paths:** (a) **Pull** via the official **Convex MCP server** (read tables/schemas, sandboxed read-only queries, `execute_function`) mounted into Hermes; (b) **Push** via **Convex HTTP actions** (`convex/http.ts`) + **scheduled functions** that POST high-signal events to Hermes's API Server as messages, atomic with the triggering mutation. Recommended hybrid: pull for on-demand state, push for proactive notify. Architecture to finalize which events warrant push and the exact tool surface.

**FR13:** Dashboard server-side AI (`explain`, `summarise-risk`, investigation) routes through Portal (proxy or API) so those features work again.

**FR14:** Per-skill Hermes model routing activated (cheap models for cheap tasks) now that a Hermes-native API exists.

**FR15:** Hermes's native memory + skill-learning + Honcho user-modeling are active and fed by session-close.

**FR16 (Stretch):** Hermes can query the Brain semantic index for deep recall (depends on Brain production embedder — Portal `/embeddings`).

**FR17:** Orientation artifacts regenerate accurately: both `MEMORY.md`, `CNS-Daily-Rhythm.md` AUTO blocks, AGENTS §8, `project-context.md` (both repos), fast-scan-index; create missing `mobile-posture.md` + `personas/`; triage the 103-item inbox backlog.

**Total FRs:** 18 (including FR-GATE and FR11 stub)

### Non-Functional Requirements

**NFR1 (Verify gate):** `bash scripts/verify.sh` exits 0 before every commit (CNS + sibling cns-dashboard).

**NFR2 (Non-destructive):** No deletion/modification of run-chain adapter logic or the NEXUS bridge in this initiative; additive/env-gated only.

**NFR3 (Brain integrity):** `brain:index` / `brain:query` keep working post-switch; embedder dependency identified before any provider change.

**NFR4 (Secrets):** No secrets committed (`.env.live-chain` stays gitignored); rotate any key exposed during the audit; dashboard secrets stay in `$lib/server`/`+server.ts` (ADR-E46-003) and as Convex/Vercel env vars.

**NFR5 (Reversibility):** Every provider change config-reversible; openai-codex stays a working fallback until Portal proven stable.

**NFR6 (Cost):** Net subscription spend should fall (one Portal bill replaces ≥3); confirm before cancelling anything.

**NFR7 (Context discipline):** Fresh chat per BMAD workflow; stories sized under ~50% context.

**NFR8 (Two-bot boundary):** Hermes and the NEXUS bridge have a documented non-colliding boundary on the shared vault.

**Total NFRs:** 8

### Additional Requirements

**Goals (G1–G7):** Success criteria spanning provider stability, preservation of existing systems, JARVIS presence, ecosystem knowledge, learning/memory, voice I/O, and full governed access.

**Preservation constraints (non-negotiable):** Discord gateway, morning-digest cron, run-chain hook/boss/weapons engine, NEXUS Discord–Obsidian bridge bot, and Brain index must keep working untouched throughout.

**Out of scope:** Hook/boss/weapons engine logic modification (additive-only if FR11 approved); NEXUS bridge modification; Convex schema redesign; dashboard visual redesign beyond JARVIS pane; standalone subscription cancellation (evaluated only, gated on Tool Gateway tier); Epic 73 completion; true always-on duplex voice (upstream not shipped).

**Pre-work (Epic C kickoff):** Pre-1 fixture fix · Pre-2 `/session-close` · Pre-3 static-body fix · Pre-4 Portal subscribe + tier confirm.

**Sequencing dependency:** Pre-work → Epic A (keystone) → Epic B (sequential after A) + Epic C (parallel) + Epic D (after A) → FR11 credential decision → optional Epic B credential stories.

**ADR-HERMES-001 topology:** Production JARVIS = FR12 awareness + async ask box; inline embedded pane = Epic D3 dev-local/tunnel opt-in only (Vercel cannot reach WSL-local Hermes).

**Open architecture questions (§10):** FR12 mechanism confirmation; FR9 proxy pattern; FR13 routing choice; NFR3 Brain embedder path; FR10 voice surface; FR11 Option A vs B; Epic D split; JARVIS hosting topology (recommendation: option (a) — Desktop for chat/voice, cockpit for data awareness).

### PRD Completeness Assessment

## Epic Coverage Validation

### Epic FR Coverage Extracted

| FR | Epic Coverage |
|----|---------------|
| FR-GATE | Pre-4 (operator) + Story 74-4, Story 78-1 |
| FR1 | Epic 74 — Story 74-2 |
| FR2 | Epic 74 — Story 74-3 |
| FR3 | Epic 74 — Story 74-4 |
| FR4 | Epic 74 — Stories 74-4, 74-5 |
| FR5 | Epic 74 — Story 74-6 |
| FR6 | Epic 74 — Story 74-7 |
| FR7 | Epic 75 — Story 75-2 |
| FR8 | Epic 75 — Stories 75-3, 75-5 |
| FR9 | **Deferred** — D3 / ADR-HERMES-012 (dev-local/tunnel opt-in) |
| FR10 | Epic 78 — Story 78-1 |
| FR11 | Epic 75 — Story 75-4 (Option A confirmed in epics vs PRD stub) |
| FR12 | Epic 77 — Stories 77-1 through 77-5, 77-7 |
| FR13 | Epic 77 — Story 77-6 (stretch, async dispatch) |
| FR14 | Epic 78 — Story 78-2 |
| FR15 | Epic 76 — Story 76-6 |
| FR16 | **Deferred** — Brain semantic recall stretch |
| FR17 | Epic 76 — Stories 76-1 through 76-4 |
| NFR1–NFR8 | Cross-epic AC + dedicated stories (74-1 NFR3, 76-5 NFR8, etc.) |
| UX-DR1–5 | Epic 77 — Stories 77-5, 77-6 |

**Total FRs in epics map:** 18 (matches PRD count including FR-GATE and FR11)

### Coverage Matrix

| FR | PRD Requirement (summary) | Epic / Story | Status |
|----|---------------------------|--------------|--------|
| FR-GATE | Confirm Tool Gateway tier before Firecrawl/TTS work | Pre-4; gates 74-4, 78-1 | ✓ Covered |
| FR1 | Portal OAuth; nous provider; sonnet-4.6 default | Epic 74 / 74-2 | ✓ Covered |
| FR2 | auxiliary.compression → Portal Haiku | Epic 74 / 74-3 | ✓ Covered |
| FR3 | Web search → Portal Tool Gateway | Epic 74 / 74-4 | ✓ Covered |
| FR4 | Discord gateway + digest regression | Epic 74 / 74-5 | ✓ Covered |
| FR5 | Dashboard systemd + OAuth + reachability | Epic 74 / 74-6 | ✓ Covered |
| FR6 | Desktop WebSocket live chat | Epic 74 / 74-7 | ✓ Covered |
| FR7 | Run-chain governance module | Epic 75 / 75-2 | ✓ Covered |
| FR8 | Hermes run-chain skill via terminal() | Epic 75 / 75-3, 75-5 | ✓ Covered |
| FR9 | Embedded Hermes pane in /nexus | Deferred D3 | ⚠️ Intentionally deferred |
| FR10 | Push-to-talk + streaming TTS | Epic 78 / 78-1 | ✓ Covered |
| FR11 | Run-chain credential migration | Epic 75 / 75-4 (Option A) | ✓ Covered (decision resolved) |
| FR12 | Bidirectional dashboard awareness | Epic 77 / 77-1–77-5, 77-7 | ✓ Covered |
| FR13 | Dashboard server-side AI via Portal | Epic 77 / 77-6 (stretch) | ⚠️ Stretch only |
| FR14 | Per-skill model routing | Epic 78 / 78-2 | ✓ Covered |
| FR15 | Memory + Honcho + session-close feed | Epic 76 / 76-6 | ✓ Covered |
| FR16 | Brain semantic recall (stretch) | Deferred | ⚠️ Intentionally deferred |
| FR17 | Orientation artifact regeneration | Epic 76 / 76-1–76-4 | ✓ Covered |

### Missing Requirements

**Critical missing FRs:** None. Every PRD FR has either an epic/story path or an explicit deferral entry in epics frontmatter.

**Notable scope resolutions (not gaps):**

1. **FR11:** PRD lists as operator-deferred stub (Option A vs B). Epics/architecture resolved **Option A** (validate/rotate Anthropic key; zero adapter edits). Implementation path exists in Story 75-4 — confirm operator sign-off before build.
2. **FR13:** PRD states full requirement; epics demote to **stretch** (Story 77-6, async ask via hermes-dispatch). Inline streaming explain/risk deferred per ADR-HERMES-011. Acceptable if operator agrees async-only v1 satisfies G3/G4 for dashboard AI.
3. **FR9 / FR16:** Explicitly deferred — aligned with PRD out-of-scope / stretch language and ADR-HERMES-001 topology.

### Coverage Statistics

- **Total PRD FRs:** 18 (including FR-GATE, FR11)
- **FRs with active epic/story coverage:** 15
- **FRs intentionally deferred:** 2 (FR9, FR16)
- **FRs at stretch priority:** 1 (FR13)
## UX Alignment Assessment

### UX Document Status

**Dedicated Hermes UX doc:** Not found (operator confirmed N/A).

**Effective UX sources:**
- Embedded requirements: **UX-DR1 through UX-DR5** in `epics-hermes-consolidation.md` (D1 scope)
- Reference design system: `ux-designs/ux-CNS-2026-06-21/` (`DESIGN.md`, `EXPERIENCE.md`, mockups)
- Live theme source of truth: `cns-dashboard/src/routes/nexus/nexus-theme.css`

### UX ↔ PRD Alignment

| PRD intent | UX coverage | Status |
|------------|-------------|--------|
| G3 JARVIS presence in cockpit (awareness + async ask, not embedded chat) | UX-DR2 async ack pattern; ADR-HERMES-001 in architecture | ✓ Aligned |
| FR12 bidirectional awareness on `/nexus` | UX-DR3 panel density; UX-DR5 freshness chrome | ✓ Aligned |
| FR10 voice on Desktop (not cockpit inline) | No cockpit voice UX-DRs (correct per topology) | ✓ Aligned |
| FR9 embedded pane (D3 deferred) | No UX-DRs for embed — consistent with deferral | ✓ Aligned |

**UX requirements in epics not explicitly in PRD:** UX-DR1–5 are D1 refinements — appropriate decomposition of FR12/FR13 UI behavior. No orphan UX requirements.

### UX ↔ Architecture Alignment

| UX-DR | Architecture support | Status |
|-------|---------------------|--------|
| UX-DR1 Nexus theme tokens | Architecture references `nexus-theme.css`, `.nx-panel` patterns; Story 77-5 AC | ✓ |
| UX-DR2 Async ask (no SSE in production) | ADR-HERMES-001 + ADR-HERMES-005 async hermes-dispatch; Vercel cannot reach WSL | ✓ |
| UX-DR3 Instrument panel density | Existing `/nexus` panel patterns; extend not redesign | ✓ |
| UX-DR4 a11y (labels, keyboard, aria-live) | Story 77-6 AC explicitly cites UX-DR4 | ✓ |
| UX-DR5 Stale/sync chrome | NexusSourceHealthPanel pattern; Convex reactive queries (no polling) | ✓ |

**Performance/responsiveness:** Architecture mandates Convex `useQuery` reactive data (cns-dashboard project-context rule) — matches EXPERIENCE.md mobile breakpoint (768px) in UX-DR4.

### Alignment Issues

None critical. The embedded UX-DR pattern correctly bridges PRD topology constraints (no production WSL loopback) with the existing Nexus design system.

### Warnings

1. **No mockup for Ask-Hermes panel specifically** — UX folder mockups focus on entity modules (`key-nexus-entities.html`). Story 77-6 should reference `.nx-panel-status` and existing dispatch patterns; consider a lightweight mockup during 77-6 if operator wants visual sign-off (optional, not blocking).
## Epic Quality Review

### Epic Structure Validation

| Epic | User-centric title? | Delivers standalone value? | Independence |
|------|---------------------|----------------------------|--------------|
| 74 — Portal + Desktop | ✓ Operator runs Hermes on one subscription | ✓ Keystone unlocks B/C/D | Depends only on Pre-work |
| 75 — Run-chain revival | ✓ Operator triggers chain from Discord/Desktop | ✓ After Epic 74 | Backward dep on 74 only |
| 76 — Orientation cleanup | ✓ Accurate cold-start context | ✓ Parallel with 75 post Pre-2 | Soft dep on Pre-2 for 76-1 |
| 77 — JARVIS awareness | ✓ Operator sees live state on `/nexus` | ✓ After Epic 74 | No dep on 75/76/78 |
| 78 — Voice + routing | ✓ Operator talks to JARVIS on Desktop | ✓ After Epic 74 | No dep on 77 |

**No forward epic dependencies detected.** Epic D split (77 awareness / 78 voice) matches ADR-HERMES-001 and avoids Vercel↔WSL coupling.

### Story Quality Assessment

**Strengths:**
- All stories use proper Given/When/Then acceptance criteria
- Protect-list and NFR2 called out repeatedly (run-chain adapters, NEXUS bridge)
- Cross-repo verify gate (`bash scripts/verify.sh`) on every story
- Pre-work correctly excluded from story files
- Brownfield integration pattern (extend `/nexus`, Convex HTTP, Hermes skills) — no erroneous greenfield setup story

**Within-epic dependency chains (validated):**

- **Epic 74:** 74-1 (embedder audit) → 74-2 (Portal) → 74-3..74-7 sequential → 74-8 docs. All backward.
- **Epic 75:** 75-1 (vitest) independent; 75-2 → 75-3 → 75-5 chain; 75-4 parallel key validation.
- **Epic 76:** 76-1 session-close feeds 76-3; 76-6 requires Epic 74 complete (cross-epic backward).
- **Epic 77:** 77-1 → 77-2 → 77-4/77-7; 77-5 can leverage existing Convex panels; 77-6 stretch independent of pull path.
- **Epic 78:** 78-1 → 78-3; 78-2 parallel after 74.

### Quality Violations

#### 🔴 Critical Violations

None.

#### 🟠 Major Issues

1. **FR11 decision drift (PRD vs epics):** PRD §5 lists FR11 as operator-deferred stub; epics and architecture lock **Option A** (ADR-HERMES-004). Implementation path is clear, but **operator explicit sign-off** should be recorded before Story 75-4 execution to avoid building against an unconfirmed decision.

2. **Story 77-5 vs 77-1 sequencing ambiguity:** Story 77-5 AC says data from "Convex reactive queries" and existing home panels — could be interpreted as shippable before 77-1 HTTP endpoint. Recommend sprint ordering **77-1 before 77-5** so awareness panels reflect the HermesAwarenessSnapshot contract, not legacy panel shapes only.

#### 🟡 Minor Concerns

1. **Story 75-1** (vitest include) and **Story 74-1** (embedder audit) are technical-enabler stories — acceptable for brownfield/NFR3 but not user-facing on their own.
2. **Story 77-6** tagged `stretch-fr13` — FR13 not guaranteed in MVP; align sprint commitment accordingly.
3. **Story 77-3** P2 trend anomaly push deferred to stretch — document in sprint if anomaly awareness is G4-critical.

### Best Practices Compliance Checklist

| Epic | User value | Independent | Sized | No forward deps | Clear AC | FR traceability |
|------|------------|-------------|-------|-----------------|----------|-----------------|
| 74 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 75 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 76 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 77 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 78 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Summary and Recommendations

### Overall Readiness Status

**READY** — with three operator confirmations before build starts.

Planning artifacts (PRD, architecture, epics) are aligned, traceable, and implementable. No missing FR coverage, no critical epic structure defects, and UX requirements for D1 are embedded and architecture-backed. Deferred items (FR9/D3, FR16, FR13 inline) are explicitly documented.

### Critical Issues Requiring Immediate Action

None blocking sprint planning. Treat these as **pre-implementation gates**:

1. **Pre-4 / FR-GATE:** Confirm Nous Portal tier includes Tool Gateway before Stories 74-4 and 78-1.
2. **FR11 Option A sign-off:** Record operator approval of ADR-HERMES-004 before Story 75-4 (epics resolved; PRD still shows stub language).
3. **Pre-2 session-close:** Run before Epic 76 build and recommended before Epic 74 to avoid stale cold-start.

### Recommended Next Steps

1. **`bmad-sprint-planning`** — register Epics 74–78 in `sprint-status.yaml` with pre-work checklist items.
2. **Execute Pre-1 → Pre-4** in order; gate Epic 74 on Pre-4 Tool Gateway confirmation.
3. **Build order:** Epic 74 → Epic 75 ∥ Epic 76 → Epic 77 → Epic 78; keep 77-1 before 77-5 in sprint board.
4. **Optional:** Add Ask-Hermes panel mockup to `ux-designs/` during Story 77-6 if visual review desired.
5. **Invoke `bmad-help`** for next BMAD workflow step after sprint planning.

### Assessment Summary

| Category | Finding |
|----------|---------|
| Document inventory | Complete — 3 core artifacts + UX reference folder |
| PRD completeness | 18 FRs + 8 NFRs extracted; FR11 stub resolved in downstream artifacts |
| Epic FR coverage | 100% traceability; 2 deferred, 1 stretch |
| UX alignment | UX-DR1–5 aligned with PRD topology and architecture |
| Epic quality | No critical violations; 2 major advisories, 3 minor |
| **Issues total** | **5** (0 critical planning gaps, 3 operator gates, 2 sequencing advisories) |

### Final Note

This assessment identified **5 items** across document discovery, coverage, UX, and epic quality. None require rework of the planning artifacts before **`bmad-sprint-planning`**. Operator gates (Portal tier, FR11 sign-off, session-close) are execution prerequisites, not planning defects.

---

**Assessor:** Implementation Readiness workflow (BMAD)  
**Completed:** 2026-06-24  
**Report:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-06-24.md`
