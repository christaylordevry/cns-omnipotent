# CNS Project Context — Omnipotent.md

Lean implementation rules for AI agents. Normative specs live in `specs/cns-vault-contract/`.

## System

- **CNS** — control layer: agent routing, vault IO, security gates, input surfaces
- **PAKE** — knowledge layer: note schemas, quality scoring, ingestion, retrieval
- **Vault** — `Knowledge-Vault-ACTIVE/` (PARA) is source of truth
- **Hermes** — `~/.hermes/`; `model.provider: nous`, `model.default: anthropic/claude-sonnet-4.6`; Discord gateway + morning-digest cron live; dashboard `0.0.0.0:9119` (systemd `hermes-dashboard.service`, `--skip-build`, `auth_path: oauth` primary); CNS skills at `~/.hermes/skills/cns/`
- **Constitution** — `specs/cns-vault-contract/AGENTS.md` (v2.1.44)
- **cns-dashboard** — Layer 3 SvelteKit + Convex dashboard; sibling at `../cns-dashboard`

## Nexus intelligence principle

> `last30days` is a codebook, not a dependency. CNS owns every adapter it runs,
> in Node, with every signal scored for personal relevance — not just market motion.

Reference clone (read-only): `~/ai-factory/projects/last30days-skill-reference`. Never install, import, or subprocess-call in CNS builds.

## Phase status

- **Track:** Hermes Consolidation (Epics 74–78) on branch `hermes-consolidation`
- **Omnipotent.md:** Epics 1–72 `done`; Epic 73 `in-progress` (73-1..73-6 `done`, 73-7 `in-progress`, 73-8 `backlog`); Epic 74 `done` (74-4 Tool Gateway `backlog`, non-blocking); Epics 75–78 `backlog`; Epic 76 `in-progress` (orientation — FR17; 76-1 `done`)
- **cns-dashboard:** Epics 1–72 `done` (incl. Epic 63 Nexus cockpit, Epic 69 signal surface); Epic 73 `in-progress` (entity intelligence UI); Epics 74–78 Omnipotent-led; Epic 77 awareness work `backlog` (depends Epic 74 `done`)
- **Hermes:** Portal `nous` / `anthropic/claude-sonnet-4.6`; dashboard `0.0.0.0:9119` (`auth_path: oauth`); Discord gateway + morning-digest cron live

## Hermes Consolidation (Epics 74–78)

Epic aliases: **A**=74 (Portal + Desktop), **B**=75 (run-chain revival), **C**=76 (orientation/governance), **D1**=77 (JARVIS awareness in Nexus), **D2**=78 (voice + per-skill routing).

| Artifact | Path |
|----------|------|
| PRD | `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` |
| Epics | `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` |
| Architecture | `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` |
| Sprint | `_bmad-output/implementation-artifacts/sprint-status.yaml` |

### ADR-HERMES-001..008 (concise)

| ADR | Summary |
|-----|---------|
| 001 | JARVIS topology: Desktop/Discord = chat+voice; Vercel `/nexus` = awareness + async ask (not embedded WSL chat on Vercel) |
| 002 | FR12 pull: `GET /hermes/awareness` bearer `HERMES_CONVEX_READ_KEY` (Epic 77) |
| 003 | FR12 push v1: Convex → Discord webhook (`[awareness.<eventType>]`) |
| 004 | FR11 Option A: `ANTHROPIC_API_KEY` for run-chain; protect-list adapters untouched |
| 005 | FR13 async via `hermes-dispatch` (stretch; not Epic 77 MVP) |
| 006 | FR-GATE: Portal paid tier for Tool Gateway (Pre-4 `done` 2026-06-24) |
| 007 | Portal migration FR1–FR4 on WSL Hermes (Epic 74 `done`) |
| 008 | Dashboard OAuth primary (`hermes dashboard register`); basic-auth fallback localhost-only |

Full normative text: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`

## Repo layout (this repo)

| Path | Purpose |
|------|---------|
| `src/` | TypeScript Vault IO MCP server (edit here) |
| `dist/` | Compiled output — do not edit |
| `specs/cns-vault-contract/` | Normative vault contract |
| `_bmad-output/planning-artifacts/` | PRD, architecture, epics |
| `_bmad-output/implementation-artifacts/` | Stories, sprint-status.yaml, deferred-work.md |

## BMAD implementation workflow

1. `/bmad-create-story` → story in `_bmad-output/implementation-artifacts/`
2. `/bmad-dev-story` → implement (fresh chat, minimal context)
3. Code structure pass — dedupe services before review
4. `/bmad-code-review` → review; reply `1` to batch-fix
5. `bash scripts/verify.sh` → must pass before claiming done
6. One logical change per commit
7. `/session-close` in #hermes at session end

## Non-negotiables (CNS control layer)

1. **Spec-first** — read relevant `specs/cns-vault-contract/` before implementing in this repo
2. **Verify gate** — `bash scripts/verify.sh` before done (CNS tests + sibling `cns-dashboard` when present; override with `CNS_DASHBOARD_ROOT`)
3. **WriteGate** — never directly edit `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`; route via Hermes session-close. When editing constitution, sync both `specs/cns-vault-contract/AGENTS.md` and vault canonical copy in one operation
4. **Vault boundaries** — never write outside vault path contract
5. **Context7** — `resolve-library-id` → `query-docs` before any library/tool implementation; never guess API signatures
6. **Safe edits** — ask before: MCP tool signature changes, audit log path changes, `security.md`, bulk refactors
7. **Context discipline** — keep features minimal; start fresh sessions under ~50% context
8. **Small commits** — one logical change each

## Mutation audit (Story 5.2)

When changing logging, `vault_log_action`, or mutator success paths, treat `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` as bound spec (also referenced from `CNS-Phase-1-Spec.md` and `modules/security.md`).

## Sibling dashboard (Layer 3)

When implementing or reviewing **cns-dashboard** work, use `../cns-dashboard/project-context.md` as the Layer 3 contract.

**Epic status (cross-repo):** Epic 63 (Nexus cockpit `/nexus`) `done`; Epic 69 (signal surface) `done`; Epic 73 (entity intelligence) `in-progress` (73-6 dashboard modules `done`, 73-7/73-8 in Omnipotent sprint). Epic 77 (JARVIS awareness) will touch `convex/http.ts`, `convex/hermesAwareness.ts`, `convex/hermesPush.ts` — planned, not built yet.

Key rules there:

- Spec-first: `epic-46-ui-spec.md` + `architecture.md` (ADR-E46-001..003)
- ECharts client-only via `EChartsPanel.svelte`
- Convex reactive queries — no polling loops
- No `NEXUS_*` env vars (ADR-E63-005)
- Clean npm reinstall after new packages before verify (rolldown/Vite 8)

## Commands

```bash
npm install
npm test
npm run build
bash scripts/verify.sh
```

## Security

- No npm/pip packages under 14 days old without operator approval
- No hardcoded API keys — use environment variables
- Hermes watchdog cron every 3 min — check `~/.hermes/logs/watchdog.log` if gateway unresponsive

## Key references

- Vault IO spec: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- Constitution: `specs/cns-vault-contract/AGENTS.md` (v2.1.44)
- Hermes consolidation PRD: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md`
- Hermes consolidation epics: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
- Hermes consolidation architecture: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`
- Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`
- Dashboard context: `../cns-dashboard/project-context.md`
