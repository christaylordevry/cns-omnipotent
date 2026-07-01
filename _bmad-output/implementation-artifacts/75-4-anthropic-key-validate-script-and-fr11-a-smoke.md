# Story 75.4: Anthropic key validate script and FR11-A smoke

Status: review

baseline_commit: 8670092

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. FR11-A key smoke only; zero protect-list edits; no run-chain E2E (75-5). Unblocks dormant chain (ANTHROPIC_API_KEY 401 since ~2026-05-24). -->

## Story

As an **operator**,
I want **`scripts/validate-anthropic-key.ts` with tests and a documented key rotate procedure**,
so that **Synthesis/Hook/Boss can run under FR11 Option A without adapter changes (FR11)**.

## Acceptance Criteria

1. **Validate script smoke-calls Anthropic (FR11-A)**
   **Given** `.env.live-chain` exists at repo root with `ANTHROPIC_API_KEY` set (gitignored via `.env.*`)
   **When** operator runs `npx tsx scripts/validate-anthropic-key.ts` from repo root
   **Then** the script loads `ANTHROPIC_API_KEY` from `.env.live-chain` (and respects an already-exported env var if present)
   **And** it POSTs a minimal Messages API request (haiku-class model, `max_tokens: 1`, user content `"ping"`)
   **And** on HTTP 2xx it prints a success line, prints key identification as **first 10 chars + masked suffix** (never full key), and exits **0**
   **And** on HTTP 401 or other failure it prints a **clear, actionable** error to stderr and exits **1**
   **And** the script is **standalone** — zero imports from protect-list paths and no imports from `src/agents/*-adapter-llm.ts` or `src/agents/run-chain.ts`

2. **Key identification output (NFR4)**
   **Given** a valid `sk-ant-…` key
   **When** the script runs (success or failure after API call)
   **Then** stdout/stderr may show only: prefix = first 10 characters, suffix mask like `…****` (last 4 chars optional) or fixed `…[masked]`
   **And** full key value never appears in logs, tests, or committed files

3. **Malformed / missing key handling**
   **Given** `.env.live-chain` missing, unreadable, or without `ANTHROPIC_API_KEY`
   **When** the script runs
   **Then** it exits **1** with message naming the problem (file path + missing var)
   **Given** `ANTHROPIC_API_KEY` present but failing format check (empty, whitespace-only, or not matching `^sk-ant-`)
   **When** the script runs
   **Then** it exits **1** before any network call with a format error (no API spend)

4. **Vitest coverage (CI-safe)**
   **Given** `tests/hermes/` domain registered (75-1)
   **When** `tests/hermes/validate-anthropic-key.test.ts` runs under `npm run test:vitest`
   **Then** tests cover at minimum:
   - missing `.env.live-chain` / missing `ANTHROPIC_API_KEY`
   - malformed key format (no network)
   - mocked `fetch` returning 200 → success path
   - mocked `fetch` returning 401 → failure path with auth messaging
   **And** tests use `vi.stubGlobal("fetch", …)` pattern (see `tests/vault-io/anthropic-fetch.test.ts`)
   **And** no live Anthropic calls in CI

5. **Documented key rotate procedure**
   **Given** governance SSOT at `AI-Context/modules/run-chain.md` (75-2)
   **When** story closes
   **Then** a **Key validation and rotation** subsection exists under § FR11 (preferred — co-located SSOT) documenting:
   - Where to obtain a new Anthropic API key (console.anthropic.com — placeholder URL only in docs)
   - How to update `.env.live-chain` (`ANTHROPIC_API_KEY=…` line only; never commit)
   - Operator approval note: rotation spends a new key; `deferred-work.md` §LLM provider consolidation defers ad-hoc key minting until operator explicitly approves FR11-A revival
   - Re-run: `npx tsx scripts/validate-anthropic-key.ts` must exit 0 before attempting run-chain (75-5)
   - Cross-link: `specs/cns-vault-contract/modules/mcp-operator-runbook.md` § Key rotation hygiene for post-incident checklist
   **And** both vault copies updated and identical (`diff -q` clean):
   - `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md`
   - `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md`

