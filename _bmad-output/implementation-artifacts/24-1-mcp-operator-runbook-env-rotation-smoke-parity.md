# Story 24.1: MCP operator runbook — env patterns, key rotation, live-call smoke, Cursor vs Claude Code

Status: done

Epic: 24 (Operator MCP runbook + parity hardening)

## Story

As an **operator / maintainer**,  
I want **one short MCP operator runbook that standardizes env wiring, key rotation, and live-call smoke across Cursor and Claude Code**,  
so that **Tier 1 tools are “actually usable” (not just “registered”), secrets never leak into repo/vault, and Cursor vs Claude Code differences don’t cause false-green setup**.

## Context / Baseline (read this before editing docs)

This story is the doc-only follow-through that multiple retros called out as missing:

- Epic 16 retro item: publish a “one page” MCP operator runbook (env `-e` pattern, rotation, live-call smoke, Cursor vs Claude paths).  
  [Source: `_bmad-output/implementation-artifacts/epic-16-retro-2026-04-18.md`]
- Epic 17 retro repeats the same action item with the same required contents.  
  [Source: `_bmad-output/implementation-artifacts/epic-17-retro-2026-04-18.md`]

The Perplexity formal MCP story is the best “reference case” because it spans:

- host-prefixed vs protocol tool naming ambiguity,
- operator config living outside the repo (`~/.cursor/mcp.json`),
- availability semantics vs “configured” semantics,
- and deterministic verify evidence with Perplexity disabled.  
  [Source: `_bmad-output/implementation-artifacts/22-1-perplexity-formal-mcp.md`],  
  [Source: `_bmad-output/implementation-artifacts/epic-22-retro-2026-04-30.md`]

Live-call smoke and evidence-capture patterns already exist for the chain harness and should be referenced/extended, not reinvented.  
[Source: `_bmad-output/implementation-artifacts/19-1-live-chain-smoke-harness-and-evidence-record.md`],  
[Source: `_bmad-output/implementation-artifacts/21-3-single-repeatable-run-script.md`]

## Hard Constraints / Guardrails

- **No secrets in the repo.** Do not add API keys or tokens to any tracked file.
- **No secrets in pasted commands.** Docs must use placeholders and “read from env” patterns only.
- **No “connected” claims without a live call.** Registration (`mcp list`) is insufficient; a remote tool invocation is required.
- **No CI network dependencies.** Live-call smoke is operator-run only; tests remain deterministic.
- **Respect constitution sync rules** if updating tool rosters or adding module links:
  - If `specs/cns-vault-contract/AGENTS.md` changes, the canonical vault copy **must** be updated identically:
    - `specs/cns-vault-contract/AGENTS.md`
    - `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`
  - Both files must be byte-identical after edits.  
  [Source: repo rule `cns-specs-constitution.mdc`]

## Requirements

### Deliverable A — One-page “MCP Operator Runbook”

Create a single runbook document that is copy/paste friendly and covers, at minimum:

- **Env patterns**:
  - Claude Code stdio registration pattern uses `-e VAR="$VAR"` (or `-e VAR="$(printenv VAR)"`) and avoids echoing key literals.
  - Cursor uses `~/.cursor/mcp.json` and an `env` block; never hardcode secrets in JSON.
  - Optional `.env` files are allowed only if they are **git-ignored** and never pasted; document the pattern used in live chain smoke (e.g. `.env.live-chain`).
- **Key rotation hygiene**:
  - A standard post-incident checklist when a secret is accidentally pasted in chat or terminal logs (rotate key, re-register MCP server, re-run smoke).
- **Live-call smoke procedure**:
  - A minimal “smoke call” per Tier 1 MCP (Firecrawl, Perplexity, Apify, Scrapling if applicable).
  - Evidence capture format: date, surface, tool invoked, high-level success/failure summary, **no secrets**.
- **Cursor vs Claude Code differences (explicit table)**:
  - Where configuration lives, how to (re)load config, and what “tool names” look like in each surface.
  - Host-prefixed tool aliases (e.g. `mcp__perplexity__search`) vs MCP protocol tool names (e.g. `search`) and when each applies.

### Deliverable B — “Reference case” worked example (Perplexity)

In the runbook, include a worked example that uses the Perplexity MCP wiring as the canonical example:

- Registration examples for both surfaces (placeholders only).
- A live-call example and how to record evidence.
- A “pitfalls” section that calls out:
  - “Configured” vs “available” semantics,
  - host-prefixed tool names vs protocol tool names,
  - and how to interpret `available=false` vs runtime failure.  
  [Source: `_bmad-output/implementation-artifacts/22-1-perplexity-formal-mcp.md`],  
  [Source: `_bmad-output/implementation-artifacts/epic-22-retro-2026-04-30.md`]

### Deliverable C — Wire the runbook into the operator’s default context

Ensure operators and agents can find this runbook without hunting:

- Add a link to the runbook from **exactly one** of:
  - `specs/cns-vault-contract/AGENTS.md` (and synced canonical copy), **or**
  - an existing module under `specs/cns-vault-contract/modules/` that is already linked from AGENTS.
- Do **not** bloat the core constitution; prefer a module link if it keeps the core file stable.

### Deliverable D — Operator guide updates (if applicable)

If the runbook changes user-facing workflow (it does), update the operator guide:

- Update `03-Resources/CNS-Operator-Guide.md` (vault-side) to include:
  - pointer to the new runbook,
  - the standard smoke procedure,
  - the key rotation checklist.

## Acceptance Criteria

### AC1. One authoritative runbook exists and is referenceable

- **Given** prior MCP wiring stories scattered the operator steps across multiple files  
- **When** the story is completed  
- **Then** there exists a single “MCP Operator Runbook” document with:
  - env patterns (`-e` pattern and Cursor `env` block),
  - key rotation checklist,
  - live-call smoke procedure,
  - Cursor vs Claude Code differences (including tool-name aliasing).

### AC2. Perplexity reference case is documented (and matches reality)

- **Given** Perplexity formal MCP wiring is the canonical recent example  
- **When** the runbook is written  
- **Then** it includes a Perplexity worked example and pitfalls section that is consistent with Story 22.1 outcomes (no direct HTTP, operator config outside repo, tool name ambiguity).  
  [Source: `_bmad-output/implementation-artifacts/22-1-perplexity-formal-mcp.md`]

### AC3. Live-call smoke is explicitly “operator-run only” and evidence format is safe

- **Given** CI and tests must remain deterministic  
- **When** the runbook defines smoke procedures  
- **Then** it clearly labels them as operator-run only and uses an evidence format that records success/failure without secrets (no raw JSON, no payload bodies).  
  [Source: `_bmad-output/implementation-artifacts/19-1-live-chain-smoke-harness-and-evidence-record.md`]

### AC4. Cursor vs Claude Code differences are explicit and actionable

- **Given** operators can get stuck in “connected but not verified” states due to surface differences  
- **When** the runbook is followed  
- **Then** it is unambiguous:
  - where each surface stores MCP config,
  - what needs restart/reload,
  - what the tool naming looks like in each surface, and
  - how to troubleshoot missing env / missing auth / “needs authentication” statuses.  
  [Source: `_bmad-output/implementation-artifacts/16-1-firecrawl-mcp-install-and-live-tool-call-verification.md`],  
  [Source: `_bmad-output/implementation-artifacts/16-3-apify-mcp-install-and-live-tool-call-verification.md`],  
  [Source: `_bmad-output/implementation-artifacts/17-1-perplexity-mcp-install-and-live-tool-call-verification.md`]

### AC5. Constitution linkage is correct and (if edited) synced

- **Given** the constitution has two mirrored copies  
- **When** any link or roster text is added/changed in `specs/cns-vault-contract/AGENTS.md`  
- **Then** the canonical vault copy is updated identically and both files are byte-identical.  
  [Source: repo rule `cns-specs-constitution.mdc`]

## Tasks / Subtasks

- [x] Create the runbook doc (AC: 1–4)
  - [x] Choose target location:
    - [x] Option A: `specs/cns-vault-contract/modules/mcp-operator-runbook.md` (preferred: module)
    - [ ] Option B: `_bmad-output/implementation-artifacts/24-1-mcp-operator-runbook.md` (if keeping it implementation-side only)
  - [x] Include a “Never do this” section (hardcoded secrets in JSON, pasting keys in chat, using raw JSON evidence).
  - [x] Include a “Checklist: new MCP service” section (install, register both surfaces, live-call verify, record evidence).

- [x] Document Cursor vs Claude Code MCP differences (AC: 4)
  - [x] Table: config location, registration mechanism, restart requirements, tool-name appearance
  - [x] Note: host-prefixed aliases vs MCP protocol tool names (and where each applies)

- [x] Add Perplexity reference case section (AC: 2)
  - [x] Registration snippet (Cursor + Claude Code) with placeholders
  - [x] Live-call smoke snippet + evidence-record template
  - [x] Pitfalls section: configured vs available, alias naming, interpreting failures

- [x] Add key rotation checklist (AC: 1)
  - [x] “If pasted in chat” procedure: rotate provider key, invalidate old tokens, re-register MCP, re-run smoke, update any local env files
  - [x] Include “do not paste” reminders and safe ways to read env values

- [x] Add live-call smoke procedure (AC: 3)
  - [x] Minimal smoke call for each Tier 1 MCP used by the chain (Firecrawl, Apify, Perplexity, Scrapling if configured)
  - [x] Evidence capture template aligned with Story 19.1 (safe markdown summary; no `--raw-json`)

- [x] Wire discoverability: link from constitution or module (AC: 1, 5)
  - [x] Kept `AGENTS.md` unchanged by linking from an existing module (`vault-io.md`), so the dual-file sync rule was not triggered

### Review Findings

