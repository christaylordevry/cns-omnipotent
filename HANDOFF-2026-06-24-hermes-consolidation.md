# HANDOFF — Hermes Consolidation & JARVIS Presence (2026-06-24)

**For:** a fresh Claude Code session (Sonnet 4.6) continuing this initiative.
**Role you're continuing:** strategic checker/verifier alongside the operator (Chris), who runs BMAD workflows in **Cursor**. You verify Cursor's outputs against the locked plan, check diffs against the protect-list, and advise next steps. You do NOT run the BMAD story workflows yourself — Cursor does.

---

## 1. What this is
Make **Hermes the single always-on intelligence layer ("JARVIS")** on **one provider (Nous Portal)**, integrated with the Nexus/CNS dashboard — without breaking anything already built. Full plan is on disk and committed:

- **PRD:** `_bmad-output/planning-artifacts/prd-hermes-consolidation.md`
- **Architecture (8 ADRs):** `_bmad-output/planning-artifacts/architecture-hermes-consolidation.md`
- **Epics/stories (29 across Epics 74–78):** `_bmad-output/planning-artifacts/epics-hermes-consolidation.md`
- **Vision diagram:** `_bmad-output/planning-artifacts/architecture-vision.md`
- **Readiness report:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-06-24.md`
- **Source research:** `docs/CNSHermes New Big Plan/` (8 verified research docs)

**Read the PRD + epics first.** They are the SSOT and are internally consistent.

---

## 2. Where we are RIGHT NOW
- Branch: **`hermes-consolidation`** (off master). 3–4 clean commits.
- **Story 74-1 (Brain embedder audit) = DONE & committed.** Verified: Brain uses `StubEmbedder` only (SHA-256, offline, no API keys) → Portal switch can't break it. NFR3 gate cleared.
- **Pre-1 fixture fix = DONE** (committed) → `verify.sh` is now fully green (1324/1324 + vitest + dashboard + python + skill gate). The old "7 session-close failures" waiver no longer applies.
- **NEXT: Story 74-2** (Portal OAuth login + provider switch). Not started.

---

## 3. The single most important live-system finding
**Hermes currently has NO working provider** — config resolves to `provider: none`, no key (confirmed in `~/.hermes/logs/errors.log`). Hermes is offline for all LLM tasks right now. This is why:
- `/session-close` (Pre-2) **cannot run** until Portal is configured → deferred to **story 76-1** (post-Portal). Do NOT try to run session-close before Epic 74.
- Epic 74 (Portal) is the keystone that brings Hermes back online.

---

## 4. Locked decisions — DO NOT re-litigate
- **Topology (a) [ADR-HERMES-001]:** Conversational + voice JARVIS lives on **Hermes Desktop/Discord** (local→WSL). The Vercel cockpit **cannot reach** WSL Hermes (`127.0.0.1:9119`), so `/nexus` gets **data-awareness (FR12) + async "ask Hermes" box** — NOT an embedded chat pane (that's D3, dev/tunnel opt-in only).
- **FR11 = Option A (operator-approved):** keep one `ANTHROPIC_API_KEY` for run-chain Synthesis/Hook/Boss; **zero edits to the engine**. No Boss rewrite.
- **FR13 = Option (ii):** dashboard explain/summarise-risk go async via `hermes-dispatch`; lowest priority; NOT in Epic 77 MVP.
- **FR12 mechanism:** least-privilege Convex HTTP read endpoint (`/hermes/awareness`) for pull + Convex→Discord webhook for push v1. NO tunnel. NO full Convex MCP at runtime.
- **Dashboard auth = Nous OAuth** (`hermes dashboard register`) primary, basic-auth fallback only.
- **Dashboard redesign = DEFERRED** to its own future epic (parked in `deferred-work.md`). Not in scope now.

## 5. PROTECT-LIST — these files must NOT be edited (verify every diff)
```
src/agents/synthesis-adapter-llm.ts
src/agents/hook-adapter-llm.ts
src/agents/boss-adapter-llm.ts
src/agents/run-chain.ts
scripts/run-chain.ts
```
Also untouched: the **NEXUS Discord–Obsidian bridge** (`~/ai-factory/projects/NEXUS`, separate Claude-Code-in-tmux bot), Discord gateway, morning-digest cron, Brain index.

---

## 6. Spend / sequencing
- **Free Portal tier can't carry Epic 74** (inference-only, $0.10). The **$30 paid tier** satisfies FR-GATE (hosted Tool Gateway = voice/TTS/web-search). **Upgrade timed to story 74-2, not before** (avoid idle subscription burn; monthly cycle).
- Build sequence: 74-1 ✅ → (Pre-1 ✅) → **74-2 (subscribe here)** → rest of 74 → 75 ∥ 76 (session-close via 76-1) → 77 → 78.
- First Portal-dependent story is 74-2; everything before it (74-1, doc stories) needs no Portal.

---

## 7. Immediate next action
1. Operator subscribes to Nous Portal $30 tier; confirms Tool Gateway listed.
2. Fresh Cursor chat → `/bmad-create-story` for **74-2** (Portal OAuth + provider switch).
3. When Cursor returns the story/implementation, **verify**: protect-list untouched, FR-GATE confirmation recorded as AC, NFR5 openai-codex fallback documented, `verify.sh` green, model = `anthropic/claude-sonnet-4.6`.

## 8. Working style the operator expects
- Verify Cursor's claims independently (read the actual code/diffs via Bash/Read — don't rubber-stamp). This caught real bugs all session (wrong adapter paths, auth contradiction, etc.).
- Give a clear recommendation + a paste-ready message for Cursor at each gate.
- Commit hygiene: explicit paths (avoid the pre-existing `scripts/`/`.agents/` whitespace churn), logical commits, branch off master, co-author trailer.
- Be concise and decisive; the operator moves fast.