6. **Verify gate (NFR1)**
   **Given** implementation complete
   **When** `bash scripts/verify.sh` runs
   **Then** it passes with no regressions

7. **Protect-list + scope (NFR2)**
   **Given** ADR-HERMES-004 protect-list
   **When** implementation completes
   **Then** **zero diffs** on:
   - `src/agents/synthesis-adapter-llm.ts`
   - `src/agents/hook-adapter-llm.ts`
   - `src/agents/boss-adapter-llm.ts`
   - `src/agents/run-chain.ts`
   - `scripts/run-chain.ts`
   **And** no live run-chain E2E invocation (that is **75-5**)
   **And** no Hermes skill edits required (75-3 already references this script on 401)

## Tasks / Subtasks

- [x] **AC #1 — Implement `scripts/validate-anthropic-key.ts`** (AC: #1, #2, #3)
  - [x] Standalone module: constants + exported helpers + `main()` CLI entry
  - [x] Resolve repo root (dirname of script → parent) for `.env.live-chain` path
  - [x] Inline env-file parser (same semantics as `parseEnvFile` in `fetch-arxiv-rss.mjs` — do **not** import from morning-digest `.mjs`)
  - [x] `maskApiKeyForDisplay(key)` → prefix 10 + masked tail
  - [x] `assertKeyFormat(key)` → `^sk-ant-` + min length
  - [x] `validateAnthropicKey(apiKey, fetchFn?)` → POST minimal message; return `{ ok, status, error? }`
  - [x] Use raw `fetch` (no `@anthropic-ai/sdk` — not a repo dependency)
  - [x] `main()`: load env → validate format → call API → print result → `process.exit(code)`

- [x] **AC #4 — Vitest tests** (AC: #4)
  - [x] Create `tests/hermes/validate-anthropic-key.test.ts`
  - [x] Import exported helpers from `../../scripts/validate-anthropic-key.ts` (or relative path matching project convention)
  - [x] `afterEach`: `vi.unstubAllGlobals()`
  - [x] Temp fixture dir for fake `.env.live-chain` files (use `fs.mkdtemp` + cleanup)

- [x] **AC #5 — Document rotation in run-chain.md** (AC: #5)
  - [x] Add § **Key validation and rotation** under existing § FR11 Option A
  - [x] Include validate command, rotate steps, operator-approval note, link to mcp-operator-runbook
  - [x] Sync canonical vault copy; `diff -q` both paths

- [x] **AC #6–#7 — Gate + scope** (AC: #6, #7)
  - [x] `bash scripts/verify.sh` green
  - [x] `git diff --name-only` excludes protect-list paths
  - [x] Optional operator smoke: run script with live key **only if** operator approves key spend (not an AC for dev agent in CI)

## Dev Notes

### Epic and sequencing context

- **Epic 75 (Run-Chain Knowledge + Revival)** — alias **Epic B**; FR **FR11** (this story), builds on **FR7** (75-2) and **FR8** (75-3).
- **Depends:** 75-1 (`tests/hermes/` vitest domain), 75-2 (governance module SSOT), 75-3 (skill already points operators to this script on 401).
- **Blocks:** **75-5** E2E revival verification (requires valid key from this story).
- **Current blocker:** `ANTHROPIC_API_KEY` HTTP **401** since ~2026-05-24 — chain dormant until operator rotates key and validate script exits 0.

[Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 75 Story 75-4; `prd-hermes-consolidation.md` §2 Background; `deferred-work.md` §LLM provider consolidation]

### Why standalone (not adapter import)

ADR-HERMES-004 **Epic B allowed code:** validate script + docs only. Protect-list forbids adapter edits. User story explicitly requires:

> Script must NOT import from protect-list paths — standalone only

**Allowed:** duplicate the three API constants already used by adapters (URL, version header, model id) inside the script file.

**Forbidden imports:**

