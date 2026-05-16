---
story_id: 31-3
epic: 31
title: obsidian-local-rest-api-and-thinking-command-activation
status: done
---

# Story 31.3: obsidian-local-rest-api-and-thinking-command-activation

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide for Epic 31 /trace and /connect activation via Obsidian Local REST API. -->

## Story

As the **operator**,  
I want **`/trace` and `/connect` thinking commands to return real vault content**,  
so that **I can query the live knowledge graph from Discord instead of receiving stub refusals**.

## Context

The **`vault-think`** Hermes skill shipped in **Epic 29 story 29-10** with four thinking commands live at v1.0 (`/challenge`, `/emerge`, `/ideas`) and four **v1.1 stubs** (`/trace`, `/connect`, `/ghost`, `/drift`). Stubs reply with `vault-think: v1.1-not-active` and cite **Obsidian Local REST API** as the prerequisite for graph work.

**Epic 29 retrospective** explicitly scoped `/trace` and `/connect` activation behind a **dependency story** (Local REST install + governed HTTP access), not as an implied stretch inside another thinking-command follow-up. **This story is that dependency story** for the first two stubs only.

**Scope (non-negotiable):**

- **Activate:** `/trace`, `/connect` only.
- **Remain stubs:** `/ghost`, `/drift` (still refuse with updated v1.1 stub message that names only ghost/drift as pending).
- **Implementation surface:** Hermes skill docs only (`SKILL.md`, `references/task-prompt.md`) — **no** Vault IO MCP tool signature changes, **no** `src/` TypeScript, **no** WriteGate or audit changes.
- **Dual copy rule:** Every skill edit applies to **both**:
  1. `scripts/hermes-skill-examples/vault-think/` (repo mirror)
  2. `~/.hermes/skills/cns/vault-think/` (operator install tree; use `bash scripts/install-hermes-skill-vault-think.sh` after mirror edits)

**Environment facts (operator-confirmed for implementation):**

| Fact | Value |
|------|--------|
| API base | `https://127.0.0.1:27124` (override via `OBSIDIAN_LOCAL_REST_URL`) |
| API key env | `OBSIDIAN_API_KEY` |
| TLS | Self-signed — `curl -k` on every call |
| `/trace` | `GET /vault/{filename}`, `POST /search/simple/?query=` |
| `/connect` | `POST /search/simple/` and optional `POST /search/` (DQL/JsonLogic) |
| HTTP client | Terminal **`curl`** only — no new Node dependencies |

## Acceptance Criteria

1. **Phase A (operator, blocking for live verification):** Operator has installed **Obsidian Local REST API** (Adam Coddington) and confirmed it is running. **WSL2 curl** to the API root returns **HTTP 200**. The **exact curl command** used (with redacted API key placeholder) is recorded in this story's **Verification** section during dev closeout.
2. **`vault-think` SKILL.md** updated: `/trace` and `/connect` moved from v1.1 stubs to **live commands**. **`version:`** bumped to **`1.1.0`**. **`/ghost` and `/drift`** remain documented stubs. Both copies updated (repo mirror + `~/.hermes/skills/cns/vault-think/`).
3. **`/trace <note-title-or-path>`:** Queries Obsidian Local REST API for the note's **backlinks** and **forward links** (outgoing wikilinks), formats a Discord response showing the **connection graph** for that note (see output template in Dev Notes).
4. **`/connect <concept-a> <concept-b>`:** Queries the REST API to find notes referencing **both** concepts; returns a **bridging path** (shortest defensible chain via shared notes/wikilinks) or honest **`no direct connection found`** when none exists within search caps.
5. **Live Discord test — `/trace`:** Run against a **known vault note**; returns **real link data** (not stub refusal). Evidence appended to `_bmad-output/implementation-artifacts/epic-31-thinking-commands-evidence.md`.
6. **Live Discord test — `/connect`:** Run with **two known concepts** that exist in the vault; returns a **real result**. Evidence in same evidence file.
7. **`tests/hermes-vault-think-skill.test.mjs`** updated: `/trace` and `/connect` asserted as **live**; stub refusal block must **not** apply to trace/connect; `/ghost` and `/drift` still stub; `version: 1.1.0` asserted.
8. **`npm test`** passes. **`bash scripts/verify.sh`** passes.

