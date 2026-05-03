# Story 26.3 (HI-3): Configure Vault IO MCP as Hermes write path

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **26** (Hermes CNS Integration)  
Epic label in vault: **HI-3** (governance bridge; **must complete before any other Hermes vault interaction**, including HI-2 constitution wiring that implies governed writes).

## Context

- Hermes actual install path: ~/.hermes/ (config.yaml and .env are here)
- ~/ai-factory/hermes/ directory exists but is empty, ignore it
- CNS_VAULT_ROOT: /mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE

## Story

As an **operator**,  
I want **Hermes configured to use the CNS Vault IO MCP server as the only governed vault write path**,  
so that **all Hermes vault mutations outside `00-Inbox/` pass through WriteGate, PAKE enforcement, and append to `_meta/logs/agent-log.md`**, and **no downstream Hermes story can accidentally bypass governance**.

## Acceptance Criteria

1. **MCP registration (AC: mcp-config)**  
   **Given** Hermes native MCP integration and the Vault IO server in this repo  
   **When** the operator completes Hermes MCP tool settings  
   **Then** the Vault IO MCP server is registered with a **reproducible** launch recipe (command, args, working directory if required) and **`CNS_VAULT_ROOT`** set to the **same** `Knowledge-Vault-ACTIVE` root used elsewhere (WSL path; expand `realpath` in evidence if symlinks).  
   **Note:** Phase 1 Vault IO stdio entrypoint reads vault root **only** from `CNS_VAULT_ROOT` on the server process; there is no separate “MCP URL” for stdio. If Hermes UI says “URL,” map it to whatever Hermes actually supports (stdio command vs SSE); record the **observed** Hermes config shape in evidence. [Source: `specs/cns-vault-contract/README.md` § Vault IO MCP: vault root]

2. **Tool surface verification (AC: tools-live)**  
   **Given** a running Hermes session with MCP connected  
   **When** the operator (or Hermes under operator instruction) invokes each tool  
   **Then** these **protocol** tools succeed against the live vault with minimal safe payloads: `vault_create_note`, `vault_append_daily`, `vault_update_frontmatter` (parameters normative in `specs/cns-vault-contract/CNS-Phase-1-Spec.md`).  
   **And** if any call fails, capture **error class** (transport, auth, validation, boundary) and whether it is Hermes-side or server-side; do not paste secrets or full bodies.

3. **Governed write path (AC: mcp-not-fs)**  
   **Given** AC2 passes  
   **When** Hermes performs a **governed** vault mutation (note outside `00-Inbox/` with PAKE frontmatter, or append to daily agent log section per spec)  
   **Then** the implementation uses **Vault IO MCP mutators** (`vault_create_note`, `vault_append_daily`, `vault_update_frontmatter`), **not** direct filesystem writes to governed paths.

4. **Inbox-only direct filesystem (AC: fs-inbox-only)**  
   **Given** Hermes may still write working files (memory, skills, local state)  
   **When** the operator documents and enforces the constraint  
   **Then** **direct filesystem writes by Hermes into the Obsidian vault** are limited to **`00-Inbox/`** only (anything else must go through MCP or be treated as triage-needed per handoff).  
   **Implementation options** (pick what Hermes supports; document chosen approach): Hermes workspace boundaries, documented operator policy + verification grep, or combination. Record **how** the constraint is enforced in the operator guide.

5. **Audit trail (AC: agent-log)**  
   **Given** a successful `vault_create_note` (or other governed mutator) from Hermes  
   **When** the operator inspects `_meta/logs/agent-log.md`  
   **Then** a **new** line appears matching the six-field append-only format described in `specs/cns-vault-contract/AGENTS.md` Section 4 (timestamp, action, tool, surface, target_path, payload_summary).  
   **And** the test note path correlates to that line (see `specs/cns-vault-contract/AUDIT-PLAYBOOK.md`).