- [x] [Review][Decision] Runbook discoverability should be vault-first (not repo-path) — resolved: mirrored into `Knowledge-Vault-ACTIVE/AI-Context/modules/mcp-operator-runbook.md`, updated vault operator guide and vault `vault-io` module pointers.

- [x] [Review][Patch] Fix misleading claim that `printenv` prevents key literals from entering commands (it expands to the literal secret) [`specs/cns-vault-contract/modules/mcp-operator-runbook.md:45`]
- [x] [Review][Patch] Add explicit “where evidence lives” guidance to avoid violating “no secrets in repo or vault” while still capturing smoke evidence (recommend local git-ignored path) [`specs/cns-vault-contract/modules/mcp-operator-runbook.md:86`]
- [x] [Review][Patch] Add explicit troubleshooting steps for missing env and missing auth (GUI env mismatch, “needs authentication”, `available=false`) to meet AC4’s “actionable” bar [`specs/cns-vault-contract/modules/mcp-operator-runbook.md:20`]
- [x] [Review][Patch] Reference the existing live-chain smoke/evidence precedents (Story 19.1 and 21.3) so we extend rather than reinvent, as required by story context/AC3 intent [`specs/cns-vault-contract/modules/mcp-operator-runbook.md:86`]
- [x] [Review][Patch] Soften tool-alias naming guidance and instruct operators to verify actual host tool names before running smoke (aliases vary by host/server) [`specs/cns-vault-contract/modules/mcp-operator-runbook.md:11`]

- [x] [Review][Defer] Perplexity MCP adapter timeouts do not cancel/kill hung stdio processes [`src/adapters/perplexity-mcp-adapter.ts:45`] — deferred, pre-existing
- [x] [Review][Defer] Apify env var naming inconsistency across scripts and docs (`APIFY_API_TOKEN` vs `APIFY_TOKEN`) can break operator wiring [`scripts/run-chain.ts:694`] — deferred, pre-existing
- [x] [Review][Defer] Live harness usage examples encourage inline secret assignments that will land in shell history, conflicting with runbook posture [`scripts/run-chain.ts:6`] — deferred, pre-existing

## Dev Notes (prevent common mistakes)

- **Use the established `-e` pattern** for Claude Code stdio servers; this is already the repo’s precedent.  
  [Source: `16-1-firecrawl-mcp-install-and-live-tool-call-verification.md`],  
  [Source: `16-3-apify-mcp-install-and-live-tool-call-verification.md`],  
  [Source: `17-1-perplexity-mcp-install-and-live-tool-call-verification.md`]
- **Explicitly separate tool-name layers**:
  - host alias names shown in Claude/Cursor UI (e.g. `mcp__perplexity__search`)
  - protocol tool names used by SDK calls in code (e.g. `search`)  
  [Source: `_bmad-output/implementation-artifacts/22-1-perplexity-formal-mcp.md`]
- **Smoke != tests.** Live-call smoke is operator-run; CI stays mocked.  
  [Source: `_bmad-output/implementation-artifacts/19-1-live-chain-smoke-harness-and-evidence-record.md`]
- **Prefer a module link** over bloating the constitution core file; keep the constitution compact.

### References (primary)

- `_bmad-output/implementation-artifacts/22-1-perplexity-formal-mcp.md`
- `_bmad-output/implementation-artifacts/epic-22-retro-2026-04-30.md`
- `_bmad-output/implementation-artifacts/17-1-perplexity-mcp-install-and-live-tool-call-verification.md`
- `_bmad-output/implementation-artifacts/16-1-firecrawl-mcp-install-and-live-tool-call-verification.md`
- `_bmad-output/implementation-artifacts/16-3-apify-mcp-install-and-live-tool-call-verification.md`
- `_bmad-output/implementation-artifacts/19-1-live-chain-smoke-harness-and-evidence-record.md`
- `_bmad-output/implementation-artifacts/21-3-single-repeatable-run-script.md`
- `_bmad-output/implementation-artifacts/epic-16-retro-2026-04-18.md`
- `_bmad-output/implementation-artifacts/epic-17-retro-2026-04-18.md`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record. (N/A, operator guide updated.)

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

— (doc-only story; no runtime logs expected)

### Completion Notes List

- Added a single authoritative MCP operator runbook module covering env wiring, key rotation hygiene, operator-run live-call smoke, and Cursor vs Claude Code differences.
- Wired runbook discoverability via the existing Vault IO module pointer, avoiding constitution edits and the dual-file sync requirement.
- Updated the vault-side `CNS-Operator-Guide.md` with a runbook pointer, standard smoke procedure, and key rotation checklist, including a Version History entry.
- `bash scripts/verify.sh` passes.

### File List

- `specs/cns-vault-contract/modules/mcp-operator-runbook.md`
- `specs/cns-vault-contract/modules/vault-io.md`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/24-1-mcp-operator-runbook-env-rotation-smoke-parity.md`

### Change Log

- 2026-04-30: Added MCP operator runbook module, linked it from Vault IO module for discoverability, and updated operator guide with smoke and rotation checklists.

