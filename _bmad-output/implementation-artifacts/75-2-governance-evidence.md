# Story 75-2 — Governance Evidence

**Date:** 2026-06-24  
**Story:** 75-2-run-chain-governance-module-and-project-folder  
**Baseline commit:** 722b28de07ece9114eecccf2acb4736d588bfb2d

## Acceptance Criteria

| AC | Description | Result | Notes |
|----|-------------|--------|-------|
| #1 | Governance module `AI-Context/modules/run-chain.md` (dual copy, identical) | **PASS** | Derived from `scripts/run-chain.ts` and `src/agents/run-chain.ts`; all required sections present |
| #2 | Vault project stub `AI-Context/projects/run-chain/README.md` | **PASS** | Co-located under `AI-Context/projects/`; links to module SSOT; no `02-Areas/` stub |
| #3 | Hermes cold-start reference | **PASS** | **Preferred A:** `AI-Context/MEMORY.md` Environment line added. AGENTS §7 row deferred to session-close / **76-4** (not edited per story scope) |
| #4 | `bash scripts/verify.sh` | **PASS** | Exit 0, no regressions |
| #5 | Protect-list + scope | **PASS** | Zero diffs on five protect-list paths; no `src/` changes; no Hermes skill at `~/.hermes/skills/cns/run-chain/` |
| #6 | Evidence artifact | **PASS** | This file |

## Dual-copy verification (`diff -q`)

```text
$ diff -q Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md \
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md"
(no output — identical)

$ diff -q Knowledge-Vault-ACTIVE/AI-Context/projects/run-chain/README.md \
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/projects/run-chain/README.md"
(no output — identical)

$ diff -q Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md \
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md"
(no output — identical)
```

## Protect-list check

```text
$ git diff --name-only HEAD -- \
  src/agents/synthesis-adapter-llm.ts \
  src/agents/hook-adapter-llm.ts \
  src/agents/boss-adapter-llm.ts \
  src/agents/run-chain.ts \
  scripts/run-chain.ts
(no output — clean)

$ test ! -d ~/.hermes/skills/cns/run-chain && echo OK
OK
```

## Cold-start path (AC #3 detail)

| Path | Action |
|------|--------|
| `AI-Context/MEMORY.md` (repo + canonical) | Added: `Run-chain SSOT: AI-Context/modules/run-chain.md (Epic 75 revival; dormant engine)` |
| `AI-Context/AGENTS.md` §7 | **Not edited** — defer to `/session-close` or Story **76-4** |
| `~/.hermes/memories/MEMORY.md` | Not symlinked to vault (`readlink -f` → self); vault MEMORY is SSOT per AC Preferred A |

## Files created / modified

| File | Action |
|------|--------|
| `Knowledge-Vault-ACTIVE/AI-Context/modules/run-chain.md` | NEW |
| `/mnt/c/.../AI-Context/modules/run-chain.md` | NEW (canonical sync) |
| `Knowledge-Vault-ACTIVE/AI-Context/projects/run-chain/README.md` | NEW |
| `/mnt/c/.../AI-Context/projects/run-chain/README.md` | NEW (canonical sync) |
| `Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md` | NEW (repo mirror) + Environment line |
| `/mnt/c/.../AI-Context/MEMORY.md` | UPDATE Environment line |

## Verify gate

```text
$ bash scripts/verify.sh
VERIFY PASSED
```
