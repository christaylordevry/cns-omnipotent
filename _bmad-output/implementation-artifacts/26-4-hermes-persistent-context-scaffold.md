# Story 26.4 (HI-4): Scaffold Hermes persistent context files

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **26** (Hermes CNS Integration)  
Epic label in vault: **HI-4** (persistent context scaffold: vault `MEMORY.md` / `USER.md`, Hermes home `skills/`, config wiring at session start).

## Context

- **HI-1** established Hermes on WSL2, vault workspace root, and **`SOUL.md` must stay absent** so constitution stays AGENTS-centric. [Source: `26-1-hermes-wsl2-install-and-config.md`]
- **HI-2** proved `.hermes.md` → `AI-Context/AGENTS.md` (symlink) for highest-priority vault-local context and documented Hermes v0.12.x behavior (raw markdown layers, no include directive). [Source: `26-2-hermes-shared-constitution.md`]
- **HI-3** owns Vault IO MCP mutators; governed vault writes outside `00-Inbox/` use MCP. [Source: `26-3-hermes-vault-io-mcp-write-path.md`]
- **This story** adds **operator-owned** persistent layers Hermes expects (`MEMORY.md`, `USER.md`), a **`~/.hermes/skills/`** directory for Hermes-local skills, and **config entries** so Hermes loads **MEMORY + USER alongside AGENTS** at session start — **without** using Vault IO mutators (operator filesystem only for vault paths).

## Story

As an **operator**,  
I want **`AI-Context/MEMORY.md` and `AI-Context/USER.md` created in the vault, `~/.hermes/skills/` on disk, and Hermes configuration updated so MEMORY and USER are injected at session start together with the existing AGENTS constitution layer**,  
so that **Hermes has explicit long-lived memory and user-preference slots aligned with CNS vault layout**, **skills have a stable home under the Hermes config root**, and **no governed-vault mutation tools are used for this scaffold** (HI-3 policy preserved).

## Acceptance Criteria

1. **Vault context files exist (AC: vault-files)**  
   **Given** vault root is `Knowledge-Vault-ACTIVE` (same root as HI-1–HI-3 / `CNS_VAULT_ROOT` target)  
   **When** the operator completes this story’s filesystem work  
   **Then** **`AI-Context/MEMORY.md`** and **`AI-Context/USER.md`** exist, are non-empty **scaffold** markdown (clear headings + short purpose text; no secrets), and are **byte-created or edited only via operator shell/editor on the host filesystem** — **not** via `vault_create_note`, `vault_append_daily`, `vault_update_frontmatter`, `vault_move`, or any other Vault IO tool.

2. **Hermes skills directory (AC: skills-dir)**  
   **Given** Hermes user config lives under **`~/.hermes/`** on the reference host (see HI-3)  
   **When** scaffolding completes  
   **Then** **`~/.hermes/skills/`** exists as a directory (empty is acceptable; optional single **`README.md`** explaining “drop Hermes skill packages here” is allowed if it does not claim vault governance).  
   **And** path is recorded in **Operator verification** with expanded absolute path.

