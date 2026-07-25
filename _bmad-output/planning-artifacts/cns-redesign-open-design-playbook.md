# CNS Redesign Playbook — Ras Mic's workflow on Open Design

**Status:** research / planning · **Date:** 2026-07-16
**Goal:** Do the CNS redesign *properly* using the Open Design (OD) install we just wired, running Ras Mic's design-system-first workflow with **OD in place of Claude Design**.

---

## 0. The one principle everything hangs on

> Do **not** let the model freestyle the UI. Establish a **design system with semantic tokens first**; then every page is generated *from* that system, not invented per-screen.

Ras Mic's thesis and OD's architecture agree exactly. Ras Mic: freestyling produces "fugly," inconsistent UI where the landing page and dashboard look unrelated; the fix is design tokens (`brand-primary`, not a raw hex) so consistency and dark-mode are global. OD's spec says the same in product terms: **"Design System first → everything else reads from it."** A `DESIGN.md` is the shared brand memory injected into every skill's system prompt.

This is also **why the first CNS attempt wasn't good** (honest diagnosis below).

---

## 1. Why the first CNS artifact fell short

The `mission-control.html` we generated looked plausible but wasn't a real redesign, for three concrete reasons:

1. **The design system was hand-authored, not extracted.** `design-systems/cns/DESIGN.md` was reverse-engineered by me from the existing `cns-dashboard` tokens. That bakes in whatever "AI-smell" the current dashboard already has instead of starting from inspiration you actually love. Ras Mic's Step 2 is *extract from a reference you chose*, not *codify what you already have*.
2. **It used OD's legacy prose format, not the richest machine-consumable one.** It has prose sections + a *separate* `tokens.css`. OD's authoritative contributor schema (`docs/design-systems.md`) wants the tokens **inside** the `DESIGN.md` as a `:root {}` block with **semantic** names, a `[data-theme="dark"]` override, font-label blocks for catalog extraction, WCAG-AA contrast, `:focus-visible` states, and component CSS that references tokens (never hardcoded hex). The richer the system, the better every downstream generation.
3. **It was one-shot, with no refine loop and no component polish.** No comment-mode markup pass to strip AI artifacts, no premium component layer. Ras Mic gets his quality from Steps 3 and 5, which we skipped.

None of this is an OD limitation — we just didn't run the real workflow. This playbook is that workflow.

---

## 2. How Open Design actually works (the parts that matter here)

**Four modes** (`docs/modes.md`), composable, design-system first:

| Mode | Output | Use in the redesign |
|---|---|---|
| **Design System** | a `DESIGN.md` + preview | **Do this first.** The foundation everything reads from. |
| **Prototype** | one editable screen (HTML/JSX) | Each CNS surface: dashboard, digest, operator docs. |
| **Deck** | multi-slide HTML (PDF/PPTX) | Operator/investor decks, on-brand. |
| **Template** | filled copy of a curated template | Fast path when a starter is close enough. |

**The design system is the product's spine.** Once a `DESIGN.md` is the active system (top-bar "Design system" dropdown), OD auto-injects it into every Prototype/Deck/Template generation — that is what makes landing/dashboard/auth cohesive.

**OD ships skills to *build* the system from real sources** (so you never freestyle or hand-author):
- **`brand-extract`** — opens a live site in the in-app Browser tab and **measures** it with the `agent-browser` tool: frequency-ranks colors into 7 semantic roles (`background, surface, foreground, muted, border, accent, accent-secondary`), harvests real `@font-face`/`font-family`, saves multiple logo candidates, pulls 6–8 hero images → a machine-consumable Brand Kit (`brand.json` → `brand.html`). It explicitly guards against the failure mode *"an LLM left alone regresses to the mean — Inter, an indigo accent, a purple gradient."* Every value must trace to something measured.
- **`web-clone`** — reproduce a reference site from its **real source** (recon → reverse-engineer → rebuild), not from an AI's guess.
- **`figma-create-design-system-rules`** — derive rules from a Figma file.

