---
story_id: 66-4
epic: 66
title: swap-investigation-provider-openrouter
status: review
repo: cns-dashboard
baseline_tests: 451
baseline_commit: 2c208ac
---

# Story 66-4 — Swap Investigation Provider: Anthropic → OpenRouter

**Story ID:** 66.4  
**Story key:** `66-4-swap-investigation-provider-openrouter`  
**Epic:** 66 — Nexus Agent Orchestration  
**Repo:** cns-dashboard ONLY  
**Status:** review  
**Baseline tests:** 451 (at commit 2c208ac)  

---

## Context

Story 66-1 wired the Intelligence Inspector AI actions (Explain, Trace, Compare, Ask AI)
using the Anthropic SDK and `claude-sonnet-4-20250514`. Two blockers appeared in
production immediately after deploy:

1. **Zero Anthropic credits** — the account has no credit balance; every
   `runInvestigation` call returns HTTP 400 `credit balance too low`.
2. **Model deprecation** — `claude-sonnet-4-20250514` reaches end-of-life
   June 15 2026 (6 days from now). A hard migration deadline regardless of billing.

The operator already pays for a ChatGPT subscription and has an OpenRouter account
(`sk-or-v1-*`) that proxies to OpenAI models at no additional cost. OpenRouter is
already used by Omnipotent.md's synthesis pipeline and is the correct provider for
this project going forward.

**This story swaps the LLM provider in `convex/investigation.ts` from Anthropic to
OpenRouter and fixes a pre-existing Convex validator error on `keywordCandidates`
surfaced in the same prod log session.**

---

## Prerequisites — Must Do Before Writing Any Code

1. **Confirm `openai` package is NOT in `package.json`** — it was absent as of
   story creation. Install it first:
```bash
   cd ~/ai-factory/projects/cns-dashboard
   npm install openai --save
```
   Verify it appears in `package.json` dependencies before proceeding.

2. **Confirm env vars are set in Convex** — both were set by the operator this
   session:
```bash
   npx convex env list --prod | grep OPENROUTER
   npx convex env list | grep OPENROUTER
```
   Both deployments (prod: `amiable-ox-862`, dev: `exciting-pony-764`) must show
   `OPENROUTER_API_KEY=sk-or-v1-...`. Do not proceed if either is missing.

3. **Do NOT import or run anything from Omnipotent.md** — OpenRouter key lives in
   `.env.live-chain` there, but cns-dashboard reads it only via Convex env
   (`process.env.OPENROUTER_API_KEY`). Never cross-import between repos.

---

## Scope

### What changes

| File | Change |
|------|--------|
| `convex/investigation.ts` | Swap Anthropic SDK → OpenAI SDK (OpenRouter base URL). Full replacement of client init, streaming loop, model constant. |
| `convex/queries.ts` (or wherever `getTopCandidates` lives) | Remove or fix `returns` validator that rejects `_creationTime` and `_id` fields. |
| `package.json` | Add `openai` dependency (done in prerequisites). |
| `package-lock.json` | Updated by npm automatically. |

### What does NOT change

- `convex/investigationSessions.ts` — session schema and CRUD are provider-agnostic
- `convex/lib/investigationContext.ts` — context builder is provider-agnostic
- `convex/lib/investigationPrompts.ts` — prompt templates are provider-agnostic
- `src/lib/components/nexus/NexusInvestigationPanel.svelte` — UI unchanged
- `src/lib/components/nexus/NexusInspectorDrawer.svelte` — UI unchanged
- `src/lib/server/trends-claude.ts` — this is the LEGACY SvelteKit Anthropic client
  for the old trends routes. Do NOT touch it. It is intentionally separate.
- Any test files — existing tests must pass; add new tests only if needed for the
  keywordCandidates fix.

---

## Implementation — Part 1: OpenRouter in `convex/investigation.ts`

### Provider swap specification

OpenRouter is OpenAI API-compatible. Use the `openai` npm package with a custom
`baseURL`. This is the standard pattern.

**Client initialisation (replaces Anthropic client):**
```typescript
import OpenAI from 'openai';

const DEFAULT_INVESTIGATION_MODEL = 'openai/gpt-4o';

let openRouterClient: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new ConvexError('OPENROUTER_NOT_CONFIGURED');
  }
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://cns-dashboard-three.vercel.app',
        'X-Title': 'Nexus Intelligence',
      },
    });
  }
  return openRouterClient;
}
```

The `HTTP-Referer` and `X-Title` headers are required by OpenRouter for usage
tracking. Use the exact values above.

**Streaming loop (replaces Anthropic stream):**

OpenRouter streaming via the OpenAI SDK uses `stream: true` on
`chat.completions.create`. The pattern:

```typescript
const client = getOpenRouterClient();
const stream = await client.chat.completions.create({
  model: DEFAULT_INVESTIGATION_MODEL,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  stream: true,
  max_tokens: 1000,
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content ?? '';
  if (delta) {
    buffer += delta;
    // existing throttled flush logic here — unchanged
  }
}
await flush('complete');
```

