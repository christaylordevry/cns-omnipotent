# Validation Report — CNS Epic 73 Entity Intelligence

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/EXPERIENCE.md`
- **Run at:** 2026-06-21T14:30:00+10:00

## Overall verdict

The spine pair passes validation for downstream story authoring (73-6 dashboard modules, 73-7 digest sections). Rubric walker: **adequate-to-strong** across categories; visual reference gap closed with `mockups/key-nexus-entities.html`. Adversarial review surfaced one implementation-critical labeling issue for **Save** (signal vs entity) and **Manually track** gating for non-person org entities — both patched in the finalized EXPERIENCE.md. Accessibility review requires sibling DOM structure for card main vs footer (not nested buttons). No critical findings block marking spines `final`.

## Category verdicts

- Flow coverage — **strong**
- Token completeness — **adequate**
- Component coverage — **strong**
- State coverage — **adequate**
- Visual reference coverage — **adequate** (post-mock)
- Bloat & overspecification — **adequate**
- Inheritance discipline — **strong**
- Shape fit — **adequate** (Responsive section added at finalize)

## Findings by severity

### Critical (0)

None.

### High (2)

**[Visual reference coverage]** — Mock not linked in spines before finalize (§ DESIGN Components, EXPERIENCE IA)
Spines lacked inline reference to key-screen mock.
*Fix:* Added `mockups/key-nexus-entities.html` links; spines win on conflict stated.

**[Accessibility]** — Nested interactive risk on entity cards (§ EXPERIENCE Interaction Primitives)
Card `<button>` must not wrap footer action buttons.
*Fix:* Document sibling structure `article > button.main + footer`; mirror digest feed DOM.

### Medium (4)

**[Adversarial]** — Save action saves top signal, not entity label (§ EntityLaneActions, A3)
Board card may not show entity context.
*Fix:* Save button label **Save top signal** until entity-scoped board metadata exists; board note includes entity display name in 73-6.

**[Adversarial]** — Manually track inappropriate for `org` emerging entities (§ EntityLaneActions)
`nexus-people.yaml` is people-only in v1.
*Fix:* Show Manually track only for `person` and `account`; hide for `org` with copy "Orgs not watchlistable in v1".

**[State coverage]** — Inspector entity mode data source (§ Inspector extension)
Clarify evidence comes from `EntityLaneItem` in payload, no secondary fetch.

**[Shape fit]** — Missing Responsive & Platform section (multi-surface: dashboard + digest)
*Fix:* Section added at finalize.

### Low (5)

- Flow failure paths only in State Patterns, not Key Flows.
- DESIGN digest template mentioned emoji; EXPERIENCE omits — aligned at finalize.
- Compare deferral not on-surface for operators (acceptable; internal spec).
- Teal chip contrast — verify at implementation (cockpit precedent).
- `title` tooltips on chips — inspector is SR-primary path for full reasons.

## Reviewer files

- `review-rubric.md`
- `review-adversarial.md`
- `review-a11y.md`
- `mockups/key-nexus-entities.html`
- `validation-report.html` (this report's HTML twin)
