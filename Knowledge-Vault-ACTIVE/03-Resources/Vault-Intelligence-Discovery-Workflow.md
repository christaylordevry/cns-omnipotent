---
pake_id: 3f8a2d1c-7e4b-4f9a-b2c5-1d6e8f0a3b4c
pake_type: SourceNote
title: "Vault Intelligence Discovery Workflow"
created: 2026-04-05
modified: 2026-04-05
status: stable
confidence_score: 1.0
verification_status: verified
creation_method: ai
tags:
  - workflow
  - notebooklm
  - strategic-discovery
  - reusable
  - meta
---

# Vault Intelligence Discovery Workflow

> [!note] What this is
> A reusable workflow for surfacing strategic intelligence from any knowledge base **X** about any topic or decision **Y**. Use this any time you feel "cloudy" about direction, want to audit what you've built, or need an outside perspective on your own thinking.

---

## When to use this workflow

- You have accumulated a lot of notes, research, or documents on **X** (a system, a project, a domain)
- You need clarity on **Y** (next steps, gaps, what to build, what to prioritize)
- You feel like the answer is somewhere in your notes but you can't see it from inside
- You are at a phase boundary and need to decide what comes next
- You want to audit your own thinking for blind spots

---

## The workflow

### Phase 1 — Export your knowledge base

**What X is:** The knowledge base you want to analyze. Could be your vault, a project folder, a set of research notes, a client's documents, anything.

**Step 1.1 — Compile X into a single document**

If X is your Obsidian vault:
```bash
bash scripts/export-vault-for-notebooklm.sh
cp scripts/output/vault-export-for-notebooklm.md \
  "/mnt/c/Users/Christopher Taylor/Downloads/vault-export-for-notebooklm.md"
```

If X is a different folder or document set, create a compilation script that:
- Concatenates all relevant files into one markdown document
- Adds a header with date and file count
- Excludes irrelevant infrastructure files (logs, schemas, build artifacts)

**What you get:** A single flat document containing everything you know about X.

---

### Phase 2 — Create a dedicated NotebookLM notebook

**Step 2.1 — Go to notebooklm.google.com**

Create a new notebook. Name it descriptively:
```
[X] Intelligence — [Y] Discovery
```

Example: `Vault Intelligence — Phase 3 Discovery`
Example: `Client Research — Pricing Strategy Discovery`
Example: `Lead-Gen Market — Niche Selection Discovery`

**Step 2.2 — Upload the compiled document**

Click Add source → Upload file → select your compiled document. Wait for processing (usually 1-2 minutes).

**Step 2.3 — Configure the chat before asking anything**

Click the chat settings icon → Custom → paste this system prompt, replacing X and Y:

```
You are analyzing [X — describe what the knowledge base is and who created it].
These notes represent [describe: research / projects / systems / thinking].
Respond as a strategic advisor who has read everything in full.
Be direct, specific, and cite note titles or topics when making claims.
No generic advice. Surface what is actually in the notes, including things
that are started but unfinished, patterns the person may not see themselves,
and concrete next actions grounded in what already exists.
The goal is to surface intelligence about [Y — the decision or direction needed].
Longer responses preferred.
```

Set response length to **Longer**. Save.

---

### Phase 3 — Run the five discovery questions

Ask these one at a time. Wait for the full response before asking the next. Do not rush.

**Question 1 — Recurring themes**
```
What recurring themes or problems appear across these notes?
What does this person keep coming back to?
```

**Question 2 — Unfinished threads**
```
What projects or ideas are mentioned but never fully developed or completed?
What has been started but stalled?
```

**Question 3 — Underleveraged assets**
```
What capabilities or systems have been built that aren't being fully leveraged yet?
What exists that could be doing more work?
```

**Question 4 — Unresolved tensions**
```
What are the biggest unresolved tensions or open questions across all of this?
Where is the thinking in conflict with itself?
```

**Question 5 — What to do next**
```
Based on everything in these notes, what should this person build or focus on next?
What is the most important thing that isn't happening yet?
```

---

### Phase 4 — Synthesize with a human advisor

**Step 4.1 — Paste all five responses into a conversation with Claude (or equivalent)**

Do not try to synthesize the responses yourself. Paste them raw and let Claude:
- Strip hallucinated facts (things NotebookLM invented that aren't real)
- Identify the signal vs. the noise
- Find the pattern across all five answers
- Reframe the findings into a clear strategic picture

**Step 4.2 — Apply the hallucination filter**

NotebookLM sometimes extrapolates from research notes into fabricated active systems. Before acting on any finding, ask yourself:
- Did I actually build this, or did I just research it?
- Is this a real project or a note I wrote speculatively?
- Does this match what I know to be true about my situation?

Flag anything that doesn't match reality. Discard it.

**Step 4.3 — Identify the three real outputs**

From the synthesis, extract exactly three things:
1. **The most embarrassing gap** — something that should already be done and has no dependencies
2. **The highest leverage next build** — the thing that unlocks the most other things
3. **The genuine open question** — something that needs a decision before anything else can move

---

### Phase 5 — Convert to action

**Step 5.1 — Name the direction**

Write one sentence: "Based on this analysis, the next phase is [name] and it focuses on [what]."

**Step 5.2 — Decide the structure**

Choose one:
- **Sequential** — do the embarrassing gap first, then the highest leverage build
- **Parallel with lanes** — run the no-dependency gap in parallel with planning the next build
- **Discovery sprint first** — if the open question blocks everything else, resolve it before committing to a direction

**Step 5.3 — Feed back into your system**

If you have a BMAD-style planning system:
- Create a sprint change proposal capturing the new direction
- Run bmad-create-prd or bmad-correct-course if scope has shifted significantly
- Add the new epics to epics.md and sprint-status.yaml
- Start story creation for the first epic

If you don't have a formal system:
- Write a one-page direction document capturing the three outputs from Step 4.3
- Create a simple task list with the next three concrete actions
- Set a review date

---

## Reuse guide

| Variable | Replace with |
|----------|-------------|
| X | The knowledge base you are analyzing (vault, project folder, client docs, research notes) |
| Y | The decision or direction you need clarity on (next phase, product direction, strategy, priorities) |
| The export script | Whatever compiles X into a single flat document |
| The notebook name | `[X] Intelligence — [Y] Discovery` |
| The system prompt | Adjust the description of X and the goal Y |

---

## Why this works

The core insight is that your own thinking, accumulated over time in notes and documents, contains the answer to most strategic questions you face. The problem is not lack of information — it is lack of synthesis. You are too close to the material to see the patterns.

NotebookLM acts as a reader who has absorbed everything without any of your emotional attachment to the work. The five questions are designed to extract:
- What you keep returning to (real priorities)
- What you started but avoided finishing (fear or dependency)
- What you built but aren't using (leverage gap)
- Where your thinking contradicts itself (unresolved decisions)
- What the material itself says to do next (the answer you already have)

Claude then acts as the filter and synthesizer, removing hallucinated facts and translating the raw intelligence into a structured strategic picture you can act on.

The workflow takes 45-90 minutes end to end and is repeatable for any domain where you have accumulated knowledge.

---

## Version history

| Date | Version | What changed | Trigger |
|------|---------|-------------|---------|
| 2026-04-05 | 1.0 | Initial documentation | Phase 3 discovery session |