3. **Hermes config wiring (AC: config-wire)**  
   **Given** Hermes loads context from configured paths / discovery order per upstream  
   **When** the operator updates **`~/.hermes/config.yaml`** (and **`.env` only if docs require env overrides** — no secrets in story artifacts)  
   **Then** configuration **explicitly** causes Hermes to load **`AI-Context/MEMORY.md`** and **`AI-Context/USER.md`** at session start **in addition to** the existing **AGENTS** layer delivered via HI-2’s `.hermes.md` → `AI-Context/AGENTS.md` symlink.  
   **And** the **exact YAML keys / values** (paths only; redact tokens) used are pasted into **Dev Agent Record**, with a one-line pointer to the **Hermes doc URL** consulted (prefer https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files and https://hermes-agent.nousresearch.com/docs/user-guide/configuration/ — if docs rename keys, **observed** keys win).

4. **Runtime proof (AC: startup-proof)**  
   **Given** AC1–AC3 satisfied and HI-3 MCP registration unchanged  
   **When** the operator runs a **reproducible** Hermes startup path (same class of evidence as HI-2: e.g. `hermes -z`, debug flag, or upstream-documented introspection — **do not invent flags**) from **vault root**  
   **Then** evidence shows **both** a distinctive substring from **`MEMORY.md`** (e.g. its top heading) **and** from **`USER.md`** appear in the assembled system context **alongside** proof the AGENTS layer is still present (e.g. Section 1 title phrase from HI-2).  
   **And** evidence is **redacted** (no API keys, no full `.env`).

5. **Mutation boundary (AC: no-mcp)**  
   **When** this story closes  
   **Then** **no** Vault IO **mutators** were invoked for creating or editing `MEMORY.md`, `USER.md`, `~/.hermes/skills/`, or `~/.hermes/config.yaml` / `.env` for this story.  
   **Note:** Reads via MCP are **not required**; if used for debugging, they must not be represented as satisfying AC1.

6. **Regression (AC: soul-stays-gone)**  
   **Given** HI-1 / HI-2 policy on `SOUL.md`  
   **When** HI-4 completes  
   **Then** `SOUL.md` is **still absent** from the Hermes workspace paths used in HI-1 / HI-2 evidence (re-check same directories). If Hermes re-seeds it during testing, **delete** before close and record in Dev Agent Record.

## Tasks / Subtasks

- [x] **Prereq check**  
  - [x] Confirm `26-2-hermes-shared-constitution` and `26-3-hermes-vault-io-mcp-write-path` are **done** in `sprint-status.yaml`; skim HI-2 operator table for `.hermes.md` / AGENTS proof pattern. [Source: `26-2-hermes-shared-constitution.md`]

- [x] **Upstream schema (AC: config-wire)**  
  - [x] Read current Hermes docs + local `hermes version` for the host; note drift from v0.12.x if any.  
  - [x] Identify the **supported** mechanism to set MEMORY and USER paths (config keys, env vars, or discovery-relative paths). If only cwd-relative discovery is supported, document the **chosen** absolute or vault-relative path strategy and why it is stable when cwd is vault root.

- [x] **Operator FS: vault files (AC: vault-files, no-mcp)**  
  - [x] Create `AI-Context/MEMORY.md` with scaffold content (suggested: `# Hermes memory (vault)`, short paragraph: append-only operator notes, not a substitute for PAKE notes).  
  - [x] Create `AI-Context/USER.md` with scaffold content (suggested: `# Hermes user context`, short paragraph: stable preferences Hermes should honor).  
  - [x] Use **shell, `install -D`, or editor** on WSL against the real vault path — **not** MCP mutators.

- [x] **Operator FS: Hermes home (AC: skills-dir)**  
  - [x] `mkdir -p ~/.hermes/skills` (or equivalent); optional `README.md` inside that folder only.

- [x] **Config edit (AC: config-wire)**  
  - [x] Edit `~/.hermes/config.yaml` (and `.env` if required by docs) to wire MEMORY and USER paths; keep AGENTS / `.hermes.md` behavior from HI-2 intact.

- [x] **Verification (AC: startup-proof, soul-stays-gone)**  
  - [x] Capture startup / context-dump evidence per AC4.  
  - [x] Re-verify `SOUL.md` absent per AC6.

- [x] **Standing: sprint / operator guide**  
  - [x] On completion: set this story to `done` in `sprint-status.yaml`; keep **epic-26** `in-progress` until remaining Hermes stories finish.  
  - [x] Operator guide: see standing task below.

## Dev Notes

### Sequencing

- **After HI-2 and HI-3:** Constitution and MCP governance already exist; HI-4 only adds **context file scaffold + Hermes-local skills directory** and **config**.

### Developer guardrails

| Guardrail | Detail |
|-----------|--------|
| **No Vault IO mutators** | AC5 is non-negotiable. Same class of boundary as HI-2 AC4. [Source: `26-2-hermes-shared-constitution.md` AC4] |
| **No Omnipotent `src/` changes** | Default: **no** MCP server or WriteGate changes unless a defect blocks wiring — escalate instead of scope creep. |
| **Governed vault writes** | Do **not** treat this story as license to write governed folders via Hermes native FS; MEMORY/USER live under **`AI-Context/`** by explicit operator intent — still **operator FS**, not MCP. For any **future** automated edits to these files from agents, use HI-3 MCP path or move drafts through `00-Inbox/` per operator guide. |
| **AGENTS.md sync rule** | If you touch `AI-Context/AGENTS.md` or `specs/cns-vault-contract/AGENTS.md`, follow the repo dual-copy sync rule. This story should **avoid** editing AGENTS bodies. [Source: `.cursor/rules/cns-specs-constitution.mdc`] |
| **Paths** | Record **WSL** `realpath` strings consistent with HI-2 / HI-3 tables. |

### Architecture compliance

- CNS Phase 1: Vault IO remains the **governed** mutation path for agent writes; this story is **operator scaffolding** only. [Source: `26-3-hermes-vault-io-mcp-write-path.md`]

### File structure / touch surfaces

| Location | Action |
|----------|--------|
| `Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md` | **Create** (operator FS) |
| `Knowledge-Vault-ACTIVE/AI-Context/USER.md` | **Create** (operator FS) |
| `Knowledge-Vault-ACTIVE/.hermes.md` | **Do not break** HI-2 symlink to `AI-Context/AGENTS.md` unless upstream forces a change — document if changed |
| `~/.hermes/skills/` | **Create** directory (operator FS) |
| `~/.hermes/config.yaml` | **Update** (operator FS) |
| `~/.hermes/.env` | **Update only if docs require** |

### Testing / verification

- Operator-led on WSL2; mirror **Operator verification** and **Dev Agent Record** tables from `26-2` / `26-3` (date, paths, no secrets).
- If Hermes does not support absolute paths to MEMORY/USER in config, document **observed** limitation and the **actual** working layout in Dev Agent Record — do not fake AC4.

### References

| Document | Path |
|----------|------|
| Hermes handoff | `Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-CNS-Integration-BMAD-Handoff.md` |
| HI-1 | `_bmad-output/implementation-artifacts/26-1-hermes-wsl2-install-and-config.md` |
| HI-2 | `_bmad-output/implementation-artifacts/26-2-hermes-shared-constitution.md` |
| HI-3 | `_bmad-output/implementation-artifacts/26-3-hermes-vault-io-mcp-write-path.md` |
| Operator guide | `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` |
| Hermes docs | https://hermes-agent.nousresearch.com/docs/ |

### Previous story intelligence

- **26.2:** `.hermes.md` is raw markdown context (often symlink to `AI-Context/AGENTS.md`); `prompt_builder.py` / docs define discovery order — reuse for proving MEMORY/USER appear **after** or **alongside** AGENTS per upstream ordering. Startup snippet pattern: `hermes -z` from vault root with redacted output. [Source: `26-2-hermes-shared-constitution.md` Dev Agent Record]  
- **26.3:** `~/.hermes/config.yaml` is the live config surface; `CNS_VAULT_ROOT` on MCP child process is separate — do not conflate Hermes workspace env with MCP server env. [Source: `26-3-hermes-vault-io-mcp-write-path.md` Context]

### Latest upstream note

- Hermes configuration schema may evolve; **live docs + installed `hermes version`** override this story if they conflict.

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If MEMORY/USER paths or `~/.hermes/skills/` become **operator-facing** setup steps: extend **Section 15** (Hermes + Vault IO MCP) in `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` with bullets: file locations, config keys (names only), “no MCP for scaffold” reminder, and link to Hermes context-files docs. Bump `modified` + Version History row.  
- [x] If no new operator-visible workflow beyond what an individual could infer from HI-2: note **“Operator guide: no update required”** in Dev Agent Record with one-line rationale (unlikely if AC3–AC4 add new paths).

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor), 2026-05-03

