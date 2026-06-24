---
baseline_commit: d71ad8a16ab756ecc9747738d692d3efa8fec99b
---

# Story 76.2: Both project-context.md files synced

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->
<!-- Sprint key: 76-2-both-project-context-md-files-synced | Branch: hermes-consolidation -->
<!-- FR17 orientation artifact — follows 76-1 session-close (AGENTS §8 v2.1.44, epics 73+76 active) -->

## Story

As a **developer**,
I want **Omnipotent.md and cns-dashboard `project-context.md` updated to Hermes consolidation phase**,
so that **AI agents see accurate stack, epic status, and cross-repo rules (FR17)**.

## Acceptance Criteria

1. **Sprint-status SSOT reflected in both files**
   **Given** epics 74–78 are defined in `_bmad-output/implementation-artifacts/sprint-status.yaml`
   **When** both `project-context.md` files are updated
   **Then** phase status lines match yaml (not Epic 64–66 era copy)
   **And** Omnipotent.md lists: Epic 72 `done`, Epic 73 `in-progress` (73-7 `in-progress`, 73-8 `backlog`), Epic 74 `done` (74-4 `backlog` non-blocking), Epics 75–78 `backlog`, Epic 76 `in-progress` (76-1 `done`)
   **And** cns-dashboard lists: Epic 63 `done`, Epics 64–72 `done` (cross-repo intelligence track), Epic 73 `in-progress`, Hermes Consolidation epics 74–78 noted as Omnipotent-led with Epic 77 touching this repo

