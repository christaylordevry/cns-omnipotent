---
stepsCompleted: [1, 2, 4, 5]
lastStep: 5
inputDocuments:
  - _bmad-output/planning-artifacts/nexus-unified-app-master-plan.md
  - _bmad-output/planning-artifacts/brownfield/00-index.md
  - _bmad-output/planning-artifacts/brownfield/system-overview.md
  - _bmad-output/planning-artifacts/brownfield/data-spine.md
  - _bmad-output/planning-artifacts/brownfield/surface-inventory.md
  - _bmad-output/planning-artifacts/brownfield/operator-workflows.md
  - _bmad-output/planning-artifacts/brownfield/ops-runtime-map.md
  - docs/index.md
  - docs/project-overview.md
  - docs/source-tree-analysis.md
  - docs/project-scan-report.json
  - docs/development-guide.md
  - project-context.md
  - HANDOFF-2026-07-24-instrument-revert-and-capability-scan.md
  - vault:03-Resources/pluto-system-design-vs-cns-architecture-sizing.md
workflowType: architecture
status: gate0-approved
gate0ApprovedAt: "2026-07-25"
step03Skipped: "starter-template evaluation inapplicable — brownfield unified-app; operator directed Decision 1 next"
pendingDecision: null
m0Execution: "awaiting-explicit-operator-go"
decisionsLocked:
  - id: D1-repo-topology
    target: A-turbo-pnpm-monorepo-multi-package
    status: locked
    lockedAt: "2026-07-25"
  - id: D1b-migration-sequencing
    target: C-contract-bridge-then-A-workspace
    status: locked
    lockedAt: "2026-07-25"
  - id: D2-shell-data-flow-ia
    target: one-shell-workflow-ia
    status: locked
    lockedAt: "2026-07-25"
  - id: D3-pluto-pull-ins
    target: sentry-first-workflow-gated-sandbox-last
    status: locked
    lockedAt: "2026-07-25"
  - id: D4-convex-stack-keep
    target: keep-convex-operational-plane-single-runtime-contract-source
    status: locked
    lockedAt: "2026-07-25"
  - id: D5-data-model-sequencing-and-gate0
    target: dm12-batched-dm3-dm4-gated-gate0-closed
    status: locked
    lockedAt: "2026-07-25"
project_name: CNS
user_name: Chris
date: "2026-07-25"
architectureScope: nexus-unified-app-phase-0
supersedesNothing: true
preservesIntact:
  - _bmad-output/planning-artifacts/architecture.md
methodMandate: first-principles-ideal-then-judge
sacredConstraints:
  - north-star-one-coherent-wired-app
  - honesty-primitives
  - instrument-visual-language
decisionProtocol: propose-then-stop
gate: "GATE 0 — operator approves architecture + monorepo call before Phase A / migration / code"
---

# Architecture Decision Document — Nexus Unified App (Phase 0)

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

**Sibling docs left intact:** Phase 1 Vault IO `architecture.md` (complete, 2026-04-01) is evidence and constraint history — not this document's baseline.

---

## Method mandate (binding — overrides preserve-by-default)

Treat brownfield docs, existing architecture ADRs, and as-built code as **EVIDENCE** of what exists and how it behaves (including what hurt) — **not** as a baseline to extend or preserve.

For every load-bearing decision (repo topology, app shell, nav/IA, data model, surface set, stack choices, digest / trend / entity pipelines):

1. **DERIVE THE IDEAL FIRST.** From the North Star + requirements: if we were building this today with no existing code, what is the right design? Write that clean-slate answer **before** consulting what exists.
2. **THEN judge** the existing implementation against that ideal with an explicit verdict — **KEEP** (wins on independent merit) / **CHANGE** (partly right) / **KILL** (exists only by inertia). "It's already built" is **not** a valid justification.
3. **Migration cost and sequencing** are decided **after** the right target is chosen — never let "that's expensive to change" pre-empt the design decision.
4. **FLAG ANCHORING:** wherever a recommendation is shaped by "what's already there," say so explicitly so the operator can challenge it.

### Sacred (do not relitigate)

| Constraint | Meaning |
|------------|---------|
| **North Star** | One coherent wired web app — every surface/system connected, flowing |
| **Honesty primitives** | No fabricated data affordances; honest empty/quiet states; signal-strength ≠ confidence |
| **INSTRUMENT** | Near-black `#111` + cyan `#0090C0` (and light-mode pair); flat instrument chrome; one visual language |