### Debug Log References

- **Live docs (non-Firecrawl):** Firecrawl MCP returned `Unauthorized: Invalid token` for `firecrawl_scrape`; Hermes pages were fetched with **WebFetch** instead: [Context files](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files), [Configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration/) (same URLs as story; observed keys and file locations taken from rendered docs + installed tree).
- **Installed Hermes:** `hermes version` → `Hermes Agent v0.12.0 (2026.4.30)`.
- **Observed loader (code):** `tools/memory_tool.py` → `get_memory_dir() == get_hermes_home() / "memories"`; no config hook to change filenames. `agent/prompt_builder.py` → `build_context_files_prompt` for `.hermes.md` / `AGENTS.md` project context (HI-2).
- **Config keys (paths / booleans only):** under `memory:` — `memory_enabled: true`, `user_profile_enabled: true`, `memory_char_limit: 2200`, `user_char_limit: 1375`, `provider: ""` (built-in file-backed memory). **File edit:** appended two `#` comment lines after `mcp_servers` documenting HI-4 symlink wiring (YAML values unchanged). **Wiring to vault paths:** operator symlinks `~/.hermes/memories/MEMORY.md` → vault `AI-Context/MEMORY.md`, same for `USER.md` (Hermes reads `HERMES_HOME/memories/*` per upstream docs tree).
- **Runtime proof:** from `/home/christ/.hermes/hermes-agent` with `PYTHONPATH=.` and venv `python3`, `chdir` vault root, `build_context_files_prompt(..., skip_soul=True)` plus `MemoryStore.load_from_disk()` — output flags `AGENTS_OK`, `MEMORY_OK` (`MEMORY (your personal notes)` + body `# Hermes memory (vault)`), `USER_OK` (`USER PROFILE` + `# Hermes user context`).
- **`SOUL.md`:** absent at vault root and `~/ai-factory/hermes`; `~/.hermes/SOUL.md` was re-created by `hermes version`, deleted again before close (same auto-seed behavior as HI-2).