| Path | Reason |
|------|--------|
| `src/agents/synthesis-adapter-llm.ts` | Protect-list |
| `src/agents/hook-adapter-llm.ts` | Protect-list |
| `src/agents/boss-adapter-llm.ts` | Protect-list |
| `src/agents/run-chain.ts` | Protect-list |
| `scripts/run-chain.ts` | Protect-list |
| `src/agents/anthropic-fetch.ts` | Couples validate script to run-chain retry policy (unnecessary for 1-token ping) |

[Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §Protect-list gate, §Epic B allowed code]

### Anthropic API contract (implement from Context7 + adapter parity)

Mirror adapter headers (read-only reference from `src/agents/boss-adapter-llm.ts` — **do not edit**):

| Constant | Value |
|----------|-------|
| URL | `https://api.anthropic.com/v1/messages` |
| Header `anthropic-version` | `2023-06-01` |
| Header `x-api-key` | trimmed `ANTHROPIC_API_KEY` |
| Header `content-type` | `application/json` |

**Validation ping body (minimize cost):**

```json
{
  "model": "claude-haiku-4-5",
  "max_tokens": 1,
  "messages": [{ "role": "user", "content": "ping" }]
}
```

- **Model:** `claude-haiku-4-5` — haiku-class, cheapest validation tier (Context7 `/anthropics/anthropic-sdk-typescript` model union; **not** `claude-sonnet-4-6` used by Synthesis/Hook/Boss in production chain).
- **No retry loop** on 429 for validate script — single attempt; operator re-runs manually.
- **401 handling:** Map to message: `Anthropic API returned 401 — ANTHROPIC_API_KEY invalid or revoked. Rotate per AI-Context/modules/run-chain.md § Key validation and rotation.`

[Source: Context7 `/anthropics/anthropic-sdk-typescript` — POST /v1/messages; `src/agents/boss-adapter-llm.ts` lines 12–13, 196–203]

### Suggested script structure (export for tests)

```typescript
// scripts/validate-anthropic-key.ts
export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const VALIDATE_MODEL = "claude-haiku-4-5";

export function parseEnvFile(content: string): Record<string, string> { /* inline */ }
export function maskApiKeyForDisplay(key: string): string { /* first 10 + …**** */ }
export function assertKeyFormat(key: string): void { /* throws or returns error */ }

export async function validateAnthropicKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> { /* ... */ }

export function loadAnthropicKeyFromEnvFile(
  envFilePath: string,
  readFileSync = fs.readFileSync,
): string { /* ENOENT / missing var */ }

async function main(): Promise<number> { /* 0 | 1 */ }

const isMain = import.meta.url === pathToFileURL(process.argv[1]!).href;
if (isMain) {
  main().then((code) => process.exit(code));
}
```

**CLI success output example (shape only):**

```text
Anthropic key OK (sk-ant-api0…[masked])
Model: claude-haiku-4-5 | HTTP 200
```

**CLI failure examples:**

```text
validate-anthropic-key: missing /path/to/Omnipotent.md/.env.live-chain
validate-anthropic-key: ANTHROPIC_API_KEY not set in .env.live-chain
validate-anthropic-key: malformed ANTHROPIC_API_KEY (expected sk-ant- prefix)
validate-anthropic-key: Anthropic API returned 401 — key invalid or revoked
```

### `.env.live-chain` loading rules

| Priority | Source |
|----------|--------|
| 1 | `process.env.ANTHROPIC_API_KEY` if already set (operator `source .env.live-chain` preamble) |
| 2 | Parse repo-root `.env.live-chain` |

Path resolution:

```typescript
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(REPO_ROOT, ".env.live-chain");
```

`.gitignore` covers `.env.*` — file never committed.

[Source: `.gitignore`; `scripts/hermes-gateway-start.sh` sourcing pattern]

### Key mask function (NFR4)

```typescript
export function maskApiKeyForDisplay(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 10) return `${trimmed.slice(0, 3)}…[masked]`;
  const prefix = trimmed.slice(0, 10);
  const suffix = trimmed.slice(-4);
  return `${prefix}…${"*".repeat(4)}`; // or `…${suffix}` per AC — pick one style, test it
}
```

Contract tests in 75-3 reject `sk-ant-…` literals in skill markdown — validate script tests must also never assert full keys.

### Testing requirements

