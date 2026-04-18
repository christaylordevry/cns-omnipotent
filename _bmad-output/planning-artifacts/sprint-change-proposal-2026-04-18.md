---
title: "Sprint Change Proposal — Tier 1 Agency Product Stack"
date: 2026-04-18
status: draft
source: bmad-correct-course
related:
  - "[[Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md]]"
---

# Sprint Change Proposal — Tier 1 Agency Product Stack

**Project:** CNS (Chris Taylor)  
**Mode assumed:** Batch (full proposal in one document; refine per item if you prefer incremental).  
**Output language:** English  

---

## Section 1: Issue Summary

### Problem statement

Phase 4 work (Tier 1 MCP, ingest pipeline) was framed as infrastructure verification and a draft ingest spec. The **agency product** intent is now explicit: a ordered Tier 1 stack (research acquisition, synthesis, and vault persistence) plus **downstream product** (automated ingest, specialized agent chain, answer filing). The **sprint-status** file stops at **epic-15** and does not yet track Phase 4 agency work, so backlog and handoff are unclear.

### Context and discovery

- **AGENTS.md** v1.9.0 already encodes Tier 1 MCP in Section 7, Phase 4 in Section 8, and a **partial** Perplexity routing line in Section 9.
- **CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md** exists as a draft and aligns with items 4–5 at a high level; it needs extension for **00-Inbox/** processing, PAKE types, master index updates, and **wiki-ingest** mapping.
- **Nexus** loads the same constitution via `CLAUDE.md` → `AGENTS.md`; explicit “Nexus uses the same Tier 1 routing rules” reduces ambiguity.

### Evidence

- Operator-provided Tier 1 list (items 1–6) with sequencing and CNS vs config-only boundaries.
- [Firecrawl MCP README](https://github.com/mendableai/firecrawl-mcp-server): package **`firecrawl-mcp`**, env **`FIRECRAWL_API_KEY`**, example `npx -y firecrawl-mcp`.

---

## Section 2: Impact Analysis

### Epic impact

| Area | Effect |
|------|--------|
| **Epics 1–15** | No retroactive change; all marked done. |
| **Phase 4 / Tier 1 (new tracking)** | Treat as **new epic slice** (recommended: **epic-16** in `sprint-status.yaml`) or a named **Phase 4** epic with sub-stories. |
| **Agency product (items 5–6)** | Not covered by existing epics; **new stories** (and possibly **epic-17** for “content research pipeline + answer filing”) if you want clean separation from Vault IO ingest. |

### Story impact

| Item | CNS story? | Notes |
|------|------------|------|
| 1 Firecrawl MCP | No | Operator config: `claude mcp add --scope user firecrawl -- npx -y firecrawl-mcp` plus `FIRECRAWL_API_KEY`; mirror in Cursor `~/.cursor/mcp.json`. Gemini CLI: configure equivalent MCP entry if supported; verify with that tool’s docs. |
| 2 Perplexity MCP | No | `claude mcp add --scope user perplexity -- npx -y perplexity-mcp` + `PERPLEXITY_API_KEY` from [pplx.ai](https://pplx.ai) (API separate from Pro subscription). |
| 3 Apify MCP | No | Apify account + token; hosted MCP `https://mcp.apify.com` per existing project patterns. |
| 4 Automated ingest | **Yes** | Touches PAKE validation, audit trail, routing; extends **CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md** and implementation in repo. |
| 5 Agent chain | **Yes** (product story) | New workflow: Research → Synthesis → Hook → Body → CTA → Boss; vault notes + paper trail. |
| 6 Answer filing | **Yes** | Persistence of significant research outputs as InsightNote/SynthesisNote with backlinks; may span vault conventions + optional automation. |

### Artifact conflicts

| Artifact | Conflict? | Action |
|----------|-------------|--------|
| **PRD** | Low | Phase 1 MVP is complete; add a **Growth / Phase 4** bullet or appendix for **agency research product** so PRD reflects intent without rewriting Phase 1. |
| **Architecture** | Low–medium | Document Tier 1 MCP as **external** tools (no Vault IO core change for 1–3). Ingest pipeline adds **orchestration** and optional **scheduler** (open in Phase 4 spec). |
| **UX** | N/A | No UI spec; operator and agent workflows only. |
| **epics.md** | Medium | Add epic block(s) for Phase 4 agency work or reference this proposal until epics file is updated. |

### Technical impact

- **Config:** Env keys and MCP registry on Claude Code, Cursor, and optionally Gemini CLI.
- **Repo:** New or extended tests only where ingest or filing is implemented (Vault IO, scripts).
- **Vault:** `00-Inbox/` automation and `master index` updates imply new or updated **WorkflowNote** spec and conventions under `_meta/` or `03-Resources/` (exact path TBD in story).

---

## Section 3: Recommended Approach

**Selected path:** **Direct adjustment** (Option 1) with **additive** epics/stories. No rollback of completed work.

**Rationale**

- Items 1–3 are **configuration and verification**; they do not require undoing shipped CNS code.
- Items 4–6 are **forward work** best captured as **spec refinement + stories** rather than PRD MVP reduction.
- **Risk:** API cost and rate limits (Firecrawl, Perplexity, Apify); mitigate with operator policy in Phase 4 spec open questions.

**Effort (rough)**

| Thread | Effort | Risk |
|--------|--------|------|
| MCP install + health check | Low | Low (keys, network, OAuth) |
| AGENTS.md / Nexus clarity | Low | Low |
| Automated ingest pipeline | High | Medium (PAKE, idempotency, index) |
| Agent chain + Boss gate | High | Medium (process, not only code) |
| Answer filing | Medium | Medium (what triggers “significant”; automation vs habit) |

**Timeline:** **1–3** can complete in days (operator time). **4–6** span multiple weeks depending on automation depth.

---

## Section 4: Detailed Change Proposals

### 4.1 Constitution: `AGENTS.md` (vault + spec mirror)

**Story:** N/A (operational doc)

**Section:** §9 When Uncertain — Perplexity

**OLD:**

```markdown
- **Perplexity:** Use the Perplexity MCP when the question requires current market data, competitor intelligence, real-time search results, or information that may have changed in the last 30 days.
```

**NEW:**

```markdown
- **Perplexity:** Use the Perplexity MCP when the question requires current market data, competitor intelligence, real-time search results, or information that may have changed in the last 30 days. Do not use it for questions answerable from vault content or established technical documentation (use vault search and Context7 or static docs first).
```

**Rationale:** Matches your routing rule; reduces redundant API spend and hallucination risk when the vault already holds the answer.

---

**Section:** §5 Nexus

**ADD** (after the bullet about same startup context, or as a short subsection):

```markdown
- **Tier 1 MCP routing:** Nexus sessions follow the same Tier 1 tool routing and Section 9 rules as IDE agents (Perplexity, Firecrawl, Apify when configured). Nexus filesystem writes remain outside Vault IO governance per above.
```

**Rationale:** Satisfies “Nexus should know when to invoke Perplexity vs Claude built-in knowledge” without duplicating full tool lists.

**Mirror:** `specs/cns-vault-contract/AGENTS.md` per repo policy.

---

### 4.2 Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`

**ADD** new epic block (IDs illustrative; renumber if you prefer):

```yaml
  epic-16: backlog
  16-1-tier-1-mcp-operator-verification-firecrawl-perplexity-apify: backlog
  16-2-automated-ingest-pipeline-00-inbox-pake-index: backlog
  epic-6-retrospective: done  # unchanged
```

**Optional epic-17** (if you split product from ingest):

```yaml
  epic-17: backlog
  17-1-content-research-agent-chain-spec-and-templates: backlog
  17-2-answer-filing-insight-synthesis-notes: backlog
```

**Rationale:** Makes Phase 4 trackable; **6.4** checklist item satisfied after approval.

---

### 4.3 Spec: `specs/cns-vault-contract/CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md`

**Extend** with:

- **00-Inbox/** watcher or batch trigger (implementation choice: CLI, script, or agent-on-demand).
- **Source type detection:** URL vs PDF vs raw text.
- **Classification:** SourceNote vs InsightNote (and when SynthesisNote is reserved for multi-source synthesis).
- **Frontmatter validation** and **routing** per §2.
- **Master index** update rules (which index file, append-only vs regenerate).
- **Mapping** from LLM Wikid **wiki-ingest** pattern to PAKE schemas (explicit field mapping table in a new section).

**Rationale:** Item 4 is explicitly a CNS story; the spec is the contract.

---

### 4.4 PRD: `_bmad-output/planning-artifacts/prd.md`

**ADD** under Growth Features or a new **Phase 4 — Agency research product** subsection (short):

- Tier 1 MCP for acquisition; automated ingest; specialized research chain; answer filing into PAKE notes.

**Rationale:** Aligns planning artifacts without changing Phase 1 completion claims.

---

### 4.5 Operator checklist (docs or README)

**ADD** a single checklist row: **Gemini CLI** MCP parity for Firecrawl (and others) when you adopt that surface, with pointer to Gemini CLI MCP config docs.

---

## Section 5: Implementation Handoff

| Scope | Classification | Primary owner |
|-------|----------------|---------------|
| Items 1–3 MCP install + keys | **Minor** | Operator (you) |
| AGENTS.md + sprint-status + PRD touch-up | **Moderate** | SM / Dev agent (small docs PRs) |
| Item 4 ingest pipeline implementation | **Moderate** | Dev (CNS repo + Vault IO) |
| Items 5–6 agent chain + answer filing | **Moderate–Major** | PM + Dev (process + vault automation) |

**Success criteria**

1. `claude mcp list` shows healthy Tier 1 servers where applicable; Cursor MCP green for same.
2. Perplexity routing rule is **complete** in AGENTS.md Section 9; Nexus explicitly inherits Tier 1 rules.
3. Ingest pipeline spec is **implementation-ready** and stories split vertical slices (single URL → SourceNote first).
4. Agent chain and answer filing have **owned stories** and acceptance criteria (paper trail, note types, backlinks).

---

## Section 6: Change Navigation Checklist (record)

| Section | Status |
|---------|--------|
| 1 Understand trigger | Done |
| 2 Epic impact | Done |
| 3 Artifacts | Done |
| 4 Path forward | Done (Direct adjustment) |
| 5 Proposal components | Done |
| 6 Final review | Pending user approval |
| 6.4 sprint-status.yaml | Pending approval |

---

## Appendix A: Firecrawl install command (verified)

Upstream **`npx`** form:

```bash
env FIRECRAWL_API_KEY=fc-YOUR_API_KEY npx -y firecrawl-mcp
```

Claude Code user scope (per your convention):

```bash
claude mcp add --scope user firecrawl -- npx -y firecrawl-mcp
```

Set **`FIRECRAWL_API_KEY`** in the environment or MCP `env` block per tool docs.

---

**Approval**

- [ ] Approve Sprint Change Proposal as written  
- [ ] Request edits (specify sections)  

After **yes**, next actions: update `sprint-status.yaml`, apply `AGENTS.md` edits (vault + mirror), and create story files for **16-2** and **17-*** as you prefer.

---

_Correct Course workflow complete pending your approval, Chris Taylor._
