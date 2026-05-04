# Story 26.2 (HI-2): Wire AI-Context/AGENTS.md as Hermes shared constitution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **26** (Hermes CNS Integration)  
Epic label in vault: **HI-2** (shared constitution pointer; **runs after HI-3** so governed writes are already proven — see sequencing below).

## Context

- **HI-1** removed `SOUL.md` and set Hermes workspace/vault root to `Knowledge-Vault-ACTIVE`. [Source: `26-1-hermes-wsl2-install-and-config.md`]
- **HI-3** registered Vault IO MCP, proved mutators + audit, and documented inbox-only direct FS policy. [Source: `26-3-hermes-vault-io-mcp-write-path.md`]
- **This story** aligns Hermes startup context with the **same** constitution Cursor/Claude use: `AI-Context/AGENTS.md` (canonical vault path). Repo mirror: `specs/cns-vault-contract/AGENTS.md` (must stay identical to vault copy when either is edited — not in scope to edit constitution text here). [Source: `specs/cns-vault-contract/AGENTS.md` header; `24-1-mcp-operator-runbook-env-rotation-smoke-parity.md`]

## Story

As an **operator**,  
I want **Hermes to load `AI-Context/AGENTS.md` as shared constitution at session start via a vault-root `.hermes.md` pointer**,  
so that **Hermes behavior matches CNS routing and security rules**, and **when no project context is given, Hermes still routes native filesystem drafts to `00-Inbox/`** per HI-3 policy — **without using Vault IO MCP mutators in this story** (HI-3 already owns the MCP bridge).

## Acceptance Criteria

1. **`.hermes.md` at vault root (AC: hermes-md)**  
   **Given** vault root is `Knowledge-Vault-ACTIVE` (same root as `CNS_VAULT_ROOT` on the MCP process from HI-3)  
   **When** the operator adds the Hermes project file  
   **Then** **`.hermes.md`** exists at **vault root** and **references** (includes, imports, or path-resolves to — exact mechanism per Hermes version) **`AI-Context/AGENTS.md`**.  
   **And** the **exact** on-disk contents (or the Hermes-supported equivalent: frontmatter + path, single-line include, etc.) are recorded in **Dev Agent Record** after confirming against **current** https://hermes-agent.nousresearch.com/docs/ (schema drift guard).

2. **Session-start load (AC: startup-context)**  
   **Given** AC1 and HI-3 MCP config remain unchanged  
   **When** the operator starts a **new** Hermes session (CLI one-shot or REPL per docs — pick one reproducible method)  
   **Then** **evidence** shows Hermes **loaded** the constitution layer (for example: startup log line, debug flag, or documented introspection command that lists injected context files — use whatever Hermes exposes; do not invent flags).  
   **And** evidence includes a **redacted** excerpt proving **`AGENTS.md`** or its **Section 1** title / distinctive phrase appears in the assembled system context (no API keys, no full `.env`).

3. **Default write routing without project context (AC: inbox-routing)**  
   **Given** no Hermes **project** / sub-workspace context is active (define “no project” operationally: fresh session with vault root only, or explicit Hermes flag if docs define one — record the method)  
   **When** Hermes is instructed to perform a **native filesystem** “test write” / scratch note (wording per Hermes capabilities; **not** `vault_create_note`)  
   **Then** the resulting file path is **under** `00-Inbox/` (any allowed subfolder per `AGENTS.md` routing is acceptable if Hermes chooses a default capture path).  
   **And** the **relative path** from vault root is pasted into **Operator verification** (no secrets).  
   **Forbidden for this AC:** invoking Vault IO MCP write tools to satisfy routing proof.

4. **Mutation surface boundary (AC: no-mcp-this-story)**  
   **Given** HI-3 owns MCP wiring and audit  
   **When** this story closes  
   **Then** **no** `vault_create_note`, `vault_append_daily`, `vault_update_frontmatter`, `vault_move`, or other Vault IO **mutators** were used **for** HI-2 evidence or `.hermes.md` placement.  
   **Note:** `.hermes.md` and any inbox scratch file are created via **Hermes native FS** or **operator shell/editor** directly on the filesystem — **not** via MCP. Governed writes elsewhere remain HI-3+ behavior.

5. **Regression guard (AC: soul-stays-gone)**  
   **Given** HI-1 removed `SOUL.md`  
   **When** HI-2 completes  
   **Then** `SOUL.md` is **still absent** from the Hermes workspace paths used in HI-1 evidence (re-check the same directories).

## Tasks / Subtasks

- [x] **Prereq check**  
  - [x] Confirm `26-1` and `26-3` are **done** in `sprint-status.yaml` and operator tables in those story files are populated. [Source: `epic-26-partial-retro-hi1-hi3-2026-05-03.md`]

