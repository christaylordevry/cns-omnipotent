---
title: Nexus Entity Intelligence — Experience
status: final
updated: 2026-06-21
finalized: 2026-06-21
owner: Chris Taylor
design_ref: ./DESIGN.md
ui_system: Nexus Intelligence Cockpit (SvelteKit + convex-svelte, dark cockpit theme)
surfaces:
  - /nexus/entities (dashboard, reactive)
  - morning digest section (markdown, one-shot HTTP read)
binds_to:
  query: getEntityIntelligence (cns-dashboard, derived, returns two ranked lanes)
  health: getEntityIntelligenceHealth (cns-dashboard, derived)
requirements: [CAP-1, CAP-3, CAP-4, CAP-5, CAP-7, CAP-8, FR4, FR5]
---

# Nexus Entity Intelligence — Experience

> **Spines win on conflict.** This file and `DESIGN.md` supersede mocks and imports on disagreement.
> Key-screen mock: [`mockups/key-nexus-entities.html`](mockups/key-nexus-entities.html).

> **Inheritance.** The Nexus cockpit (SvelteKit routes under `cns-dashboard/src/routes/nexus/`,
> `convex-svelte` reactive `useQuery`, the `--nx-*` theme) is the UI system. This spec defines only the
> **behavioral delta** for two entity modules + a digest section. Visual identity lives in
> `{design_ref}`; this file references its tokens by name.

## Foundation

- **Form factor:** desktop-first dashboard (the cockpit), with the existing mobile collapse behavior
  inherited (`MOBILE_BREAKPOINT_PX = 768`, single-column stacking — see `NexusDigestSignalFeed.svelte`).
  The digest section is platform-agnostic markdown (Discord + dashboard digest).
- **Data contract:** both modules subscribe reactively to one query, `getEntityIntelligence`, which
  returns `{ trackedInMotion: EntityLaneItem[], emergingToReview: EntityLaneItem[] }`, each already
  ranked and sliced to `ENTITY_LANE_MAX_ITEMS` (architecture §5, ADR-E73-006). The client passes `now`
  (no `Date.now()` in the Convex query). `[ASSUMPTION A1]` UI does no re-ranking.
- **Read-only law:** no surface in this feature writes YAML or config (FR5 / CAP-5). The strongest
  affordance is a navigational deep-link ("Manually track"). No Approve, ever.
- **Per-card data (FR4):** every card renders display name, entity type, why-it's-here (`reasons[]`),
  activity/momentum summary, supporting source traces, and lane-appropriate quick actions.

## Information Architecture

```
Nexus cockpit
├── Intelligence            /nexus              (existing main cockpit)
├── Signals                 /nexus/investigate  (existing board)
└── Entities  [NEW]         /nexus/entities     ← activates the disabled "New Intelligence" sidebar slot
        ├── Module 1: Tracked Entities in Motion   (top, stacked)
        │     └── EntityCard[]  (tracked lane; actions: Inspect · Save)
        ├── Module 2: Emerging Entities to Review  (below, stacked)
        │     └── EntityCard[]  (emerging lane; actions: Inspect · Save · Manually track)
        └── EntityHealthFootnote
Intelligence Inspector drawer (existing, extended)
        └── mode: 'entity'  ← opened by "Inspect" from either lane

Morning digest (markdown)
└── DigestEntitySection
      ├── "Tracked entities accelerating now"   (ranked, ≤N lines)
      └── "Emerging entities worth a look"      (ranked, ≤N lines)
```

**Sidebar change (`NexusSidebar.svelte`):** the existing disabled `new-intelligence` nav item becomes
an enabled link — `{ id: 'entities', label: 'Entities', href: '/nexus/entities', icon: <people/spark> }`.
Active-state logic reuses the existing `isActive()` pattern (`pathname === '/nexus/entities'`).

**Route shell (`/nexus/entities/+page.svelte`):** reuses the `nexus/+layout.svelte` shell (sidebar +
topnav). The page body is a **single center column** of two stacked `{components.EntityModulePanel}`s —
no right rail (entity cards are wide). Layout reference:
[`mockups/key-nexus-entities.html`](mockups/key-nexus-entities.html).

**Lane separation is structural, not cosmetic (CAP-1).** Two distinct panels, distinct headers,
distinct detection models behind them (acceleration vs cold-start), distinct action sets. The lanes
never merge into one feed.

## Voice and Tone

Terse, analytical, evidence-first — the operator is a power user, not a novice. Microcopy:

| Context | Copy |
|---------|------|
| Module 1 title | `TRACKED ENTITIES IN MOTION` |
| Module 2 title | `EMERGING ENTITIES TO REVIEW` |
| Momentum (accel) | `12 mentions / 7d vs 1.3/wk baseline (≈4×)` |
| Momentum (cold) | `4 mentions / 7d · new (no baseline)` |
| Tracked-lane empty | `No tracked entities are accelerating right now.` |
| Emerging-lane empty | `No new entities crossed the review threshold this window.` |
| No-data (early days) | `Baselines are still accruing — emerging candidates will appear first.` |
| Save confirm | `Saved` (flash, then revert — mirrors "On board" pattern) |
| Save action label (v1) | `Save top signal` |
| Manually-track link | `Manually track →` (tooltip: `Opens where the people watchlist lives — no automatic changes`) |
| Health footnote | `Entity stage ran {time} · {n} snapshots · {t} tracked / {e} emerging` |

Tone rule: never imply automation the system won't do. "Manually track" must read as *you will do this
yourself*, reinforcing the read-only contract (FR5).

## Component Patterns (behavioral)

> Visual specs: `{design_ref}` Components. Below = behavior, props, lane deltas.

### EntityModulePanel
- Props: `title`, `lane: 'tracked' | 'emerging'`, `items`, `runDate`, `state`.
- Renders count badge = `items.length`; freshness meta = `runDate`.
- Owns the lane's empty/loading/error states (see State Patterns).

### EntityCard
- Props: `item: EntityLaneItem`, `lane`.
- **DOM structure (a11y):** `article` wrapper; **sibling** `button.nx-entity-card-main` (card body
  click → Inspect) and `footer.nx-entity-footer` (action buttons). Footer must **not** be nested
  inside the main button — mirrors `NexusDigestSignalFeed` (`div` card + separate main button + footer).
- Click on the card main → **Inspect** (opens drawer in entity mode). Footer buttons use
  `stopPropagation` only when needed for nested controls inside footer; they are outside the main
  button by default.
- Renders, top→bottom: `{components.EntityTypeBadge}` + name + (tracked pill | activeCount) →
  `{components.MomentumLine}` → `{components.ReasonChipRow}` → collapsed `{components.EvidenceTraceList}`
  → `{components.EntityLaneActions}`.

### MomentumLine
- Direction from server reasons: contains `acceleration` → up/teal; `cold_start` → review/amber;
  else → flat/muted (`{design_ref}` colours). Never computed client-side beyond reading reasons.

### ReasonChipRow
- One chip per `reasons[]` entry, capped visually (show first 4, "+N" overflow chip that expands).
- Chip text = short mono label per code; `title` + `aria-label` = full `reason.detail`.
- Order: surface the strongest trigger first (acceleration / cold_start), then enrichment reasons
  (cross_source, theme_adjacent, co_mentioned…). `[ASSUMPTION A1]` server order is trusted; UI only
  truncates.

### EvidenceTraceList (source traces, FR4)
- Collapsed default: `{n} source traces ▸`. Expand → up to 5 evidence rows (architecture caps
  `signalRefs` at 5). Each row links nowhere on its own; full provenance is in the Inspect drawer.

### EntityLaneActions (lane-differentiated, D4)
| Action | Tracked lane | Emerging lane | Behavior |
|--------|:---:|:---:|----------|
| Inspect | ✓ | ✓ | Opens `NexusInspectorDrawer` in `mode:'entity'` with the full item. Also triggered by card-main click. |
| Save top signal | ✓ | ✓ | Label **Save top signal** in v1 (not "Save entity"). Reuses investigation-board client against the entity's highest-rank `evidence[0]` signal `[ASSUMPTION A3]`. Board card should include entity `displayName` in note/metadata when 73-6 implements (adversarial review). Flashes `Saved`, then optional `View board` link. |
| Manually track | ✗ | ✓ (gated) | Shown only when `entityType` is `person` or `account`. **Hidden for `org`** — `nexus-people.yaml` is people-only in v1; org emerging entities have Inspect + Save only. Anchor deep-link to watchlist location (architecture §6.1). **Read-only; no write.** Tooltip: `Opens where the people watchlist lives — no automatic changes`. |
| Approve | ✗ | ✗ | **Out of scope, FR5.** Not rendered. |
| Compare | ✗ | ✗ | **Deferred v1 (D5).** Not rendered. v1.5/v2 once entity-comparison semantics are specced. |

