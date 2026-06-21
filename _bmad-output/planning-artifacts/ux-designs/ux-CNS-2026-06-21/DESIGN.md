---
title: Nexus Entity Intelligence — Visual Design
status: final
updated: 2026-06-21
finalized: 2026-06-21
owner: Chris Taylor
inherits_ui_system: Nexus Intelligence Cockpit theme (cns-dashboard/src/routes/nexus/nexus-theme.css)
scope: Two dashboard modules (Tracked Entities in Motion, Emerging Entities to Review) + digest section variant
colors:
  # Aliases of existing --nx-* tokens. Epic 73 introduces NO new base palette.
  surface.0: "var(--nx-surface-0)"        # #161616 page
  surface.1: "var(--nx-surface-1)"        # #1e1e1e card interior
  surface.2: "var(--nx-surface-2)"        # #262626 panel
  surface.3: "var(--nx-surface-3)"        # #303030 inset / chip
  border: "var(--nx-border)"              # #383838
  text.0: "var(--nx-text-0)"              # #f0f0f0 primary
  text.1: "var(--nx-text-1)"              # #b8b8b8 secondary
  text.2: "var(--nx-text-2)"              # #888888 muted
  accent.primary: "var(--nx-accent-primary)"   # #00c8aa teal — momentum / accelerate / tracked
  accent.secondary: "var(--nx-accent-secondary)" # #60a5fa blue — emerging / neutral evidence
  accent.warning: "var(--nx-accent-warning)"   # #fbbf24 amber — review / caution
  accent.danger: "var(--nx-accent-danger)"     # #fb7185 rose — errors only
  tracked.affordance: "#00d4aa"          # people-match teal (existing .nx-inspector-people-match-chip)
  # Entity-type tints (NEW semantic aliases over existing palette, no new hex)
  entity.person: "var(--nx-accent-primary)"
  entity.account: "var(--nx-accent-secondary)"
  entity.org: "var(--nx-lifecycle-mature)"     # #60a5fa-family blue
typography:
  font.body: "var(--nx-font-body)"       # Source Sans 3
  font.mono: "var(--nx-font-mono)"       # DM Mono — labels, badges, metrics
  scale.module_title: "0.6875rem / 0.12em uppercase mono"   # .nx-panel-title
  scale.entity_name: "0.9375rem / 600 body"                 # card primary
  scale.momentum_line: "0.8125rem / 600 mono"               # the bold metric line
  scale.reason_chip: "0.6875rem / 500 mono"                 # .nx-*-chip
  scale.meta: "0.625rem–0.6875rem mono"                     # counts, source badges
rounded:
  chip: "999px"
  card: "8px (var(--nx-radius-lg))"
  inset: "6px (var(--nx-radius-md))"
spacing:
  panel_gap: "var(--nx-panel-gap)"       # 12px
  panel_padding: "var(--nx-panel-padding)" # 16px
  card_margin: "6px 12px"                # matches .nx-digest-card
components:
  - EntityModulePanel
  - EntityCard
  - MomentumLine
  - ReasonChipRow
  - EntityTypeBadge
  - EvidenceTraceList
  - EntityLaneActions
  - EntityHealthFootnote
  - DigestEntitySection
---

# Nexus Entity Intelligence — Visual Design

> **Spines win on conflict.** This file and `EXPERIENCE.md` are the contract for Epic 73 UX. They
> supersede mocks, wireframes, and imports when those disagree. Visual mock:
> [`mockups/key-nexus-entities.html`](mockups/key-nexus-entities.html) (both lanes, loaded state).

> **Inheritance contract.** This feature is **not a new visual language**. It inherits the Nexus
> Intelligence Cockpit theme defined in `cns-dashboard/src/routes/nexus/nexus-theme.css`. Every token
> below is an alias of, or a thin extension over, an existing `--nx-*` token. Epic 73 adds **zero**
> new base colours, fonts, or radii. Where this doc and the live `nexus-theme.css` ever disagree,
> `nexus-theme.css` is the source of the base token and this doc only adds *semantic* aliases.

## Brand & Style

The Nexus surface is a **dark, instrument-panel intelligence cockpit** — charcoal shell, monospace
instrumentation, a single teal accent for "this is moving / this matters," restrained chrome, dense
but legible. The entity modules must read as **another instrument on the same dashboard**, not a new
product. Voice on-surface is terse and analytical: labels are uppercase mono micro-labels; numbers
are mono; prose is minimal and only appears as evidence ("why this matters").

Two new semantic ideas are layered onto the existing language, both expressed with existing colours:

- **Momentum** is the hero quantity. It is always teal (`{colors.accent.primary}`) when accelerating,
  amber (`{colors.accent.warning}`) when flagged for review, muted (`{colors.text.2}`) when flat.
