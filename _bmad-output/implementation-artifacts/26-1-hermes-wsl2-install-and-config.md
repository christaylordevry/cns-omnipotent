# Story 26.1 (HI-1): Install and configure Hermes Agent on WSL2

Status: ready-for-dev

Epic: 26 (Hermes CNS Integration)  
Epic label in vault: **HI-1** (first story in Hermes sequence).

## Story

As an **operator**,  
I want **Hermes Agent installed under `~/ai-factory/hermes/`, configured for OpenRouter with `anthropic/claude-sonnet-4.6`, with Discord credentials present and the default personality file removed**,  
so that **the Hermes CLI runs cleanly on WSL2, knows the Obsidian vault root path for later stories, and HI-2 through HI-8 can proceed without SOUL.md conflicting with AGENTS.md**.

## Scope boundaries (mandatory)

| In scope (this story) | Out of scope (do not do here) |
|----------------------|-------------------------------|
| Official install, `hermes setup`, model + env vars, vault root path in Hermes config | **HI-3:** Vault IO MCP as Hermes write path |
| Delete `SOUL.md` immediately after install/setup creates it | **HI-2:** Point Hermes context at `AI-Context/AGENTS.md` |
| CLI smoke: `hermes` launches; one simple prompt gets a response | **HI-5:** Create or wire `#hermes` Discord channel |
| Record WSL2 vault root path used in Hermes config (evidence in Dev Agent Record) | Any vault mutation via Hermes, MCP, or filesystem beyond what `hermes setup` requires |

**Epic execution order (vault source of truth):** After HI-1, the locked epic order is HI-3 before HI-2 for vault-related wiring. SOUL.md removal in HI-1 is **mandatory before HI-2** per epic constraints.

## References

- **Vault (canonical narrative + decisions):**  
  `Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Epic 26 — Hermes CNS Integration 05-03-26.md`  
  WSL path: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Epic 26 — Hermes CNS Integration 05-03-26.md`
- **Vault (BMAD handoff, architecture, HI-1 through HI-8 draft AC, risks):**  
  `Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-CNS-Integration-BMAD-Handoff.md`  
  WSL path: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/01-Projects/Brain - Central Nervous System Build/Hermes/Hermes-Agent-CNS-Integration-BMAD-Handoff.md`
- **Upstream:** [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)  
- **Docs:** https://hermes-agent.nousresearch.com/docs/
- **Install one-liner (from handoff):**  
  `curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash`  
  [Source: Hermes-Agent-CNS-Integration-BMAD-Handoff.md §2 Installation]

## Acceptance criteria

1. **Install location (AC: path)**  
   **Given** WSL2 Ubuntu (or equivalent) on the same machine as existing CNS/Nexus work  
   **When** the operator runs the **official** Hermes install flow  
   **Then** Hermes runtime and CLI resolve under **`~/ai-factory/hermes/`** (expand to absolute path in evidence, e.g. `/home/<user>/ai-factory/hermes/`).  
   **And** if the default script targets another directory, the operator documents the **supported** adjustment (env var, clone target, or official flag) so the effective home is `~/ai-factory/hermes/` without breaking upgrades.

2. **Setup and secrets (AC: setup)**  
   **Given** `OPENROUTER_API_KEY` and `HERMES_DISCORD_TOKEN` are **already exported** in the operator shell or systemd/user env on WSL2  
   **When** `hermes setup` (or current equivalent guided setup) completes  
   **Then** OpenRouter is selected or configured as the provider and the model is **`anthropic/claude-sonnet-4.6`** (exact string OpenRouter expects).  
   **And** Discord bot token is bound to Hermes using **`HERMES_DISCORD_TOKEN`** (do not reuse the Nexus token).  
   **And** no secrets are committed to this repo or pasted into vault notes.

3. **SOUL.md removal (AC: soul)**  
   **Given** default Hermes initialization may create `SOUL.md`  
   **When** setup finishes  
   **Then** **`SOUL.md` is deleted immediately** and must not remain in the Hermes workspace for downstream stories.  
   **Rationale:** Single constitution is `AI-Context/AGENTS.md` (HI-2); duplicate personality files cause behavioral drift. [Source: Epic 26 locked decisions; handoff §6 risk "SOUL.md conflicts with AGENTS.md"]

4. **CLI health (AC: cli)**  
   **When** the operator runs `hermes` (help, version, or doctor subcommand per upstream docs)  
   **Then** the process exits **0** with no stack traces or missing-module errors.

5. **Vault root in Hermes config (AC: vault-root)**  
   **Given** the live Obsidian vault root on WSL2 (canonical example):  
   `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/`  
   **When** Hermes is configured for workspace/vault path per upstream docs  
   **Then** the **exact** path string written into Hermes config is recorded in **Dev Agent Record** (and matches `realpath` if symlinks are involved).  
   **Note:** This story only **sets** the path; it does **not** require Hermes to perform governed vault writes (HI-3).

