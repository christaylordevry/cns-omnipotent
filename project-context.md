# CNS Project Context — Omnipotent.md

Lean implementation rules for AI agents. Normative specs live in `specs/cns-vault-contract/`.

## System

- **CNS** — control layer: agent routing, vault IO, security gates, input surfaces
- **PAKE** — knowledge layer: note schemas, quality scoring, ingestion, retrieval
- **Vault** — `Knowledge-Vault-ACTIVE/` (PARA) is source of truth
- **Hermes** — `~/.hermes/` Discord gateway; CNS skills at `~/.hermes/skills/cns/`
- **Constitution** — `specs/cns-vault-contract/AGENTS.md` (v2.1.5)
- **cns-dashboard** — Layer 3 SvelteKit + Convex dashboard; sibling at `../cns-dashboard`

## Nexus intelligence principle

> `last30days` is a codebook, not a dependency. CNS owns every adapter it runs,
> in Node, with every signal scored for personal relevance — not just market motion.

Reference clone (read-only): `~/ai-factory/projects/last30days-skill-reference`. Never install, import, or subprocess-call in CNS builds.

## Phase status

- Omnipotent.md: Phase 6 complete; Epics 1–63 done; Epic 64 (Intelligence Scoring Engine v1) backlog; Epic 65 (Native Source Adapters v1) backlog; Epic 66 (Agent Orchestration) backlog
- cns-dashboard: Epics 1–48 done; Epic 63 (Nexus Intelligence Cockpit UI) done; Epic 64 schema extension (64-1) backlog

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

## Sibling dashboard (Layer 3 / Epic 46)

When implementing or reviewing **cns-dashboard** work, use `../cns-dashboard/project-context.md` as the Layer 3 contract. Key rules there:

- Spec-first: `epic-46-ui-spec.md` + `architecture.md` (ADR-E46-001..003)
- ECharts client-only via `EChartsPanel.svelte`
- Convex reactive queries — no polling loops
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
- Repo rules: `CLAUDE.md`, `AGENTS.md`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`
- Dashboard context: `../cns-dashboard/project-context.md`