Everything else — repos, surfaces, data shapes, pipelines, stack choices — is a **candidate for change** and must earn its place via KEEP / CHANGE / KILL.

### Decision protocol

Propose → stop → operator approval. No migration, no code, no Phase A until **GATE 0** clears (architecture + monorepo call).

### Agenda (load-bearing decisions — order)

1. Repo topology / monorepo (A / B / C spectrum; vault never vendored; Hermes runtime stays `~/.hermes`)
2. Unified-app shell + data-flow + nav/IA (including `/trends` and dead surfaces)
3. Ras Mic / Pluto first-class pull-ins: Convex `workflow`, Sentry, agent-experience stack rule, Daytona/Docker sandbox

---

## Initialization record (Step 1)

**Created:** `_bmad-output/planning-artifacts/architecture-nexus-unified-app.md`  
**Branch context:** Omnipotent.md `hermes-consolidation` · dashboard sibling `cns-redesign`  
**Inputs loaded:** see frontmatter `inputDocuments`  
**Pluto note:** pulled via Vault IO (`03-Resources/pluto-system-design-vs-cns-architecture-sizing.md`) — monorepo trigger MET in operator brief; pull-ins listed above.

**Master-plan note:** Part 7 still points at Phase A / RP-1; Part 4.5 + this workflow supersede that for sequencing — Phase 0 / GATE 0 first. Master plan will be updated when architecture decisions land (after Gate 0 — not during Decision proposals).

---

## Project Context Analysis

_Charter = master plan Part 0. Brownfield = evidence of behavior and pain, not a preserve-list. No separate PRD._

### Requirements overview (ideal product — from North Star)

**Functional (architectural meaning):**

| Need | Architectural implication |
|------|---------------------------|
| One coherent web app spanning cockpit, trends, entities, investigations, digest, vault, Hermes, NotebookLM, voice | Single product shell, single IA, shared design system, shared client↔data contracts — not a folder of loosely linked apps |
| Operator workflow state: orient → judge → investigate → deepen → capture | Navigation and data-flow designed around **state transitions**, not around repo or historical route trees |
| Surfaces that are empty must say so honestly | UI architecture forbids fabricated chrome; empty/quiet/error are first-class states |
| Visual fidelity (INSTRUMENT) is part of done | Design tokens + shell primitives are architectural constraints, not polish backlog |
| Systems must be wired end-to-end (writers → store → queries → surfaces) | Topology must make writer and reader of the same contract co-visible to agents and humans |
| Long-running agent work must not die on session drop | Durable execution belongs in the control plane (candidate: Convex `workflow`) |
| Failures must be searchable across gateway + app | Structured observability (candidate: Sentry) is a first-class concern |
| Risky agent shell/browser needs containment | Sandbox boundary (Daytona/Docker) is an architecture decision, not an ops preference |

**Non-functional:**

| NFR | Implication |
|-----|-------------|
| Single-operator personal ops (not multi-tenant SaaS) | Prefer coherence and agent DX over tenancy/billing/SSO theater |
| WriteGate / vault path contracts remain for knowledge mutations | Vault stays a governed external knowledge plane — never vendored into app git |
| Hermes runtime stays at `~/.hermes` | Runtime install ≠ source-of-truth packaging; decide only where *source* and *contracts* live |
| Verify gate green; propose-then-stop on data shapes / ranking | Architecture must support atomic cross-surface change + contract tests |
| Reactive live data in the app | Shared data plane with subscriptions (Convex already fits the ideal on merit — to be judged later, not assumed for topology) |

**Scale & complexity:**

- Primary domain: full-stack personal intelligence OS (web app + orchestration + agent runtime + external knowledge vault)
- Complexity: **high** (multi-surface product + continuous ingest + agent skills + honesty UX) — not enterprise multi-tenant
- Estimated architectural components (ideal): app shell · shared types/contracts · data plane · orchestration writers · agent runtime boundary · vault IO boundary · observability · durable workflow · sandbox

### Technical constraints & dependencies (sacred + hard boundaries)

| Constraint | Class |
|------------|-------|
| North Star / honesty / INSTRUMENT | Sacred — do not relitigate |
| Vault = live Obsidian/PARA — reference via vault-io only | Hard — never vendor into monorepo |
| Hermes process runtime at `~/.hermes` | Hard — source may move; runtime path stays |
| Gate 0 before Phase A / migration / code | Process |
| Input set frozen (no more existing-design docs) | Process — reduces anchoring |

