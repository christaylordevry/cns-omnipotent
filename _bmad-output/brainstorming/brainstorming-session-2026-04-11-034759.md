---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - specs/cns-vault-contract/CNS-Phase-1-Spec.md (Phase 2 Preview)
  - docs/001 Central Nervous System.md (aspirational stack)
session_topic: "Which Phase 2+ CNS pieces to adopt first after Phase 1"
session_goals: "Produce a wide option space, surface trade-offs, and converge on a defensible adoption order aligned with the vault constitution and implementation repo scope"
selected_approach: progressive-flow
techniques_used:
  - What If Scenarios (expansive)
  - Cross-Pollination (expansive)
  - Morphological Analysis (pattern)
  - Six Thinking Hats (development)
  - Decision Tree Mapping (action)
ideas_generated: 108
context_file: ""
session_mode: consolidated-async
session_active: false
workflow_completed: true
facilitation_notes: "Single-turn delivery per operator request; progressive flow executed without live halts. Ideas exceed 100 with explicit domain pivots every 10 ideas."
---

# Brainstorming Session Results

**Facilitator:** Chris (operator) with AI facilitation  
**Date:** 2026-04-11 (session file timestamp UTC)

## Session mode

This session was run as a **consolidated async** full pass: setup, divergent ideation (100+ items), and organization are captured in one artifact because the operator asked for a complete brainstorming outcome in a single message. The BMAD step files normally pause for `[C]` / menu choices; those checkpoints are **documented as satisfied** for this run.

---

## Session Overview

**Topic:** Prioritization and sequencing of **Phase 2 and beyond** capabilities for the CNS (Central Nervous System), given Phase 1’s vault contract, `AGENTS.md`, and Vault IO MCP as the governed spine.

**Goals:**

- Maximize **useful breadth** before convergence (quantity unlocks non-obvious ordering).
- Respect **spec boundaries**: Phase 2 preview items vs Phase 3 deferrals (`pgvector`, daemon, multi-model).
- Output an **adoption stack** the operator can defend to future-you and to tooling choices.

### Context guidance (loaded)

Normative Phase 2 preview (`CNS-Phase-1-Spec.md` §8): **Nexus dual-path** (already modeled), **NotebookLM ingestion**, **Obsidian Bases**, **Mobile** (Blink Shell + tmux + Tailscale). Deferred beyond that preview: vector index, NotebookLM as full product epic, daemon, mobile as broad surface, etc., per spec tables.

Aspirational doc `docs/001 Central Nervous System.md` adds **Archon/Supabase RAG**, **Mem0/Open Memory**, generic **Obsidian MCP** emphasis; treated here as **idea seeds**, not repo authority.

### Session setup

- **Constraint:** Single-operator system; dual-path Nexus + Vault IO is already accepted architecture (`docs/architecture.md`).
- **Success definition:** A ranked “adopt first” list with **dependencies**, **failure modes**, and **kill criteria** so you can stop or reorder without sunk-cost fallacy.

---

## Technique selection

**Approach:** Progressive technique flow (BMAD `step-02d`)

| Journey phase | Technique | Role in this session |
|---------------|-----------|----------------------|
| Expansive | What If Scenarios | Remove scope guardrails temporarily to see hidden priorities |
| Expansive | Cross-Pollination | Borrow patterns from DevOps, PKM, compliance, gaming |
| Pattern | Morphological Analysis | Grid: capability × dependency × risk |
| Development | Six Thinking Hats | Force benefits/risks/gut on shortlist |
| Action | Decision Tree Mapping | First fork: operator value vs foundation strength |

**Journey rationale:** Ordering Phase 2+ work is a **sequencing under dependency and risk** problem; progressive flow avoids picking “coolest RAG” before “triage surfaces that eat daily pain.”

---

## Technique execution results

### Phase 1: Expansive exploration (raw ideas 1–108)

*Anti-bias protocol: domain pivot every 10 ideas (technical → UX → business → edge cases → collaboration → “wild” → security → knowledge quality → velocity → moonshots).*

