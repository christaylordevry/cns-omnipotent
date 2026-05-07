# Story 28.3: Wire #general auto-ingest (auto-capture, manual triage)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **28** (Hermes operator closure and NotebookLM freshness)  
Tracked in sprint-status as: **`28-3-wire-general-auto-ingest`**

## Context

- Operator posts URLs throughout the day in Discord `#general` as candidate research material. The pain is that good sources get lost between “saw it” and later triage.
- Epic 27 established the canonical workflow and mental model: **capture first, then manual triage** (`/triage` -> `/approve` -> `/execute-approved`). This story automates capture only, it must not perform routing, moves, filing, synthesis, or approval actions. [Source: `_bmad-output/implementation-artifacts/27-1-define-hermes-triage-skill-entrypoint-and-safe-defaults.md`]
- `#hermes` already has a working URL ingest pattern and safety guardrails (untrusted input, SSRF blocks, bounded output, avoid widening allowlists). `#general` should mirror the trigger rigor and safety posture. [Source: `_bmad-output/implementation-artifacts/26-6-url-ingest-hermes-vault.md`]
- The operator already has the URL ingest skill installed at `~/.hermes/skills/cns/hermes-url-ingest-vault/`. This story may reuse it, but must preserve the key distinction: **auto-capture to `00-Inbox/`**, triage remains manual. (If reusing the existing skill would write directly to `03-Resources/`, add a capture-only variant that writes to `00-Inbox/` instead and document why.)

## Story

As an **operator**,
I want **Hermes to monitor Discord `#general` and automatically capture any message containing a URL into `00-Inbox/`**,
so that **no sources are lost between capture and the standard manual workflow (`/triage` -> `/approve` -> `/execute-approved`)**.

## Scope boundaries (non-negotiable)

- This story automates **capture only**.
- This story must not:
  - run triage, routing, filing, synthesis, or comparison
  - call `/approve` or `/execute-approved` flows on behalf of the operator
  - move notes out of `00-Inbox/`
  - update AGENTS or NotebookLM automation

## Acceptance Criteria

1. **Channel monitor (AC: channel)**
   - **Given** Hermes Discord gateway is running with existing auth and channel scoping
   - **When** a message is posted in Discord `#general` (channel ID: `1484880486785486951`)
   - **Then** Hermes evaluates it for URLs and performs capture behavior only in `#general` (no other channels changed in this story).

2. **URL detection trigger (AC: trigger)**
   - **Given** a message in `#general`
   - **When** the message contains at least one `http://` or `https://` URL substring
   - **Then** Hermes triggers auto-capture
   - **And** non-http(s) strings (e.g. `ftp://`, bare domains without scheme) do not trigger capture.

3. **Capture output location (AC: inbox-write)**
   - **Given** a triggered URL capture
   - **When** Hermes persists captured content
   - **Then** the captured artifact is written under `00-Inbox/` as an unstructured capture (no PAKE schema requirement)
   - **And** the note includes, at minimum:
     - the original URL(s) (verbatim as seen in Discord, trimmed for outer whitespace only)
     - capture timestamp (ISO 8601 UTC)
     - a bounded extract of fetched content or a short failure class (see AC: fetch)

4. **Fetch safety posture (AC: fetch)**
   - **Given** a URL was detected
   - **When** Hermes attempts to fetch page content for capture
   - **Then** it rejects SSRF-shaped targets before fetch (at minimum: `localhost`, loopback, RFC1918 IPv4 literals, IPv6 link-local and ULA)
   - **And** it uses a hard wall clock timeout (recommend 30s unless Hermes upstream forces a different value)
   - **And** on fetch failure (timeout, HTTP error, empty body, non-text without safe extraction), Hermes still writes an Inbox capture that records the URL and the failure class, so the operator can decide what to do at triage time.

5. **Noise control (AC: bounds)**
   - **When** a message contains many URLs
   - **Then** Hermes captures at most **3** distinct URLs from that single message (deterministic ordering, first-seen wins)
   - **And** it records in the Inbox note that additional URLs were omitted (count only).

6. **Manual triage remains authoritative (AC: manual-triage)**
   - **Given** one or more auto-captures were written to `00-Inbox/`
   - **When** the operator later runs `/triage` in `#hermes`
   - **Then** the standard Epic 27 workflow remains the only path that proposes routing and performs moves, with explicit operator approval per-item.