6. **Operator guide (AC: docs)**  
   **Given** this integration is operator-facing  
   **When** the story closes  
   **Then** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` includes a **Hermes + Vault IO MCP** subsection: registration pattern, `CNS_VAULT_ROOT`, tool names, inbox-only FS rule, and **compatibility notes** (stdio vs other transports). Bump `modified` and add a Version History row referencing this story slug.

7. **Risk: Python / Hermes MCP client (AC: compat)**  
   **Given** handoff §6 and §8.1 flag unknown compatibility  
   **When** implementation runs  
   **Then** perform an **explicit** first connection test from Hermes to this server **before** claiming AC2–AC5.  
   **If stdio from Hermes fails:** document the **workaround** actually used (for example wrapper script, alternate transport, or host-side relay) in the operator guide and in **Dev Agent Record**; do not leave “TODO” for the next story.

## Tasks / Subtasks

- [x] **Prereq check (AC: mcp-config)**  
  - [x] Confirm HI-1 complete: Hermes runnable, `SOUL.md` absent, vault root aligned with `CNS_VAULT_ROOT` target. [Source: `26-1-hermes-wsl2-install-and-config.md`]
  - [x] Resolve install vs config paths on the host: Hermes may use **`~/.hermes/config.yaml`** and **`~/.hermes/.env`** (user briefing) and/or paths under **`~/ai-factory/hermes/`** (HI-1); record **actual** paths used on disk in evidence.

- [x] **Build and register Vault IO MCP (AC: mcp-config, compat)**  
  - [x] From Omnipotent.md repo: `npm install && npm run build` so `dist/index.js` exists.
  - [x] Register server in Hermes per current NousResearch docs (https://hermes-agent.nousresearch.com/docs/); set `CNS_VAULT_ROOT` on the **child process** env exactly like `specs/cns-vault-contract/modules/mcp-operator-runbook.md` patterns for Cursor/Claude (adapt keys to Hermes YAML/env).
  - [x] Record exact command + env var **names** (no values for secrets); redact tokens.

- [x] **Live tool calls (AC: tools-live)**  
  - [x] `vault_create_note`: create a disposable test note (governed folder, valid PAKE frontmatter per `AGENTS.md`); use a unique title slug such as `hermes-mcp-smoke-YYYYMMDD`.
  - [x] `vault_append_daily`: append one safe line to today’s daily note `## Agent Log` (or spec-correct section per `CNS-Phase-1-Spec.md`).
  - [x] `vault_update_frontmatter`: minimal legal change (for example bump `modified` on the test note).

- [x] **Audit verification (AC: agent-log)**  
  - [x] `tail` or `grep` `_meta/logs/agent-log.md` for the test note path and paste **one** redacted example line into evidence (no payload secrets).

- [x] **Filesystem constraint (AC: fs-inbox-only)**  
  - [x] Document enforcement mechanism; if Hermes cannot hard-limit paths, document **operator verification** procedure (for example periodic `find` excluding `00-Inbox/` for Hermes-owned writes) and treat violations as triage per handoff §3.

- [x] **Operator guide + handoff alignment (AC: docs)**  
  - [x] Update `03-Resources/CNS-Operator-Guide.md` as in AC6.
  - [x] Cross-link `specs/cns-vault-contract/modules/mcp-operator-runbook.md` for env/smoke discipline.

- [x] **Standing task: sprint / epic**  
  - [x] On completion: move this story to `done` in `sprint-status.yaml`; leave **epic-26** `in-progress` until remaining Hermes stories finish.

## Dev Notes

### Governance and sequencing

- This story is the **governance bridge** from `Hermes-Agent-CNS-Integration-BMAD-Handoff.md` §3: Hermes default FS writes are **not** governed; **all** Hermes vault writes outside `00-Inbox/` must use Vault IO MCP **before** HI-4+ use cases that write `03-Resources/` etc.
- Epic 26 note: **HI-3 before HI-2** for vault-related wiring (HI-1 artifact); do not defer MCP wiring to HI-2.

### Technical requirements

| Topic | Requirement |
|--------|----------------|
| Vault root | `CNS_VAULT_ROOT` on MCP process; validated at `loadRuntimeConfig`. [Source: `specs/cns-vault-contract/README.md`] |
| Tools | `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily` (+ reads as needed); signatures in `CNS-Phase-1-Spec.md`. |
| Audit | Successful governed mutations append to `_meta/logs/agent-log.md`; format in repo mirror `specs/cns-vault-contract/AGENTS.md` §4. |
| Mutation policy | Do **not** change WriteGate, audit logger implementation, or tool contracts in this story **without** operator approval per root `AGENTS.md` Safe Edit Policy. This story is **configuration and verification**, not MCP server code changes unless a bug blocks Hermes and is separately approved. |

### Architecture compliance

- **Nexus** remains a distinct trust surface; Hermes must not be documented as bypassing MCP for governed paths. [Source: `specs/cns-vault-contract/AGENTS.md` §5 vs §4]
- Tier 1 MCP runbook habits apply: **registration is not verification**; one real tool call per critical tool. [Source: `specs/cns-vault-contract/modules/mcp-operator-runbook.md`]

### File structure / touch surfaces

| Location | Action |
|----------|--------|
| `~/.hermes/config.yaml`, `~/.hermes/.env` (or actual paths) | Hermes MCP + env |
| Omnipotent.md `dist/index.js` | Built server entry |
| `Knowledge-Vault-ACTIVE/_meta/logs/agent-log.md` | Evidence read |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | Documentation |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Status transitions |

### Testing / verification

- **Operator-led** on WSL2; no requirement to add network calls to CI.
- Mirror evidence style from `26-1-hermes-wsl2-install-and-config.md` and `16-1-firecrawl-mcp-install-and-live-tool-call-verification.md` (tables, dates, no secrets).

### References (attach for dev agent)