## Phase A — Operator instructions (complete before Phase B verification)

Execute on **Windows Obsidian** + **WSL2 terminal**:

1. Open Obsidian on Windows.
2. **Settings → Community plugins → Browse** → search **"Local REST API"**.
3. Install **"Local REST API"** by **Adam Coddington**.
4. Enable the plugin.
5. Copy the **API key** from plugin settings (never commit to git).
6. Export **`OBSIDIAN_API_KEY`** in the Hermes shell or `~/.hermes/config.yaml` `env` block.
7. From **WSL2**, verify connectivity:

```bash
curl -sk -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer <api-key>" \
  "https://127.0.0.1:27124/"
```

**Success:** printed status is **`200`**.

**Authenticated vault listing:**

```bash
curl -sk -H "Authorization: Bearer <api-key>" "https://127.0.0.1:27124/vault/"
```

Record the working command in **Verification** when Phase A is confirmed.

## Tasks / Subtasks

- [x] **Phase A gate:** Confirm operator completed plugin install + WSL2 curl **200** (or document blocker in Dev Agent Record). (AC1) — root **200** verified; authenticated `/vault/` requires operator `OBSIDIAN_API_KEY`
- [x] **Context7 before coding:** `resolve-library-id` → **Obsidian Local REST API**; `query-docs` for auth, `GET /vault/{filename}`, `POST /search/simple/`, note JSON `Accept` headers. Library IDs: `/coddingtonbear/obsidian-local-rest-api`, `/openapi/coddingtonbear_github_io_obsidian-local-rest-api_openapi_yaml`. (AC3–4)
- [x] Read current **`scripts/hermes-skill-examples/vault-think/SKILL.md`** and **`references/task-prompt.md`** in full. (prep)
- [x] **`SKILL.md`:** Bump **`version: 1.1.0`**; move `/trace`, `/connect` to v1.0-style **When to use**; keep `/ghost`, `/drift` in stub table; document REST dependency + env vars; update description frontmatter. (AC2)
- [x] **`task-prompt.md`:** Remove `/trace` and `/connect` from §1a stub block; add §3 branches with REST procedures, caps, error messages, and **exact Discord templates** (AC3–4). Update stub refusal text to mention only `/ghost` and `/drift`.
- [x] Define **note resolution** for `/trace`: accept vault-relative path **or** title substring; resolve via `GET /vault/` listing + `POST /search/simple/` if ambiguous; reply `vault-think: trace ambiguous` with ≤5 candidates when needed.
- [x] Implement **link graph extraction** using Local REST (no Vault IO mutators): outgoing `[[wikilinks]]` from note body; incoming via `search/simple` for link targets; cap ≤ **12** backlinks + ≤ **12** forward links displayed. (AC3)
- [x] Implement **`/connect`:** two non-empty concept tokens after `/connect `; search both; intersect paths; optional 2-hop bridge via shared intermediate note; cap ≤ **6** `search/simple` calls total. (AC4)
- [x] **`bash scripts/install-hermes-skill-vault-think.sh`**; verify mirror == `~/.hermes/skills/cns/vault-think/`. (AC2)
- [x] Update **`tests/hermes-vault-think-skill.test.mjs`** (AC7).
- [x] **Operator Guide §15.6:** Document `/trace` and `/connect` as live; REST prerequisite; version history row (standing task). (AC2 user-facing)
- [x] **Live Discord tests**; append evidence file (AC5–6) — `#hermes` 2026-05-17; see `epic-31-thinking-commands-evidence.md`
- [x] Run **`npm test`** and **`bash scripts/verify.sh`** (AC8).

## Dev Notes

### Epic 31 / prior story intelligence

| Source | Relevance |
|--------|-----------|
| **31-1** (done) | Hermes skill dual-copy + install script pattern; Discord live tests; operator guide updates. |
| **31-2** (done) | Unrelated (ingest dedup); no file overlap. |
| **29-10** (done) | Baseline `vault-think` v1.0.0, stub block, test module, Operator Guide §15.6, channel bindings already list all seven commands. |
| **Epic 29 retro** | Local REST is explicit prerequisite — **do not** half-implement graph ops via `vault_search` alone. |

