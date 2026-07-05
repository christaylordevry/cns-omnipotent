# Two-bot vault boundary (Hermes vs NEXUS bridge)

Single-operator vault with **two independent Discord write surfaces**. Consolidation work must not collide with the legacy NEXUS bridge bot.

## Bots at a glance

| Bot | Stack | Discord channel | Write governance | Audit trail |
|-----|-------|-----------------|----------------|-------------|
| **Hermes** | Hermes gateway + CNS skills + Vault IO MCP | `#hermes` (CNS channel) | Governed path: Vault IO WriteGate, PAKE, secret scan on MCP mutators | `_meta/logs/agent-log.md` on Vault IO success |
| **NEXUS bridge** | Claude Code in tmux + Discord plugin | Separate bridge channel / session | **Outside** Vault IO: direct filesystem writes | No Vault IO audit lines |

Hermes is the **consolidation target** (JARVIS). NEXUS bridge is **preserved untouched** per NFR8.

## Vault write paths

### Hermes (preferred for governed work)

- **Vault IO MCP** (`cns_vault_io`): all governed reads/writes/search/move through WriteGate.
- **Session-close** (`/session-close`): deterministic scripts update `AI-Context/MEMORY.md`, `vault-fast-scan-index.md`, AGENTS §8 (via gate-apply), CNS-Daily-Rhythm AUTO blocks, NotebookLM fan-out. Constitution `AI-Context/AGENTS.md` edits are operator-owned (WriteGate blocks MCP).
- **Hermes skills** that call Vault IO or operator-approved FS for orientation artifacts (fast-scan, triage plans).
- **Symlinks:** `~/.hermes/memories/USER.md` → vault `AI-Context/USER.md` (operator FS).

### NEXUS bridge (legacy dual-path)

- **Direct filesystem writes** from Claude Code in tmux with vault as cwd.
- **No WriteGate, no PAKE validation, no MCP secret scan** on those writes.
- Notes may lack full PAKE frontmatter; triage like `00-Inbox/` captures.
- See `AGENTS.md` §5 and `docs/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md`.

### Collision zones (watch these)

| Path class | Hermes | NEXUS | Risk if both write blindly |
|------------|--------|-------|----------------------------|
| `00-Inbox/` | Vault IO + ingest skills | Direct FS | Duplicate captures; schema mismatch |
| `01-Projects/` … `03-Resources/` | Vault IO moves/creates | Direct FS | PAKE gaps, no audit line |
| `AI-Context/**` | WriteGate-protected (MCP blocked) | Should not write | Constitution drift |
| `DailyNotes/` | `vault_append_daily` | Direct FS | Duplicate log lines |
| `_meta/logs/agent-log.md` | Vault IO append only | Not written by NEXUS | Audit completeness |

**Rule:** IDE and Hermes agents use Vault IO. Do not bypass WriteGate to mimic NEXUS.

## Environment variable namespaces

Keep namespaces disjoint so cns-dashboard, Hermes, and NEXUS bridge never steal each other's config.

| Namespace | Owner | Examples | Notes |
|-----------|-------|----------|-------|
| `HERMES_*` | Hermes gateway, skills, awareness pull | `HERMES_HOME`, `HERMES_CONVEX_READ_KEY` | WSL Hermes only |
| `CNS_*` | Vault IO MCP, brain recall, vault root | `CNS_VAULT_ROOT`, `CNS_BRAIN_EMBEDDER` | Omnipotent.md + Hermes |
| `DASHBOARD_*` / `PUBLIC_*` | cns-dashboard SvelteKit + Convex | `PUBLIC_CONVEX_URL`, dashboard sync secrets | Vercel + local Nexus |
| `NEXUS_*` | NEXUS bridge launcher only | `NEXUS_TMUX_SESSION`, `NEXUS_VAULT_DIR`, `NEXUS_DISCORD_PLUGIN` | **Never** on cns-dashboard |

**ADR-E63-005 (locked):** cns-dashboard must **never** define `NEXUS_VAULT_DIR`, `NEXUS_TMUX_SESSION`, or `NEXUS_DISCORD_PLUGIN`. Use `CNS_*`, `DASHBOARD_*`, or `PUBLIC_*` instead. [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`, `sprint-change-proposal-2026-06-06.md` §ADR-E63-005]

## Escalation if collision suspected

1. **Stop writes** on both bots until scope is clear.
2. **Identify writer:** check `_meta/logs/agent-log.md` (Hermes Vault IO only), file `modified` timestamps, and gateway logs (`~/.hermes/logs/gateway.log` vs NEXUS tmux session).
3. **Diff the file** — PAKE-complete frontmatter + audit line ⇒ likely Vault IO; sparse frontmatter ⇒ likely NEXUS capture.
4. **Triage capture** — route NEXUS-style notes through `/triage` (Epic 27) before treating as canonical.
5. **Do not** restart, reconfigure, or patch NEXUS bridge code during Hermes consolidation stories unless a dedicated NEXUS epic says so.
6. **Document incident** in daily note `## Agent Log` and operator handoff if recurring.

## See also

- `AGENTS.md` §4 (Vault IO), §5 (Nexus dual-path)
- `docs/Nexus-Discord-Obsidian-Bridge-Full-Guide.md`
- `_bmad-output/implementation-artifacts/8-1-nexus-coexistence-documentation.md`
- `_bmad-output/implementation-artifacts/74-5-gateway-and-morning-digest-regression-gate.md` (two-bot regression evidence)
