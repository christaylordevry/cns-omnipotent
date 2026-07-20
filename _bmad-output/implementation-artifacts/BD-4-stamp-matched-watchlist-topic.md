---
story_id: BD-4
epic: cns-redesign
title: stamp-matched-watchlist-topic-on-digest-signal
status: done
created: 2026-07-20
operator_brief: 2026-07-20
predecessors: 64-1, 69-2
blocks: Obj-2.3, scenario-03.2-trends-crossing
design_gate: APPROVED_WITH_EDITS_2026-07-20
baseline_commit: 819ab43
---

# Story BD-4: Stamp matched watchlist topic onto digest signals

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created.
     Design gate APPROVED WITH EDITS 2026-07-20 — proceed to implementation. -->

## Story

As a **CNS operator digging a Nexus signal and deepening into Trends**,
I want **each scored digest signal to optionally carry the watchlist `topicSlug` that drove its relevance match**,
so that **Obj 2.3 (Nexus → Trends deepen without context reset) has a real data path — not a fuzzy title heuristic**.

## Review Gate — APPROVED WITH EDITS (2026-07-20)

### (a) Field name and type — **APPROVED**

| Decision | Value |
|----------|-------|
| **Field** | `topicSlug` |
| **Type** | `v.optional(v.string())` |
| **Where** | Top-level on `digestSignalInputValidator`, `digestSignalRowValidator`, `digestSignalListItemValidator` |
| **Not** | Convex `Id<'trendTopics'>` / `Id<'watchlist'>` — scorer stays ID-unaware |
| **Not** | Nested under `sourceMetadata` — join key, not provenance |

### (b) Multi-match tie-break — **APPROVED**

`resolveWatchlistMatch(signal, domainKeywords)` (mirror `resolvePeopleMatch`):

1. Tokenize signal once: `tokenizeSignalText(title, summary)`.
2. For **each** domain keyword, compute `f1Score(signalTokens, tokenizeForScoring(keyword))`.
3. Keep candidates with F1 **> 0**.
4. Pick **single best**: highest F1 → longer `normalizeTerm` keyword → earliest YAML index.
5. No candidate → **omit** `topicSlug`.

### (c) Normalization / slug rule — **APPROVED** (+ AC8 round-trip)

```
normalizeTerm(keyword)     = trim → lower → collapse whitespace
slugFromKeyword(keyword)   = trim → lower → [^a-z0-9]+ → '-' → collapse '-' → strip edges
                             → truncate to TOPIC_SLUG_MAX_LEN (80)  // C9
```

**Stamp value:** kebab `topicSlug`, not space-normalized term.

**Dual-impl drift flag:** `slugFromKeyword` will exist in Hermes scorer (JS) and Convex (`trendIntelligence.ts`). They can drift silently. **Mitigation required:** shared case-list parity test asserting identical output across both implementations (or extract shared module). Call out which situation is true in Dev Agent Record on implement.

### (d) Prove `rankScore` unchanged — **APPROVED**

Relevance is bag-of-tokens F1; BD-4 **adds** best-keyword resolve for stamp only. Golden-fixture deep-equal on `{ scores, rankScore, disposition, rank }`; leave `scoreRelevance` / `RANK_WEIGHT_*` / `computeRankScore` untouched.

### Accepted consequence — no backfill

Signals already in Convex have no `topicSlug` and stay unlinked. Scenario 03.2 degrade path covers them. **Do NOT backfill.**

---

## Context

| Topic | Detail |
|-------|--------|
| **Why** | CNS redesign Obj 2.3 blocked — verified 2026-07-19 in grounding-verdict |
| **Repos** | Cross-repo, **strict order**: Phase A `cns-dashboard` (`cns-redesign` branch) **deploy first**, then Phase B Omnipotent.md + `~/.hermes` |
| **Blocks** | Scenario 03.2 Trends Crossing; full Obj 2.3 |
| **Does not block** | Investigate → Verdict (03.1 → 03.4) degradation path |
| **Out of scope** | Nexus→Trends UI link; any `rankScore`/weight changes; per-case evidence canvas (deferred-work.md 2026-07-19); replacing `getPriorDigestSignalsForTopic` heuristics |

### Problem (verified)