### Inspector extension (`mode:'entity'`)
`[ASSUMPTION A2]` Additive to the existing `drawerPayload` union in `NexusInspectorDrawer.svelte`. Evidence
and reasons come from the in-hand `EntityLaneItem` passed at open time — **no secondary Convex fetch**
for entity mode. In entity mode the drawer header shows the entity name + `EntityTypeBadge`; body sections:
**Why it's here** (reasons[] as prose-expanded chips, reusing `.nx-inspector-why-block`), **Momentum**
(active vs baseline + the momentum line), **Source traces** (full `signalRefs`, reusing
`.nx-inspector-trace-list`), **Co-mentioned tracked entities** (chips, reusing
`.nx-inspector-related-list`). Footer is lane-aware: tracked → `Save` + `Dismiss`; emerging →
`Save` + `Manually track` + `Dismiss`. Topic/keyword/digestSignal modes are untouched.

### DigestEntitySection (digest surface, CAP-8)
- Pure markdown appended into the existing digest markdown before Discord chunking
  (`post-digest-discord.mjs`). Two sub-sections, each ranked, each `≤ ENTITY_LANE_MAX_ITEMS` but
  practically trimmed (digest is a glance): suggest top 3–5 lines per lane.
- Line grammar: `• **{displayName}** ({type}) — {momentumShort} · {topReasonLabel}`
  - tracked example: `• **Andrej Karpathy** (person) — ≈4× vs baseline · cross-source (3)`
  - emerging example: `• **ggml-org/llama.cpp** (org) — new, 5 mentions/7d · cold start`
- Section omitted entirely (no empty header) when a lane has zero items, to respect digest density.
- Feature remains useful with the dashboard closed (CAP-8): the digest carries name + why + momentum
  in one line each.

## State Patterns

Reuse the existing panel state vocabulary verbatim (`NexusSourceHealthPanel` / `NexusDigestSignalFeed`):

| State | Behavior |
|-------|----------|
| Loading | Skeleton cards (`.nx-digest-card-skeleton` shimmer); `role=status` SR text "Loading entities…". |
| Empty (lane) | `.nx-panel-status` with the lane-specific copy above (`role="status"`). |
| Empty (early days) | Both lanes empty + health footnote → show the "baselines accruing" message. |
| Error | `.nx-panel-status` `role="alert"`, "Entity intelligence unavailable. Try again shortly." Each lane fails independently if one is empty but data exists. |
| Reactive update | Convex subscription re-renders in place; no manual refresh. New/updated entities animate in respecting `prefers-reduced-motion` (reuse the existing reduced-motion guard). |
| Save pending/confirmed/error | Mirror `NexusDigestSignalFeed.addToBoard` exactly (pending → `Adding…`, success flash → `Saved`/`View board`, error → inline `role=alert`). |
| Stage didn't run | Health footnote states last successful run; lanes may show prior-window data. Never a hard error if the post-push stage exited 0 with no fresh snapshots (architecture §8). |

## Interaction Primitives

- **Card click = Inspect.** Card main is a sibling `button`; footer actions are outside it (not nested).
- **Keyboard:** card main `button` (Enter/Space → Inspect); footer actions in tab order after main; drawer reuses the existing **focus trap + Esc-to-close + focus
  restore** in `NexusInspectorDrawer.svelte`.
- **Overflow chips:** "+N" is a button; expands the row (no navigation).
- **Manually track:** standard anchor (`<a href>`), opens in a way that surfaces the watchlist
  location/instructions; never a mutation, never a confirm dialog (nothing to confirm).
- **No drag, no inline edit, no destructive action** anywhere in v1.

## Accessibility Floor

- Every colour-coded signal (entity type, momentum direction, reason chip) has a **text twin**: type
  has a mono label, momentum has the numeric line, each chip has visible text + `aria-label` = full
  `reason.detail`. Colour is never the only carrier (WCAG 1.4.1).
- Panels use `aria-labelledby` to their titles; lists use `role="list"`; status/skeleton use
  `role="status"`; errors use `role="alert"` — same as existing panels.
- Drawer: inherits the existing dialog semantics (labelled aside, `inert` when closed, focus trap,
  Esc, focus restore).
- Targets: footer buttons keep the existing ≥28–32px hit areas; chips are non-interactive except the
  "+N" overflow.
- Contrast: text on `{design_ref}` surfaces inherits the cockpit's existing passing ratios; the rose
  danger token is used for text only on dark surfaces where it already passes (errors), never as a
  3px-on-grey decorative element.

## Key Flows