- [x] **Upstream schema (AC: hermes-md)**  
  - [x] Read Hermes docs for **vault-root project file** naming (confirm `.hermes.md` vs versioned alternative) and syntax to include external markdown.  
  - [x] Create `.hermes.md` at **`Knowledge-Vault-ACTIVE/.hermes.md`** with content that points Hermes at **`AI-Context/AGENTS.md`** (path relative to vault root unless docs require absolute).

- [x] **Startup verification (AC: startup-context, soul-stays-gone)**  
  - [x] Cold-start Hermes; capture evidence per AC2.  
  - [x] Re-verify `SOUL.md` absent (AC5).

- [x] **Inbox routing verification (AC: inbox-routing, no-mcp-this-story)**  
  - [x] Run Hermes without project context; trigger minimal native FS write per AC3.  
  - [x] Confirm path under `00-Inbox/`; optionally **delete** the scratch file afterward (operator hygiene — not required for AC pass).

- [x] **Standing: sprint / epic**  
  - [x] On completion: set this story to `done` in `sprint-status.yaml`; keep **epic-26** `in-progress` until remaining Hermes stories finish.

## Dev Notes

### Sequencing (non-negotiable)

- Epic lock: **HI-3 before HI-2** for vault governance. This story assumes HI-3 **done** so inbox-only FS policy and MCP are already true. [Source: `26-1-hermes-wsl2-install-and-config.md` § Epic execution order; `26-3-hermes-vault-io-mcp-write-path.md` header]

### Developer guardrails

| Guardrail | Detail |
|-----------|--------|
| **No MCP mutators** | Do **not** use Vault IO tools for HI-2 acceptance evidence (AC4). HI-3 already proved MCP. |
| **No Omnipotent server code** | Default: **no** changes under `src/`, WriteGate, or audit logger. If Hermes cannot load external constitution without a code change elsewhere, escalate — do not silently expand scope. |
| **Constitution sync** | If you **edit** text in `AI-Context/AGENTS.md` or `specs/cns-vault-contract/AGENTS.md`, follow repo **AGENTS.md sync rule** (both copies identical). This story should **avoid** editing constitution bodies; pointer-only. [Source: `.cursor/rules/cns-specs-constitution.mdc`] |
| **Paths** | Record **WSL** `realpath` strings consistent with HI-1 / HI-3 evidence tables. |

### Architecture compliance

- Hermes **direct** vault FS writes outside `00-Inbox/` remain **out of policy**; routing proof must stay in **Inbox** (AC3). [Source: `26-3-hermes-vault-io-mcp-write-path.md` AC4; handoff §3]

### File structure / touch surfaces

| Location | Action |
|----------|--------|
| `Knowledge-Vault-ACTIVE/.hermes.md` | **Create/update** (operator FS — not MCP) |
| `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` | **Read-only** reference target (do not change unless separately approved) |
| `~/.hermes/config.yaml` (or actual HI-1 paths) | **Read-only** unless Hermes docs require a key for constitution discovery — prefer `.hermes.md`-only changes |

### Testing / verification

- Operator-led on WSL2; mirror evidence tables from `26-1` / `26-3` (date, paths, no secrets).
- If Hermes does not support `.hermes.md` as assumed, document **observed** mechanism in Dev Agent Record and adjust AC1 wording in a **follow-up** story — do not fake AC2.

### References (attach for dev agent)

| Document | Path |
|----------|------|
| Hermes handoff | `Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-CNS-Integration-BMAD-Handoff.md` |
| Vault epic note | `Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Epic 26 — Hermes CNS Integration 05-03-26.md` |
| HI-1 artifact | `_bmad-output/implementation-artifacts/26-1-hermes-wsl2-install-and-config.md` |
| HI-3 artifact | `_bmad-output/implementation-artifacts/26-3-hermes-vault-io-mcp-write-path.md` |
| Constitution | `specs/cns-vault-contract/AGENTS.md` (mirror of vault `AI-Context/AGENTS.md`) |
| MCP runbook | `specs/cns-vault-contract/modules/mcp-operator-runbook.md` |
| Hermes docs | https://hermes-agent.nousresearch.com/docs/ |

### Previous story intelligence

- **26.3:** MCP registration lives under **`~/.hermes/config.yaml`** on the reference host; `CNS_VAULT_ROOT` on child env; `hermes mcp test` pattern for transport checks — **reuse for sanity** if needed, but **mutator smoke is not** part of HI-2.  
- **26.1:** `SOUL.md` must remain deleted; constitution is AGENTS-only post-HI-2.

### Latest upstream note

