#!/usr/bin/env node
/**
 * Story 76-3: Generate AI-Context/inbox-triage-plan.md from canonical inbox inventory.
 * Plan only — no vault_move. Operator FS write class.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const vaultRoot =
  process.env.CNS_VAULT_ROOT?.trim() ||
  "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE";
const inboxListPath = process.argv[2] || "/tmp/inbox-103.txt";

function rel(p) {
  const prefix = vaultRoot.replace(/\/$/, "") + "/";
  if (!p.startsWith(prefix)) {
    throw new Error(`path outside vault: ${p}`);
  }
  return p.slice(prefix.length);
}

/** @type {Record<string, { category: 'act'|'defer'|'archive', rationale: string, dest?: string }>} */
const OVERRIDES = {
  "00-Inbox/AI Knowledge Layer_.md": {
    category: "act",
    rationale: "PAKE/CNS knowledge-layer architecture seed; blocks consolidation orientation",
    dest: "01-Projects/Brain - Central Nervous System Build/",
  },
  "00-Inbox/About Me - when asked what i do.md": {
    category: "defer",
    rationale: "Personal positioning note; useful but not Hermes consolidation critical path",
    dest: "02-Areas/About Me/",
  },
  "00-Inbox/Agent Design Info.md": {
    category: "act",
    rationale: "Agent design patterns for CNS/Hermes routing",
    dest: "03-Resources/AI-Native-Infrastructure/",
  },
  "00-Inbox/Alex - Per Jwana Job/CV and Call Structure.md": {
    category: "defer",
    rationale: "Job-search collateral; personal, not consolidation-blocking",
    dest: "02-Areas/",
  },
  "00-Inbox/Alex - Per Jwana Job/Jwana’s job connect convo.md": {
    category: "defer",
    rationale: "Job-search conversation notes",
    dest: "02-Areas/",
  },
  "00-Inbox/All Notes from iPhone 17 Pro Max.md": {
    category: "defer",
    rationale: "Bulk unstructured mobile dump; triage in batches after consolidation",
    dest: "00-Inbox/ (batch triage)",
  },
  "00-Inbox/B-MAD New Feature Workflow.md": {
    category: "act",
    rationale: "BMAD workflow capture; active in Hermes Consolidation implementation",
    dest: "03-Resources/AI-Native-Infrastructure/",
  },
  "00-Inbox/CNS Project Handoff — April 17, 2026.md": {
    category: "act",
    rationale: "CNS handoff context; may supersede older backlog items",
    dest: "01-Projects/Brain - Central Nervous System Build/",
  },
  "00-Inbox/Foundation + First Client.md": {
    category: "defer",
    rationale: "Business development brainstorming; parallel track to consolidation",
    dest: "01-Projects/",
  },
  "00-Inbox/Fully integrate codex into cursor ide.md": {
    category: "act",
    rationale: "IDE/tooling integration note for CNS operator stack",
    dest: "01-Projects/Brain - Central Nervous System Build/",
  },
  "00-Inbox/Gemini About Me - Needs review.md": {
    category: "defer",
    rationale: "Personal bio draft pending review",
    dest: "02-Areas/About Me/",
  },
  "00-Inbox/Personal money business brainstorming.md": {
    category: "defer",
    rationale: "Personal finance brainstorming",
    dest: "02-Areas/",
  },
  "00-Inbox/Remove contains files.md": {
    category: "archive",
    rationale: "Stale housekeeping stub; no consolidation value",
    dest: "04-Archives/",
  },
  "00-Inbox/_README.md": {
    category: "defer",
    rationale: "Inbox contract manifest; keep until bulk triage completes",
    dest: "00-Inbox/",
  },
  "00-Inbox/new branch.md": {
    category: "act",
    rationale: "CNS/git workflow capture from active build",
    dest: "01-Projects/Brain - Central Nervous System Build/",
  },
  "00-Inbox/new scope.md": {
    category: "act",
    rationale: "Scope-change capture for CNS/Hermes work",
    dest: "01-Projects/Brain - Central Nervous System Build/",
  },
  "00-Inbox/things that still need to be accomplished with my cns build.md": {
    category: "act",
    rationale: "Open CNS build backlog; direct consolidation input",
    dest: "01-Projects/Brain - Central Nervous System Build/",
  },
  "00-Inbox/hermes-hi2-inbox-routing-20260503.md": {
    category: "act",
    rationale: "Hermes inbox routing test/evidence; informs triage skill",
    dest: "01-Projects/Brain - Central Nervous System Build/Hermes/",
  },
  "00-Inbox/hermes-morning-digest-2026-05-04.md": {
    category: "defer",
    rationale: "Historical morning-digest capture; process after digest pipeline stable",
    dest: "03-Resources/",
  },
  "00-Inbox/hermes-morning-digest-2026-06-05.md": {
    category: "defer",
    rationale: "Historical morning-digest capture",
    dest: "03-Resources/",
  },
  "00-Inbox/hermes-auto-capture-20260507T044500Z-x-com.md": {
    category: "defer",
    rationale: "URL auto-capture sample; route if novel after dedup check",
    dest: "03-Resources/",
  },
  "00-Inbox/hermes-auto-capture-20260507T044600Z-www-geeky-gadgets-com.md": {
    category: "defer",
    rationale: "URL auto-capture sample",
    dest: "03-Resources/",
  },
  "00-Inbox/hermes-auto-capture-20260507T045129Z-example-com.md": {
    category: "archive",
    rationale: "E2E test fixture URL (example.com); no production value",
    dest: "04-Archives/",
  },
  "00-Inbox/hermes-auto-capture-20260507T045130Z-localhost.md": {
    category: "archive",
    rationale: "E2E test fixture URL (localhost); no production value",
    dest: "04-Archives/",
  },
  "00-Inbox/hermes-auto-capture-20260507T045145Z-example-com.md": {
    category: "archive",
    rationale: "Duplicate example.com test capture",
    dest: "04-Archives/",
  },
  "00-Inbox/QuickNote/BS Filter.md": {
    category: "defer",
    rationale: "Personal quick note",
    dest: "02-Areas/",
  },
  "00-Inbox/QuickNote/Brain storm.md": {
    category: "defer",
    rationale: "Unstructured brainstorm",
    dest: "02-Areas/",
  },
  "00-Inbox/QuickNote/CNS Backlog — All Gaps, Deferred Items, Phase 2+ Candidates.md": {
    category: "act",
    rationale: "CNS backlog inventory; high value for consolidation gap analysis",
    dest: "01-Projects/Brain - Central Nervous System Build/",
  },
  "00-Inbox/QuickNote/CNS Todo.md": {
    category: "act",
    rationale: "Active CNS task list",
    dest: "01-Projects/Brain - Central Nervous System Build/",
  },
  "00-Inbox/QuickNote/CNS_Handoff_Current_Repo_State_2026-05-03.md.md": {
    category: "act",
    rationale: "Repo handoff state; compare against current sprint-status",
    dest: "01-Projects/Brain - Central Nervous System Build/",
  },
  "00-Inbox/QuickNote/visually-oriented..md": {
    category: "defer",
    rationale: "Fragment note",
    dest: "02-Areas/",
  },
  "00-Inbox/unfair dismissal - centerlink/Claude Temp Chat Dump.md": {
    category: "defer",
    rationale: "Personal/legal matter; not consolidation scope",
    dest: "02-Areas/",
  },
  "00-Inbox/unfair dismissal - centerlink/New things I remember.md": {
    category: "defer",
    rationale: "Personal/legal matter",
    dest: "02-Areas/",
  },
  "00-Inbox/unfair dismissal - centerlink/Unfair Dismissal Claim - Centerlink.md": {
    category: "defer",
    rationale: "Personal/legal matter",
    dest: "02-Areas/",
  },
  "00-Inbox/unfair dismissal - centerlink/Updated.md": {
    category: "defer",
    rationale: "Personal/legal matter",
    dest: "02-Areas/",
  },
};