1. `digestSignalRowValidator` has **no** topic/slug field (`cns-dashboard/convex/validators.ts`).
2. Signal↔topic is **inferred** via `findBestSignalForTopic` title/focus heuristic (`digest.ts` ~54-156, `getPriorDigestSignalsForTopic` ~355).
3. No Nexus→Trends UI link exists.
4. Scorer relevance is bag F1; keyword identity never retained (unlike `peopleMatch`).

### Production-safety ordering (non-negotiable)

Convex `v.object` **rejects unknown fields**. If Phase B ships before Phase A is **deployed**, every `addDigestSignal` with `topicSlug` fails → morning digest push breaks.

```
Phase A (dashboard) → deploy to Convex prod → confirm addDigestSignal accepts optional topicSlug
Phase B (scorer + dual-copy sync) → only then
```

Push script already spreads `{ ...signal, digestRunId }` — once validators accept the field, push needs no allowlist change (verify with test; dual-copy still required if any touch).

## Acceptance Criteria

### AC1 — Phase order + schema (Phase A)

**Given** Phase A is implemented on `cns-dashboard` branch `cns-redesign`
**When** `addDigestSignal` receives a signal with optional `topicSlug: "ai-agents"`
**Then** insert succeeds and the field is stored and returned by `getDigestSignalsForRun` / `getDigestSignalById`
**And** a signal **without** `topicSlug` still succeeds (legacy / unmatched)
**And** Phase B is **not** merged/deployed until Phase A is live on the Convex deployment the morning digest hits

### AC2 — Matched signal stamps slug end-to-end (Phase B)

**Given** a signal whose best watchlist keyword is e.g. `"AI agents"`
**When** `score-digest-signals.mjs` runs then `push-digest-convex.mjs` pushes
**Then** `addDigestSignal` args include `topicSlug: "ai-agents"` (C9 slug)
**And** the value is the **best** match per (b), not first-in-list

### AC3 — Unmatched signal omits field (Phase B)

**Given** a signal with no watchlist keyword F1 > 0 (or watchlist missing → relevance degraded path)
**When** score + push run
**Then** `topicSlug` is **absent** (not `null` / `""`)
**And** push succeeds with no Convex validation error

### AC4 — rankScore byte-identical (Phase B)

**Given** a fixed input fixture set
**When** scoring runs after BD-4
**Then** per-signal `scores.*`, `rankScore`, `disposition`, and sort `rank` match the pre-change golden baseline
**And** `RANK_WEIGHT_*` and `computeRankScore` are untouched

### AC5 — Dual-copy identity (Phase B)

**Given** repo SSOT under `scripts/hermes-skill-examples/morning-digest/scripts/`
**When** Phase B completes
**Then** `cmp -s` (or `diff`) shows repo ↔ `~/.hermes/skills/cns/morning-digest/scripts/` copies of `score-digest-signals.mjs` and `push-digest-convex.mjs` are **byte-identical**
**And** install via `bash scripts/install-hermes-skill-morning-digest.sh` (rsync) is the sync path

### AC6 — Tests

**Given** existing patterns in `tests/morning-digest-*.test.mjs` and `cns-dashboard/tests/convex/digest.test.ts`
**When** story completes
**Then** coverage includes: optional accept/omit (Convex); best-match + tie-break; slug fixtures (`AI agents` → `ai-agents`); golden rankScore regression; push passthrough of `topicSlug`; dual-copy or install-gate still green

### AC7 — Verify gate

**Given** both repos touched
**When** `bash scripts/verify.sh` runs from Omnipotent.md (with sibling dashboard present)
**Then** it passes

### AC8 — Round-trip resolve (not generation-only)

**Given** stamped `topicSlug` values produced from real watchlist terms (and edge fixtures)
**When** the dashboard resolves via `trendTopics.by_topicSlug` (or equivalent index lookup used by Trends)
**Then** each stamped slug **round-trips** to an existing `trendTopic` row (or watchlist row that seeds the same slug) — not merely “looks like a slug”
**And** fixtures cover: multi-word, punctuation, mixed case, **>80 chars (truncation boundary)**, and any non-ASCII currently in `~/.hermes/trend-watchlist.yaml`
**And** a shared case-list parity test proves Hermes JS `slugFromKeyword` and Convex `slugFromKeyword` produce **identical** outputs (guards silent join breakage)

