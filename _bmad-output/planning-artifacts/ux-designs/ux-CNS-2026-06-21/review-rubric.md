# Spine Pair Review — CNS (Epic 73 Entity Intelligence)

## Overall verdict

The spine pair is **ready for downstream story authoring** with minor patches applied during finalize (mock links, DOM structure for card/footer, Responsive section, digest line grammar alignment). Flow coverage, component duality, and lane-differentiated actions are strong. Token completeness is adequate for a brownfield extension (hex literals in the Colors table; semantic aliases documented). Visual reference coverage was thin until the key-screen mock was added. No critical mechanical breaks block 73-6/73-7.

## 1. Flow coverage — **strong**

Checked CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-7, CAP-8 against Key Flows.

### Findings
- **low** Flow 1–3 cover protagonist journeys with climax beats but no explicit **failure path** (e.g. entity stage didn't run, error state). State Patterns table covers these; Key Flows omit a failure beat. *Fix:* optional fourth micro-flow or one sentence in Flow 1 noting graceful empty when stage skipped — addressed in State Patterns, acceptable for v1.

## 2. Token completeness — **adequate**

Extracted YAML `colors`, `typography`, `rounded`, `spacing` and all `{colors.*}` / `{typography.*}` prose references.

### Findings
- **medium** Several frontmatter color entries use `var(--nx-*)` strings without inline hex; downstream consumers must read `nexus-theme.css`. The Colors **table** supplies hex for every load-bearing role — sufficient when paired with inheritance note. *Fix:* none required; table is the mirror target.
- **low** `{colors.entity.org}` references `var(--nx-lifecycle-mature)` without hex in table row — org tint inherits blue family; acceptable.

## 3. Component coverage — **strong**

Nine components in DESIGN.md; matching behavioral rows in EXPERIENCE.md Component Patterns. DigestEntitySection has visual + behavioral specs.

### Findings
- **low** `MomentumLine` and `ReasonChipRow` are sub-parts of EntityCard in DESIGN but also have standalone EXPERIENCE rows — good. No orphan components.

## 4. State coverage — **adequate**

Surfaces: `/nexus/entities` (two modules), inspector drawer entity mode, digest markdown.

| Surface | States covered |
|---------|----------------|
| Entity modules | loading, empty (lane), empty (early days), error, loaded, save pending/confirm/error, stage didn't run |
| Drawer | inherits existing open/closed/empty |
| Digest | omitted when lane empty |

### Findings
- **medium** Inspector **entity mode loading** while `getEntityIntelligence` item is present but evidence fetch pending — not spelled out. *Fix:* note drawer uses in-hand `EntityLaneItem.evidence` (no extra fetch) — clarify in Inspector extension bullet.

## 5. Visual reference coverage — **adequate** (after mock)

`mockups/key-nexus-entities.html` added at finalize. Spines initially lacked inline links.

### Findings
- **high** No inline mock link at DESIGN Components or EXPERIENCE IA before finalize. *Fix:* add `mockups/key-nexus-entities.html` links in both spines (finalize step).

## 6. Bloat & overspecification — **adequate**

Some repetition between DESIGN Components and EXPERIENCE Component Patterns is intentional (visual vs behavioral split). Brownfield grounding table in decision log is verbose but useful for 73-6.

### Findings
- **low** DESIGN DigestEntitySection mentions `{emoji}` in line template but EXPERIENCE examples omit emoji — inconsistency. *Fix:* remove emoji from DESIGN template to match EXPERIENCE.

## 7. Inheritance discipline — **strong**

`design_ref: ./DESIGN.md` resolves. Component names match across spines. CAP/requirement IDs align with SPEC. Token references in EXPERIENCE resolve to DESIGN names.

### Findings
- **low** Sidebar decision log says label "Entities" while EXPERIENCE still references `new-intelligence` id — consistent intent, id may stay `entities` in implementation.

## 8. Shape fit — **adequate**

DESIGN.md canonical section order present. EXPERIENCE.md has all required defaults. **Responsive & Platform** not present — triggered by dashboard + digest multi-surface.

### Findings
- **medium** Missing Responsive & Platform section (required when triggered). *Fix:* add short section covering desktop-first, mobile stack, digest as markdown-only.

## Mechanical notes

- Frontmatter `status: draft` — update to `final` at close.
- Spines-win-on-conflict statement not yet in spines — add once at top of EXPERIENCE or DESIGN per finalize protocol.
- `[ASSUMPTION A1–A3]` appropriately flagged for dev-story confirmation.
