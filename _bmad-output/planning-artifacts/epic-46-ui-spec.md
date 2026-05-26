# Epic 46 UI Spec — CNS Trend Intelligence: Layer 3 Interaction Surfaces
**Version:** 0.1 (pre-BMAD)  
**Date:** 2026-05-26  
**Author:** Research synthesis — Christopher Taylor + Claude Sonnet 4.6  
**Status:** Spec-ready. Use this to seed the Epic 46 PRD.

---

## 0. What This Document Is

This is the design contract for Epic 46: the full visual overhaul of the CNS Trend Intelligence dashboard, combining the ambient monitoring cockpit (Mode 1) with an investigation canvas (Mode 2). It defines layout zones, chart library assignments, interaction model, drawer system, Hermes integration points, and the visual system. It does not define stories — that's the BMAD PRD. It does define every interface decision the PRD stories will implement.

---

## 1. Design Direction: Intelligence Workstation

The product is not a KPI dashboard. It is a **personal intelligence workstation** — the kind of thing that lives in a second monitor, stays open while you work, and rewards both casual glances and deep dives.

The visual grammar is: **dark precision instrument**. Think a high-end audio mixing board, a Bloomberg terminal with good taste, a submarine sonar display if it were designed in 2026. Not black — graphite and slate. Not bright neons — one restrained accent family. Not a grid of equal-weight cards — clear hierarchy, one dominant view, supporting panels that breathe.

The three design tensions to resolve intentionally throughout:
1. **Ambient vs. Interactive** — the screen must be scannable at a glance AND rewarding to click into
2. **Dense vs. Spacious** — signal-dense panels with generous breathing room between them
3. **Automated vs. Interrogatable** — every computed score must feel explainable, not magic

---

## 2. Visual System

### 2.1 Color Palette

```css
/* Base surfaces — not pure black, graphite-slate family */
--surface-0:  #0d0f12;  /* page background */
--surface-1:  #13161b;  /* panel background */
--surface-2:  #1a1e26;  /* card/tile background */
--surface-3:  #222731;  /* hover state / active panel */
--surface-4:  #2c3240;  /* borders, dividers */

/* Text */
--text-primary:   #e8eaf0;  /* main reading text */
--text-secondary: #8b909e;  /* labels, metadata */
--text-muted:     #525866;  /* timestamps, disabled */

/* Accent — single family: electric teal-cyan */
--accent-primary:  #00c8aa;  /* primary interactive, lifecycle EMERGING */
--accent-glow:     #00c8aa33; /* glow/halo effect */
--accent-secondary: #0096d6; /* links, secondary CTAs */

/* Lifecycle stage colors — consistent across all charts */
--lifecycle-emerging:  #00c8aa;  /* teal */
--lifecycle-growing:   #3d9bff;  /* blue */
--lifecycle-peak:      #f5a623;  /* amber */
--lifecycle-declining: #e85d5d;  /* red */
--lifecycle-dormant:   #525866;  /* muted grey */

/* Signal states */
--anomaly-spike: #ff6b35;   /* orange — spike anomaly */
--anomaly-drop:  #7b61ff;   /* violet — drop anomaly */
--forecast-band: #00c8aa22; /* translucent teal for confidence band */

/* Risk traffic light */
--risk-low:    #2ecc71;
--risk-medium: #f5a623;
--risk-high:   #e85d5d;
```

### 2.2 Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Panel headers | `DM Mono` | 500 | 11px, all-caps, 0.1em letter-spacing |
| Chart labels, metadata | `DM Mono` | 400 | 10–11px |
| Body text, descriptions | `Inter` | 400 | 13–14px |
| Investment score display | `DM Mono` | 700 | 28–36px tabular-nums |
| Topic keyword chip | `Inter` | 600 | 12px |
| Lifecycle badge | `DM Mono` | 700 | 10px all-caps |

Rationale: `DM Mono` gives the instrument/terminal feel without feeling retro. `Inter` keeps prose readable. The monospace + sans-serif split separates data from commentary visually.

### 2.3 Spatial System