2. **Layer-3 ADR references (Hermes consolidation)**
   **Given** `architecture-hermes-consolidation.md` is normative for Epics 74–78
   **When** both files are read by a dev agent
   **Then** each includes a concise **Hermes Consolidation ADR** section citing ADR-HERMES-001 through ADR-HERMES-008 with one-line summaries:
   - **001** — JARVIS topology (a): Desktop/Discord = chat+voice; `/nexus` = awareness + async ask (not embedded WSL chat on Vercel)
   - **002** — FR12 pull: `GET /hermes/awareness` bearer `HERMES_CONVEX_READ_KEY` (Epic 77)
   - **003** — FR12 push v1: Convex → Discord webhook (`[awareness.<eventType>]`)
   - **004** — FR11 Option A: `ANTHROPIC_API_KEY` for run-chain; protect-list adapters untouched
   - **005** — FR13 async via `hermes-dispatch` (stretch; not Epic 77 MVP)
   - **006** — FR-GATE: Portal paid tier for Tool Gateway (Pre-4 `done` 2026-06-24)
   - **007** — Portal migration FR1–FR4 on WSL Hermes (Epic 74 `done`)
   - **008** — Dashboard OAuth primary (`hermes dashboard register`); basic-auth fallback localhost-only
   **And** pointer to full ADR: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` (Omnipotent) / `../Omnipotent.md/_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` (dashboard)

3. **Hermes live stack pointers**
   **Given** Epic 74 Portal migration complete (76-1 session-close live)
   **When** Omnipotent.md `project-context.md` is updated
   **Then** Hermes section documents:
   - `model.provider: nous`
   - `model.default: anthropic/claude-sonnet-4.6`
   - Dashboard service: `0.0.0.0:9119` (systemd `hermes-dashboard.service`, `--skip-build`)
   - `auth_path: oauth` (primary; basic-auth fallback documented as exception-only per ADR-HERMES-008)
   - Discord gateway + morning-digest cron preserved (FR4)
   - Constitution reference bumped to match live AGENTS (v2.1.44 post-76-1 — verify `specs/cns-vault-contract/AGENTS.md` header)

4. **cns-dashboard Epic 63/73 + env rules preserved**
   **Given** cns-dashboard `project-context.md` is updated
   **When** an agent reads Layer 3 rules
   **Then** Epic 63 (Nexus Intelligence Cockpit `/nexus`) shows `done`
   **And** Epic 73 (Entity Intelligence) shows `in-progress` with dashboard stories 73-6 `done`, 73-7/73-8 pending in Omnipotent sprint
   **And** **Epic 46/63 env rules unchanged** — non-negotiable #10 preserved verbatim in spirit:
   - Never `NEXUS_VAULT_DIR`, `NEXUS_TMUX_SESSION`, `NEXUS_DISCORD_PLUGIN`
   - Use `CNS_*`, `DASHBOARD_*`, `HERMES_*`, or `PUBLIC_*` instead (ADR-E63-005)
   **And** ADR-E46-001..003 section remains intact (routes, EChartsPanel, server secrets)

5. **Cross-repo verify gate**
   **Given** changes are markdown-only in both repos
   **When** dev runs `bash scripts/verify.sh` from Omnipotent.md root
   **Then** exit code 0 (CNS tests + sibling `cns-dashboard` `npm test` via default `../cns-dashboard` or `CNS_DASHBOARD_ROOT`)
   **And** dev runs `bash scripts/verify.sh` from cns-dashboard root (or confirms Omnipotent gate already exercised dashboard tests)

6. **Scope boundary — no forbidden edits (NFR2)**
   **Given** this story is documentation-only
   **When** implementation completes
   **Then** zero diffs in protect-list paths:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** no edits to vault `AI-Context/AGENTS.md` (WriteGate — session-close owns §8)
   **And** no code changes unless verify gate failure requires unrelated fix (document in completion notes)

## Tasks / Subtasks

- [x] **T1 — Load SSOT and stale baselines** (AC: #1)
  - [x] Read full `sprint-status.yaml` `development_status` for epics 63–78
  - [x] Read current `project-context.md` in both repos; mark every stale line (phase status, Hermes provider, epic numbers)
  - [x] Read `architecture-hermes-consolidation.md` ADR-HERMES-001..008 sections for accurate one-liners

- [x] **T2 — Update Omnipotent.md `project-context.md`** (AC: #1–#3, #5)
  - [x] Replace **Phase status** block with Hermes Consolidation reality (see Dev Notes table)
  - [x] Update **System** / **Hermes** bullets (nous provider, dashboard `:9119`, skills path unchanged)
  - [x] Add **Hermes Consolidation** subsection: epics 74–78 aliases (A–D2), branch `hermes-consolidation`, planning artifacts paths
  - [x] Add **ADR-HERMES-001..008** reference table (concise)
  - [x] Update **Sibling dashboard** section: Epic 63/69/73 status; Epic 77 future touchpoints (`convex/http.ts`, `/nexus` awareness)
  - [x] Update constitution version line to live v2.1.44 (confirm from `specs/cns-vault-contract/AGENTS.md`)
  - [x] Add key references: `prd-hermes-consolidation.md`, `epics-hermes-consolidation.md`, `architecture-hermes-consolidation.md`
  - [x] Remove or replace stale lines: "Epic 64–66 backlog", OpenRouter/Codex-primary Hermes wording, "Phase 6 complete; Epics 1–37" as sole status

- [x] **T3 — Update cns-dashboard `project-context.md`** (AC: #1, #2, #4, #5)
  - [x] Replace **Phase status**: Epic 63 `done`; Epic 69 `done`; Epic 73 `in-progress`; note 74–78 Omnipotent-led
  - [x] Remove stale "Epic 45 soak gate running" / "Epic 63 in backlog" lines
  - [x] Add **Hermes Consolidation (cross-repo)** subsection: ADR-HERMES-001 cockpit role, Epic 77 D1 scope for this repo, `hermes-dispatch` seam
  - [x] Add **ADR-HERMES-001..008** pointer table (dashboard-relevant subset emphasized: 001, 002, 003, 005, 008)
  - [x] Preserve **non-negotiable #10** (no `NEXUS_*`) — do not weaken wording
  - [x] Preserve **Locked architecture (Epic 46)** and **Drawer contract** sections
  - [x] Update **Key references** to include Hermes consolidation architecture path
  - [x] Update `/nexus` route description: production cockpit (not "in backlog")

- [x] **T4 — Verify and commit** (AC: #5, #6)
  - [x] `bash scripts/verify.sh` from Omnipotent.md
  - [x] Optional: `bash scripts/verify.sh` from cns-dashboard if separate commit
  - [x] Two-repo commit strategy: one commit per repo (markdown-only) OR single Omnipotent commit if dashboard edited via sibling path — operator preference: **two small commits** (one per repo)
  - [ ] Update story File List and mark sprint-status `76-2-both-project-context-md-files-synced: done` after code review

## Dev Notes

### What this story is (and is not)

- **IS:** Manual sync of the two lean agent context files that Cursor/Claude load at session start — FR17 orientation layer.
- **IS NOT:** Session-close (76-1 done), fast-scan/inbox (76-3), governance stubs (76-4), or any Hermes config changes.
- **Docs-only:** No `src/`, `convex/`, or `~/.hermes/` edits. If tempted to "fix" stale `CLAUDE.md` in either repo — **out of scope** unless operator expands story; note in completion comments only.

### SSOT — sprint-status.yaml snapshot (2026-06-24, `hermes-consolidation`)

Use yaml over epics file prose when they disagree (76-1 lesson).

| Epic | Status | Notable stories |
|------|--------|-----------------|
| 63 | `done` | Nexus cockpit UI (cns-dashboard) |
| 64–72 | `done` | Intelligence scoring, sources, digest orchestrator |
| 73 | `in-progress` | 73-1..73-6 `done`; 73-7 `in-progress`; 73-8 `backlog` |
| 74 | `done` | 74-1..74-3, 74-5..74-8 `done`; **74-4 `backlog`** (Tool Gateway — non-blocking) |
| 75 | `backlog` | Run-chain revival (Epic B) |
| 76 | `in-progress` | 76-1 `done`; **76-2 this story** |
| 77 | `backlog` | JARVIS awareness in Nexus (Epic D1 — **cns-dashboard primary**) |
| 78 | `backlog` | Voice + per-skill routing (Epic D2) |

**Active in-progress epics:** 73, 76 only.

### Omnipotent.md — required phase status replacement

**Remove (stale):**
```
- Omnipotent.md: Phase 6 complete; Epics 1–63 done; Epic 64 … backlog; Epic 65 … backlog; Epic 66 … backlog
- cns-dashboard: Epics 1–48 done; Epic 63 … done; Epic 64 schema extension (64-1) backlog
```

**Replace with (example structure — tighten prose, keep lean):**
```
## Phase status