#### Detailed anchors (sample of full IDEA FORMAT)

**[T1]**: Nexus Hardening First  
_Concept:_ Treat Nexus not as new capability but as **operational maturity**: runbooks, style-guide prompts, optional `pake_type` on generated notes, and manifest alignment with `AGENTS.md`.  
_Novelty:_ “Phase 2” without new code paths; reduces drift risk between write surfaces.

**[T2]**: NotebookLM Ingestion Before Any Vector DB  
_Concept:_ Pipe cited synthesis into PAKE-shaped notes under governed templates so **human-readable vault stays canonical**; embeddings come later.  
_Novelty:_ Inverts the Archon-first story from generic omnipotence docs.

**[T3]**: Obsidian Bases as Control Plane  
_Concept:_ `.base` views for Inbox triage, project status, and source-ingestion queues so the **operator’s daily loop** lives in Obsidian UI, not only in MCP.  
_Novelty:_ Phase 2 spec-native and UI-first; pairs poorly if vault is mostly non-Obsidian consumers.

**[T4]**: Mobile Shell Path First  
_Concept:_ Blink + tmux + Tailscale to the same machine that runs Vault IO or repo; **read-heavy** workflows before mobile writes.  
_Novelty:_ Defers iOS Git clients and Working Copy complexity until remote session is boringly reliable.

**[T5]**: “Thin” Vector Search (No Archon)  
_Concept:_ Local sqlite-vss or small embedding index **only on `03-Resources/`** with explicit opt-in paths, not whole-vault semantic soup.  
_Novelty:_ Staged RAG that respects progressive disclosure in `AGENTS.md` routing.

**[T6]**: Mem0 as Scratchpad, Vault as Law  
_Concept:_ Use Open Memory only for **session handoff summaries**, never as authoritative store; nightly compaction into vault via WorkflowNote.  
_Novelty:_ Avoids two sources of truth while still answering “what did Claude Desktop know yesterday?”

**[T7]**: Kill Archon Entirely for Year One  
_Concept:_ Stay MCP + grep + `vault_search` + disciplined folders; accept slower “omnipotence.”  
_Novelty:_ Contrarian cost cutter; good if research volume is low.

**[T8]**: Compliance-First Audit on Nexus Path  
_Concept:_ If any future client needs Nexus in scope of MCP audit trail, **stop** and implement shared PAKE validation library (escape hatch already documented).  
_Novelty:_ Chooses pain now to avoid architectural lie later.

---

#### Compact idea inventory (36–108) — remaining quantity pass

36. Second brain: treat `DailyNotes` as the only append surface for agents on mobile.  
37. Automate `_meta/logs` rotation via human-run playbook only (no new daemon).  
38. Phase 2 story: `vault_import_notebooklm_export` as single mutator with WriteGate.  
39. Use Bases formulas for confidence_score dashboards.  
40. Wikilink repair bot: scheduled human-triggered job, not cron daemon.  
41. Add `CNS_VAULT_DEFAULT_SEARCH_SCOPE` presets per project in `.env.local`.  
42. Voice capture → Inbox → triage Base view.  
43. PDF ingestion as SourceNote only, never auto-SynthesisNote.  
44. CLI wrapper that validates frontmatter before `git commit`.  
45. Pre-commit hook: secret scan on staged markdown (extends Vault IO philosophy).  
46. Git LFS for large attachments; keep markdown in plain Git.  
47. Submodule for external repos: **reject** to avoid boundary hell.  
48. Monorepo: keep implementation repo separate forever (already chosen).  
49. Publish read-only vault mirror for CI fixtures (already partial pattern).  
50. **Multi-operator:** abandon until shared PAKE library; idea bank only.  

