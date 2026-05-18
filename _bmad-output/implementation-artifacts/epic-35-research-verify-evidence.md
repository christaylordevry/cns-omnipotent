# Epic 35 — Research cluster /verify evidence

**Run date:** 2026-05-18
**Operator:** Christopher Taylor (Cursor dev-story — Vault IO pipeline)
**Gateway:** Operator confirmed Hermes gateway live (PID **803055**, prior session) + `vault-think` v1.3.0 on `#hermes` (2026-05-18 code review). Stamps via `vaultUpdateFrontmatter` (WriteGate + PAKE + audit, surface `story-35-2`). AC3: MCP batch accepted for all notes including 3 SynthesisNotes; Discord `/verify` re-review not required.
**Target:** 03-Resources/Research/ — **43** notes (Research-cluster `verification_status: pending` at run; story create-text **69** was vault-wide miscount — corrected at review).

## Queue discovery (AC2)

| Field | Value |
|-------|-------|
| **Discovery method** | `verification_status: pending` scan under `03-Resources/Research/` + cross-check vs `vault-lint-2026-05-18.md` Rule 3 Research rows |
| **Research pending at run** | **43** (40 SourceNote, 3 SynthesisNote) |
| **Checklist** | 43 paths — table below (full decision log) |
| **Note** | Discord `/verify` queue not pasted; MCP pipeline used per story 34-3 precedent after operator judgment |

**Judgment policy:** Q1 analyses, CNS/Hermes syntheses, active tool/API refs → verified. Tutorial ingests, COMBINED notes, duplicate chains, github listicles, source-leak gossip → disputed.

| Path | pake_type | Days pending | Decision | Method | UTC time |
|------|-----------|--------------|----------|--------|----------|
| 03-Resources/Research/3-20-26 Building my powerful system setup.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:44.822Z |
| 03-Resources/Research/Agentic-AI-Engineering.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:44.855Z |
| 03-Resources/Research/AI-Agent-Security-DeepMind-Traps.md | SynthesisNote | 2 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:44.887Z |
| 03-Resources/Research/AI-Programmatic-Niche-Directory-Monetization-Q1-2026.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:44.910Z |
| 03-Resources/Research/Anatomy of the .claude Folder 1.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:44.934Z |
| 03-Resources/Research/Anatomy of the .claude folder.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:44.957Z |
| 03-Resources/Research/Best Practices for Claude Code.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:44.983Z |
| 03-Resources/Research/Claude + Obsidian The Memory Stack That Compounds.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.007Z |
| 03-Resources/Research/Claude Code + NotebookLM + Obsidian The Research Stack Nobody's Using.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.033Z |
| 03-Resources/Research/Claude Cowork Masterclass for SEO (full tutorial).md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.056Z |
| 03-Resources/Research/Claude-Code-GTM-Engineering-Blueprint.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.080Z |
| 03-Resources/Research/Claude-Code-Source-Leak-March-2026.md | SourceNote | 47 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.103Z |
| 03-Resources/Research/Claude-Cowork-Context-Engineering-Research-Note-COMBINED.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.129Z |
| 03-Resources/Research/Claude-Cowork-Desktop-AI-Workspace-Explainer.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.154Z |
| 03-Resources/Research/CLAUDE-md-Configuration-Definitive-Guide.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.179Z |
| 03-Resources/Research/CLAUDE-md-Configuration.md | SourceNote | 37 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.203Z |
| 03-Resources/Research/Context Engineering.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.228Z |
| 03-Resources/Research/CS-Video-Courses-GitHub.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.255Z |
| 03-Resources/Research/Etsy-AI-Prompt-Digital-Planner-Market-Analysis-Q1-2026.md | SourceNote | 78 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.284Z |
| 03-Resources/Research/Extend Claude with skills.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.308Z |
| 03-Resources/Research/Firecrawl-Web-Data-API.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.343Z |
| 03-Resources/Research/Gemini-Prompt-Engineering.md | SourceNote | 52 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.373Z |
| 03-Resources/Research/github - repos.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.398Z |
| 03-Resources/Research/Hermes-Agent-CNS-Comparison.md | SynthesisNote | 28 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.424Z |
| 03-Resources/Research/How to 10x your Claude Skills (using Karpathy's autoresearch method).md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.449Z |
| 03-Resources/Research/How-I-Use-Obsidian-Claude-Code-To-Run-My-Life-Isenberg-Vin.md | SourceNote | 7 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.481Z |
| 03-Resources/Research/I created a tool that automates the BMAD Method.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.505Z |
| 03-Resources/Research/I Ran Local AI on My MacBook and iPhone. The Gap Is Closing Fast.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.530Z |
| 03-Resources/Research/Lead-Gen-Directories-Sydney/Lead-Gen-Directory-Monetization-Sydney-Q1-2026.md | SourceNote | 77 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.554Z |
| 03-Resources/Research/Marketing-SEO-Data-Tools.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.583Z |
| 03-Resources/Research/MCP-Servers-Ecosystem-Overview.md | SourceNote | 53 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.607Z |
| 03-Resources/Research/MCP-Servers-Ecosystem.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.635Z |
| 03-Resources/Research/Obsidian-Claude-Code-All-Sources-Synthesis.md | SynthesisNote | 7 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.659Z |
| 03-Resources/Research/OpenClaw-AI-Research.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.684Z |
| 03-Resources/Research/Ralph-Loop-Autonomous-Workflows.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.707Z |
| 03-Resources/Research/Scrapling-Python-Web-Scraper.md | SourceNote | 49 | verified | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.730Z |
| 03-Resources/Research/Stitch Masterclass for Beginners (full tutorial).md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.754Z |
| 03-Resources/Research/This SIMPLE Obsidian + Claude Code setup could turn your vault into a 24×7 AI agent.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.778Z |
| 03-Resources/Research/Top 50 Claude Skills & GitHub  Repos for AI — The Only List You  Need.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.801Z |
| 03-Resources/Research/Top Github Repositories which everyone should look.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.826Z |
| 03-Resources/Research/Top-9-GitHub-Repos-Claude-Code-2026.md | SourceNote | 47 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.849Z |
| 03-Resources/Research/Vibe-Coding-Tools-and-Features.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.874Z |
| 03-Resources/Research/YishenTuclaudian An Obsidian plugin that embeds Claude Code as an AI collaborator in your vault.md | SourceNote | 49 | disputed | vault_update_frontmatter (MCP pipeline) | 2026-05-18T00:01:45.898Z |

## Summary
- Processed: 43
- Verified: 21
- Disputed: 22
- Post-run Research `pending` on disk: **0** (code-review scan 2026-05-18)
- Post-run Rule 3 (Research): **0** stale_pending in cluster (frontmatter); `vault-lint-2026-05-18.md` on-disk report predates stamps — refresh via `/vault-lint` in `#hermes` optional for updated report artifact

**Audit:** 43 lines with surface: story-35-2 in _meta/logs/agent-log.md.