- Hermes project-file schema may evolve; always prefer **live docs** over this story’s prose if they conflict.

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If `.hermes.md` becomes a **new operator-facing** setup step: add a short bullet under the existing **Hermes + Vault IO MCP** material in `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (Section 15 as of HI-3): pointer file name, path to `AI-Context/AGENTS.md`, and link to Hermes docs. Bump `modified` + Version History row.  
- [x] N/A: docs did not subsume this without new behavior; operator guide was updated.

## Dev Agent Record

### Agent Model Used

Codex GPT-5, 2026-05-03

### Debug Log References

- Upstream docs checked live: https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files and https://hermes-agent.nousresearch.com/docs/user-guide/configuration/
- Installed Hermes checked locally: `hermes version` reports `Hermes Agent v0.12.0 (2026.4.30)`.
- Installed code checked: `/home/christ/.hermes/hermes-agent/agent/prompt_builder.py` confirms `.hermes.md` / `HERMES.md` discovery, optional YAML frontmatter stripping, raw markdown read, and priority before `AGENTS.md`.
- Pre-change repo test: `npm test` passed.
- Schema proof: Hermes `build_context_files_prompt(cwd='/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE', skip_soul=True)` returned `## .hermes.md`, `AGENTS.md - Central Nervous System Constitution`, and `## 1. System Identity`.
- Startup proof: `hermes -z` from vault root returned `LOADED=AGENTS.md - Central Nervous System Constitution; SECTION=1. System Identity`.
- Inbox proof: `hermes -z` from vault root created `00-Inbox/hermes-hi2-inbox-routing-20260503.md` via native filesystem `write_file`; `grep` found no matching Vault IO audit log entry.

### Completion Notes List

- Prereqs confirmed: `26-1-hermes-wsl2-install-and-config` and `26-3-hermes-vault-io-mcp-write-path` are `done` in `sprint-status.yaml`; both story operator tables are populated.
- Current Hermes schema finding: `.hermes.md` is not a frontmatter include file. It is a highest-priority raw markdown context file; frontmatter is stripped; no include directive is supported in v0.12.0 docs or code.
- Created vault-root `.hermes.md` as a symlink to `AI-Context/AGENTS.md`; this makes Hermes path-resolve the pointer to the canonical constitution without duplicating constitution text.
- Live startup proof showed the AGENTS title and Section 1 heading in assembled context.
- No-project native filesystem routing proof wrote the scratch note under `00-Inbox/`; no Vault IO mutator was used for HI-2 evidence.
- `SOUL.md` was auto-seeded by Hermes during live CLI/config invocations, per installed Hermes behavior. It was deleted again before closure, and final verification found no `SOUL.md` in the HI-1/Hermes workspace paths.
- Operator guide updated: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` Section 15 now documents the `.hermes.md` symlink pointer and upstream schema note; Version History adds `1.8.1`.

### File List

- `Knowledge-Vault-ACTIVE/.hermes.md` (vault; symlink to `AI-Context/AGENTS.md`)
- `Knowledge-Vault-ACTIVE/00-Inbox/hermes-hi2-inbox-routing-20260503.md` (vault; Hermes native filesystem scratch proof)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (vault; Section 15 update)
- `_bmad-output/implementation-artifacts/26-2-hermes-shared-constitution.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-03 | Story 26.2 closed: `.hermes.md` symlink pointer to `AI-Context/AGENTS.md`, upstream schema verified manually, live startup and inbox routing evidence captured, operator guide updated. |

### Operator verification (no secrets) — fill on close

| Field | Value |
|--------|--------|
| **Date** | 2026-05-03 |
| **Vault root** | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` (`realpath` same; matches HI-3 `CNS_VAULT_ROOT`) |
| **`.hermes.md` path** | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/.hermes.md` |
| **Pointer mechanism** | Filesystem symlink: `.hermes.md -> AI-Context/AGENTS.md`. Current Hermes docs and v0.12.0 code load `.hermes.md` as raw markdown context, strip optional YAML frontmatter, and do not support an include directive. |
| **Startup evidence** | `hermes -z` from vault root returned `LOADED=AGENTS.md - Central Nervous System Constitution; SECTION=1. System Identity` |
| **No-project FS test path** | `00-Inbox/hermes-hi2-inbox-routing-20260503.md` |
| **MCP mutators used for HI-2?** | **No**. `.hermes.md` placed by shell symlink; scratch file created by Hermes native filesystem `write_file`; no `vault_create_note`, `vault_append_daily`, `vault_update_frontmatter`, or `vault_move` used. |
| **`SOUL.md` present?** | **No** after final cleanup in `/home/christ/.hermes`, `/home/christ/ai-factory/hermes`, and vault root. Note: Hermes auto-seeds `/home/christ/.hermes/SOUL.md` during CLI startup if absent, so operators must re-check after Hermes upgrades or startup tests until upstream supports disabling the seed. |

## Story completion status

- **done:** AC1 through AC5 satisfied, AC4 explicitly confirmed (no MCP mutators used for HI-2), and operator verification table complete without secrets.

## Saved questions (for PO / operator if blocked)

1. If Hermes renames or deprecates `.hermes.md`, which replacement file does v2026.x use — and does it still support including a vault-relative markdown constitution?
2. If AC3 cannot be triggered without a Hermes feature flag not available on this host, should routing proof defer to HI-4+ with explicit “N/A + doc link” in Dev Agent Record?
