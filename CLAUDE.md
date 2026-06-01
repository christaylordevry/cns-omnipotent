# Project Rules — CNS (Central Nervous System)
This file is **implementation-repo** rules for the Omnipotent.md codebase.
Not the vault CLAUDE.md shim — that lives at `specs/cns-vault-contract/shims/CLAUDE.md`.

---

## System Context
- **CNS** — control layer: agent routing, vault IO, security gates, input surfaces
- **PAKE** — knowledge layer: note schemas, quality scoring, ingestion, retrieval
- **Vault** — `Knowledge-Vault-ACTIVE/` (PARA structure) is the single source of truth
- **Hermes** — `~/.hermes/` — Discord gateway, skills at `~/.hermes/skills/cns/`
- **Constitution** — `specs/cns-vault-contract/AGENTS.md` (v2.1.5)

## Phase Status
Phase 6 complete. Epics 1–37 done. Epics 38 + 43 in progress.
- Vault IO MCP: live (10 tools, WriteGate enforced)
- Hermes: live (Discord gateway, anthropic/claude-sonnet-4-5 via OpenRouter, watchdog cron every 3 min)
- Cursor: primary model Claude Sonnet 4.6
- NotebookLM: live (4 notebooks, fan-out via session-close)
- CNS-Daily-Rhythm.md: live (AUTO blocks refreshed by session-close Step 6.7)
- run-chain: dormant (adapters use Anthropic API directly — Epic 38-2 deferred)

---

## Active MCPs
| MCP | Tools | Notes |
|-----|-------|-------|
| `cns_vault_io` | 10 vault read/write and operator-disambiguation tools | WriteGate on AI-Context/ |
| `notebooklm` | source_add, notebook_query | Fan-out via session-close |
| `context7` | resolve-library-id, query-docs | **Always use before implementing any library** |
| `firecrawl` | scrape, extract, search, crawl, browser | Web content extraction |
| `perplexity` | search, reason, deep_research | Live web research |
| `playwright` | navigate, click, screenshot, get_title | Browser automation — Chromium at ~/.cache/ms-playwright |
| `discord` | reply, react, fetch_messages | Hermes Discord surface |

---

## Workflow — BMAD Method
1. `/bmad-create-story` → generates story file in `_bmad-output/implementation-artifacts/`
2. `/bmad-dev-story` → implements the story (fresh chat, minimal context)
3. **Code structure pass** → after implementation, check for duplicated functions/service layer issues before review
4. `/bmad-code-review` → review + patch findings (reply 1 to batch-fix)
5. `bash scripts/verify.sh` → must pass before claiming done
6. Commit: one logical change per commit
7. `/session-close` in #hermes at end of every session

Planning artifacts: `_bmad-output/planning-artifacts/`
Stories: `_bmad-output/implementation-artifacts/`
Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`
Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`

---

## Non-Negotiables
1. **Spec-first.** Confirm `specs/cns-vault-contract/` before implementing
2. **Verify gate.** `bash scripts/verify.sh` must pass before every commit (CNS repo tests plus sibling `cns-dashboard` `npm test` when `../cns-dashboard` exists; override path with `CNS_DASHBOARD_ROOT`)
3. **Small commits.** One logical change each
4. **WriteGate.** Never directly edit `AI-Context/AGENTS.md` — route via Hermes session-close
5. **Vault boundaries.** Never write outside vault path contract
6. **Context window discipline.** Keep features minimal. Start a new session rather than extending a bloated one. Sweet spot is under 50% of context window.

---

## Context7 — Always Required
Before implementing against any library or tool API:
1. `resolve-library-id` → get the Context7 ID
2. `query-docs` → fetch current docs for your specific use case
3. Implement from those docs — never from training data

Priority IDs:
- Hermes Agent: `/nousresearch/hermes-agent`
- Playwright MCP: `/microsoft/playwright.dev`

---

## open-source Tool
When working with external packages or libraries:
```bash
npx open-source <repo-url>
```
Dumps the repo source into the codebase so the agent has code-as-context rather than guessing from docs. Use before implementing features that depend on a package's internals.

---

## Key References
- Constitution: `specs/cns-vault-contract/AGENTS.md`
- Daily Operating Rhythm: `AI-Context/CNS-Daily-Rhythm.md`
- Operator Guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- Vault IO spec: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`
- Mutation audit: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
- Verify gate: `scripts/verify.sh`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`

## Security
- Never install an npm or pip package fewer than 14 days old unless explicitly approved by the operator. This prevents supply chain attacks via recently published malicious packages.
- Never hardcode API keys or tokens in config files — use environment variables.
- Hermes gateway watchdog runs every 3 min via cron — check `~/.hermes/logs/watchdog.log` if gateway is unresponsive.