const ACT_CLIP = new Set([
  "A harness for every task dynamic workflows in Claude Code.md",
  "Claude Code overview.md",
  "Claude Remote Control Info.md",
  "Common workflows.md",
  "Complete Guide to NotebookLM.md",
  "Firecrawl - The Web Data API for AI.md",
  "Harness design for long-running application development.md",
  "How Claude remembers your project.md",
  "How Companies Should Take Notes with AI.md",
  "How I turned Obsidian into a second brain that runs itself.md",
  "How to Build a Claude Research Agent That Reads the Internet Every Morning and Briefs You in 5 Mins.md",
  "How to Master Codex in 2026 (Builder's Course).md",
  "I'm on the claude code train.md",
  "Lessons from Building Claude Code How We Use Skills.md",
  "Lessons from Building Claude Code Seeing like an Agent.md",
  "Make the Most of Claude AI From First Chat to Full Autopilot.md",
  "Manage costs effectively.md",
  "NotebookLM Got Crazy Powerful Here's How I Used It to Learn Something Really Hard.md",
  "OpenClaw + Obsidian CLI My Vault Runs Itself.md",
  "Optimize your terminal setup.md",
  "Research Graphs Agentic Note Taking System for Researchers.md",
  "Scrapling - Powerful Web Scrapper.md",
  "Skill Graphs  SKILL.md",
  "Talk to Your Obsidian Notes from Your Phone — Claude Code Mobile Setup.md",
  "The Complete Beginner’s Guide to Context Engineering.md",
  "The Harness Is Everything What Cursor, Claude Code, and Perplexity Actually Built.md",
  "Working across file systems.md",
  "You're Only Using 20% of Claude Code - Here's How to Unlock the Rest.md",
  "mikeyobrienralph-orchestrator An improved implementation of the Ralph Wiggum technique for autonomous AI agent orchestration.md",
]);