```
Panel padding:        20px all sides
Panel gap:            12px
Border radius:        6px (panels), 4px (chips/badges), 2px (chart elements)
Panel border:         1px solid var(--surface-4)
Drawer width:         380px (fixed)
Context pop-out:      320px wide, appears as overlay on chart
Header height:        48px
```

### 2.4 Motion Principles

- Panel load: `opacity 0→1, translateY 8px→0`, staggered 60ms per panel
- Drawer open/close: `translateX` slide, 220ms `cubic-bezier(0.4, 0, 0.2, 1)`
- Chart tooltip: instant appear, no animation (responsiveness > polish here)
- Lifecycle badge transition: cross-fade 300ms when stage changes
- Anomaly marker: pulse keyframe `0→1→0.6 opacity`, 2s loop while anomaly is active
- Score update: number counter animation, 600ms ease-out

---

## 3. Route Structure and Mode Switching

```
/                     → redirect to /trends
/trends               → Command Center (Mode 1) — default
/trends/canvas        → Research Canvas (Mode 2)
/trends/:topicId      → deep link to Command Center with topic pre-selected
```

Mode toggle sits in the top-right header, two tab-style buttons: `Monitor` and `Explore`. They share the same data layer (same Convex queries, same watchlist) — just different interaction postures.

---

## 4. Mode 1: Command Center

### 4.1 Layout Architecture

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: CNS Trend Intelligence  [Monitor] [Explore]  48px│
├──────────────────────────────────┬──────────────────────┤
│                                  │                      │
│  HERO ZONE                       │  TOPIC SIDEBAR       │
│  Primary trend timeline          │  240px fixed         │
│  (LayerChart multi-line)         │  Watchlist chips     │
│  ~400px tall                     │  Lifecycle badges    │
│                                  │  Investment scores   │
│                                  │                      │
├─────────────┬──────────┬─────────┤                      │
│ SCORE STRIP │ANOMALY   │FORECAST │                      │
│ (4 metric   │FEED      │PREVIEW  │                      │
│  tiles)     │          │         │                      │
│             │          │         │                      │
├─────────────┴──────────┴─────────┤                      │
│                                  │                      │
│  SIGNAL MAP                      │                      │
│  (ECharts scatter/heatmap)       │                      │
│  topic clustering + source heat  │                      │
│                                  │                      │
└──────────────────────────────────┴──────────────────────┘
                                   ↕ Context Drawer slides
                                     in from right (380px)
                                     over the sidebar
```

### 4.2 Hero Zone — Primary Trend Timeline

**Library:** LayerChart  
**Chart type:** Multi-line area chart with annotations  
**Data source:** `trendScores` + `signalEvents` for selected topics  

What it shows:
- One line per active watchlist topic (up to 5 by default, more via toggle)
- Y-axis: signal volume (normalized 0–100) or raw trend strength score
- Annotations: lifecycle stage transition markers as vertical lines with labels
- Anomaly markers: pulsing dots at detected anomaly timestamps
- Breakpoints: subtle dashed vertical line where slope changes significantly
- Hover crosshair: shows all topic values at that timestamp in a tooltip
- Selected topic: thickened line, others dim to 30% opacity

Interaction:
- Click a data point → opens Context Drawer anchored to that topic + timestamp
- Click a lifecycle transition marker → opens Context Drawer showing what changed
- Drag to zoom in on time range
- Double-click → reset zoom

Time range controls: `7D  30D  90D  ALL` pill tabs, top-right of the panel.

### 4.3 Topic Sidebar

**Library:** Svelte components only — no charting library  
**Width:** 240px fixed

Each topic chip contains:
```
┌──────────────────────────────┐
│ ● AI agent orchestration     │
│ EMERGING          0.83 ↑     │
│ ▓▓▓▓▓▓▓▓░░ risk: LOW        │
└──────────────────────────────┘
```
- Colored dot = lifecycle stage color
- Keyword text = topic name
- Badge = lifecycle stage in DM Mono all-caps
- Score = investment score 0.00–1.00, with trend arrow (↑↓→) from previous hour
- Risk bar = thin horizontal bar colored by overall_risk value
- Click → highlights that topic in hero chart AND opens Context Drawer

Active state: `--surface-3` background, left border `3px solid var(--accent-primary)`.

Hermes "investigate" button: on hover, a small `⚡` button appears at right edge. Click → sends Hermes Discord command to investigate the topic.

### 4.4 Score Strip

**Library:** Svelte components  
**Type:** 4 metric tiles in a horizontal strip

| Tile | Metric | How computed |
|---|---|---|
| Top Signal | Highest investment_score topic right now | Max of `trendScores.investmentScore` |
| Emerging Now | Count of topics in EMERGING stage | Filter `lifecycle_stage = EMERGING` |
| Active Anomalies | Count of anomalies in last 24h | Count from `trendAnomalies.detectedAt > now-24h` |
| Forecast Confidence | Avg rSquared of all active topics | Mean of `trendScores.rSquared` |

Each tile: large number in DM Mono 700, label below in DM Mono 400. On click → filter the hero chart to the relevant topic subset.

### 4.5 Anomaly Feed

**Library:** Svelte components (no chart)  
**Type:** Chronological event feed

Each anomaly entry:
```
14:32  AI agent orchestration
       SPIKE  +3.8σ  via Google Trends
       [Trace] [Compare] [Save]