7. **Regression (AC: no-regress)**
   - **Then** existing `#hermes` bindings and skills remain unchanged for their existing triggers.
   - **And** no changes to Omnipotent Vault IO server `src/` are required for this story (capture is Hermes-side only, Inbox write is allowed without PAKE).

## Tasks / Subtasks

- [x] **Confirm existing #hermes URL ingest behavior** (AC: trigger, no-regress)
  - [x] Verify whether `hermes-url-ingest-vault` writes to `03-Resources/` (governed) or supports an Inbox mode.
  - [x] Record observed behavior and Hermes version in Dev Agent Record.

- [x] **Implement #general auto-capture skill binding** (AC: channel, trigger)
  - [x] Bind channel ID `1484880486785486951` (`#general`) to the capture behavior using Hermes-supported configuration, mirroring the wiring pattern used for `#hermes` URL ingest. [Source: `_bmad-output/implementation-artifacts/26-6-url-ingest-hermes-vault.md` Dev Agent Record]
  - [x] Ensure trigger is “message contains http(s) URL substring”, not the stricter `/ingest` prefix shape (this channel is capture-first).

- [x] **Capture-only implementation path** (AC: inbox-write, fetch, bounds)
  - [x] If the existing `hermes-url-ingest-vault` skill cannot be safely reused without writing to governed folders, implement a sibling skill:
    - `~/.hermes/skills/cns/hermes-url-auto-capture-inbox/`
    - Reuse the same fetch safety guardrails as HI-6
    - Write a markdown capture to `00-Inbox/` (filesystem write is acceptable for Inbox)
  - [x] Include a deterministic filename scheme that avoids collisions (timestamp + hostname slug, or Hermes upstream default), and never overwrites an existing Inbox capture.

- [x] **Evidence and operator-facing behavior** (AC: manual-triage)
  - [x] Post one URL in `#general` and verify an Inbox note exists with the required fields.
  - [x] Post a private-IP URL (or `localhost`) and verify it is rejected pre-fetch, but still creates an Inbox capture recording the refusal class.
  - [x] Post a message with 4+ URLs and verify the 3-URL cap with omitted count recorded.

## Dev Notes

### Developer guardrails

- **Discord is untrusted input.** Treat message content as prompt-injection capable. Do not allow page content to influence vault paths, permissions, or tool selection.
- **No “silent automation” beyond capture.** Anything that changes note location, frontmatter, or routing is triage-stage work only (Epic 27).
- **Inbox write posture:** `00-Inbox/` is explicitly the raw capture zone, schema-free. Writes outside Inbox must remain MCP-governed per HI-3, but this story stays inside Inbox. [Source: `specs/cns-vault-contract/AGENTS.md` §2]

### References

- Existing URL ingest pattern and safety posture: `_bmad-output/implementation-artifacts/26-6-url-ingest-hermes-vault.md`
- Hermes Discord channel wiring keys and channel IDs pattern: `_bmad-output/implementation-artifacts/26-5-hermes-discord-channel-and-bot.md`
- Manual triage workflow and read-only defaults: `_bmad-output/implementation-artifacts/27-1-define-hermes-triage-skill-entrypoint-and-safe-defaults.md`
- Vault routing model (Inbox is schema-free): `specs/cns-vault-contract/AGENTS.md` §2

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new workflow surface in `#general`): update `03-Resources/CNS-Operator-Guide.md` (operator FS) with:
  - `#general` auto-capture description
  - URL trigger semantics
  - How to rely on manual `/triage` for routing
  - Safety notes (untrusted input, SSRF blocks)
  - Bump `modified` date and add a Version History row referencing **`28-3-wire-general-auto-ingest`**

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex), 2026-05-07

### Debug Log References