### Completion Notes List

- Prereqs: `26-2` and `26-3` are `done` in `sprint-status.yaml`.
- Upstream: context-files doc lists project context files only; **MEMORY/USER are not CWD-discovered context files** — they live under `HERMES_HOME/memories/` per Configuration doc directory tree and Memory Configuration keys.
- Vault scaffolds written via **shell heredocs** on WSL to `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/{MEMORY,USER}.md`.
- Symlink bridge: `~/.hermes/memories/MEMORY.md` and `USER.md` → vault files (no `config.yaml` edit required beyond keys already present).
- `~/.hermes/skills/README.md` added; directory ensured.
- Operator guide Section 15 extended + Version **1.8.2** row; repo `bash scripts/verify.sh` passed (no `src/` edits).

### File List

- `Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md` (vault; operator FS)
- `Knowledge-Vault-ACTIVE/AI-Context/USER.md` (vault; operator FS)
- `~/.hermes/memories/MEMORY.md` (symlink → vault `AI-Context/MEMORY.md`)
- `~/.hermes/memories/USER.md` (symlink → vault `AI-Context/USER.md`)
- `~/.hermes/skills/README.md` (Hermes home)
- `~/.hermes/config.yaml` (Hermes home; HI-4 operator comments only — `memory.*` keys unchanged)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (vault; Section 15)
- `_bmad-output/implementation-artifacts/26-4-hermes-persistent-context-scaffold.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-03 | Story 26.4 closed: vault MEMORY/USER scaffolds, `memories/` symlinks to vault, skills dir + README, live-doc memory keys recorded, Python loader proof for AC4, operator guide 1.8.2, SOUL cleanup noted. |

### Operator verification (no secrets) — fill on close

| Field | Value |
|--------|--------|
| **Date** | 2026-05-03 |
| **Vault root** | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` (matches HI-3 `CNS_VAULT_ROOT`) |
| **`AI-Context/MEMORY.md` path** | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md` |
| **`AI-Context/USER.md` path** | `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/USER.md` |
| **`~/.hermes/skills/` absolute path** | `/home/christ/.hermes/skills` |
| **Config keys used for MEMORY/USER** | `memory.memory_enabled: true`, `memory.user_profile_enabled: true`, `memory.memory_char_limit: 2200`, `memory.user_char_limit: 1375`, `memory.provider: ""` (built-in). Vault paths injected via **symlinks** from `~/.hermes/memories/` (no path override keys in v0.12.0). |
| **Startup evidence summary** | Hermes venv `python3` + `build_context_files_prompt(cwd=vault_root, skip_soul=True)` shows AGENTS / Section 1 path; `MemoryStore.load_from_disk()` snapshot includes `MEMORY (your personal notes)` block containing `# Hermes memory (vault)` and `USER PROFILE` block containing `# Hermes user context`. Same code paths as CLI session memory + project context (`hermes_cli/oneshot.py` states memory loads match chat). |
| **MCP mutators used for HI-4?** | **No** |
| **`SOUL.md` present?** | **No** at vault root and `~/ai-factory/hermes` at close; **`~/.hermes/SOUL.md` removed again** after Hermes re-seeded it during `hermes version` (document for operators). |

## Story completion status

- **done:** AC1–AC6 satisfied; live Hermes docs consulted (WebFetch; Firecrawl unavailable); `npm` verify gate passed for repo; sprint status `done`.

## Saved questions (for PO / operator if blocked)

1. If upstream only discovers `MEMORY.md` / `USER.md` at **vault root** (not `AI-Context/`), is the approved workaround **symlinks** at root → `AI-Context/` (operator FS), or **config absolute paths** — and which does Hermes validate on Windows/WSL paths?
2. Should `MEMORY.md` / `USER.md` ever carry PAKE frontmatter for vault consistency, or remain plain markdown Hermes layers only?