```

- Direction badge: `SPIKE` (orange) or `DROP` (violet)
- Sigma distance: shows how many σ from mean
- Source label: which signal source triggered it
- Actions: `Trace` (open source breakdown in drawer), `Compare` (overlay this period vs prior week in drawer), `Save` (write to vault watchlist note via vault-io)

### 4.6 Forecast Preview

**Library:** LayerChart  
**Type:** Small multiples — one sparkline per topic with confidence band

Each sparkline: 120px wide, 60px tall, shows last 14 days + 14-day forecast. Confidence band as translucent fill. Forecast line dashed.

Click any sparkline → expands full forecast in Context Drawer.

### 4.7 Signal Map

**Library:** ECharts  
**Type:** Scatter plot OR heatmap calendar (toggle)

Scatter mode: X = trend strength, Y = investment score, bubble size = signal volume, color = lifecycle stage. Each bubble is a watchlist topic. Shows where topics cluster — you can see at a glance which topics are high-strength-high-investment (upper right), vs high-strength-declining (right side, orange/red).

Heatmap calendar mode: X = day, Y = hour of day, color intensity = signal volume for the selected topic. Reveals daily/weekly seasonality visually. Switch with a pill toggle: `Map  Calendar`.

---

## 5. Mode 2: Research Canvas

### 5.1 Layout Architecture

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: CNS Trend Intelligence  [Monitor] [Explore]    │
├──────────────────────────────────┬──────────────────────┤
│                                  │                      │
│  CANVAS ZONE                     │  INVESTIGATION       │
│  Topic cards, freeform layout    │  PANEL               │
│  not a grid — spatial            │  320px               │
│                                  │  (always visible     │
│  [+ Add topic]  [Save view]      │  in this mode)       │
│                                  │                      │
│  ┌─────────┐   ┌─────────┐      │  Selected topic or   │
│  │ Topic   │   │ Topic   │      │  cross-topic view    │
│  │ Card    │   │ Card    │      │                      │
│  └─────────┘   └─────────┘      │  Shows decomposed    │
│                                  │  trend, seasonality, │
│        ┌─────────┐              │  source breakdown,   │
│        │ Topic   │              │  Hermes actions      │
│        │ Card    │              │                      │
│        └─────────┘              │                      │
└──────────────────────────────────┴──────────────────────┘
```

### 5.2 Topic Card Anatomy

Each card: `--surface-2` background, 280px wide, drag-to-reposition.