### Cross-cutting concerns

1. **Product coherence vs strata split** — one app vs multiple repos/shells/themes
2. **Contract integrity** — writers (orchestration) and readers (app) sharing types without drift
3. **Agent context packing** — coding agent must see UI + backend + contracts in one workspace for the North Star to be implementable consistently
4. **Operator flow** — IA/shell must encode workflow states, not historical page inventory
5. **Durability & observability** — long skills + searchable failures across surfaces
6. **Containment** — sandbox for risky agent execution
7. **Honesty** — data-shape and UI affordance rules that survive every surface

### Evidence note (not yet judging topology)

Brownfield documents record pain that *motivates* asking the topology question (schema drift, dual `_bmad-output`, dual git identity, app/backend invisibility). That pain is **evidence the ideal must address**. It does not dictate which option (A/B/C) wins — Decision 1 derives the target first.

### Step 3 note

Starter-template evaluation (**step-03**) skipped as inapplicable to this brownfield Phase 0. Next: Decision 1 (repo topology) under propose-then-stop.

---

## Decision 1 — Repo topology (LOCKED)

**Status:** LOCKED 2026-07-25 · **Target:** Option **A**  
**Migration sequencing:** not locked here — see Decision 1b (propose-then-stop)

### Target definition (precise — do not misread)

**A = one workspace of multiple packages**, not a single merged codebase.

| Package / tree (names illustrative) | Role |
|-------------------------------------|------|
| `apps/dashboard` (or equiv.) | Nexus unified web app — shell, surfaces, INSTRUMENT |
| `packages/orchestration` (or equiv.) | Digest / trend ingest / sync / awareness writers; Hermes *source* (skills/contracts as code) |
| **`packages/contracts` (first-class, linchpin)** | Shared types, Convex payload validators, digest/trend/entity contract schemas — **imported by both app and Hermes writers** |
| `packages/vault-io` / specs | Vault IO MCP + `specs/cns-vault-contract/` |
| `_bmad-output/` | **One** planning + implementation artifact tree |
| Root verify | **One** verify gate spanning packages |

**Linchpin (explicit):** Co-location alone does **not** kill OPS-2 / `contributedCount`-class drift. The **shared-contract package** does: app and writers import the same validators/types. "Monorepo" here means that workspace shape — **not** "move all folders into one soup."

### Ideal → verdict (record)

Clean-slate ideal (one product → one workspace, shared contracts, vault/Hermes-runtime out of band) → **A**.  
Existing split repos: **KILL** as topology target. Vault outside git: **KEEP**. Hermes runtime `~/.hermes`: **KEEP**. Dual `_bmad-output` / standing OPS-2 process: **KILL**.

Ideal-first reasoning approved by operator as non-anchored.

### Hard rules (unchanged)

1. **Vault never vendored** — live PARA; agents use vault-io only.
2. **Hermes runtime stays `~/.hermes`** — in-repo = source / skills / contracts **synced out** to runtime; not the live process tree.

### Explicitly not decided here

- Package manager / Turbo layout details beyond "Turbo + pnpm workspace"
- Which git remote becomes primary
- Exact package names
- **Migration sequencing** → Decision 1b

### Operator refinements absorbed

1. Multi-package workspace; shared-contract package is the linchpin against schema drift.
2. Prefer **C-first bridge** for sequencing (stand up contracts package before full collapse) — target remains A; detail in 1b.

**No code. No migration execution until Gate 0 (full architecture) and sequencing approval.**

---

## Decision 1b — Migration sequencing (LOCKED)

**Status:** LOCKED 2026-07-25  
**Sequence:** **M0 → M1 → M2 → M3**  
**Invariant:** C is a bridge; A remains the architectural target.

### M0 — Diagnose, unblock live data, then formalize the contract

**Deliverable zero: diagnose the live P0 from real evidence before defining the contract.**

1. Pull a real rejected digest payload and the matching Convex validation error.
2. Trace the exact writer path and receiving validator.
3. Determine which side is canonically wrong. Do **not** pre-assume that `contributedCount` should be absent.
4. Explicitly test competing explanations: top-level vs nested placement, a second writer path, partial synchronization, and regression after dashboard commit `ada50fe` / Story 90-2.
5. Define the corrected canonical shape from that diagnosis.