### Architecture compliance

- **Hermes skill-only:** Cognition stays on-demand via `#hermes` channel binding; **no** AGENTS.md or session-close injection.
- **Read-only posture preserved for Vault IO:** `/trace` and `/connect` use **HTTP to Obsidian Local REST API** only. Still allow **`vault_search` + `vault_read`** for v1.0 commands. **Do not** add vault mutators.
- **Secrets:** API key lives in operator env / `~/.hermes/config.yaml` — **never** in repo, tests, or story verification (use `<api-key>` placeholder).
- **Spec-first:** No `specs/cns-vault-contract/` change unless operator approves new normative HTTP surface (not expected).

### Obsidian Local REST API — implementation reference

**Authentication:** `Authorization: Bearer <api-key>` (header name configurable in plugin; default `Authorization`).

**Base URL:** `https://127.0.0.1:27124` (operator standard; override `OBSIDIAN_LOCAL_REST_URL`). All calls use **`curl -k`**.

**Endpoints to use:**

| Operation | Endpoint | Notes |
|-----------|----------|--------|
| Health / root | `GET /` | AC1 curl target |
| Read note | `GET /vault/{filename}` | URL-encode path; optional `Accept: application/vnd.olrapi.note+json` |
| Simple search | `POST /search/simple/?query=...&contextLength=...` | Find notes mentioning a concept or wikilink target |
| Structured search | `POST /search/` | DQL or JsonLogic for `/connect` bridge |
| Vault listing | `GET /vault/` or `GET /vault/{dir}/` | Resolve ambiguous titles |

**Error replies (exact strings — add to task-prompt):**

| Condition | Reply |
|-----------|--------|
| REST unreachable / non-200 | `vault-think: obsidian-rest-unavailable` |
| Missing API key env | `vault-think: obsidian-rest-no-api-key` |
| Note not found | `vault-think: trace not-found` |
| `/connect` missing concepts | `vault-think: connect requires two concepts` |
| No bridge found | `vault-think: connect no direct connection found` |

### Discord output templates (normative — task-prompt must embed verbatim)

**`/trace` success:**

```text
🔗 Trace: [note title]
Path: [vault-relative path]

← Backlinks ([N]):
• [title] — [path]
...

→ Forward links ([M]):
• [title] — [path]
...

Graph: [one sentence synthesis of how this note sits in the vault]
```

**`/connect` success:**

```text
🌉 Connect: [concept A] ↔ [concept B]

Bridge:
• [path 1] — [why it links A]
• [path 2] — [why it links B]
...

Summary: [1-2 sentences]
```

**`/connect` no path:** use exact error string `vault-think: connect no direct connection found`.