```
┌────────────────────────────────┐
│ EMERGING          [⋮] [⚡] [×]  │  ← lifecycle badge, menu, hermes, dismiss
│                                │
│ AI agent orchestration         │  ← keyword, 16px Inter 600
│                                │
│ ████████░░  0.83               │  ← investment score bar + number
│                                │
│ [LayerChart sparkline 5-day]   │  ← 260px × 80px
│                                │
│ ⚠ Anomaly: +3.8σ 14:32 today  │  ← anomaly alert inline
│                                │
│ Sources: Google · News (3)     │  ← signal source pills
│                                │
│ Peak est. 4 days               │  ← days_to_peak from trendScores
└────────────────────────────────┘
```

Hover state: elevate with `box-shadow`, reveal "Compare" button at bottom.  
Click anywhere on card (not buttons): loads topic into Investigation Panel.  
Drag: reposition on canvas — position saved to Convex (new `canvasLayouts` table or localStorage alternative).

### 5.3 Investigation Panel

This is the always-visible right panel in Canvas mode. It shows the currently selected topic in full detail — the same information as the Context Drawer in Mode 1, but persistently laid out.

Panel sections (scrollable):
1. **Lifecycle history** — LayerChart step chart showing stage transitions over time
2. **Trend decomposition** — LayerChart three-pane chart: trend component, seasonal component, residual
3. **Forecast** — full 14-day forecast with confidence band
4. **Source breakdown** — ECharts stacked bar: signal volume by source over time
5. **Risk profile** — ECharts radar chart: volatility, decline, timing, platform risks on 5 axes
6. **Hermes actions** — contextual action surface (see Section 7)

---

## 6. Context Drawer System (Mode 1)

### 6.1 Trigger Model

The context drawer is Mode 1's equivalent of the Investigation Panel. It opens from the right, overlaying the topic sidebar (380px wide). One drawer is open at a time.

Triggers:
| User action | Drawer state |
|---|---|
| Click topic chip | Topic overview (lifecycle + investment + forecast sparkline + actions) |
| Click chart data point | Timestamp detail (all topic values at that moment + anomaly check) |
| Click anomaly feed entry | Anomaly detail (spike/drop timeline, source breakdown, comparison) |
| Click lifecycle transition marker | Stage change detail (what moved it, momentum context) |
| Click forecast sparkline | Full 14-day forecast + confidence breakdown |
| Click `Trace` on anomaly | Source trace (which sources triggered, signal volume by source, raw news headlines) |

### 6.2 Drawer Structure

```
┌───────────────────────────────────┐
│ [×]  AI agent orchestration  [⚡] │  ← close, topic name, hermes
│ GROWING · 0.78 ↑ · risk: LOW     │  ← status line
├───────────────────────────────────┤
│                                   │
│  [Context-specific content zone]  │
│  Varies by trigger type           │
│  ~300px tall                      │
│                                   │
├───────────────────────────────────┤
│  ACTIONS                          │
│  [Explain this]                   │
│  [Compare to last week]           │
│  [Trace source mentions]          │
│  [Summarise risk]                 │
│  [Save to watchlist note]         │
│  [Create alert]                   │
│  [Ask Hermes to investigate]      │
└───────────────────────────────────┘
```

### 6.3 Action Implementations