**Refinement surfaces** (Ras Mic's Step 3):
- **Comment mode** — click an element → popover → "make this card glassmorphic." Available when the agent adapter reports `surgicalEdit: true`.
- **Chat** — "move the CTA above the fold."
- **Sliders** — any `od.parameters` a skill declares; re-prompts with just that value.

**Export to the codebase** (Ras Mic's Step 4, "Send to Claude Code"):
- We already wired OD's **MCP** into `claude / cursor / codex`. From inside Cursor/Claude Code the agent calls OD tools (`get_artifact`, `get_file`, `create_artifact`, `write_file`, `search_files`) to pull the active project's design system + artifacts straight into `cns-dashboard` — no zip export per iteration.

**The proper `DESIGN.md` contract** (`docs/design-systems.md`), 9 numbered sections:
`1. Visual Theme & Atmosphere · 2. Color · 3. Typography · 4. Spacing · 5. Layout & Composition · 6. Components · 7. Motion & Interaction · 8. Voice & Brand · 9. Anti-patterns`
Hard requirements: real hex in `:root{}`; `[data-theme="dark"]` override (CNS is dark-first, so author the *dark* tokens as primary); `Display:/Body:/Mono:` font-label block; WCAG-AA (4.5:1 text) with the note that tertiary text on dark surfaces still must pass; `:focus-visible` on every interactive element; component CSS references semantic tokens (`var(--color-primary)`), never hardcoded `#fff`.

---

## 3. Ras Mic's workflow → Open Design (the substitution)

| # | Ras Mic (Claude Design) | Open Design equivalent |
|---|---|---|
| 1 | Collect inspiration (Mobbin/X screenshots) | Same. Curate 5–10 refs you love. OD can also take a **live URL** directly. |
| 2 | Generate foundation with Claude Design (screenshots or a `design.md`) | **OD Design System mode** → `brand-extract` (measure a live reference) or `web-clone`, producing a proper `DESIGN.md` with `:root` semantic tokens. |
| 3 | Iterate/refine with the markup tool; remove AI artifacts; add missing components | **OD comment mode** (`surgicalEdit`) + chat. `brand-extract`'s "measure, don't guess" already suppresses AI-smell; add dialogs/forms/dropdowns/tooltips/empty-loading-error states. |
| 4 | Export to coding agent ("Send to Claude Code") | **OD MCP** (already wired to claude/cursor/codex) — agent pulls `DESIGN.md` + tokens into `cns-dashboard`. |
| 5 | Polish with premium libraries; **extract the design system from one striking component** and propagate | Same technique inside OD/Cursor: paste a component, tell the agent to extract its tokens (radii, spacing, color) and apply them app-wide. |

---

## 4. The CNS redesign, step by step

**Step 1 — Source inspiration (you, ~30 min).**
Gather 5–10 full-page screenshots of control surfaces you genuinely admire — Linear, Vercel dashboards, observability consoles (Datadog/Grafana), trading terminals, Raycast. Because CNS is a dark, data-dense *instrument* surface, bias the set that way. Park them in a folder (or a Mobbin/Gather board). Pick **one primary reference** whose feel you want CNS to inherit.

**Step 2 — Build the foundation in OD (Design System mode).**
Two good paths:
- **(a) Extract from a live reference** — open the reference site, run `brand-extract` (Home → "Create Design System" / paste the URL). OD measures real colors/type/logo and emits a Brand Kit you convert into `design-systems/cns/DESIGN.md`.
- **(b) Screens → system** — feed your inspiration screenshots into a Design System generation and have it produce the 9-section `DESIGN.md`.
Either way, **write it in the proper contract**: dark-first `:root` semantic tokens, `[data-theme]`, font labels, WCAG-AA, focus states. This **supersedes** the current hand-authored `design-systems/cns/` — treat that as a v0 placeholder.

**Step 3 — Refine out the AI-smell (comment mode + chat).**
Generate one representative screen (the dashboard) with the new system, then use **comment mode** to draw on/kill anything generic (fake confetti, hallucinated logos, mean-reverting indigo). Explicitly ask OD to add the missing component inventory: dialogs, forms, dropdowns, tooltips, toasts, and **empty / loading / error** states. Don't move on until one screen looks exactly right — that screen becomes the quality bar.

**Step 4 — Build the real app through the MCP.**
In **Cursor (WSL)** or **Claude Code**, with the OD MCP live, point the agent at `cns-dashboard` and instruct: *"Build these routes strictly from the active OD design system tokens: dashboard, digest UI, operator docs."* Because it reads the same `DESIGN.md` tokens, routes stay cohesive. (Cursor Agent now authenticated on your subscription; Claude Code and Codex already were.)

**Step 5 — Polish with a premium component layer.**
Ras Mic's layering, all Tailwind-compatible so they compose:
- **Foundation:** [shadcn/ui](https://ui.shadcn.com) — buttons, inputs, dialogs, tables, navbars.
- **Motion/marketing:** [Aceternity UI](https://ui.aceternity.com) and [Motion Primitives](https://motion-primitives.com) — hero/bento/reveal, tactile animation.
- **AI patterns:** [Cult UI](https://www.cult-ui.com) — animated + AI-SDK agent components (relevant for CNS's agent surfaces).
- **Fillers:** [HyperUI](https://www.hyperui.dev) — footers, 404s, standard blocks.
The technique: paste **one** striking component, tell the agent to **extract its design system** (colors, spacing, radii) and apply those tokens across the app, so the whole surface adopts the nuance rather than looking like a bolted-on widget.

---

## 5. Guardrails (bake into every prompt)

- **Semantic tokens only** — components reference `var(--color-*)`, never raw hex; this is what makes dark-mode and future re-skins one-line changes.
- **Measure, don't mean-revert** — anti-pattern to name explicitly in prompts: no default Inter+indigo+purple-gradient; every value traces to your inspiration.
- **Accessibility is Lens-A blocking** — WCAG-AA 4.5:1 (tertiary text on dark surfaces too), `:focus-visible` on every interactive element.
- **CNS is dark-first** — author the dark tokens as the primary `:root`, not as an afterthought override.
- **One quality bar screen first** — perfect the dashboard, then let the system propagate; don't generate five mediocre screens.

---

## 6. Strategic note (don't skip)

The CNS redesign is **substrate/polish** work — genuinely useful because dashboards, the Digest UI, and operator docs are *trust surfaces* a client or collaborator actually sees, but it is not itself the revenue/deploy needle-mover ([[project_strategic_bottleneck_deploy_not_build]]). Timebox it. The highest-leverage version: use this workflow to make the **operator-facing** surfaces (the ones tied to the trust/revenue modules) look credibly premium, then stop — don't gold-plate internal-only screens.

---

## Sources
- Open Design local docs: `docs/modes.md`, `docs/design-systems.md`, `skills/brand-extract/SKILL.md`, `skills/web-clone/SKILL.md`, `docs/spec.md`.
- Ras Mic workflow: operator-supplied notes (`Ras Mic's definitive workflow for d.txt`).
- [Anthropic ships major Claude Design overhaul — design-system imports & code round-trips (VentureBeat)](https://venturebeat.com/technology/anthropic-ships-major-claude-design-overhaul-with-design-system-imports-code-round-trips-and-a-fix-for-its-token-burning-problem)
- [How to Build a Design System in Claude Design That Doesn't Look Like AI (MindStudio)](https://www.mindstudio.ai/blog/build-design-system-claude-design-no-ai-aesthetics)
- [From Prompt to Production: Designer's workflow with Claude Design + Claude Code (Design Systems Collective)](https://www.designsystemscollective.com/from-prompt-to-production-a-designers-step-by-step-workflow-with-claude-design-claude-code-a7705daad026)
- Component libraries: [shadcn/ui](https://ui.shadcn.com), [Aceternity UI](https://ui.aceternity.com), [Cult UI](https://www.cult-ui.com), [HyperUI](https://www.hyperui.dev), [Motion Primitives](https://motion-primitives.com).