6. **Basic model round-trip (AC: prompt)**  
   **Given** AC2–AC4 satisfied  
   **When** the operator runs a **minimal** Hermes CLI invocation that sends one short user prompt (per docs: non-interactive flag or REPL one-shot)  
   **Then** a **non-empty** model reply is returned (HTTP or provider errors fail the story).  
   **And** evidence notes **subcommand used** and **date**; no API keys in the story file.

## Tasks / Subtasks

- [ ] Create `~/ai-factory/hermes/` if needed; run official `install.sh` per References (AC: path).
- [ ] Complete `hermes setup`; wire `OPENROUTER_API_KEY`, `HERMES_DISCORD_TOKEN`; set model `anthropic/claude-sonnet-4.6` (AC: setup).
- [ ] Locate and **delete `SOUL.md`** immediately; confirm it is absent (AC: soul).
- [ ] Confirm `hermes` CLI (AC: cli).
- [ ] Set Hermes workspace/vault root to WSL path of `Knowledge-Vault-ACTIVE`; record exact string (AC: vault-root).
- [ ] Run one simple CLI prompt; capture outcome in Dev Agent Record (AC: prompt).
- [ ] Standing task: Operator guide (see below).

## Developer context and guardrails

### Technical requirements

- **OS:** WSL2; align with existing Nexus/CNS workflows (LF, `/mnt/c/...` paths as needed).
- **Model ID:** Use OpenRouter’s identifier **`anthropic/claude-sonnet-4.6`** for parity with Nexus routing posture where applicable. [Source: Epic 26 locked decisions]
- **Env vars:** Assume present: `OPENROUTER_API_KEY`, `HERMES_DISCORD_TOKEN`. Do not print values in logs committed to git.

### Architecture compliance (CNS)

- Hermes default filesystem writes are **not** governed by Vault IO. **Do not** enable or test vault writes here; **HI-3** establishes MCP-only write path. [Source: Epic 26 Critical constraints; handoff §3 Governance Bridge]
- **Discord channel / server layout** is **HI-5**. Token may be configured in HI-1 for setup wizard completeness, but do not scope channel creation or bot channel permissions to this story.

### Hermes-specific behavior

- Hermes builds system context from layers including `SOUL.md`, `MEMORY.md`, `USER.md`, skills, and configured context files. For CNS, **`SOUL.md` must not exist** after this story so HI-2 can rely on AGENTS.md-only constitution. [Source: handoff §2 Core Architecture; §6 risk table]

### Testing / verification

- No `npm test` in Omnipotent.md repo for this story unless you add automation (optional). Verification is **operator-led** on WSL2.
- Document evidence in **Operator verification** and **Dev Agent Record** tables (mirror pattern from Story 16.1 in this folder).

### Latest upstream note

- Handoff lists **v2026.4.8** as “latest as of writing” (2026-04-20). Prefer current docs at https://hermes-agent.nousresearch.com/docs/ for CLI flags and setup flow if install behavior changed.

## Previous story intelligence

- No prior epic-26 implementation artifact in this repo. Reuse **operator evidence style** from `_bmad-output/implementation-artifacts/16-1-firecrawl-mcp-install-and-live-tool-call-verification.md` (tables, no secrets, explicit date).

## Project context reference

- CNS vault root for MCP is **`CNS_VAULT_ROOT`** on the Vault IO server process; Hermes may use a separate config key for “workspace” or project root. For HI-1, align Hermes’s configured vault/workspace path with the **same** Obsidian root the operator uses for `Knowledge-Vault-ACTIVE`. [Source: `specs/cns-vault-contract/README.md` Vault IO MCP vault root]

## Standing tasks (every story)

### Standing task: Update operator guide

- [ ] If this story adds or changes a **user-facing** operator workflow for CNS: update `03-Resources/CNS-Operator-Guide.md` in the vault (full overwrite or targeted edit per constitution), bump `modified`, add Version History row.
- [ ] If the change is **machine-local only** (Hermes install on one WSL host) and no shared operator doc is required: note **“Operator guide: no update required”** in Dev Agent Record with one-line rationale.

## Dev Agent Record

### Agent Model Used

_(filled by implementing agent)_

### Debug Log References

### Completion Notes List

### File List

_(expected: this story file; `sprint-status.yaml`; optional small doc under `docs/` only if repo policy requires; **no** secrets in repo.)_

### Operator verification (no secrets)

| Field | Value |
|--------|--------|
| **Date** | _(YYYY-MM-DD)_ |
| **Hermes path** | _(absolute path under ~/ai-factory/hermes/)_ |
| **SOUL.md** | _(absent; confirm search or `test ! -f`)_ |
| **Model** | `anthropic/claude-sonnet-4.6` via OpenRouter |
| **Vault root in Hermes config** | _(exact string)_ |
| **CLI smoke** | _(command + exit 0)_ |
| **Prompt test** | _(subcommand + one-line outcome)_ |

## Story completion status

- **ready-for-dev:** Ultimate context engine analysis completed; comprehensive developer guide created (create-story workflow Step 5).
- Close to **done** only when all acceptance criteria are satisfied and evidence tables are filled without secrets.