**Sequence inside M0:**

1. **Minimal live fix first:** change whichever side the evidence proves wrong; commit this independently to unblock the morning spine.
2. **Prove the operator outcome:** run a real morning digest; Convex accepts the write; the cockpit displays a digest run **newer than 2026-07-22**.
3. **Formalize second:** extract the proven shape into the first-class shared-contract package (`@cns/contracts` is illustrative); make both app validators and Hermes/orchestration writers import it.

**Acceptance criterion:** success is the real end-to-end digest outcome above. Type-checking and dual imports are necessary but insufficient.

### M1 — Dual-repo contract consumption

- App and writers both import the shared contract.
- Each repo's verification asserts contract compatibility/version.
- Retire the manual OPS-2 synchronization ritual for covered shapes.
- Repositories remain split only as a temporary migration state.

### M2 — One multi-package workspace

- Establish the Turbo/pnpm root and converge into `apps/*`, `packages/contracts`, orchestration/Hermes source, Vault IO/specs, one `_bmad-output`, and one root verify gate.
- Choose the git-history and repository-collapse mechanic separately after architecture approval.
- Co-location does not replace contracts; `packages/contracts` remains the linchpin.

### M3 — Runtime synchronization boundary

- Version Hermes source, skills, and contracts in the workspace.
- Install/sync them one-way to the live runtime at `~/.hermes`.
- Keep runtime state, logs, secrets, and process files out of the repository.
- Keep the live vault outside git and accessible only through Vault IO.

### Non-goals and anchoring record

- No code or migration executes before Gate 0.
- Package names, Turbo configuration, primary remote, and git-history mechanics remain open.
- **Anchoring flag:** M0's first deliverable is shaped by the live `contributedCount` P0. This controls sequencing, not target topology.
- **Anchoring flag:** split repos through M1 are temporary containment, never the end state.

---

## Decision 2 — Unified shell, data flow, and IA (LOCKED)

**Status:** LOCKED 2026-07-25  
**Target:** One product shell; workflow IA; durable judgments; shared evidence as a **target data model** (not an ingestion rewrite commitment)

### Validation — WDS Phase 3/4 convergence

This IA independently converges with WDS Phase 3/4 scenarios. Cite as validation, not as source of design:

| WDS scenario | Architecture destination |
|--------------|--------------------------|
| **S01** morning-orient | **Briefing** |
| **S03** dig-and-deepen | **Explore** |
| **S02** entity narrative | **Explore** lens (Entities) |

The clean-slate workflow (Orient → Judge → Investigate → Deepen → Capture) produced the same destinations; WDS confirms the operator mental model already pointed here.

### One shell (target)

- Persistent left nav for workflow destinations
- Header: context, command/search, freshness, system health
- Main workspace
- One context drawer (selected signal / entity / trend / case / note)
- Global Hermes text/voice drawer (everywhere)
- URL-addressable workflow state; no critical context only in client memory
- Honest loading / empty / quiet / stale / partial / error states (INSTRUMENT + honesty sacred)

### Information architecture (locked)