**Key differences from Anthropic streaming to preserve:**
- The existing `enqueueFlush` / `flushChain` serialization from 66-1 review patch
  (M1 fix) MUST be preserved. Only replace the stream source, not the flush logic.
- The final `await flush('complete')` call MUST remain as the single terminal patch.
- Error handling MUST catch and call `flush('error')` the same way it did before.
- The `CONVEX_ERROR('OPENROUTER_NOT_CONFIGURED')` guard at handler entry mirrors
  the existing `CLAUDE_NOT_CONFIGURED` guard — keep the same early-exit pattern.

**Remove entirely:**
- `import Anthropic from '@anthropic-ai/sdk'`
- `const DEFAULT_CLAUDE_MODEL` constant
- `getAnthropicClient()` function
- All references to `anthropicClient` variable
- All Anthropic stream event types (`MessageStreamEvent`, etc.)

**Guard at handler entry** — update the existing key check:
```typescript
// Before (Anthropic):
if (!process.env.ANTHROPIC_API_KEY?.trim()) {
  throw new ConvexError('CLAUDE_NOT_CONFIGURED');
}

// After (OpenRouter):
if (!process.env.OPENROUTER_API_KEY?.trim()) {
  throw new ConvexError('OPENROUTER_NOT_CONFIGURED');
}
```

---

## Implementation — Part 2: Fix `keywordCandidates` Validator Error

**Error seen in prod logs:**
[CONVEX Q(keywordCandidates:getTopCandidates)] ReturnsValidationError:
Object contains extra field _creationTime that is not in the validator.

**Root cause:** The `returns` validator on `getTopCandidates` explicitly lists fields
but omits `_creationTime` and `_id`, which Convex always adds to returned documents.

**Fix:** Find `getTopCandidates` in `convex/queries.ts` (or wherever it lives — search
the codebase). Remove the `returns:` validator from that query entirely, or update it
to use `v.any()`. The simplest correct fix is removing the `returns` clause so Convex
infers the return type from the schema.

Do NOT add `_creationTime` and `_id` to the validator — Convex system fields should
not be manually declared in returns validators.

Before making the fix, confirm the file location:
```bash
grep -rn "getTopCandidates" convex/ | head -10
```

---

## Acceptance Criteria

All of the following must be true before marking this story done:

1. **Live Explain action works** — tapping Explain on a scored signal in the
   Intelligence Inspector drawer opens `NexusInvestigationPanel`, a response streams
   in, and the session persists in Convex `investigationSessions`. Verify on prod at
   `https://cns-dashboard-three.vercel.app/nexus`.

2. **No Anthropic SDK in convex/** — running this command returns zero results:
```bash
   grep -rn "anthropic\|@anthropic-ai" convex/ | grep -v "_generated"
```

3. **OpenRouter client uses correct base URL** — verify in source:
   `baseURL: 'https://openrouter.ai/api/v1'` present in `convex/investigation.ts`.

4. **keywordCandidates validator error gone** — after `npx convex dev --once`,
   opening the dashboard should not produce the `ReturnsValidationError` in logs.
   Verify by running `npx convex logs --prod` for 30 seconds after page load.

5. **Baseline tests pass** — `bash scripts/verify.sh` shows 451 tests passing
   (or more if new tests added). Zero lint errors. Build green.

6. **`npx convex dev --once` succeeds** — schema valid, no TypeScript errors in
   Convex functions.

7. **`src/lib/server/trends-claude.ts` is untouched** — this file must not be
   modified. It serves the legacy trends routes and uses SvelteKit `$env`, which
   is correct for that context.

8. **Session restore still works** — close and reopen an inspector drawer for a
   signal that has a completed session less than 24h old. The prior result should
   auto-restore without triggering a new OpenRouter call.

---

## Verify Gate (run in cns-dashboard)

```bash
# Source nvm if node not on PATH
source ~/.nvm/nvm.sh

# Full verify
bash scripts/verify.sh

# Confirm no Anthropic imports in convex/
grep -rn "anthropic\|@anthropic-ai" convex/ | grep -v "_generated"

# Confirm OpenRouter key readable in dev
npx convex env list | grep OPENROUTER

# Deploy to dev
npx convex dev --once

# Deploy to prod when verify passes
npx convex deploy
```

---

## Commit Message
feat(epic-66): swap investigation provider Anthropic → OpenRouter (66-4)

Replace @anthropic-ai/sdk with openai SDK in convex/investigation.ts
OpenRouter base URL + HTTP-Referer/X-Title headers
Model: openai/gpt-4o
Preserve M1 flush serialization and terminal patch pattern from 66-1
Fix keywordCandidates getTopCandidates returns validator (_creationTime error)


---

## Sprint Status Update

After commit and prod deploy, update in Omnipotent.md:
- `sprint-status.yaml` → `66-4-swap-investigation-provider-openrouter: done`