const ARCHIVE_CLIP = new Set([
  "Headless Sync 1.md",
  "Headless Sync.md",
  "Post  LinkedIn 1.md",
  "Thread by @bcherny 1.md",
  "Thread by @bcherny.md",
  "firecrawlfirecrawl 🔥 The Web Data API for AI - Turn entire websites into LLM-ready markdown or structured data.md",
]);

function classify(relPath) {
  if (OVERRIDES[relPath]) return OVERRIDES[relPath];

  if (relPath.startsWith("00-Inbox/DailyNotes/")) {
    return {
      category: "defer",
      rationale: "Misplaced daily note in inbox; relocate to DailyNotes/ when triaged",
      dest: "DailyNotes/",
    };
  }

  if (relPath.startsWith("00-Inbox/Clippings/")) {
    const base = relPath.split("/").pop();
    if (ACT_CLIP.has(base)) {
      return {
        category: "act",
        rationale: "Active CNS/Hermes stack reference (tools, harness, vault, NotebookLM)",
        dest: "03-Resources/AI-Native-Infrastructure/",
      };
    }
    if (ARCHIVE_CLIP.has(base)) {
      return {
        category: "archive",
        rationale: "Duplicate, superseded, or low-signal clipping",
        dest: "04-Archives/",
      };
    }
    return {
      category: "defer",
      rationale: "Generic web clipping; process after consolidation critical path",
      dest: "03-Resources/",
    };
  }

  throw new Error(`unclassified: ${relPath}`);
}

function row(relPath, { rationale, dest }) {
  const d = dest ? ` | ${dest}` : "";
  return `| ${relPath} | ${rationale}${d ? "" : ""} | ${dest ?? "—"} |`;
}

const absPaths = readFileSync(inboxListPath, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean);
const entries = absPaths.map((p) => {
  const r = rel(p);
  return { path: r, ...classify(r) };
});

const act = entries.filter((e) => e.category === "act");
const defer = entries.filter((e) => e.category === "defer");
const archive = entries.filter((e) => e.category === "archive");

if (entries.length !== 103) {
  throw new Error(`expected 103 entries, got ${entries.length}`);
}

const today = new Date().toISOString().slice(0, 10);
const md = `# Inbox Triage Plan (Hermes Consolidation — FR17)

> Generated: ${today} | Total: ${entries.length} markdown files under 00-Inbox/
> Story: 76-3 | Execution: Hermes \`/triage\` family (Operator Guide §15.3) — plan only, no moves in this story.

## Summary

| Category | Count | Intent |
|----------|-------|--------|
| Act now | ${act.length} | Route during consolidation sprint |
| Defer | ${defer.length} | Process after Epics 74–78 critical path |
| Archive candidate | ${archive.length} | Relocate to 04-Archives/ when operator approves |

## Act now

| Path | Rationale | Suggested destination |
|------|-----------|----------------------|
${act.map((e) => row(e.path, e)).join("\n")}

## Defer

| Path | Rationale | Suggested destination |
|------|-----------|----------------------|
${defer.map((e) => row(e.path, e)).join("\n")}

## Archive candidate

| Path | Rationale | Suggested destination |
|------|-----------|----------------------|
${archive.map((e) => row(e.path, e)).join("\n")}

## Execution notes

- Preview: \`/triage\` in Discord \`#hermes\`
- Approve: \`/triage-approve <path> --to <dir>/\`
- Execute (later): \`/triage-execute <path> --to <dir>/\` — one \`vault_move\` per invocation
- Obsidian panel: \`_meta/bases/inbox-triage.base\`
- **This document is advisory only.** No bulk moves were executed in Story 76-3.
`;

const outDir = join(vaultRoot, "AI-Context");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "inbox-triage-plan.md");
writeFileSync(outPath, md, "utf8");
console.log(`Wrote ${outPath} (${act.length} act, ${defer.length} defer, ${archive.length} archive)`);
