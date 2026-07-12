# HANDOFF 2026-07-13 — CNS infrastructure, next session

**Run in a FRESH Claude Code session** (the prior session's context was bloated). Read memories `feedback_verify_tracker_state_before_implementing`, `project_strategic_bottleneck_deploy_not_build`, `feedback_no_spawn_chips_use_cursor_prompts`, `feedback_verify_not_implement` first.

## Context (why this session exists)

Operator wants to keep building the CNS **while Fable 5 access lasts** — using Fable's peak reasoning for the design/architecture parts. Explicitly **NOT** doing the Fable Phase 2 reasoning-manual integration (deferred, see `HANDOFF-2026-07-13-fable5-reasoning-extraction.md`), and **NOT** applying the extracted manual yet. Just regular CNS infrastructure work.

**Honest framing (operator has heard this, chose infra anyway — do NOT re-litigate, just note it once):** the CNS substrate is mature/over-built; the real bottleneck is revenue/deploy, not infrastructure (`project_strategic_bottleneck_deploy_not_build`). The infra backlog below is thin and mostly residual — pick the genuinely-valuable item, don't manufacture work.

## STEP 0 — Kill the stale tracker first (verify-before-implement)

`88-3-confirm-obsidian-markdown-fires-governed-create` is marked `backlog` in sprint-status, but the 2026-07-12 note-authoring parity work **proved the note-style-guide alone produces Nexus-grade notes on all 3 surfaces without the obsidian-markdown skill firing** (see `hermes-consolidation-initiative` memory). This is almost certainly a stale tracker. **First action:** confirm (the parity notes `0xjeff-hermes-analyst-...` and `pluto-system-design-vs-cns-architecture-sizing` in canonical `03-Resources/` are the evidence), then **close 88-3 as "guide sufficient — no skill-wiring needed"** in sprint-status + a deferred-work note. That closes Epic 88. Don't build it.

## STEP 1 — Pick ONE real build target (the only genuinely-open infra work)

Verify each is still open before starting (trackers go stale — three did today). Candidates, roughly best-first:

1. **Epic 58 completion — NotebookLM watched-surface tier-2 (58-2) + drive-sync reliability residual.** 58-2 is "reserved, not yet scoped" → needs a design pass (Fable-worthy) then build. The drive-sync residual: the `nlm source list` calls before each sync are slow and risk a 90s wall-clock wall on flaky-NLM nights (sync itself is instant) — a concrete reliability fix. **Timely:** all the NotebookLM lock-in landed today, so the context is fresh. *Recommended lead.*
2. **77-6 — async-ask Hermes box (stretch FR13).** A dashboard → ask-Hermes-async JARVIS feature. Substantive but cross-repo (cns-dashboard + Omnipotent.md).
3. **78-3 — voice + routing operator-guide section.** Small doc; low value.

**Confirm the pick with the operator before planning.** (78-1 is operator-blocked on the Electron build — skip.)

## STEP 2 — Plan it on Fable 5, build via Cursor, verify here

Standard CNS pipeline (do NOT deviate):
1. **Plan/architect on Fable 5** (this is the reasoning-heavy part worth spending Fable on): confirm the spec (`specs/cns-vault-contract/` — spec-first is non-negotiable), scope the story/AC, threat-model the change.
2. **Hand build work to Cursor as paste-ready prompts** (lead with repo/branch/dir). Cursor = builder, Claude Code = verifier. **Do NOT `spawn_task` chips** (they land stale worktrees — bit us before; see `feedback_no_spawn_chips_use_cursor_prompts`). Use `/bmad-create-story` → `/bmad-dev-story` in Cursor.
3. **Verify empirically here:** `bash scripts/verify.sh` must pass; review the committed diff, not the summary; drive the actual behavior. Then `/bmad-code-review`.

## Standing constraints (carry these)

- **Spec-first**, **verify gate before every commit**, small commits, WriteGate on `AI-Context/`, vault boundaries.
- Git/push in WSL as `christaylordevry`; commits local unless operator says push. Current branch `hermes-consolidation` (synced at `bfec8a2` as of this handoff).
- **Governed-doc edits** (any AI-Context module): `note-style-guide` precedent — specs SSOT + byte-identical vault mirror + `verify.sh` vault-modules-parity gate. Never `npm run sync-vault-modules` (vault→specs, clobbers a specs edit).
- Check git state via **WSL** (Windows Bash-tool git fakes CRLF churn).
- If nothing here feels worth the effort, that's a real signal — say so and point the operator back at the revenue bottleneck rather than inventing substrate work.