### AC9 — No backfill

**Given** historical `digestSignals` rows without `topicSlug`
**When** BD-4 ships
**Then** those rows remain without the field (unlinked; 03.2 degrade path)
**And** no migration/backfill job runs

## Tasks / Subtasks

### Phase A — cns-dashboard (`cns-redesign`) — SHIP/DEPLOY FIRST

- [x] **A1** Validators (AC: 1, 6)
  - [x] Add `topicSlug: v.optional(v.string())` to `digestSignalInputValidator`, `digestSignalRowValidator`, `digestSignalListItemValidator` in `convex/validators.ts`
  - [x] Schema follows row validator — no hand schema field list; **do not** add `by_topicSlug` index unless a query needs it (crossing does not)
- [x] **A2** Mappers (AC: 1)
  - [x] Extend `toDigestSignalListItem` in `convex/digest.ts` (~87-124)
  - [x] Extend duplicate mapper in `convex/hermesAwareness.ts` (~44-81) — keep in sync
  - [x] `addDigestSignal` / `rescoreDigestRun` already insert/patch validator-shaped objects — confirm no strip
- [x] **A3** Convex tests (AC: 1, 6, 8)
  - [x] `tests/convex/digest.test.ts`: accept with slug; omit without; list mapper returns field; round-trip via `by_topicSlug`
  - [x] `tests/convex/topic-slug.test.ts` + shared `topic-slug-parity-cases.json`
- [x] **A4** Deploy gate (AC: 1)
  - [x] Deployed Convex prod `amiable-ox-862` (digest target) 2026-07-20
  - [x] Schema push succeeded; live mutation smoke blocked by Convex free-plan limit (ops — not validator reject)
  - [x] Phase B proceeded after deploy confirmation

### Phase B — Omnipotent.md + `~/.hermes` — ONLY AFTER A4

- [x] **B1** Context retains keywords (AC: 2, 4)
  - [x] `loadScoringContext`: keep `domainKeywords: string[]` alongside existing `domainTokens` (do not change token bag construction)
- [x] **B2** `resolveWatchlistMatch` + `slugFromKeyword` port (AC: 2, 3, 8)
  - [x] Implement per (b)+(c); export for unit tests
  - [x] Stamp in `scoreDigestSignals` next to `peopleMatch`: set `out.topicSlug` only on match
- [x] **B3** Push dual-copy (AC: 2, 5)
  - [x] Confirm spread already forwards (no allowlist strip)
  - [x] Repo SSOT + `install-hermes-skill-morning-digest.sh`; `cmp` both scripts exit 0
- [x] **B4** Tests (AC: 2–6, 8)
  - [x] `tests/morning-digest-score-signals.test.mjs`: match/omit/tie-break/slug + golden rankScore
  - [x] `tests/morning-digest-push-convex.test.mjs`: topicSlug passthrough + omit
  - [x] `tests/bd-4-topic-slug-parity.test.mjs`: Hermes vs Convex SSOT cases
- [x] **B5** `bash scripts/verify.sh` (AC: 7) — PASSED 2026-07-20

### Review Findings

- [x] [Review][Patch] Replace the false-positive-prone watchlist matcher with watchlist-corpus IDF weighting, a minimum-confidence floor, and ambiguous-tie omission [scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs:396] — Decision 2026-07-20: compute IDF over the watchlist keyword corpus, bias weak or tied evidence toward omission, and add a quality regression proving `langchain-ai/langchain` does not resolve to `biotech-ai`.
- [x] [Review][Patch] Clear inherited `topicSlug` when rescoring produces no match [scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs:1781]
- [x] [Review][Patch] Respect `CNS_DASHBOARD_ROOT` in the cross-repo parity test [tests/bd-4-topic-slug-parity.test.mjs:23]

## Dev Notes

### Architecture compliance

- Pattern precedent: **64-1** optional digestSignal fields; **69-2** `peopleMatch` stamp in `scoreDigestSignals`.
- Scorer must **not** call Convex or know topic IDs.
- Dashboard later resolves `topicSlug` → topic via `trendTopics.by_topicSlug` / watchlist (UI story — out of scope).
- Do **not** change `getPriorDigestSignalsForTopic` in this story (optional future: prefer stamped slug).

