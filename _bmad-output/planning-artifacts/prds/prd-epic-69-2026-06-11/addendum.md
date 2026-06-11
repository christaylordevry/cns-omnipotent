# Addendum — Epic 69 Nexus Intelligence UI

Technical detail for architecture and story authors. Not normative product language — see `prd.md` FRs.

---

## A1 — Canonical 12-source registry (UI + health panel)

Morning-digest task-prompt sources mapped to dashboard display keys:

| # | Task-prompt source | `digestSourceTypeValue` / section | Health badge label |
|---|-------------------|-----------------------------------|--------------------|
| 1 | Google Trends | *(keywordCandidates — not digestSignal)* | Google Trends |
| 2 | NewsAPI | `newsapi` / `headlines` | NewsAPI |
| 3 | Perplexity | `deep_signal` / `deep_signal` | Perplexity |
| 4 | arXiv | `arxiv` / `arxiv` | arXiv |
| 5 | HackerNews | `hackernews` / `hackernews` | HackerNews |
| 6 | Notebook pick / §9 push | *(orchestration — not a sourceType)* | Notebook |
| 7 | GitHub | `github` / `github` | GitHub |
| 8 | Reddit | `reddit` / `reddit` | Reddit |
| 9 | RSS | `rss` / `rss` | RSS |
| 10 | Product Hunt | `producthunt` / `producthunt` | Product Hunt |
| 11 | X / Twitter | `twitter` / `twitter` | X |
| 12 | Bluesky | `bluesky` / `bluesky` | Bluesky |

**Health inference without push metadata (fallback):**

- `fired`: ≥1 `digestSignal` with matching `sourceType`, OR appears in any `contributingSources[].sourceType` on that run
- `unknown`: no metadata and no signals (ambiguous — treat as muted/warning in UI)

**Preferred (FR-5):** `digestRuns.sourceOutcomes[]` pushed from completion hook:

```typescript
type SourceOutcome = {
  sourceKey: string; // e.g. "newsapi", "twitter"
  status: 'fired' | 'unavailable' | 'error';
  signalCount?: number;
  reason?: string; // e.g. "X credentials not configured"
};
```

Push path: extend `run-digest-convex-completion.mjs` or `push-digest-convex.mjs` to parse task-prompt section headers / `(source unavailable: …)` markers from artifact. **Not a new adapter** — completion metadata only.

---

## A2 — Dedup cluster inspector UI

When `sourceMetadata.dedupClusterSize >= 2`:

```
┌─ Merged signal (3 sources) ─────────────┐
│ [HN] [NewsAPI] [X]  ← source badges      │
│ HN 842 pts · NewsAPI — · X 1.2k likes     │
│ Primary: hackernews                       │
└──────────────────────────────────────────┘
```

- Primary `sourceType` on row = winner from dedup engine
- Each `contributingSources[]` entry: badge + best engagement metric (`points`, `stars`, `likes`, etc.)
- Hide section when `dedupClusterSize` absent or `< 2`
- Reuse `sourceDisplayLabel()` from `trend-panel-format.ts`

---

## A3 — People match metadata (push-side, optional 69-2 gate)

Scoring (`score-digest-signals.mjs`) when handle bonus applies:

```json
"sourceMetadata": {
  "authorHandle": "karpathy",
  "peopleMatch": {
    "personName": "Andrej Karpathy",
    "matchedHandle": "karpathy",
    "bonusPoints": 20,
    "matchType": "handle"
  }
}
```

Name match (+10):

```json
"peopleMatch": {
  "personName": "Dario Amodei",
  "matchType": "name",
  "bonusPoints": 10
}
```

Extend `sourceMetadataValidator` in cns-dashboard. UI reads `peopleMatch` — no server-side people file on Vercel.

**Fallback UI (if push metadata deferred):** show `authorHandle` + chip "Watchlist boost likely" when `personalRelevance >= 20` and handle present — no person name.

---

## A4 — Disposition visual hierarchy spec

Reuse `dispositionColour()` from `nexus-inspector-scoring.ts`:

| Disposition | Colour | Feed treatment |
|-------------|--------|----------------|
| `priority` | `#00D4AA` | Pinned top section; left border 3px; elevated card shadow |
| `escalate` | `#EF4444` | Second pin group; border accent |
| `watch` | `#F59E0B` | Standard card; disposition badge |
| `ignore` | `#6B7280` | Collapsed "Low priority" accordion default closed on mobile |

Sort within tier: `rankScore` desc (query already sorts).

Mobile: max 5 visible in priority tier before "Show all priority"; full list scrollable.

---

## A5 — Investigation board schema (Screen 10)

New table `investigationBoardItems`:

```typescript
investigationBoardItems: defineTable({
  digestSignalId: v.id('digestSignals'),
  digestRunId: v.id('digestRuns'),
  column: v.union(
    v.literal('triage'),
    v.literal('investigating'),
    v.literal('waiting'),
    v.literal('resolved')
  ),
  note: v.optional(v.string()),
  addedAt: v.number(),
  updatedAt: v.number(),
  workspaceId: v.optional(v.string())
})
  .index('by_column_updated', ['column', 'updatedAt'])
  .index('by_signal', ['digestSignalId'])
```

- "Add to investigation" from inspector or digest feed card
- Board at `/nexus/investigate` (new route) — kanban columns
- Link to latest `investigationSessions` for that signal (Explain/Compare/etc.)
- Persist across sessions via Convex — not localStorage

**Out of v1 board scope:** multi-user assignment, drag between workspaces, Hermes webhook triggers.

---

## A6 — Story dependency graph

```
69-4 (feed + disposition) ──┬──► 69-1 (inspector dedup) — uses same signal row types
69-3 (source health query) ─┘    69-2 (people match) — inspector only
69-5 (Screen 10) — independent; uses digestSignalId from feed/inspector
```

Suggested sprint: `69-4` → `69-1` ∥ `69-3` → `69-2` → `69-5`

---

## A7 — Mobile breakpoints

- Inspector drawer: full-width overlay below `768px` (existing pattern)
- Source health panel: horizontal scroll chip row on mobile
- Investigation board: single-column stacked columns with tabs, or horizontal swipe between columns `[ASSUMPTION: tabbed mobile kanban]`