- **Lane identity** is carried by the module header and an accent edge, not by recolouring cards:
  - *Tracked in Motion* → teal family (continuity with the existing people-match teal `#00d4aa`).
  - *Emerging to Review* → blue/amber family (`{colors.accent.secondary}` / `{colors.accent.warning}`),
    signalling "candidate, not yet trusted."

## Colors

All values alias `nexus-theme.css`. No new palette.

| Role | Token | Base | Usage |
|------|-------|------|-------|
| Page | `{colors.surface.0}` | `#161616` | route background |
| Panel | `{colors.surface.2}` | `#262626` | `EntityModulePanel` body |
| Card | `{colors.surface.1}` | `#1e1e1e` | `EntityCard` interior |
| Inset / chip bg | `{colors.surface.3}` | `#303030` | reason-chip / badge backgrounds |
| Hairline | `{colors.border}` | `#383838` | card + panel borders |
| Primary text | `{colors.text.0}` | `#f0f0f0` | entity display name |
| Secondary text | `{colors.text.1}` | `#b8b8b8` | reason detail |
| Muted text | `{colors.text.2}` | `#888888` | counts, source meta, flat momentum |
| Momentum / tracked accel | `{colors.accent.primary}` | `#00c8aa` | momentum line up, acceleration chip, tracked lane accent |
| Emerging / neutral | `{colors.accent.secondary}` | `#60a5fa` | emerging lane accent, cross-source chip |
| Review / caution | `{colors.accent.warning}` | `#fbbf24` | cold-start "needs review" chip, low-confidence |
| Error only | `{colors.accent.danger}` | `#fb7185` | load/stage errors; never decorative |
| Tracked affordance | `{colors.tracked.affordance}` | `#00d4aa` | tracked-entity pill (matches existing people-match chip) |

**Reason-chip colour mapping** (chips reuse `.nx-anomaly-direction-tag` / `.nx-digest-disposition-chip`
geometry; tint by meaning):

| reason code | Chip tint | Base |
|-------------|-----------|------|
| `acceleration` | teal | `{colors.accent.primary}` |
| `cold_start` | amber | `{colors.accent.warning}` |
| `cross_source` | blue | `{colors.accent.secondary}` |
| `new_source` | blue | `{colors.accent.secondary}` |
| `theme_adjacent` | muted | `{colors.text.1}` on `{colors.surface.3}` |
| `co_mentioned` | tracked teal | `{colors.tracked.affordance}` |
| `high_priority_source` | teal | `{colors.accent.primary}` |

**Entity-type tint** (small left-of-name dot / badge): `person` teal, `account` blue, `org` blue
(mature). Type is also always spelled in a mono micro-label so colour is never the only signal
(see Do's and Don'ts / accessibility).

## Typography

Inherits the two existing families verbatim — **Source Sans 3** (`{typography.font.body}`) for names
and prose, **DM Mono** (`{typography.font.mono}`) for every label, badge, count, and metric.

| Element | Spec | Mirrors |
|---------|------|---------|
| Module title | `{typography.scale.module_title}` | `.nx-panel-title` |
| Entity display name | `{typography.scale.entity_name}` | `.nx-digest-card-title` |
| Momentum line | `{typography.scale.momentum_line}` | new, mono-bold |
| Reason chip | `{typography.scale.reason_chip}` | `.nx-anomaly-direction-tag` |
| Source badge / count | `{typography.scale.meta}` | `.nx-digest-card-source` |

Numerals in momentum and counts are **always mono** so columns of metrics align — consistent with
score/rank rendering in the inspector (`.nx-inspector-score`, `.nx-digest-card-rank`).

## Layout & Spacing

- Route `/nexus/entities` reuses the shell from `nexus-theme.css`: `.nx-shell` (sidebar +
  `.nx-content`). The entity surface uses a **single center column** of stacked panels (no right rail),
  to give wide evidence cards room — distinct from the main page's `minmax(0,1fr) var(--nx-weights-width)`
  two-column grid.
- Two `EntityModulePanel`s stacked with `{spacing.panel_gap}` (12px); each `.nx-panel` with
  `{spacing.panel_padding}` (16px) header padding, card list inside.
- `EntityCard` margins `{spacing.card_margin}` (`6px 12px`) — identical to `.nx-digest-card` so the two
  feeds feel like siblings.
- Reason chips wrap (`flex-wrap`) with `6px` gaps, like `.nx-digest-card-tags`.

## Elevation & Depth

Reuse exactly: panels `box-shadow: var(--nx-panel-shadow)`; cards flat on `{colors.surface.1}` with a
1px `{colors.border}` hairline; hover lifts the border to teal-mix and the card bg to
`{colors.surface.2}` (the existing `.nx-digest-card:hover` behavior). A momentum/priority entity gets a
**3px left accent edge** in the lane accent colour, reusing the `.nx-digest-card-priority`
`border-left` device — not a new shadow.

## Shapes

Pills (`{rounded.chip}`) for chips/badges; `{rounded.card}` (8px) for cards and panels;
`{rounded.inset}` (6px) for inset rows (evidence traces). No new shapes; matches existing radii.