### Files to touch

| Repo | Path | Action |
|------|------|--------|
| cns-dashboard | `convex/validators.ts` | ADD optional `topicSlug` |
| cns-dashboard | `convex/digest.ts` | UPDATE list mapper |
| cns-dashboard | `convex/hermesAwareness.ts` | UPDATE duplicate mapper |
| cns-dashboard | `tests/convex/digest.test.ts` | ADD cases |
| Omnipotent.md | `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | ADD match+stamp; dual-copy |
| Omnipotent.md | `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` | VERIFY passthrough; dual-copy if touched |
| Omnipotent.md | `tests/morning-digest-score-signals.test.mjs` | ADD |
| Omnipotent.md | `tests/morning-digest-push-convex.test.mjs` / pipeline test | ADD |
| runtime | `~/.hermes/skills/cns/morning-digest/scripts/*.mjs` | SYNC via install — never edit alone |

### UPDATE files — current state (must preserve)

**`scoreRelevance`:** bag F1 vs `domainTokens`; missing watchlist → 25. **Preserve byte-identical score outputs.**

**`scoreDigestSignals`:** spreads original signal; adds scores/disposition/rankScore; optional peopleMatch + normalizedEngagement; sorts by rankScore. **Add optional topicSlug only.**

**`addDigestSignal`:** validates via `digestSignalInputValidator`, inserts as-is. **Must accept new optional field after A1.**

**`toDigestSignalListItem`:** explicit destructure — **will silently drop `topicSlug` if not updated.**

### Anti-patterns (do not)

- Ship Phase B before Phase A deploy
- Store Convex IDs in Hermes output
- Change relevance to max-per-keyword F1 “to align” with stamp (breaks AC4)
- Stamp first YAML match on multi-hit
- Stamp `normalizeTerm` space-form instead of kebab slug
- Edit only `~/.hermes` copy
- Build Nexus→Trends UI in this story
- Invent `certainty` / `status_reason` or other prohibited vault fields (N/A here but constitution still applies to any note writes)

### References

- [Source: `cns-dashboard/_bmad-output/C-UX-Scenarios/03-eric-dig-and-deepen/grounding-verdict.md` — BD-4]
- [Source: `cns-dashboard/_bmad-output/C-UX-Scenarios/03-eric-dig-and-deepen/3.2-trends-crossing/3.2-trends-crossing.md`]
- [Source: `cns-dashboard/_bmad-output/C-UX-Scenarios/00-ux-scenarios.md` — BD table]
- [Source: `_bmad-output/implementation-artifacts/64-1-digest-signals-schema-extension.md` — optional field pattern]
- [Source: `cns-dashboard/convex/trendIntelligence.ts` — `slugFromKeyword`]
- [Source: `cns-dashboard/convex/keywordCandidates.ts:6-8` — `normalizeTerm`]
- [Source: `scripts/trend-ingest.py:121-128` — C9 `topic_slug`]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — relevance + peopleMatch]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — per-case canvas deferred 2026-07-19]
- Deferred-work: no WriteGate / vault_log_action / security.md impact — **no operator constitution approval required for vault mutators**

### Project context

- Cross-repo verify: Omnipotent `scripts/verify.sh` runs sibling `cns-dashboard` tests when present (`CNS_DASHBOARD_ROOT`).
- Branch: dashboard work on `cns-redesign`; Omnipotent Phase B on current Hermes/digest working branch after A deploy.
- Dual-copy: install gate + `cmp` is an AC, not a nice-to-have.

## Previous story intelligence

### From 64-1 (schema extension)

- Optional fields on input **and** row validators; read mapper must list every new field or it disappears from queries.
- Push already passthrough-spreads — tests must assert the new key on `addDigestSignal` args.
- Legacy rows without the field must remain readable.

### From 69-2 (peopleMatch)

- Stamp pattern lives in `scoreDigestSignals` after score computation.
- Identity fields go on the signal (or `sourceMetadata` for provenance); BD-4 uses **top-level** `topicSlug` per Review Gate (a).

## Git intelligence

Recent Omnipotent work is session-close / Epic 58 docs — not digest scoring. Recent dashboard work is on `cns-redesign` (WDS redesign docs). Treat **64-1 / morning-digest test files** as the pattern SSOT, not the latest unrelated commits.

## Latest tech notes

- Convex validators: unknown keys rejected — drives Phase A-before-B.
- No new npm/pip packages. Port `slugFromKeyword` in pure JS inside the scorer.
- Context7 not required (no new library API).

## Story completion status

- Design gate **APPROVED WITH EDITS** 2026-07-20; implementation complete.
- Status → **done** after adversarial review patches and verify PASS.

## Change Log

- 2026-07-20: Phase A optional `topicSlug` on digestSignal validators/mappers; Convex prod deploy; Phase B `resolveWatchlistMatch` stamp; dual-copy sync; AC4 golden + AC8 parity/round-trip tests; verify PASS.
- 2026-07-20: Code review fixed false-positive matching with watchlist-corpus IDF confidence, a 50% floor, ambiguous-leader omission, stale-slug clearing, and portable dashboard-root test resolution; full verify PASS.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Pre-stamp golden capture for AC4 fixture (runAt `1750000000000`)
- Convex prod deploy to `amiable-ox-862`; live mutation smoke blocked by free-plan limit
- Restored corrupted live vault `note-style-guide.md` from specs SSOT to unblock 87-2 parity gate (unrelated to BD-4)

### Completion Notes List

- **Dual-impl situation (AC8):** Hermes `slugFromKeyword` in `score-digest-signals.mjs` and Convex `convex/lib/topicSlug.ts` are separate copies (cannot share runtime). Shared case SSOT: `cns-dashboard/convex/lib/topic-slug-parity-cases.json`. Parity proven by Hermes matching SSOT + Convex vitest matching same SSOT (`tests/bd-4-topic-slug-parity.test.mjs`).
- **Truncation:** Convex `slugFromKeyword` now applies C9 `TOPIC_SLUG_MAX_LEN=80` (was unbounded); watchlist keywords today are short.
- **No backfill** of historical signals.
- rankScore golden deep-equal passed; `scoreRelevance` / weights / `computeRankScore` untouched.
- Dual-copy `cmp` exit 0 for score + push scripts after install.
- Code review replaced raw F1 matching with watchlist-corpus IDF confidence, a 50% floor, and ambiguous-leader omission; the live `langchain-ai/langchain` false-positive fixture now resolves to no topic.
- Rescoring now removes inherited stale `topicSlug` values when no current match exists; cross-repo parity tests honor `CNS_DASHBOARD_ROOT`.

### File List

**cns-dashboard**
- `convex/validators.ts`
- `convex/digest.ts`
- `convex/hermesAwareness.ts`
- `convex/trendIntelligence.ts` (import shared slug helper)
- `convex/lib/topicSlug.ts` (new)
- `convex/lib/topic-slug-parity-cases.json` (new)
- `tests/convex/digest.test.ts`
- `tests/convex/topic-slug.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/_progress/00-design-log.md`

**Omnipotent.md**
- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `tests/morning-digest-score-signals.test.mjs`
- `tests/morning-digest-push-convex.test.mjs`
- `tests/bd-4-topic-slug-parity.test.mjs` (new)
- `_bmad-output/implementation-artifacts/BD-4-stamp-matched-watchlist-topic.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**runtime (via install)**
- `~/.hermes/skills/cns/morning-digest/scripts/score-digest-signals.mjs`
- `~/.hermes/skills/cns/morning-digest/scripts/push-digest-convex.mjs` (unchanged content; re-synced)
---

## ✅ POST-IMPLEMENTATION REVIEW FINDING (2026-07-19/20) — RESOLVED 2026-07-20

**Status: BD-4 mechanically VERIFIED end-to-end; match-quality defect fixed during code review.**
`resolveWatchlistMatch` now uses watchlist-corpus IDF weighting, requires 50% weighted keyword coverage, and omits equal-confidence leaders. A regression fixture proves `langchain-ai/langchain` does not resolve to `biotech-ai`.

### Runtime verification — PASSED (closes the previously-open AC)
First live push after Phase B, digest run `2026-07-20` (`md7795tcr4xk9x1c6ej5qm4d658awnh1`),
recovered via `run-push-digest-watchdog-cron.sh` once the Convex plan block was cleared:
- 50 signals returned by `digest:getDigestSignalsForRun`.
- `topicSlug` present in the returned shape; **20 carry a slug, 30 omit it** — correct
  behaviour for an optional field (most signals legitimately match nothing).
- Slugs correctly kebab-cased (`ai-agents`, `mcp-protocol`, `llm-infrastructure`).
- **Scorer → push → Convex accept → query return: CONFIRMED.** The open runtime AC is closed.

### 🔴 DEFECT — false-positive topic matches (must fix before the crossing ships)
Observed on the same live run:

| Stamped slug | Actual signal |
|---|---|
| `biotech-ai` | `langchain-ai/langchain` |
| `biotech-ai` | "AI advice made people less accurate but more confident" |
| `knowledge-management-software` | "@hosseeb @deanwball Soooo, releasing Linux was dumping?" |
| `knowledge-management-software` | "@thedillona … The fact that training is ex…" |

Distribution: **`biotech-ai` (6) + `knowledge-management-software` (5) = 11 of 20 stamps.**

### Root cause (confirmed, deterministic)
`~/.hermes/trend-watchlist.yaml` contains 14 keywords; **6 contain the token "AI"**
(`AI agents`, `AI coding tools`, `AI marketing tools`, `biotech AI`, `AI funding rounds`,
`design to code AI`) and 2 contain "software".

1. A signal containing only the common token **"ai"** scores an *identical* F1 against all
   six AI-keywords — the token carries almost no discriminating power in this corpus.
2. Approved tie-break rule #3 is **"longer normalized keyword wins."**
3. `biotech ai` (10 chars) therefore beats `ai agents` (9 chars) — every generic AI signal
   deterministically routes to `biotech-ai`.
4. Same mechanism sends "software"/"management" hits to `knowledge management software`
   (29 chars — the longest keyword in the list).

**The two longest keywords have become garbage magnets.** The real culprit is the
threshold, not the tie-break: the approved rule was *"No F1 > 0 → omit"*, so **any single
shared common word produces a stamp**, and the length tie-break then concentrates those
false positives.

### Why this is BLOCKING rather than cosmetic
**For the Obj 2.3 Trends crossing, a WRONG topic link is worse than NO link.** A missing
link hits the honest designed degrade path ("No linked topic — resolve here"). A wrong link
sends the operator to an unrelated topic — the thread snaps *silently while appearing to
work*, which is precisely the failure Obj 2.3 exists to prevent.

This is also a **green-tests / wrong-behaviour** defect: every AC passed (field lands,
scores byte-identical, slug round-trips) because none of them asserted the slugs were
*correct*.

### Required fixes — completed in code review
1. **Raise the match threshold.** `F1 > 0` is far too permissive. Require meaningful
   overlap; tune against the 2026-07-20 run (50 signals) as a fixture.
2. **Down-weight non-discriminating tokens** — IDF-style weighting or a domain stopword
   list. "ai" in 6/14 keywords is the primary offender.
3. **Reconsider the length tie-break.** It actively concentrates false positives into long
   keywords. On a weak-evidence tie, **omit rather than guess** — bias hard toward no-link.
4. **Add a match-QUALITY fixture** (not just a mechanism test), e.g. assert
   `langchain-ai/langchain` does NOT resolve to `biotech-ai`. Mechanism tests cannot catch
   this class.

### Unrelated items surfaced during the same verification (log separately, not BD-4)
- **Silent-failure bug:** `push-digest-watchdog` logged
  `action=completion-convex-push-failed … signalsWritten:0` with **`exit=0`**. A push that
  writes zero signals must exit non-zero / alert; this is why a full day of missing data
  went unnoticed.
- **Convex free-plan outage (resolved):** deployments were disabled, blocking digest push,
  dashboard-sync, internal-dev-state and awareness-pull. Billing cleared; `2026-07-20`
  backfilled successfully. No data lost (local artifacts intact).
- **Vault `note-style-guide.md` corruption:** restored from the specs SSOT during this story
  and verified byte-identical (all 12 modules match). **Root cause of the corruption is
  still unknown** — worth its own investigation.
