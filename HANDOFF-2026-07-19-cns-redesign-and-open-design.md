# HANDOFF 2026-07-19 — CNS Redesign + Open Design install

**Read `memory: project_cns_redesign_open_design` first (⭐), then this.** Nothing here needs redoing — pick up at **Freya IA**.

---

## TL;DR
- **Open Design** is installed system-wide and persistent (daemon + web GUI + MCP). Done.
- **CNS redesign** is being planned via **WDS** in `cns-dashboard`. **Saga Phase 1–2 (Product Brief + Trigger Map) DONE and committed.** Next = **Freya IA (Phase 3–4)**.
- One operator action is clock-bound: **capture the baseline this week** (before any surface changes).

## What this session did (arc)
1. Installed **Open Design** (`nexu-io/open-design`) system-wide in WSL — daemon `:7456` (systemd `open-design.service`), web GUI `:3000` (systemd `open-design-web.service`), MCP wired into **claude/cursor/codex**. Full details + WSL gotchas: `memory: reference_open_design_install`.
2. Proved the OD generate loop (cockpit artifact via Claude engine). Fixed **cursor-agent auth** (subscription login, not API key).
3. Researched **Ras Mic's design-system-first workflow → mapped onto Open Design**. Playbook committed (see index).
4. Fixed `cns-dashboard`'s **half-installed BMAD** → wired **WDS (Whiteport Design Studio)** for Cursor + Claude Code. Committed.
5. Ran **WDS Saga**: full **Product Brief + Trigger Map**. Committed.

## Current state
- **Branch:** `cns-dashboard` → `cns-redesign` (commits: `60ad212` WDS wiring, `fc2907c` playbook, `385402a` Saga output). **Not pushed. Tree clean.**
- **OD services:** `XDG_RUNTIME_DIR=/run/user/1000 systemctl --user status open-design open-design-web` (enabled + linger; survive reboot). Web GUI from Windows = **`http://127.0.0.1:3000`** (NOT `localhost` — IPv6 issue).
- **Memory updated:** `project_cns_redesign_open_design`, `reference_open_design_install`.

## NEXT STEPS — in order, do NOT reorder
1. **Baseline capture (operator, this week, clock-bound).** 3–5 mornings BEFORE any surface change: minutes-to-orient, module hops, Nexus-or-Discord-first. It's the before-state for the success criteria; lost the moment redesign starts.
2. **Freya IA (Phase 3–4) — the actual heart of the redesign.** In Cursor on `cns-dashboard`: invoke `bmad-wds-freya` (Wake Freya). Scenarios → conceptual specs → the **question-first reorganized layout**. This is IA-not-reskin.
3. **OD brand-extract → CNS DESIGN.md — AFTER Freya IA, never before.** Point OD's browser at **live TradingView** (`tradingview.com/chart`, dark Supercharts) → brand-extract → DESIGN.md as **Tailwind v4 `@theme`** tokens. Skinning before the IA reorg = the re-skin mistake the whole concept rejects.
4. **Cursor builds** (WDS Mimir / `bmad-wds-agentic-development`) → **operator verifies**.

## KEY DECISIONS & GOTCHAS — don't re-derive or re-mistake
- **FRESH inspiration decided.** TradingView primary (Bloomberg terminal is uncapturable — no public URL). Do NOT reuse the old `v1` mockups (operator deleted them) or the hand-authored `design-systems/cns/` (v0 placeholder). Anti-refs: no light/colorful SaaS templates, no decorative glass/photo/neon.
- **Concept is IA-FIRST:** question-first (organized by Eric's questions, not modules), entities first-class + lifecycle, **evidence = trust**, one instrument / two depths (Nexus push / Trends pull) with **no context reset**, a **live instrument not a static digest**. A re-skin fails the concept.
- **Data-backed (verified in Convex, no data-layer changes):** `.lifecycle` (read 14× by components), `.evidence`, `.sources`, `rankScore` (0–100 + high-priority bands), entity emergence model all exist. **NO stored `confidence` field** → confidence/certainty is **DERIVED** from sources + evidence + rankScore + freshness. Never fabricate a confidence %; that would violate the "never falsely certain" voice rule.
- **Charts = biggest build risk:** rendered by **LayerChart (SVG) + ECharts (canvas)** — both re-themed **in-engine**, NOT via CSS tokens. Budget for it.
- **Stack:** Svelte 5 (runes) + Tailwind v4 (`@theme`) + Convex (preserve 47 `useQuery` bindings) + `@sveltejs/adapter-vercel`. **Desktop-only, dark-only.** Scope bound to **Nexus (23 comps) + Trends (19 comps)**.
- **Real surfaces:** `/nexus` (+ `investigate`, `entities`), `/trends` (+ `[topicId]`, `canvas`). Root `/` is a redirect. "Daily Digest UI" = the `NexusDigestSignalFeed` panel inside `/nexus` (redesign in place, not a route). "Operator docs" = vault markdown, OUT of frontend scope.
- **Persona:** Eric the Operator (+ light "Dana the Demo" secondary). Force hierarchy: **Orient-without-reconstruction → Trust → Reach.**
- **Positioning honest check (keep it):** the cockpit wins ONLY if Eric reaches for Nexus over the Discord digest. Agents = pull; cockpit = push. This is the guardrail against scope-inflating to "connect everything."
- **Voice:** `state → evidence → action`; signed deltas (`+8.2%`); relative + UTC time; fixed lexicon (signal/entity/anomaly/source/salience/watch threshold); no emoji (semantic glyphs OK).
- **WSL exec gotcha:** OD daemon needs `/mnt/c` stripped from PATH; inline `wsl bash -c '...$()...'` MANGLES variables — write scripts to `~` and run via `tr -d '\r' | bash`.

## Deferred (not this redesign)
- **Hermes MCP → Open Design** wiring (block + reason in `Omnipotent.md/_bmad-output/implementation-artifacts/deferred-work.md`).
- **Hermes v0.17 → upstream upgrade** + start using `/goal` (separate initiative surfaced this session; not started).

## Artifact index
- **Playbook:** `cns-dashboard/_bmad-output/planning-artifacts/cns-redesign-open-design-playbook.md` (Ras Mic → OD method)
- **Brief:** `cns-dashboard/_bmad-output/A-Product-Brief/project-brief.md`
- **Trigger Map:** `cns-dashboard/_bmad-output/B-Trigger-Map/00-trigger-map.md`
- **OD install:** `~/tools/open-design`; services in `~/.config/systemd/user/`; wrapper `~/.local/bin/od`
- **Memory:** `project_cns_redesign_open_design` (⭐), `reference_open_design_install`

## To resume in a new session
Open `cns-dashboard` in Cursor (UNC-path launcher), branch `cns-redesign`. Wake Freya: `bmad-wds-freya`. Bring me back in at Freya's **conceptual specs / IA layout** or at **brand-extract** — those are where codebase-grounded input matters most.