### Flow 1 — Chris catches a tracked name heating up (CAP-2 / CAP-4)
Sunday, 06:30, coffee. Chris opens the cockpit on his laptop, clicks **Entities** in the sidebar
(the slot that used to be greyed out). **Tracked Entities in Motion** is the top module. The first card:
**Andrej Karpathy**, teal type-dot, a bold teal line — `18 mentions / 7d vs 4.1/wk baseline (≈4×)` —
and three chips: `ACCEL ≈4×`, `3 SOURCES`, `NEW: youtube`. He doesn't need logs; the *why* is on the
card. **Climax:** he hovers `NEW: youtube`, the tooltip reads "first YouTube appearance vs 30-day
baseline" — that's the part he'd have missed manually. He clicks the card; the Inspector slides in
(entity mode) with the five source traces. He hits **Save**, it flashes `Saved`, and he moves on —
twelve seconds, one genuinely earlier signal. No Approve button tempted him to over-automate; there
wasn't one.

### Flow 2 — Chris discovers an org he wasn't watching (CAP-3 / CAP-5)
Tuesday. The tracked lane is quiet, so Chris scrolls to **Emerging Entities to Review**. A card he's
never seen: **ggml-org/llama.cpp** (org, blue dot), amber line `5 mentions / 7d · new (no baseline)`,
chips `COLD START`, `2 SOURCES`, `THEME`. It's clearly a candidate, clearly explained. **Climax:** he
decides it's worth tracking. He clicks **Manually track →**; instead of silently editing YAML, it opens
the location where `nexus-people.yaml` lives with a note that nothing was changed. *He* makes the call
and the edit — the system surfaced, it didn't decide. That's the trust contract working: one emerging
entity drove a real decision (CAP-3 success), and the feature never mutated his config (CAP-5).

### Flow 3 — Chris reads the digest with the dashboard closed (CAP-8)
07:00, phone, Discord. The morning digest lands. Below the signal sections, two short blocks:
**Tracked entities accelerating now** — `• **Andrej Karpathy** (person) — ≈4× vs baseline ·
cross-source (3)` — and **Emerging entities worth a look** — `• **ggml-org/llama.cpp** (org) — new,
5 mentions/7d · cold start`. **Climax:** he gets the same two insights as the dashboard, in two lines,
without opening anything — and taps through to `/nexus/entities` only because he *wants* the source
traces, not because the digest was too thin to act on. The feature lives in the daily flow, not just
the cockpit.

## Inspiration & Anti-patterns

- **Inspiration:** the existing digest feed's tiered, evidence-forward cards and the source-health
  panel's honest "inferred" disclaimer — both set the bar for *legible, trustworthy* density.
- **Anti-pattern to avoid:** a generic "recommendations" feed with a thumbs-up/approve button. This
  feature is deliberately read-only suggestion-grade (FR5); the absence of Approve and (v1) Compare is
  a feature, documented in `{design_ref}` Do's and Don'ts, not an oversight.

## Responsive & Platform

- **Desktop (primary):** `/nexus/entities` uses full center column (~900px max content width in mock);
  two stacked modules; cards show momentum line + chips without horizontal scroll.
- **Mobile (≤768px):** inherits cockpit breakpoint (`MOBILE_BREAKPOINT_PX`). Single column; reason chips
  wrap; source-health-style horizontal scroll not used for entity cards (vertical list only). Footer
  actions wrap on narrow widths.
- **Digest (Discord + dashboard markdown):** no DOM — plain-text bullets per `DigestEntitySection`. No
  colour or interactive affordances; name leads each line for SR and Discord plain rendering. Deep-link
  to `/nexus/entities` may appear as a single markdown link after sections when digest template supports it.

## Open Items

- `[ASSUMPTION A1/A2/A3]` (see decision log) to confirm in dev-stories 73-5/73-6.
- `[NOTE FOR UX]` Compare is a tracked v1.5/v2 candidate — revisit when a spec defines entity-to-entity
  comparison semantics (what is compared against what, over which window).
- Sidebar icon for Entities slot: use people/radar spark icon at implementation (mock uses text nav).

---

## Finalization log

- **2026-06-21:** Key-screen mock `mockups/key-nexus-entities.html` rendered (both lanes + empty/loading alts).
- **2026-06-21:** Reviewer Gate — rubric + adversarial + a11y; synthesis in `validation-report.md` / `.html`.
- **2026-06-21:** Patches from review: Save top signal label, Manually track gated by entityType, card DOM sibling structure, Responsive section, mock links, digest emoji removed from DESIGN.
- **2026-06-21:** Status → `final`.