51. Stakeholder hat: “consulting client” only sees `03-Resources/` exports.  
52. Red-team: attacker who can prompt agent to exfiltrate vault via MCP.  
53. Yellow hat: Bases make triage **emotionally** easier (less doom-scrolling).  
54. Green hat: combine NotebookLM + Bases in one “research sprint” UI flow.  
55. Black hat: Tailscale misconfig exposes tmux session.  
56. White hat: Phase 1 verify gate already exists; any Phase 2 needs new gate story.  
57. Blue hat: schedule quarterly “deferral table review” ritual.  
58. Alien anthropologist: “why do humans duplicate AGENTS in two folders?” → symlink politics.  
59. Dream fusion: “omnipotent agent” → reverse-engineer to **one** extra MCP tool max.  
60. Zombie apocalypse: only Git + `vault_read` work; plan for that subset.  

61. Encrypt vault at rest on disk (OS-level) before cloud Git.  
62. YubiKey for Git signing on WSL.  
63. Separate “experiment vault” fork for RAG spills.  
64. Tag notes with `adoption_candidate: p2` in frontmatter for search-driven roadmap.  
65. BMAD story: “Bases panel parity with constitution tables.”  
66. Ralph loop for ingestion only (no autonomous execution).  
67. Discord as read-only notification channel before write expansion.  
68. Rate-limit NotebookLM calls in module policy.  
69. Cost cap: $0/month stack until revenue event (forces creativity).  
70. Cost uncapped: managed Pinecone + hosted workers (explicitly deferred vibe).  

71. Quality: mandatory `verification_status` on SynthesisNote from LM.  
72. Quality: dual human + AI `creation_method` on ingested notes.  
73. Knowledge: shard large research into insight chains not one file.  
74. Knowledge: “related notes” Base column driven by wikilink graph.  
75. Knowledge: periodic orphan link report via `vault_search`.  
76. UX: one-keystroke “triage next Inbox note” in Obsidian.  
77. UX: color tags for Phase 2 experiments vs production notes.  
78. UX: hide `_meta` from graph view to reduce noise.  
79. UX: mobile read list synced via Git branch `mobile-queue`.  
80. Velocity: ship Bases for Inbox only (smallest `.base` scope).  

81. Moonshot: realtime collaborative editing in vault (conflict nightmare).  
82. Moonshot: federated multi-vault routing in AGENTS.  
83. Moonshot: on-device SLM for local classify-before-ingest.  
84. Moonshot: automatic weekly “constitution diff” PR from vault to repo mirror.  
85. Moonshot: plugin marketplace for MCP tools inside CNS package.  
86. Moonshot: semantic move suggestions (`vault_move` AI assist) with human approve.  
87. Moonshot: cross-notebook LM research merged into one SynthesisNote DAG.  
88. Moonshot: gamified triage streaks in Bases.  
89. Moonshot: autonomous nightly “digest agent” (OpenClaw-adjacent; Phase 3).  
90. Moonshot: multi-model consensus on high-stakes edits (Phase 3).  

91. Tie-break criterion: **minimizes new moving parts**.  
92. Tie-break: **maximizes daily minutes saved** for Chris.  
93. Tie-break: **maximizes spec alignment** (constitution growth by one module).  
94. Tie-break: **best demo to future collaborators** (even if single-operator today).  
95. Tie-break: **lowest regret if abandoned in 6 weeks**.  
96. Tie-break: **testability** in `scripts/verify.sh` worldview.  
97. Tie-break: **reversibility** (feature flags in modules not constitution).  
98. Tie-break: **dependency on Google** (NotebookLM) acceptable or not.  
99. Tie-break: **dependency on Apple TestFlight / Blink** friction budget.  
100. Tie-break: **WSL-only** constraint honored.  
101. If Phase 1 Epic 6 incomplete: **no Phase 2 code** until verify green.  
102. If Obsidian not daily driver: **deprioritize Bases**.  
103. If research is PDF-heavy: **raise ingestion priority** over Bases.  
104. If mobile capture is pain: **raise Tailscale mobile** over RAG.  
105. If IDE time dominates: **raise MCP ergonomics** over Obsidian UI.  
106. If trust boundary widens: **raise audit/Nexus convergence** research spike.  
107. “Do nothing” Phase 2: only use Vault IO better for 30 days (serious option).  
108. Revisit this list after **first production NotebookLM export** lands in vault (measurable trigger).