| Destination | Route family | Job | Includes |
|-------------|--------------|-----|----------|
| **Briefing** | `/` | Orient and judge | Morning digest, priority queue, Dig / Watch / Dismiss |
| **Investigate** | `/investigate` | Advance active work | Cases, board, sessions, findings, **investigation canvas** (today's `/trends/canvas` + `canvasLayouts`) |
| **Explore** | `/explore/*` | Deepen understanding | Trends, Entities, Anomalies as **lenses** (not peer primary destinations) |
| **Knowledge** | `/knowledge/*` | Retrieve and capture | Vault bridge, NotebookLM, authored notes |
| **System** | `/system/*` | Operate the machinery | Sources, pipeline runs, health, integrations, settings |

**Global (not primary destinations):** Hermes/voice drawer · command palette · Support as contextual help · Archive as durable status/filters across Briefing / Investigate / Knowledge · Digest as pipeline feeding Briefing, not a separate product surface.

### Surface-set verdicts (locked)

| Existing concept | Verdict | Target |
|------------------|---------|--------|
| Nexus shell | **CHANGE** | Becomes the only product shell |
| Trends shell | **KILL** | Capabilities under `/explore/trends`; independent shell removed |
| Intelligence | **CHANGE** | **Briefing** |
| Signals board | **CHANGE** | **Investigate** |
| Trends | **KEEP capability / CHANGE placement** | Explore lens |
| Entities | **KEEP capability / CHANGE placement** | Explore lens |
| Anomalies | **KEEP capability / CHANGE placement** | Explore lens (not primary nav) |
| Sources | **KEEP capability / CHANGE placement** | System |
| Archive | **KILL as destination** | Durable lifecycle + filters |
| Docs | **CHANGE** | Knowledge |
| Support | **KILL as destination** | Contextual help |
| Hermes/voice | **KEEP capability / CHANGE placement** | Global shell affordance |
| NotebookLM | **KEEP capability / CHANGE placement** | Knowledge lens/tool |
| Investigation canvas (`/trends/canvas`) | **KEEP capability / CHANGE placement** | **`/investigate`** — advances active work, not Explore |

### Data-flow principles (locked)

1. **Canonical evidence substrate = TARGET data model**, not an implicit pipeline rebuild. A later data-model decision sequences it incrementally:
   - **First (cheap, high-value):** provenance fields + cross-surface identity keys
   - **Only if measured overlap justifies it:** fuller digest/trend lineage unification (today trend ingest covers ~2–3 sources; overlap is narrow)
   - Decision 2 does **not** commit to re-engineering ingestion
2. Separate evidence from interpretation (observations vs scores vs judgments vs cases)
3. Provenance on every surfaced claim (source, observed time, processing time, freshness)
4. Durable operator actions (Dig / Watch / Dismiss / Resolve / Capture) as persisted commands
5. Commands vs projections; UI does not invent missing state
6. One contract boundary (`@cns/contracts`) for writer↔app payloads
7. Cross-surface identity so Briefing → Explore → Investigate → Knowledge does not losey-copy

### Durable Dismiss — KILL client-only (with rationale)

**Verdict:** Client-only Dismiss → **KILL**. Durable Dismiss → **KEEP as target**.

**Why the prior deliberate choice flips:**

- **Original BD-1 rationale (valid then):** `digestSignals` are per-run scoped; client-only dismiss prevented noise accumulating across ephemeral run rows.
- **What changed:** the cockpit now joins runs on `externalId` (change-gating). The same signal identity can **reappear across runs**, so local-only dismiss no longer holds.
- **Target behavior:** durable suppress of re-surfacing for the same `externalId`, with **decay** (nothing silenced forever). Exact retention/decay parameters belong to the later data-model decision.

### Existing data-flow verdicts (otherwise approved)

| As built | Verdict |
|----------|---------|
| Shared reactive operational data plane (concept) | **KEEP concept** — Convex earns KEEP separately at stack decision |
| Separate digest and trend lineages | **CHANGE** toward target model; no forced full unification now |
| Entity stage mainly digest-tied | **CHANGE** toward cross-evidence derivation over time |
| Awareness backend without shell consumer | **CHANGE** → global freshness/health |
| Vault bodies outside operational DB | **KEEP** |
| Snapshot/search bridge for app knowledge | **CHANGE** → formalize read bridge; vault remains authority |

### Anchoring flags (acknowledged)

- Target shell is a new unified shell; Nexus components survive only if they satisfy it.
- Explore lenses resemble Trends/Entities/Anomalies because those jobs independently match "deepen."
- Convex not locked here.
- WDS citation is **validation of convergence**, not an instruction to preserve WDS docs as baseline.

**No code. No shell migration until Gate 0.**

---

## Decision 3 — Pluto / Ras Mic pull-ins (LOCKED)

**Status:** LOCKED 2026-07-25  
**Targets:** D3a–D3d approved · **Sequence:** **D3b → D3a → D3d (last, non-blocking)** · PostHog deferred

### Ideal properties (record)

Durable long work · searchable failure · agent-friendly stack selection · containment for unsupervised agent execution.

### D3b — Structured observability (HIGHEST PRIORITY)

**Target:** Sentry on Hermes gateway + dashboard. PostHog deferred.

**Evidence attribution (correct):** The P0 digest break (`contributedCount` / Convex `ArgumentValidationError`) is a **CONTRACT failure**, not a durability failure. Convex `workflow` would **not** have caught it; a **pushing** error product would.

**Also true:** `check-digest-run-outcome.mjs` already recorded the failure and nobody read it. A log nobody checks and a dashboard nobody opens fail identically.

**Unify with Decision 2 awareness — one health model, three consumers (not a second health system):**

| Consumer | Grade | Role |
|----------|-------|------|
| **Sentry** | Developer | Stack traces, unhandled rejections, failed mutations, skill aborts |
| **Awareness projection** | Operator | Shell freshness/health — System destination + Last-sync (Decision 2) |
| **Hermes / Discord** | Push | P0 alerts to the operator; in-app Notifications is the twin surface |

**Hard requirement:** a failed digest write must **actively reach the operator** (Discord/Hermes push and/or in-app notification) — not merely sit in Sentry or an outcome file.

**Verdict:** log-only as sole error product → **KILL**. Sentry → **KEEP**. Separate parallel “health product” → **KILL**. Awareness + Sentry + Discord = one model, three lenses.

### D3a — Durable long-running skills (GATED)

**Target:** Convex `workflow` for skills that need durable multi-step execution. Short interactive turns stay on the request path.

**Gate — observed evidence before wrap:**

1. D3b lands first (need failure data).
2. Inventory skills that have **actually** aborted/dropped in practice (logs + the new error product).
3. Wrap **only** those. If the honest list is digest completion + NotebookLM fan-out, scope is **two skills**, not a program.
4. `workpool` remains deferred until workflow earns its keep on the real list.

**Verdict:** blanket workflow-wrap → **KILL**. Evidence-gated `workflow` on proven droppers → **KEEP**. Sequencing: **after D3b**.

### D3c — Agent-experience stack rule (LOCKED POLICY)

When adding infra, score in order: (1) Convex component or MCP the agent can drive? (2) Can it live as code in-repo? (3) Avoid a new context island? If no → written exception required.

Implicit preference → **CHANGE** to explicit rule. Effect-TS / billing-class complexity → **KILL for now**.

### D3d — Sandbox (LAST, NON-BLOCKING)

**Target:** Sandbox for **autonomous / unsupervised** execution — not blast-radius alone.

| Trigger class | Backend |
|---------------|---------|
| Cron-triggered, Discord-triggered, or any path with **no human in the loop** | Sandbox **mandatory** (`daytona` or `docker` — choice unlocked) |
| Operator-in-the-loop (Cursor / Claude Code / supervised session) | **Local allowed** |

**Rationale:** Cursor and Claude Code already run unsandboxed on the host; **supervision** is the discriminator.

**Sequence:** D3d is **last** and **explicitly non-blocking** for Gate 0 and the wiring waves. Daytona vs Docker stays unlocked.

**Verdict:** `local` for all skills including unsupervised cron → **CHANGE**. OpenClaw multi-tenant theater → **KILL**.

### Out of scope (confirmed)

Autumn/credits, WorkOS/SSO, Effect-TS ledger, multi-channel messaging, Greptile (optional later), named staging (soft later), PostHog (deferred).

### Anchoring flags (acknowledged)

- Convex-as-durability-host is partly shaped by the live data plane — durability requirement survives even if Convex later fails KEEP.
- Sentry is the boring default for structured errors, not sacred.
- D3d autonomy criterion deliberately de-centers “already have daytona_image.”

---

## Decision 4 — Operational data plane: KEEP Convex (LOCKED)

**Status:** LOCKED 2026-07-25  
**Target:** Convex remains the operational data plane for the unified app.

**KEEP rests on:** reactive reads + typed server-validated commands + one shared plane for writers and app + agent DX (D3c). "Already deployed" is quarantined as an anchoring flag — it is evidence of fit and switching cost, never the justification.

### Contract mechanism (binding — this makes M0 real)

Convex validators are runtime values; TypeScript types are compile-time. If `@cns/contracts` defines one and Convex hand-defines the other, they drift silently — exactly how `contributedCount` happened.

**RULE: one runtime definition is the single source; all types derive from it.** (Convex supports Infer-style type derivation — confirm the exact API via Context7 at implementation time.)

**Coupling fork — decide explicitly at M0; both options legal; hand-maintained parallel definitions FORBIDDEN either way:**

| Option | Mechanism | Trade |
|--------|-----------|-------|
| **(a) Direct export** | `@cns/contracts` exports Convex validators; app schema and writers both import them | Mild Convex coupling in the contract package; zero generation tooling |
| **(b) Vendor-neutral + generate** | Contracts define neutral schemas; Convex validators are **generated** from them | Vendor-neutral contracts; adds a generation step that must be part of verify |

Either way: **exactly one runtime source of truth**; types via inference/derivation only; no second hand-written definition on either side of the writer↔app boundary.

### Stays off Convex (explicit)

| Excluded | Rule |
|----------|------|
| Vault note bodies | Vault remains knowledge authority (Decision 2); Convex holds snapshots/read-bridge only |
| Hermes process runtime | `~/.hermes` boundary (Decision 1) |
| **Secrets / credentials** | Env only — never Convex documents (`HERMES_CONVEX_READ_KEY`, API keys, tokens) |
| **Honcho memory / recall state** | Separate learning pillar on its managed service; never mirrored into Convex for "unification"; never touch the `pre_llm_call` recall path |
| **Large raw artifacts** | Vault exports (~1.2–1.6 MB), media, scraped blobs — store **references**, not payloads |
| Second SSOT for contracts | Convex schema/validators **consume** `@cns/contracts`; they are not an independent definition |

### KILL / do not introduce

Second operational DB "for the redesign" · polling loops as primary UX freshness · client-side invented operational state.

### Alternatives rejected (approved as-is)

Postgres + custom realtime (more surface, weaker agent DX) · split app-DB/ingest-DB (recreates the drift class) · vault-as-operational-store (wrong job).

**No code. No migration until Gate 0.**

---

## Decision 5 — Incremental data-model sequencing + Gate 0 (LOCKED)

**Status:** LOCKED 2026-07-25 · **Gate 0:** CLOSED / APPROVED

### Data-model sequence

| Step | What | Notes |
|------|------|-------|
| **DM-1+2 (ONE contract revision)** | Identity keys **and** provenance fields batched | Additive; one lockstep two-repo deploy pre-monorepo. Delivers freshness for D3b awareness one step earlier. |
| **DM-3** | Durable Dismiss-with-decay + Resolve/Archive lifecycle | Depends on DM-1 identity rule |
| **DM-4** | Evidence/interpretation / lineage unification | **Gated** — only if measured overlap justifies it |

### DM-1+2 — Identity + provenance (batched)

**Identity (DM-1):**

1. **Measure first:** fraction of `digestSignals` carrying a usable `externalId`, broken down by source. Evidence of a real hole: `nexus-overnight-delta.ts` already falls back to `id:${digestSignalId}` when `externalId` is absent — id-only keys never match across runs by design, so those rows are invisible to identity-join and DM-3 Dismiss-with-decay would silently fail to suppress them.
2. **Adopt `externalId` as seed** only with known coverage from that measurement.
3. **Fallback rule required:** for rows without a usable `externalId`, either (a) derive a stable cross-run key, or (b) explicitly mark them **non-joinable** and **exclude** them from durable-Dismiss guarantees. No silent half-coverage.

**Provenance (DM-2):** additive `source`, `observedAt`, `processedAt` (freshness derivable) on every surfaced record — same revision as DM-1.

**Anchoring resolution:** `externalId` stays the seed convention; coverage measurement + fallback kill the silent-failure mode. Challenge remains open only if measurement shows a better canonical key.

All shapes through `@cns/contracts` (D4 single-runtime-source rule). Exact schemas remain propose-then-stop at story level.

### DM-3 — Durable judgments

Implements Decision 2: Dismiss-with-decay on the identity key; persisted Resolve/Archive. First behavioral schema change after DM-1+2.

### DM-4 — Lineage unification gate

Unification is **not** the default. Justification requires a named measurement, fed by RP-1:

> **Overlap share** = fraction of source observations that appear in **both** digest and trend lineages.

Only if that share is high enough to justify the cost (today trend ingest covers ~2–3 sources; expect narrow overlap until measured) does DM-4 proceed. Otherwise stay deferred indefinitely.

### Gate 0 close-out (this approval)

1. Architecture doc stamped `status: gate0-approved`.
2. Master plan reconciled: Part 4.5 decisions recorded; Part 7 next step = **M0 diagnosis** (explicit operator go); **Phase B design gate preserved** — hand-built visual target per destination (Briefing / Investigate / Explore / Knowledge / System), operator-approved **before** any build. That workflow is the only one that has produced a design the operator kept; rewriting Part 7 must not bury it.
3. Phase 0 record committed as one planning commit (brownfield package + this architecture + reconciled master plan).
4. **Still no code.** M0 begins only on explicit operator go.

**Not covered by Gate 0 (remain propose-then-stop during execution):** package names, Turbo config, git-history mechanic, Daytona vs Docker, contract fork (a) vs (b), per-DM field schemas.