| Document | Path |
|----------|------|
| Hermes handoff | `Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-CNS-Integration-BMAD-Handoff.md` (§3 Governance Bridge, §6 risk “MCP integration”, §7 Story HI-3, §8 Q1, §9 diagram) |
| MCP operator runbook | `specs/cns-vault-contract/modules/mcp-operator-runbook.md` |
| Constitution (audit + tools summary) | `specs/cns-vault-contract/AGENTS.md` |
| Phase 1 spec (tool params) | `specs/cns-vault-contract/CNS-Phase-1-Spec.md` |
| Vault root policy | `specs/cns-vault-contract/README.md` |
| Repo agent rules | `AGENTS.md` (repo root) |
| Story 5.2 (mutation audit) | `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md` |

### Previous story intelligence (26.1)

- Use **operator verification tables** and explicit dates; never commit Discord tokens or API keys.
- Hermes install path in HI-1 evidence was **`~/ai-factory/hermes/`**; user briefing also mentions **`~/.hermes/`** for config. **Do not assume**; record what exists on the machine.
- HI-1 explicitly **deferred** vault mutation testing to HI-3; this story is the first allowed governed-write verification from Hermes.

### Latest upstream note

- Hermes docs and MCP config schema may evolve; prefer https://hermes-agent.nousresearch.com/docs/ over stale screenshots.

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] **Required for this story** (AC6): update `03-Resources/CNS-Operator-Guide.md` via `vault_update_frontmatter` / `vault_create_note` as appropriate; do not skip.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent), 2026-05-03

### Debug Log References

- `hermes mcp test cns_vault_io` (stdio connect + nine tools listed).
- Node MCP client smoke (same `command`/`args`/`env` as Hermes registration) calling `vault_create_note`, `vault_append_daily`, `vault_update_frontmatter` against live vault.

### Completion Notes List

- Built Vault IO (`npm install && npm run build`); added `mcp_servers.cns_vault_io` to `/home/christ/.hermes/config.yaml` with `CNS_VAULT_ROOT` on the server child env.
- Hermes-native verification: `hermes mcp test cns_vault_io` succeeded (transport stdio, 637 ms connect, nine tools).
- Live mutators: disposable SourceNote `03-Resources/hermes-mcp-smoke-20260503-disposable-smoke.md`, daily append under `## Agent Log`, frontmatter merge (`status`, `modified`); audit lines present in `_meta/logs/agent-log.md`.
- Operator guide: Section 15 plus overview table Hermes row; `modified` bumped; Version History 1.8.0; cross-link to repo `mcp-operator-runbook.md`.
- AC3 (Hermes runtime using MCP for governed writes): enforced by operator policy plus Section 15; runtime LLM must call `mcp_cns_vault_io_*` tools (documented). No Hermes code fork in this story.
- Repo `npm test` and `bash scripts/verify.sh` green after changes (story file and sprint YAML only in repo besides pre-existing code).

### File List

- `_bmad-output/implementation-artifacts/26-3-hermes-vault-io-mcp-write-path.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (vault; absolute path under `/mnt/c/...` on WSL)
- Machine-local (not in Omnipotent git): `/home/christ/.hermes/config.yaml` (MCP registration block appended)

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-03 | Story 26.3 closed: Hermes `cns_vault_io` MCP registration, `hermes mcp test` + live mutator smoke, operator guide Section 15, sprint status `done`. |

### Operator verification (no secrets)

| Field | Value |
|--------|--------|
| **Date** | 2026-05-03 |
| **Hermes config paths** | `/home/christ/.hermes/config.yaml` (MCP block); `/home/christ/.hermes/.env` (present; not used for `CNS_VAULT_ROOT`, set in YAML `env`); install dir `~/ai-factory/hermes/` exists (empty aside from dirs) |
| **Omnipotent.md repo path** | `/home/christ/ai-factory/projects/Omnipotent.md` |
| **MCP launch command** | `node` with arg `/home/christ/ai-factory/projects/Omnipotent.md/dist/index.js` (stdio) |
| **CNS_VAULT_ROOT** | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` (`realpath` equals same string on this host) |
| **vault_create_note** | pass; `03-Resources/hermes-mcp-smoke-20260503-disposable-smoke.md` |
| **vault_append_daily** | pass; `DailyNotes/2026-05-03.md` section `## Agent Log` |
| **vault_update_frontmatter** | pass; same test note |
| **agent-log correlation** | `grep hermes-mcp-smoke-20260503 _meta/logs/agent-log.md` shows pipe-delimited lines, e.g. create line for `03-Resources/hermes-mcp-smoke-20260503-disposable-smoke.md` |
| **FS constraint method** | Hermes has no vault path allowlist; operator policy plus optional `find` / review documented in CNS-Operator-Guide Section 15 and handoff §3 triage rule |
| **Stdio / Hermes compat** | works (`hermes mcp test cns_vault_io` exit 0; no workaround required on this host) |

## Story completion status

- **ready-for-dev:** Ultimate context engine analysis completed; comprehensive developer guide created (create-story workflow Step 5).
- Move to **done** only when all acceptance criteria are satisfied and operator verification table is complete without secrets.