- **Track:** Hermes Consolidation (Epics 74–78) on branch `hermes-consolidation`
- **Omnipotent.md:** Epics 1–72 `done`; Epic 73 `in-progress`; Epic 74 `done` (74-4 Tool Gateway `backlog`); Epics 75–78 `backlog`; Epic 76 `in-progress` (orientation — FR17)
- **cns-dashboard:** Epics 1–72 `done` (incl. Epic 63 Nexus cockpit, Epic 69 signal surface); Epic 73 `in-progress` (entity intelligence UI); Epic 77+ awareness work `backlog` (depends Epic 74)
- **Hermes:** Portal `nous` / `anthropic/claude-sonnet-4.6`; dashboard `0.0.0.0:9119` (`auth_path: oauth`); Discord gateway + morning-digest cron live
```

### cns-dashboard — required phase status replacement

**Remove (stale):**
```
- Epics 1–48 done; Epic 63 in backlog
- Epic 45 story 45-7: soak gate may still be running
```

**Replace with:** Epic 63 `done`, Epic 69 `done`, Epic 73 `in-progress`, cross-repo pointer to Omnipotent sprint for 74–78.

### Hermes Consolidation planning artifacts

| Artifact | Path (Omnipotent) |
|----------|-------------------|
| PRD | `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` |
| Epics | `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` |
| Architecture | `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` |
| Sprint | `_bmad-output/implementation-artifacts/sprint-status.yaml` |

Epic aliases: A=74, B=75, C=76, D1=77, D2=78.

### ADR-HERMES quick reference (for both files)

| ADR | One-line |
|-----|----------|
| 001 | Desktop/Discord = JARVIS chat+voice; Vercel `/nexus` = awareness + async ask only |
| 002 | Hermes pulls cockpit via `GET /hermes/awareness` (bearer key) — not Convex MCP |
| 003 | High-signal push: Convex → Discord webhook |
| 004 | Run-chain stays on `ANTHROPIC_API_KEY`; no adapter edits |
| 005 | Cockpit AI = async `hermes-dispatch`; inline streaming deferred |
| 006 | FR-GATE: paid Portal tier for Tool Gateway/TTS |
| 007 | Portal provider migration (Epic 74) |
| 008 | Dashboard auth: OAuth via `hermes dashboard register`; basic-auth fallback localhost-only |

### cns-dashboard — rules that MUST NOT regress

From current `project-context.md` — **copy forward unchanged:**

1. **ADR-E63-005 / non-negotiable #10** — no `NEXUS_*` env vars (bridge bot namespace)
2. **ADR-E46-001..003** — trends routes, EChartsPanel-only, server-side secrets
3. **Drawer `topicSlug` contract** — not Convex Id in URL/drawer state
4. **Convex reactive** — no polling loops for trend/nexus data
5. **ECharts client-only** via `EChartsPanel.svelte`

Add (don't replace): Hermes consolidation cross-repo context for upcoming Epic 77 files:
- `convex/http.ts`, `convex/hermesAwareness.ts`, `convex/hermesPush.ts` (not built yet — document as planned)

### Verify gate — cross-repo

From `scripts/verify.sh` (Omnipotent):

```bash
CNS_DASHBOARD_ROOT="${CNS_DASHBOARD_ROOT:-${REPO_ROOT}/../cns-dashboard}"
# runs npm test in sibling when package.json exists
```

**This story:** markdown edits should not break tests. Run full gate anyway (NFR1). If dashboard tests fail for unrelated reasons, document pre-existing failure — do not waive without evidence.

### Protect-list (forbidden)

```
src/agents/synthesis-adapter-llm.ts
src/agents/hook-adapter-llm.ts
src/agents/boss-adapter-llm.ts
src/agents/run-chain.ts
scripts/run-chain.ts
```

### Relationship to 76-1

76-1 refreshed vault/Hermes MEMORY, AGENTS §8, CNS-Daily-Rhythm AUTO blocks via session-close. **76-2** refreshes the **repo-local** `project-context.md` files that BMAD persistent_facts load — agents often read these before sprint-status. Content must be **consistent** with 76-1 outputs but not duplicate them (different audience: implementation rules vs vault orientation).

### Optional consistency (not AC — note only)

`CLAUDE.md` in both repos is also stale (e.g. Omnipotent still says OpenRouter Hermes, cns-dashboard says Epic 53). **Do not edit** unless operator asks — scope is `project-context.md` only per story title.

## Architecture Compliance

- **FR17** — orientation artifacts include both `project-context.md` files [Source: `epics-hermes-consolidation.md` Story 76-2]
- **NFR1** — `bash scripts/verify.sh` both repos where applicable
- **NFR2** — protect-list untouched; NEXUS bridge untouched
- **ADR-HERMES-001..008** — cite in project-context; full normative text in architecture doc
- **ADR-E63-005** — preserve in cns-dashboard file [Source: `architecture-epic-63-nexus-cockpit.md`]
- **ADR-E46-001..003** — preserve in cns-dashboard file [Source: `epic-46-ui-spec.md`, `architecture.md`]

## Library / Framework Requirements

**None** — markdown-only story. No Context7 lookup required unless dev accidentally touches Hermes CLI docs for wording accuracy (optional: `/nousresearch/hermes-agent` for `hermes dashboard register` spelling).

## File Structure Requirements

| Action | Path | Repo |
|--------|------|------|
| **UPDATE** | `project-context.md` | Omnipotent.md |
| **UPDATE** | `project-context.md` | cns-dashboard (`../cns-dashboard/`) |
| Read SSOT | `_bmad-output/implementation-artifacts/sprint-status.yaml` | Omnipotent |
| Read ADRs | `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` | Omnipotent |
| Read epics | `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` | Omnipotent |
| Verify | `bash scripts/verify.sh` | Omnipotent (includes dashboard tests) |

**Do not create** new files. **Do not edit** `specs/cns-vault-contract/AGENTS.md` or vault canonical AGENTS.

## Testing Requirements

1. `bash scripts/verify.sh` from `/home/christ/ai-factory/projects/Omnipotent.md` — mandatory
2. Manual diff review: both `project-context.md` files side-by-side for cross-repo consistency (epic 73/74/76/77 statements align)
3. Grep guard: `NEXUS_VAULT_DIR|NEXUS_TMUX|NEXUS_DISCORD` must appear only in **prohibition** context in cns-dashboard file, not as recommended vars
4. Grep guard: Omnipotent file must not claim Epic 64–66 as active backlog

## Previous Story Intelligence (76-1)

From `story-76-1-session-close-refresh.md` (done 2026-06-24):

- Session-close live post-Portal; AGENTS §8 bumped to **v2.1.44**
- `epic-72: done`, `epic-74: done` (74-4 stays `backlog`), `epic-76: in-progress`
- Active in-progress epics in yaml: **73, 76** — both MEMORY surfaces updated via session-close
- `project-context.md` explicitly deferred to **76-2** — do not assume 76-1 updated repo context files
- ROADMAP AUTO block may show generic Epic titles until epics index updated — **76-2** can reference `epics-hermes-consolidation.md` in project-context to compensate
- Protect-list pattern: zero engine adapter diffs across Epic 74–76 — maintain for this docs story

## Git Intelligence Summary

Recent `hermes-consolidation` commits:

| Commit | Relevance |
|--------|-----------|
| `d71ad8a` | AGENTS mirror sync post session-close §8 → v2.1.44 |
| `58dc23d` | 76-1 complete — orientation artifacts live |
| `91343cc` | 74-8 governance — `hermes-desktop.md`, routing.md |
| `dd74547` | 74-7 Desktop WebSocket chat |

Pattern: docs/orientation commits are small and evidence-based. This story = two markdown files, one or two commits.

## Latest Technical Information

**Live Hermes config (post-Epic 74, June 2026):**

```yaml
# ~/.hermes/config.yaml (expected)
model:
  provider: nous
  default: anthropic/claude-sonnet-4.6