- **Repo pre-change gate:** `npm test` passed before edits: Node TAP suites passed and Vitest reported **48 files / 576 tests passed**.
- **Installed Hermes:** `hermes version` -> `Hermes Agent v0.12.0 (2026.4.30)`.
- **Existing `#hermes` URL ingest behavior:** `~/.hermes/skills/cns/hermes-url-ingest-vault/SKILL.md` maps qualifying `#hermes` URL shapes to Vault IO `vault_create_note` with `pake_type: SourceNote`, so it writes governed notes under `03-Resources/` and is not safe to reuse for capture-only `00-Inbox/` writes.
- **New skill mirror:** repo package added at `scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/`; live package installed at `~/.hermes/skills/cns/hermes-url-auto-capture-inbox/`.
- **Config binding:** `~/.hermes/config.yaml` now includes `1484880486785486951` in `discord.allowed_channels` and `discord.free_response_channels`, adds a `discord.channel_prompts` entry for `#general`, and adds a separate `discord.channel_skill_bindings` entry with only `hermes-url-auto-capture-inbox`. Existing `#hermes` binding remains `hermes-url-ingest-vault`, `triage`, and `session-close`.
- **Config validation:** parsed `~/.hermes/config.yaml` with `js-yaml`; confirmed both channel prompt keys and both channel binding entries are present.
- **Skill availability:** `hermes skills list` shows `hermes-url-auto-capture-inbox` as a local enabled skill.
- **Gateway reload:** restarted the running `ai-factory` tmux gateway with the existing launch pattern; `hermes gateway status` reports running; gateway log records `Registered /skill command with 90 skill(s)` and `Connected as Hermes#9214`.
- **Static guard test:** added `tests/hermes-url-auto-capture-inbox-skill.test.mjs`; red run failed before the skill/docs existed, then passed after implementation.
- **MCP regression:** `hermes mcp test cns_vault_io` succeeded: connected, 9 tools discovered.
- **Live probe limitation:** bot-authored Discord message to `#general` (`1501912410666041484`) was accepted by Discord but intentionally produced no gateway inbound event and no Inbox note, consistent with bot self-message loop prevention. Operator-authored `#general` messages are still required to complete the three live evidence subtasks.
- **Operator E2E:** verified with operator-authored `#general` messages that (1) normal URL capture writes an Inbox note with required fields, (2) `localhost` is rejected pre-fetch but still produces an Inbox note recording the refusal class, and (3) a 4+ URL message is capped to 3 distinct URLs with omitted count recorded.
- **Regression sweep:** no Omnipotent Vault IO server `src/` files changed. Existing `#hermes` skills remain bound. `~/.hermes/SOUL.md` was present and was removed again; `~/.hermes/memories/MEMORY.md` and `USER.md` remain symlinks to vault `AI-Context/`.

### Completion Notes List

- Implemented a capture-only Hermes skill for Discord `#general` that triggers on any `http://` or `https://` URL substring, captures at most 3 distinct URLs in first-seen order, records omitted URL count, applies SSRF pre-fetch refusals, and writes unstructured markdown captures to the active vault `00-Inbox/`.
- Preserved the governed `#hermes` URL ingest path: no changes to `hermes-url-ingest-vault`, `triage`, or `session-close` bindings.
- Updated the operator guide with `#general` auto-capture behavior, trigger semantics, manual triage boundary, SSRF notes, install path, and Version History row `1.23.0`.
- Marked story **done** after operator-authored Discord E2E verification: normal URL capture, localhost/private refusal capture, and 4+ URL cap capture.

### File List

- `scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/SKILL.md`
- `scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/references/capture-prompt.md`
- `scripts/hermes-skill-examples/hermes-url-auto-capture-inbox/references/config-snippet.md`
- `scripts/install-hermes-skill-url-auto-capture-inbox.sh`
- `tests/hermes-url-auto-capture-inbox-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/28-3-wire-general-auto-ingest.md`
- `~/.hermes/config.yaml`
- `~/.hermes/skills/cns/hermes-url-auto-capture-inbox/SKILL.md`
- `~/.hermes/skills/cns/hermes-url-auto-capture-inbox/references/capture-prompt.md`
- `~/.hermes/skills/cns/hermes-url-auto-capture-inbox/references/config-snippet.md`
- `~/.hermes/SOUL.md` (operator home; generated by Hermes earlier, removed again)

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-07 | Started 28.3, added capture-only `#general` skill mirror and live Hermes install, bound channel `1484880486785486951`, updated operator guide, restarted gateway, and left live Discord E2E pending operator-authored messages because bot-authored probes are ignored by the gateway. |
| 2026-05-07 | Completed operator-authored Discord E2E verification for `#general` auto-capture and marked story done. |

### Operator Verification Completed

Post these messages in Discord `#general` and verify new `00-Inbox/hermes-auto-capture-*` notes:

1. `https://example.com/?cns-28-3-ok`
2. `http://localhost/cns-28-3-blocked`
3. `https://example.com/a https://example.com/b https://example.com/c https://example.com/d`
