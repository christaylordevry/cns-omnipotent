# Project Rules — CNS (Central Nervous System)

This file is **implementation-repo** rules for the Omnipotent.md codebase.
Not the vault CLAUDE.md shim — that lives at `specs/cns-vault-contract/shims/CLAUDE.md`.

---

## System Context

- **CNS** — control layer: agent routing, vault IO, security gates, input surfaces
- **PAKE** — knowledge layer: note schemas, quality scoring, ingestion, retrieval
- **Vault** — `Knowledge-Vault-ACTIVE/` (PARA structure) is the single source of truth
- **Hermes** — `~/.hermes/` — Discord gateway, skills at `~/.hermes/skills/cns/`
- **Constitution** — `specs/cns-vault-contract/AGENTS.md` (v1.9.5, Phase 5 complete)

## Phase Status

All phases complete through Phase 5. Epics 1–28 done.
- Vault IO MCP: live (9 tools, WriteGate enforced)
- Hermes: live (Discord, daily digest, triage, session-close, #general auto-ingest)
- NotebookLM: live (4 notebooks, fan-out via session-close)
- Next: Epic 29 (scope TBD)

---

## Active MCPs

| MCP | Tools | Notes |
|-----|-------|-------|
| `cns_vault_io` | 9 vault read/write tools | WriteGate on AI-Context/ |
| `notebooklm` | source_add, notebook_query | Fan-out via session-close |
| `context7` | resolve-library-id, query-docs | Always use before implementing |
| `firecrawl` | scrape, extract, search, crawl, browser | Web content extraction |
| `perplexity` | search, reason, deep_research | Live web research |
| `discord` | reply, react, fetch_messages | Hermes Discord surface |

---

## Workflow — BMAD Method

1. `/bmad-create-story` → generates story file in `_bmad-output/implementation-artifacts/`
2. `/bmad-dev-story` → implements the story (fresh chat)
3. `bash scripts/verify.sh` → must pass before claiming done
4. Commit: one logical change per commit

Planning artifacts: `_bmad-output/planning-artifacts/`
Stories: `_bmad-output/implementation-artifacts/`
Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Non-Negotiables

1. **Spec-first.** Confirm `specs/cns-vault-contract/` before implementing
2. **Verify gate.** `bash scripts/verify.sh` must pass before every commit
3. **Small commits.** One logical change each
4. **WriteGate.** Never directly edit `AI-Context/AGENTS.md` — route via Hermes session-close
5. **Vault boundaries.** Never write outside vault path contract

---

## Context7 — Always Required

Before implementing against any library or tool API:
1. `resolve-library-id` → get the Context7 ID
2. `query-docs` → fetch current docs for your specific use case
3. Implement from those docs — never from training data

Priority IDs:
- Hermes Agent: `/nousresearch/hermes-agent`

---

## Key References

- Constitution: `specs/cns-vault-contract/AGENTS.md`
- Operator Guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- Vault IO spec: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- Mutation audit: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
- Verify gate: `scripts/verify.sh`