| Action label | Routes to | Mechanism |
|---|---|---|
| `Explain this` | Claude API (direct) | SvelteKit `+server.ts` route → Anthropic API streaming → rendered progressively in drawer |
| `Compare to last week` | Convex query | No bot — queries historical `signalEvents`, overlays prior 7-day window on hero chart |
| `Trace source mentions` | Convex query | No bot — queries `signalEvents` filtered by topicId + source breakdown |
| `Summarise risk` | Claude API (direct) | Same streaming pattern as Explain this, risk scores as context |
| `Save to watchlist note` | Hermes (#hermes) | POST to Discord webhook → Hermes vault-io skill writes/updates note in `02-Areas/` |
| `Create alert` | Convex only | Writes to `trendAlerts` table — no bot, no Discord |
| `Ask Hermes to investigate` | Hermes (#hermes) | POST to Discord webhook with structured skill-format command |

**Nexus is not wired into Epic 46.** It remains the manual deep-work surface for open-ended vault analysis. The dashboard's bot surface is Hermes exclusively.

---

## 7. Hermes Integration Points

### The Nexus/Hermes Distinction (Critical)

The system has two Discord-connected agents that are architecturally different. This distinction determines all Epic 46 routing decisions.

**Hermes** — GPT-5.5 via Codex OAuth, 91 skills, vault-io MCP (WriteGate enforced), cron-based. Fast, structured, always-on. Best for: repeatable skill invocations, vault writes, structured investigation commands.

**Nexus** — Claude Code running in tmux/WSL2, direct vault file system access, full Claude Code intelligence. Best for: open-ended deep analysis, complex multi-step vault work. Triggered manually by DM. Not wired into Epic 46.

**The call: Epic 46 dispatches to Hermes only.** Nexus remains the manual deep-work surface. It is too powerful and too fragile (machine/WSL/tmux dependent) to be triggered by a dashboard button. All dashboard bot actions go to #hermes via Discord webhook.

### The `⚡ Ask Hermes` Button

The button is labelled `Ask Hermes` (honest about which system it hits). Clicking it constructs a skill-formatted command matching Hermes's existing invocation conventions, not freeform text:

```
investigate-trend keyword: "AI agent orchestration"
  context: GROWING · score: 0.78 · anomaly: +3.8σ at 14:32
  request: trace sources, assess momentum, recommend watch/ignore
```

Response comes back in #hermes in Discord as normal. Epic 46 does **not** relay Discord responses back to the dashboard — that is a future epic.

### Alert creation

When a user clicks `Create alert` in the drawer, it writes to a `trendAlerts` Convex table:
```typescript
trendAlerts: defineTable({
  topicId: v.id("trendTopics"),
  keyword: v.string(),
  condition: v.union(
    v.literal("ANOMALY_SPIKE"),
    v.literal("ANOMALY_DROP"),
    v.literal("STAGE_CHANGE"),
    v.literal("SCORE_ABOVE"),
    v.literal("SCORE_BELOW")
  ),
  threshold: v.optional(v.number()),
  createdAt: v.number(),
  active: v.boolean(),
})
```
The alert evaluation logic runs inside the Epic 45 hourly analytics action. Alert delivery to Discord is Epic 47 scope.

---

## 8. Chart Library Assignments — Full Map

| Component | Library | Chart type | Why |
|---|---|---|---|
| Hero trend timeline | LayerChart | Multi-line area + annotations | Native Svelte reactivity, click events, custom annotation overlays |
| Topic sidebar sparklines | LayerChart | Mini line | Inline in Svelte component tree |
| Forecast sparklines (strip) | LayerChart | Line + confidence band | Same component as hero, scaled down |
| Lifecycle history (drawer/panel) | LayerChart | Step chart | Reactive to Convex query updates |
| Trend decomposition (drawer/panel) | LayerChart | 3-pane stacked charts | Composable layout via LayerCake framework |
| Full forecast (drawer/panel) | LayerChart | Line + confidence band fill | Same component |
| Signal map — scatter | ECharts | Scatter (bubble) | ECharts handles large point sets with zoom better |
| Signal map — heatmap calendar | ECharts | Heatmap | ECharts has a native calendar heatmap chart type |
| Source breakdown (drawer) | ECharts | Stacked bar | ECharts idiom, no custom code needed |
| Risk profile radar (panel) | ECharts | Radar | ECharts radar is the cleanest available option |
| Score strip tiles | Svelte only | Number display | No chart needed |
| Anomaly feed | Svelte only | Event list | No chart needed |
| Topic cards (canvas) | LayerChart (sparkline) + Svelte | Card + mini line | Svelte for layout, LayerChart for the inline chart |
| Investigation panel sections | Mix (see above) | — | Same components reused from drawer |

---

## 9. Watchlist Management UI

This was called out in the Epic 46 description. It lives in the topic sidebar's footer:

```
[+ Add keyword]  [Edit watchlist]
```

`+ Add keyword` → inline input field expands in sidebar, Enter to add.  
`Edit watchlist` → opens a modal (not a drawer): shows all 5 keywords, remove buttons, drag to reorder, save button.

When a keyword is added:
1. Convex mutation `addToWatchlist` adds to `watchlist` table
2. Triggers the hourly analytics action to run immediately for the new topic
3. Topic appears in sidebar with "Calculating..." placeholder until first scores arrive

---

## 10. Responsive Behaviour

The dashboard is designed for a **single operator on a desktop or large laptop**. It does not need to be fully mobile-responsive. It does need to not break below 1200px.

At 1200px: sidebar collapses to icon-only mode (shows just the lifecycle color dot and investment score number, no text). Tooltip on hover reveals the full chip.  
At <1000px: show a "best viewed on desktop" message. No further optimization needed.

---

## 11. State Management

All real-time data flows through **Convex reactive queries** — no polling, no manual refresh. The SvelteKit components subscribe to:

```typescript
// Active in both modes
const topics = useQuery(api.trends.getTrendTopics)
const scores = useQuery(api.trends.getLatestScores)
const anomalies = useQuery(api.trends.getRecentAnomalies, { hours: 24 })

// On topic selection
const selectedTopicHistory = useQuery(
  api.trends.getTopicSignalHistory,
  { topicId: selectedId, days: 30 }
)
const selectedForecast = useQuery(
  api.trends.getTopicForecast,
  { topicId: selectedId }
)
```

Selected topic ID is a Svelte store (`$selectedTopicId`). Changing it triggers all drawer/panel queries to update automatically via Convex reactivity.

---

## 12. Open Decisions — All Resolved

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| 1 | Normalize vs raw values in hero chart | **Normalize by default, raw as toggle** | Different sources aren't comparable; raw still useful for expert inspection |
| 2 | Canvas card position persistence | **Explicit save via "Save view" button; debounced autosave for session resilience** | Autosaving every drag is noisy; intentional saves for permanent layouts |
| 3 | Claude API streaming | **Yes — SvelteKit `+server.ts` route with ReadableStream** | Well-supported on Vercel; confirm deployment protection allows the route in preview |
| 4 | Alert delivery in Epic 46 | **Store in Convex only** — Discord delivery is Epic 47 | Correct scope boundary |
| 5 | Topic compare interaction | **Click-to-compare first** — select topic A, click Compare, pick topic B | More discoverable than drag-to-compare; add drag as enhancement later |
| 6 | Watchlist cap | **8 default, expandable to 12** | 5–8 is visual sweet spot for hero chart; 10+ gets noisy |
| 7 | Nexus vs Hermes in dashboard | **Hermes only** — Nexus not wired into Epic 46 | Hermes is structured, always-on, correct for skill-format dispatch |
| 8 | ECharts SSR | **Client-only wrapper via `onMount` / dynamic import** — explicitly scoped in story AC | Known SvelteKit pattern; write the wrapper story from day one |
| 9 | LayerChart lifecycle annotations | **Verify annotation API before locking Story 46-3 AC** — use chart-relative shapes | LayerChart releases reference this; confirm ergonomics for vertical markers |

---

## 13. What This Spec Enables

After this spec, the BMAD PRD for Epic 46 can define stories cleanly against concrete deliverables:

- **Story 46-1:** Visual system implementation (CSS custom properties, typography, layout tokens)
- **Story 46-2:** Command Center layout shell + topic sidebar
- **Story 46-3:** Hero trend timeline (LayerChart multi-line + annotations)
- **Story 46-4:** Score strip + anomaly feed
- **Story 46-5:** Context drawer system (shell + trigger model)
- **Story 46-6:** Drawer actions — vault save, alert create, Hermes send
- **Story 46-7:** "Explain this" + "Summarise risk" via Claude API streaming
- **Story 46-8:** Signal map (ECharts scatter + heatmap calendar)
- **Story 46-9:** Research Canvas mode — topic cards + canvas layout
- **Story 46-10:** Investigation panel — decomposition + risk radar
- **Story 46-11:** Watchlist management UI
- **Story 46-12:** Forecast panel (full 14-day with confidence band)

---

*End of Epic 46 UI Spec v0.1. Feed into BMAD `bmad-create-prd` as primary context.*