```

**Dashboard (74-6):** `hermes-dashboard.service` → `0.0.0.0:9119`, `--skip-build`, `auth_path: oauth` via `hermes dashboard register`.

**Deferred (document, don't claim done):** 74-4 Tool Gateway web search `backlog`; Epic 75 run-chain revival `backlog`; Epic 77 awareness HTTP endpoint not yet in cns-dashboard.

## Project Context Reference

- BMAD persistent_facts load `project-context.md` at skill activation — this story fixes stale agent cold-start
- Constitution: `specs/cns-vault-contract/AGENTS.md` v2.1.44 (verify header)
- Deferred: dashboard UX redesign out of Hermes Consolidation scope [Source: `deferred-work.md` § Parked initiative 2026-06-24]
- Dashboard Layer 3 contract: `../cns-dashboard/project-context.md` — must stay in sync with Omnipotent sibling section

## Story Completion Status

- **Status:** review
- **Completion note:** Both `project-context.md` files synced to Hermes Consolidation phase; verify gate passed; two-repo commits pending operator review before sprint `done`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- `bash scripts/verify.sh` exit 0 (Omnipotent + cns-dashboard tests)
- Grep: no stale Epic 64–66 backlog in Omnipotent file
- Grep: `NEXUS_*` vars only in prohibition context in dashboard file

### Completion Notes List

- Synced Omnipotent `project-context.md`: phase status from sprint-status.yaml, Hermes `nous`/Sonnet 4.6/dashboard `:9119`, ADR-HERMES-001..008 table, constitution v2.1.44
- Synced cns-dashboard `project-context.md`: Epic 63/69 `done`, Epic 73 `in-progress`, Hermes Consolidation cross-repo section, `/nexus` production route in repo layout
- Preserved ADR-E46-001..003, drawer contract, non-negotiable #10 (no `NEXUS_*`) verbatim
- CLAUDE.md files intentionally untouched (out of scope per operator constraint)
- Protect-list paths: zero diffs

### File List

- `project-context.md` (Omnipotent.md)
- `../cns-dashboard/project-context.md` (cns-dashboard)
- `_bmad-output/implementation-artifacts/story-76-2-project-context-sync.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-06-24: Story 76-2 implementation — both project-context.md files synced to Hermes Consolidation phase (FR17)