| Test | Approach |
|------|----------|
| Missing env file | Point `loadAnthropicKeyFromEnvFile` at nonexistent path |
| Missing var in file | Temp file with only `FIRECRAWL_API_KEY=x` |
| Malformed key | `assertKeyFormat("not-a-key")` throws/returns error; `fetch` not called |
| Mock success | `vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })))` |
| Mock 401 | `status: 401` → `validateAnthropicKey` returns `ok: false`, message mentions 401 |

**Reference test file:** `tests/vault-io/anthropic-fetch.test.ts` — `vi.stubGlobal`, `afterEach` cleanup.

**Do not** add live-network tests or env-gated integration tests in this story.

[Source: `_bmad-output/implementation-artifacts/75-1-hermes-test-domain-and-vitest-include.md`]

### Documentation — run-chain.md § Key validation and rotation (minimum)

Add after § **FR11 Option A / credential posture** in `AI-Context/modules/run-chain.md`:

1. **Validate (smoke):** `npx tsx scripts/validate-anthropic-key.ts` from repo root; exit 0 required before run-chain.
2. **Obtain key:** Anthropic Console → API Keys → create key (document URL only).
3. **Update:** Edit gitignored `.env.live-chain`: `ANTHROPIC_API_KEY=sk-ant-…` (replace line; never commit).
4. **Operator approval:** FR11-A revival is operator-approved (architecture gate 2026-06-24); do not mint keys without explicit approval (`deferred-work.md`).
5. **Revoke old key** at provider after confirming validate script passes.
6. **Post-incident:** If key was exposed, follow `mcp-operator-runbook.md` § Key rotation hygiene.
7. **Next step:** Story 75-5 E2E via Hermes `run-chain` skill.

**Dual-copy sync** (same as 75-2):

```bash
diff -q \
  Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md \
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md"
```

[Source: `_bmad-output/implementation-artifacts/75-2-run-chain-governance-module-and-project-folder.md` §Vault path contract]

### WriteGate / security

- **Vault edit:** `AI-Context/modules/run-chain.md` only (governance module extension). Operator FS or approved write path — not Vault IO MCP WriteGate bypass for `AGENTS.md`.
- **No** `vault_log_action` changes.
- **No** `security.md` edits unless operator requests.
- **No secrets** in commits, story file, or test fixtures (use `sk-ant-test000000000000000000000000000000000000000000` style fake keys in tests only).

### Protect-list (NFR2 — zero diffs)

| Path | Reason |
|------|--------|
| `src/agents/synthesis-adapter-llm.ts` | Synthesis LLM adapter |
| `src/agents/hook-adapter-llm.ts` | Hook LLM adapter |
| `src/agents/boss-adapter-llm.ts` | Boss LLM adapter |
| `src/agents/run-chain.ts` | Orchestrator |
| `scripts/run-chain.ts` | CLI entry |

### File structure requirements

| File | Action |
|------|--------|
| `scripts/validate-anthropic-key.ts` | **NEW** |
| `tests/hermes/validate-anthropic-key.test.ts` | **NEW** |
| `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md` | **UPDATE** — § Key validation and rotation |
| `/mnt/c/.../AI-Context/modules/run-chain.md` | **UPDATE** — canonical sync |

**Optional (not required):** remove or repurpose `tests/hermes/run-chain.test.ts` placeholder — may keep both tests.

**Forbidden:** protect-list paths, `scripts/run-chain.ts`, live E2E proof artifact, new npm dependencies.

### Previous story intelligence

**75-1 (done):** Vitest include `"tests/hermes/**/*.test.ts"`; baseline 51 files / 643 tests after placeholder.

**75-2 (review):** `run-chain.md` SSOT documents 401 blocker and points to 75-4; FR11 Option A section exists — **extend** it, do not duplicate stage/env tables. Review patches pending on module wording — rotation doc should not re-open engine files.

**75-3 (review):** Hermes skill `task-prompt.md` already tells operators to run `scripts/validate-anthropic-key.ts` on 401 — script must exist at that path. No skill edits unless validate path differs.