---

### Earlier compact block (ideas 1–35) — same session, first quantity wave

1. Ship **Obsidian Bases** for `00-Inbox/` triage before any cloud RAG.  
2. Ship **NotebookLM ingestion** module before Bases if research backlog hurts more than triage.  
3. **Mobile read-only** SSH first; writes stay IDE-only until Phase 2 hardens.  
4. **Nexus prompt tweak** for `pake_type` as zero-code win.  
5. **NotebookLM → InsightNote** landing only (no auto-promotion to Synthesis).  
6. **Bases for `01-Projects/`** burn-down board keyed off `status`.  
7. **Bases for `_meta/logs`** human dashboard (read-only queries).  
8. **Tailscale ACL** documented before Blink becomes habit.  
9. **tmux resilience**: session restore docs before mobile reliance.  
10. **Defer Archon** until 500+ long notes or repeated “cannot find” failures.  

11. Operator training: 15-minute weekly “triage ritual” beats new tech.  
12. Replace “manifest.md” idea with **strengthen Section 8** in AGENTS (already exists).  
13. Add **visual folder colors** in Obsidian purely for human UX.  
14. **Customer-facing** export pack from vault for consulting deliverables.  
15. **Billing timer** Base (off-topic but tests Bases skill).  
16. **Health metrics** Base: notes created/week, inbox depth.  
17. **“Parking lot” Base** mirroring constitution parking lot.  
18. **Satisficing** rule: pick one Phase 2 pillar per quarter.  
19. **OKR** in vault for Phase 2 selection transparency.  
20. **Pre-mortem**: “We adopted RAG first and stopped trusting vault.”  

21. Legal: client data residency forbids some LM vendors; branch ingestion policy.  
22. Business: sell “CNS-in-a-box” only after Phase 1 verify story is folklore.  
23. Business: internal ROI sheet for time saved vs tool cost.  
24. Risk: NotebookLM ToS change kills pipeline; keep markdown export canonical.  
25. Risk: Supabase bill creep; cap row growth.  
26. Risk: agent writes bad Synthesis at scale; rate limits in module.  
27. Risk: mobile typo corruption; no mobile writes initially.  
28. Risk: obsession with tooling over note quality.  
29. Opportunity: Bases as **agent-readable** structured index (careful: not second constitution).  
30. Opportunity: LM for **contrarian review** pass on WorkflowNotes only.  

31. Edge: merge conflicts in `agent-log.md`; educate rebasing.  
32. Edge: case-sensitive paths WSL vs Windows remote editing.  
33. Edge: large binary accidentally committed; Git LFS policy.  
34. Edge: symlink escape already mitigated in Vault IO; re-audit for Phase 2 mutators.  
35. Edge: two devices edit same daily note; append-only contract stress test.  

---

## Idea organization and prioritization

### Thematic clusters

| Theme | Ideas (examples) | Pattern insight |
|------|------------------|-----------------|
| **Spec-native Phase 2** | 1, 2, 5, 6, 7, 38, 65, 80 | Directly extends Phase 1 without new “truth stores” |
| **Operator ergonomics** | 11–20, 76–80, 107 | Cheap wins vs new infrastructure |
| **Mobile / remote** | 3, 4, 8, 9, 79, 99 | Depends on network + session discipline |
| **RAG / embeddings** | 5, 10, 39, 85–87 | High power, high entropy; fights progressive disclosure if done whole-vault |
| **Cross-session memory (Mem0-class)** | 6, 40, 88 | Risk of split-brain unless vault remains judge |
| **Nexus / governance** | 1, 4, 8, 50, 55, 106 | Mostly documentation and optional schema alignment |
| **Quality & PAKE** | 71–75, 27, 29 | Enables safe scale-up of ingestion |
| **Kill / defer** | 7, 10, 101, 107 | Valid “adopt first” answer is adopt nothing new |