### File structure requirements

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/vault-think/SKILL.md` | v1.1.0, live trace/connect |
| `scripts/hermes-skill-examples/vault-think/references/task-prompt.md` | REST procedures + templates |
| `~/.hermes/skills/cns/vault-think/**` | Install copy (via script) |
| `tests/hermes-vault-think-skill.test.mjs` | Live vs stub assertions |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | §15.6 + version history (standing task) |
| `_bmad-output/implementation-artifacts/epic-31-thinking-commands-evidence.md` | Create or append Discord evidence (AC5–6) |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Set story **done** when complete |

**Not in scope:** `src/`, `specs/`, MCP registrations, `/ghost`, `/drift` activation, new npm dependencies.

### Testing requirements

**CI (blocking):**

```bash
npm test
bash scripts/verify.sh
```

**Test module changes (AC7):**

- Assert `version: 1.1.0` in `SKILL.md`.
- Assert `/trace` and `/connect` in **When to use** or live-command section **without** `No (v1.1)` / stub-only markers.
- Assert `task-prompt.md` contains trace/connect procedure sections and **does not** include trace/connect in the `v1.1-not-active` stub block.
- Assert `/ghost` and `/drift` still documented as stubs.
- Replace or extend test titled **"documents v1.0 output templates and stub refusal"** — stub refusal applies to ghost/drift only.

**Manual (blocking for done):**

- Phase A curl **200** recorded in Verification.
- Discord `/trace` and `/connect` evidence in `epic-31-thinking-commands-evidence.md`.

### References

- [Source: `_bmad-output/implementation-artifacts/29-10-hermes-thinking-commands.md`]
- [Source: `scripts/hermes-skill-examples/vault-think/SKILL.md`]
- [Source: `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`]
- [Source: `_bmad-output/planning-artifacts/epic-29-retrospective.md` § Obsidian Local REST API]
- [Source: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.6]
- [Source: Context7 `/coddingtonbear/obsidian-local-rest-api` — auth, vault GET, search/simple]
- [Source: `tests/hermes-vault-think-skill.test.mjs`]
- [Source: `scripts/install-hermes-skill-vault-think.sh`]

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] Update **`Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`** §15.6: `/trace` and `/connect` live; Local REST install + env vars; bump **Version History** (**1.27.0**).

## Dev Agent Record

### Agent Model Used

Composer (dev-story 31-3)

### Debug Log References

- Context7: `/coddingtonbear/obsidian-local-rest-api` — vault GET, search/simple, search/ JsonLogic
- Phase A: `GET https://127.0.0.1:27124/` → **200** (no key); `GET /vault/` → **401** without `OBSIDIAN_API_KEY` in agent shell

### Completion Notes List

- Activated **`vault-think` v1.1.0**: `/trace` and `/connect` live via **`curl -k`** to `https://127.0.0.1:27124` with **`OBSIDIAN_API_KEY`**; `/ghost`, `/drift` remain stubs.
- **`task-prompt.md` §3** documents note resolution, link caps, connect bridge logic, and verbatim Discord templates.
- Installed repo mirror to **`~/.hermes/skills/cns/vault-think/`** (diff clean).
- Operator Guide §15.6 + version **1.27.0** updated.
- **`npm test`** and **`bash scripts/verify.sh`** pass.
- **Operator follow-up:** Discord `/trace` and `/connect` live in `#hermes` (2026-05-17); evidence in `epic-31-thinking-commands-evidence.md`.

### File List

- `scripts/hermes-skill-examples/vault-think/SKILL.md`
- `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`
- `tests/hermes-vault-think-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/epic-31-thinking-commands-evidence.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Operator FS: `~/.hermes/skills/cns/vault-think/**`

### Verification

| Check | Result |
|-------|--------|
| Phase A curl (exact command) | `curl -sk -o /dev/null -w "%{http_code}\n" "https://127.0.0.1:27124/"` → **200**; authenticated: `curl -sk -H "Authorization: Bearer <api-key>" "https://127.0.0.1:27124/vault/"` → operator |
| `npm test` | **pass** |
| `bash scripts/verify.sh` | **pass** |
| Discord `/trace` live | **pass** — `trace CNS-Operator-Guide.md` in `#hermes` (2026-05-17) |
| Discord `/connect` live | **pass** — `connect research synthesis` in `#hermes` (2026-05-17) |

## Code Review

- 2026-05-16: Review found that `/trace` backlink discovery searched each outgoing wikilink target instead of searching for notes that link to the resolved note, so AC3 could return co-citation noise rather than true backlinks. Patched `task-prompt.md` to build backlink aliases from the resolved note, search those aliases, exclude the source note, and added a regression assertion in `tests/hermes-vault-think-skill.test.mjs`.

## Change Log

- 2026-05-16: Story 31-3 created (ready-for-dev) — activate `/trace` and `/connect` via Obsidian Local REST API; Phase A operator install; v1.1.0 skill bump; ghost/drift remain stubs.
- 2026-05-16: Implementation complete (review) — skill v1.1.0, REST curl procedures, tests, operator guide 1.27.0; Discord evidence pending operator.
- 2026-05-16: Review patch — corrected `/trace` backlink procedure to search aliases for the resolved note instead of outgoing targets; live Discord evidence remains pending operator.
- 2026-05-17: AC5–6 complete — live Discord evidence recorded; story **done**.