[Source: `_bmad-output/implementation-artifacts/75-1-*.md`, `75-2-*.md`, `75-3-*.md`]

### Git intelligence (recent Epic 75 commits)

| Commit | Story | Pattern |
|--------|-------|---------|
| `8670092` | 75-3 | Hermes skill mirror + `tests/hermes-run-chain-skill.test.mjs` contract tests |
| `18b9171` | 75-2 | Vault governance docs dual-copy sync |
| `722b28d` | 75-1 | Minimal vitest config one-liner + `tests/hermes/` bootstrap |

Follow: one logical commit, `bash scripts/verify.sh` before done, branch `hermes-consolidation`.

### Architecture compliance

- **FR11 Option A:** Validate/rotate Anthropic key only; zero adapter edits (ADR-HERMES-004).
- **NFR1:** `bash scripts/verify.sh` passes.
- **NFR2:** Protect-list untouched.
- **NFR4:** Masked key display; no secrets in repo.

### Latest technical information

- **Anthropic Messages API:** POST `https://api.anthropic.com/v1/messages` with `x-api-key` + `anthropic-version: 2023-06-01`.
- **Cheapest model id (2026):** `claude-haiku-4-5` (Context7 model union).
- **No SDK:** Repo uses raw `fetch` in adapters; validate script matches that pattern.
- **Vitest:** `^3.2.4`; `vi.stubGlobal("fetch", …)` for HTTP mocks.

[Source: Context7 `/anthropics/anthropic-sdk-typescript`; `package.json`]

### Project context reference

- Hermes Consolidation Epics 74–78 on `hermes-consolidation`.
- Epic 74 `done`; Epic 75 `in-progress` (75-1 `done`, 75-2/75-3 `review`, this story unblocks 75-5).
- Portal OAuth ≠ run-chain credentials (ADR-HERMES-004).

[Source: `project-context.md`; `sprint-status.yaml`]

### References

- [Source: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Epic 75 Story 75-4]
- [Source: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md` §FR11, §2 Background]
- [Source: `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md` §ADR-HERMES-004, §Protect-list, §Project Structure]
- [Source: `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md` — extend § FR11]
- [Source: `specs/cns-vault-contract/modules/mcp-operator-runbook.md` § Key rotation hygiene]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` §LLM provider consolidation]
- [Source: `_bmad-output/implementation-artifacts/75-1-hermes-test-domain-and-vitest-include.md`]
- [Source: `_bmad-output/implementation-artifacts/75-2-run-chain-governance-module-and-project-folder.md`]
- [Source: `_bmad-output/implementation-artifacts/75-3-hermes-run-chain-trigger-skill.md`]
- [Source: `tests/vault-io/anthropic-fetch.test.ts` — fetch mock pattern]
- [Source: Context7 `/anthropics/anthropic-sdk-typescript` — Messages API]

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (Cursor)

### Debug Log References

- Lint: `preserve-caught-error` on ENOENT — attached `{ cause: err }`; simplified response body read to fix `no-useless-assignment`.

### Completion Notes List

- Implemented standalone `scripts/validate-anthropic-key.ts` with exported helpers, `isMain` guard, haiku ping (`claude-haiku-4-5`, `max_tokens: 1`), masked key output, and format pre-check before network.
- Added `tests/hermes/validate-anthropic-key.test.ts` (12 tests): missing file, missing var, malformed key, mocked 200/401, env precedence, temp fixture.
- Extended `AI-Context/modules/run-chain.md` § FR11 with **Key validation and rotation** subsection; synced canonical vault copy (`diff -q` clean).
- `bash scripts/verify.sh` passed (655 vitest tests + full gate). Zero protect-list diffs.

### File List

- `scripts/validate-anthropic-key.ts` (new)
- `tests/hermes/validate-anthropic-key.test.ts` (new)
- `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md` (updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)

### Change Log

- 2026-06-24: Story 75-4 — Anthropic key validate script, vitest coverage, FR11 rotation docs (FR11-A smoke).

## Story Completion Status

- **Status:** review
- **Completion note:** Implementation complete — validate script, tests, rotation docs; verify.sh green; ready for code review.