## Components

> Visual specs only. Behavior, states, and props live in `EXPERIENCE.md` (cross-referenced).

### EntityModulePanel
A `.nx-panel` with `.nx-panel-header` → `.nx-panel-title` (uppercase mono) on the left, a mono count
badge + freshness meta (`.nx-panel-meta`, the run date) on the right. Lane accent appears only as a
2px top-border tint in the lane colour. Two instances: "Tracked Entities in Motion",
"Emerging Entities to Review". See mock:
[`mockups/key-nexus-entities.html`](mockups/key-nexus-entities.html).

### EntityCard
Mirrors `.nx-digest-card`: a column inside a hairline card. Top row = `EntityTypeBadge` + display name
(left), tracked pill or `activeCount` (right). Then `MomentumLine`. Then `ReasonChipRow`. Then a
collapsed `EvidenceTraceList`. Footer = `EntityLaneActions`. Hover/focus identical to digest card.

### MomentumLine
A single mono-bold line, colour-coded by direction (teal up / amber review / muted flat). Format:
`{activeCount} mentions / {window}d vs {baselineDailyRate}/wk baseline (≈{ratio}×)`. For cold-start
entities with no baseline: `{activeCount} mentions / {window}d · new (no baseline)`.

### ReasonChipRow
`flex-wrap` row of pills. Each pill = mono micro-label (e.g. "ACCEL ≈4×", "COLD START", "3 SOURCES",
"NEW: github", "THEME", "CO-MENTIONED", "PRIORITY SRC"), tinted per the colour map. `title`/`aria-label`
carries the full `reason.detail` string. Reuses `.nx-anomaly-direction-tag` geometry.

### EntityTypeBadge
Small dot + 2-letter mono badge (`PE`/`AC`/`OG`) using the source-badge style
(`.nx-inspector-digest-source-badge`). Dot tinted by entity type; label always present.

### EvidenceTraceList
Reuses `.nx-inspector-trace-row` styling: up to 5 evidence rows, each = source badge
(`DIGEST_SOURCE_BADGE` map) + signal title (truncated) + sourceType. Collapsed to "N source traces"
summary that expands on click; opening Inspect shows the full list in the drawer.

### EntityLaneActions
Footer button row reusing `.nx-digest-card-footer` + `.nx-digest-add-board-btn` styling. **Lane-aware**
(per `EXPERIENCE.md` D4): Tracked = `Inspect · Save top signal`; Emerging = `Inspect · Save top signal · Manually track` (gated by entityType).
"Manually track" is a deep-link (anchor), visually a tertiary ghost button. **No "Approve" button.
No "Compare" button in v1.**

### EntityHealthFootnote
A muted one-liner under the lower module (reusing `.nx-source-health-disclaimer` style) surfacing
`getEntityIntelligenceHealth`: e.g. "Entity stage ran 06:14 · 142 snapshots · 8 tracked / 6 emerging".
Mirrors the source-health inference disclaimer pattern.

### DigestEntitySection
Markdown (not DOM) variant for the morning Discord/dashboard digest. Two compact ranked sub-sections
rendered as text, within the existing digest markdown + 2000-char chunking
(`post-digest-discord.mjs`). Each line: `• {displayName} ({type}) — {momentum short} · {top reason}` (plain text; bold optional in
dashboard markdown only).
Visual identity = plain markdown; no colour, so it must lead with the name and a single momentum/reason
clause. See `EXPERIENCE.md` for exact line grammar.

## Do's and Don'ts

**Do**
- Alias `--nx-*` tokens; let `nexus-theme.css` own every base value.
- Lead every card with the **name + momentum line** so "why" is legible without expanding.
- Use mono micro-labels alongside colour for type and reasons (colour is never the sole signal).
- Reuse `.nx-digest-card`, `.nx-anomaly-*`, `.nx-inspector-*` chrome so the surface feels native.
- Render empty/loading/error with the existing `.nx-panel-status` / skeleton / `role="alert"` patterns.

**Don't**
- Don't introduce a new palette, font, card shape, or shadow.
- Don't ship a **one-click Approve / auto-track** affordance (FR5 / CAP-5) — surfaces are read-only.
- **Don't ship "Compare" in v1.** *(Locked deferral, D5.)* Entity-to-entity comparison semantics are
  undefined in SPEC and architecture; an action with no defined behavior would undermine the PRD trust
  criterion (CAP-4) more than its absence costs. **Revisit as a v1.5/v2 candidate only once a spec
  defines what entity comparison compares.** This is a documented deferral, not an omission.
- Don't put "Manually track" on Tracked-lane cards (D4) — those entities are already tracked.
- Don't recolour entire cards by lane; lane identity lives in the header + accent edge only.
- Don't let colour carry meaning a screen reader can't reach — every tint has a text/`aria` twin.