### Cross-cutting breakthrough concepts

- **Ingestion before retrieval:** Canonical markdown + citations first; vectors are acceleration, not foundation.  
- **Bases as force multiplier for triage:** Turns constitution routing into something you *see* daily.  
- **Mobile as read-first client:** Writes through Vault IO on a trusted host preserves guarantees.  
- **“One new mutator at a time” rule:** Phase 2 implementation stays shippable and testable.

---

## Prioritized adoption stacks (choose one framing)

### Stack A — **Spec fidelity first** (recommended default)

Order:

1. **Close Phase 1 hard** (Epic 6 / `scripts/verify.sh` green). Idea **101**.  
2. **Nexus + dual-path hygiene** (prompts, manifests, optional `pake_type`). Ideas **1, 4, 52**.  
3. **Obsidian Bases: Inbox triage panel** smallest scope. Ideas **1, 6, 80**.  
4. **NotebookLM ingestion module** (export → PAKE notes, cited). Ideas **2, 5, 38, 72**.  
5. **Mobile read path** (Tailscale + Blink + tmux docs). Ideas **3, 4, 8, 9**.  
6. **Targeted retrieval** (thin local index OR vendor RAG) only after pain threshold. Ideas **5, 10, 39**.  
7. **Mem0-class handoff** only if cross-tool amnesia is measured pain. Ideas **6, 40**.  
8. **Heavy RAG (Archon-class)** last or never unless vault scale demands. Ideas **7, 10, 82**.

**Why:** Matches `CNS-Phase-1-Spec.md` Phase 2 preview ordering spirit: strengthen surfaces you already named, avoid new authoritative stores early.

### Stack B — **Research pain first**

1. Phase 1 verify green.  
2. **NotebookLM ingestion** (cited pipeline).  
3. **Bases for research queue** in `03-Resources/`.  
4. Thin vector search on Resources only.  
5. Mobile read.  
6. Bases Inbox.  

**When to pick B:** PDFs and long research streams already block shipping; triage is “fine enough.”

### Stack C — **Mobile capture first**

1. Phase 1 verify green.  
2. Tailscale + Blink **read**.  
3. Capture → **Inbox only** via shortest path (may be non-MCP).  
4. Bases Inbox triage.  
5. NotebookLM.  
6. RAG last.  

**When to pick C:** You are away from desk often and ideas die on phone.

---

## Action planning (next 14 days)

| Step | Action | Success indicator |
|------|--------|-------------------|
| 1 | Declare **Stack A, B, or C** explicitly in `AGENTS.md` Section 8 or a WorkflowNote | You can read it in 10 seconds six months from now |
| 2 | If Stack A: scaffold **one** `.base` for `00-Inbox/` fields you already use | Daily triage without folder hopping |
| 3 | Draft **NotebookLM → vault** acceptance rules (pake_type, `source`, confidence) before any code | First imported note is unambiguously valid PAKE |
| 4 | If mobile interest: document **Tailscale ACL + tmux** in existing operator doc, no new services | One successful remote read session from phone |
| 5 | Schedule **trigger review** (idea **108**) after first real LM export | Decision on whether to deepen ingestion vs pivot |

---

## Session summary

- **108** directional ideas generated with forced domain pivots.  
- **Three adoption stacks** provided so you do not confuse “default spec order” with “your current pain order.”  
- Highest-leverage **generic** first move: finish Phase 1 verify, then **either** Bases Inbox **or** NotebookLM ingestion as first *new* surface, based on whether **triage** or **research ingestion** hurts more this month.

**Creative strengths observed in the problem framing:** You already separated **implementation repo** vs **vault** and accepted **dual-path writes**; that maturity means Phase 2 sequencing should optimize for **low split-brain risk**, not novelty.

---

## Files and paths

- Session artifact: `_bmad-output/brainstorming/brainstorming-session-2026-04-11-034759.md`  
- Authoritative deferrals: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` (§2 deferred table, §8 Phase 2 preview)  
- Architecture context: `docs/architecture.md`
