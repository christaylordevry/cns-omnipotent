/**
 * Internal dev-state collector (Story 81-1b) — read-only parsers + ranking for /nexus discovery panel.
 */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  parseAgentLogContent,
  readAgentLogEntries,
  type AgentLogEntry,
} from "../dashboard-sync.js";

/** Hand-mirrored from cns-dashboard/convex/validators.ts — keep in sync. */
export type InternalDevStateCategory = "deferred" | "sprint" | "agent_log" | "vault_scan";

/** Hand-mirrored from cns-dashboard/convex/validators.ts — keep in sync. */
export type PrioritizedItem = {
  rank: number;
  rankScore: number;
  title: string;
  category: InternalDevStateCategory;
  rationale: string;
  sourcePath: string;
};

export const DEFERRED_WORK_REL = "_bmad-output/implementation-artifacts/deferred-work.md";
export const SPRINT_STATUS_REL = "_bmad-output/implementation-artifacts/sprint-status.yaml";
export const AGENT_LOG_SOURCE_PATH = "_meta/logs/agent-log.md";
export const VAULT_SCAN_REL = "AI-Context/vault-fast-scan-index.md";

export const SPRINT_INCLUDE_STATUSES = new Set(["review", "in-progress", "ready-for-dev"]);

export const AGENT_LOG_MUTATION_TOOLS = new Set([
  "vault_create_note",
  "vault_update_frontmatter",
  "vault_append_daily",
  "vault_move",
  "vault_log_action",
]);

const STORY_KEY_RE = /^\s*(\d+-\d+\w*(?:-[\w-]+)*):\s*(\S+)/;
const VAULT_SCAN_LINE_RE =
  /^(SRC|INS|SYN|DLY|OTH)\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(\d{4}-\d{2}-\d{2})$/;
const DATE_IN_PARENS_RE = /\((\d{4}-\d{2}-\d{2})\)/;
const SURFACED_BY_RE = /^\*\*Surfaced by:\*\*\s*(.+)$/im;

const CATEGORY_PRIORITY: Record<InternalDevStateCategory, number> = {
  sprint: 4,
  deferred: 3,
  agent_log: 2,
  vault_scan: 1,
};

const GLOBAL_ITEM_CAP = 20;

type ScoredCandidate = Omit<PrioritizedItem, "rank">;

type DeferredCandidate = ScoredCandidate & { surfacedAt: number | null };
type SprintCandidate = ScoredCandidate & { status: string };
type AgentLogCandidate = ScoredCandidate & { timestamp: number; tool: string };
type VaultScanCandidate = ScoredCandidate & { created: string; scanType: string };

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export function parseDateToMs(isoDate: string): number | null {
  const ms = Date.parse(`${isoDate}T12:00:00.000Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function parseSurfacedAtFromDeferredSection(heading: string, body: string): number | null {
  const headingMatch = heading.match(DATE_IN_PARENS_RE);
  if (headingMatch) {
    return parseDateToMs(headingMatch[1]);
  }
  const surfacedByMatch = body.match(SURFACED_BY_RE);
  if (surfacedByMatch) {
    const dateMatch = surfacedByMatch[1].match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return parseDateToMs(dateMatch[1]);
    }
  }
  return null;
}

export function parseDeferredWorkContent(content: string): DeferredCandidate[] {
  const lines = content.split("\n");
  const sections: { heading: string; bodyLines: string[] }[] = [];
  let current: { heading: string; bodyLines: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) {
        sections.push(current);
      }
      current = { heading: line.slice(3).trim(), bodyLines: [] };
      continue;
    }
    if (current) {
      current.bodyLines.push(line);
    }
  }
  if (current) {
    sections.push(current);
  }

  return sections.map(({ heading, bodyLines }) => {
    const body = bodyLines.join("\n");
    const surfacedAt = parseSurfacedAtFromDeferredSection(heading, body);
    const surfacedByMatch = body.match(SURFACED_BY_RE);
    let rationale: string;
    if (surfacedByMatch) {
      rationale = surfacedByMatch[0].trim();
    } else {
      const firstLine = bodyLines.find((l) => l.trim().length > 0)?.trim() ?? heading;
      rationale = firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
    }
    if (rationale.length > 120) {
      rationale = `${rationale.slice(0, 117)}...`;
    }

    return {
      title: heading,
      category: "deferred" as const,
      rationale,
      sourcePath: DEFERRED_WORK_REL,
      rankScore: 0,
      surfacedAt,
    };
  });
}

function isExcludedSprintKey(key: string): boolean {
  if (key.startsWith("epic-")) {
    return true;
  }
  if (key.endsWith("-retrospective")) {
    return true;
  }
  if (key.startsWith("pre-")) {
    return true;
  }
  return false;
}

export function parseSprintStatusContent(yaml: string): SprintCandidate[] {
  const lines = yaml.split("\n");
  let inDevelopmentStatus = false;
  let currentEpicComment: string | null = null;
  const candidates: SprintCandidate[] = [];

  for (const line of lines) {
    if (/^development_status:\s*$/.test(line)) {
      inDevelopmentStatus = true;
      continue;
    }
    if (inDevelopmentStatus && line.length > 0 && !/^\s/.test(line) && !line.startsWith("#")) {
      break;
    }
    if (!inDevelopmentStatus) {
      continue;
    }

    const epicCommentMatch = line.match(/^\s+# Epic (\d+)/);
    if (epicCommentMatch) {
      currentEpicComment = line.trim().replace(/^#\s*/, "");
      continue;
    }

    const storyMatch = line.match(STORY_KEY_RE);
    if (!storyMatch) {
      continue;
    }
    const [, key, status] = storyMatch;
    if (isExcludedSprintKey(key)) {
      continue;
    }
    if (!SPRINT_INCLUDE_STATUSES.has(status)) {
      continue;
    }

    let rationale = `Sprint status: ${status}`;
    if (currentEpicComment) {
      rationale = `${rationale} (${currentEpicComment})`;
    }

    candidates.push({
      title: key,
      category: "sprint",
      rationale,
      sourcePath: SPRINT_STATUS_REL,
      rankScore: 0,
      status,
    });
  }

  return candidates;
}

export function dedupeAgentLogEntries(entries: AgentLogEntry[]): AgentLogEntry[] {
  const byPath = new Map<string, AgentLogEntry>();
  for (const entry of entries) {
    const existing = byPath.get(entry.targetPath);
    if (!existing || entry.timestamp > existing.timestamp) {
      byPath.set(entry.targetPath, entry);
    }
  }
  return [...byPath.values()];
}

export function parseAgentLogCandidates(entries: AgentLogEntry[]): AgentLogCandidate[] {
  return dedupeAgentLogEntries(entries).map((entry) => {
    const rationaleRaw = `${entry.tool} via ${entry.surface}: ${entry.summary}`;
    const rationale =
      rationaleRaw.length > 120 ? `${rationaleRaw.slice(0, 117)}...` : rationaleRaw;
    return {
      title: `${entry.action} ${entry.targetPath}`,
      category: "agent_log" as const,
      rationale,
      sourcePath: AGENT_LOG_SOURCE_PATH,
      rankScore: 0,
      timestamp: entry.timestamp,
      tool: entry.tool,
    };
  });
}

export function parseVaultScanContent(content: string): VaultScanCandidate[] {
  const candidates: VaultScanCandidate[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(VAULT_SCAN_LINE_RE);
    if (!match) {
      continue;
    }
    const [, scanType, vaultPath, title, created] = match;
    candidates.push({
      title: title.trim(),
      category: "vault_scan",
      rationale: `Fast-scan: ${scanType} note modified ${created}`,
      sourcePath: vaultPath.trim(),
      rankScore: 0,
      created,
      scanType,
    });
  }
  return candidates;
}

function sprintBaseScore(status: string): number {
  switch (status) {
    case "review":
      return 92;
    case "in-progress":
      return 88;
    case "ready-for-dev":
      return 78;
    default:
      return 0;
  }
}

function deferredBaseScore(bodyContext: string): number {
  const firstThree = bodyContext.split("\n").slice(0, 3).join("\n");
  if (/blocking|blocker|FATAL/i.test(firstThree)) {
    return 72;
  }
  return 62;
}

function agentLogBaseScore(tool: string): number {
  return AGENT_LOG_MUTATION_TOOLS.has(tool) ? 58 : 48;
}

function vaultScanBaseScore(scanType: string): number {
  switch (scanType) {
    case "SYN":
    case "INS":
      return 42;
    case "SRC":
      return 38;
    case "DLY":
    case "OTH":
      return 32;
    default:
      return 32;
  }
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function daysSince(fromMs: number, nowMs: number): number {
  return (nowMs - fromMs) / (24 * 60 * 60 * 1000);
}

function hoursSince(fromMs: number, nowMs: number): number {
  return (nowMs - fromMs) / (60 * 60 * 1000);
}

function deferredRecencyBonus(surfacedAt: number | null, nowMs: number): number {
  if (surfacedAt === null) {
    return 0;
  }
  const days = daysSince(surfacedAt, nowMs);
  if (days > 30) {
    return 0;
  }
  return Math.min(8, days);
}

function agentLogRecencyBonus(timestamp: number, nowMs: number): number {
  const hours = hoursSince(timestamp, nowMs);
  return Math.max(0, 12 - hours / 2);
}

function vaultScanRecencyBonus(created: string, nowMs: number): number {
  const createdMs = parseDateToMs(created);
  if (createdMs === null) {
    return 0;
  }
  const days = daysSince(createdMs, nowMs);
  return Math.max(0, 10 - days * (10 / 14));
}

export function scoreDeferredCandidate(
  candidate: DeferredCandidate,
  bodyContext: string,
  nowMs: number,
): ScoredCandidate {
  const base = deferredBaseScore(bodyContext);
  const bonus = deferredRecencyBonus(candidate.surfacedAt, nowMs);
  return {
    title: candidate.title,
    category: candidate.category,
    rationale: candidate.rationale,
    sourcePath: candidate.sourcePath,
    rankScore: clampScore(base + bonus),
  };
}

export function scoreSprintCandidate(candidate: SprintCandidate): ScoredCandidate {
  return {
    title: candidate.title,
    category: candidate.category,
    rationale: candidate.rationale,
    sourcePath: candidate.sourcePath,
    rankScore: clampScore(sprintBaseScore(candidate.status)),
  };
}

export function scoreAgentLogCandidate(candidate: AgentLogCandidate, nowMs: number): ScoredCandidate {
  const base = agentLogBaseScore(candidate.tool);
  const bonus = agentLogRecencyBonus(candidate.timestamp, nowMs);
  return {
    title: candidate.title,
    category: candidate.category,
    rationale: candidate.rationale,
    sourcePath: candidate.sourcePath,
    rankScore: clampScore(base + bonus),
  };
}

export function scoreVaultScanCandidate(candidate: VaultScanCandidate, nowMs: number): ScoredCandidate {
  const base = vaultScanBaseScore(candidate.scanType);
  const bonus = vaultScanRecencyBonus(candidate.created, nowMs);
  return {
    title: candidate.title,
    category: candidate.category,
    rationale: candidate.rationale,
    sourcePath: candidate.sourcePath,
    rankScore: clampScore(base + bonus),
  };
}

export function scoreAndRankCandidates(
  deferred: DeferredCandidate[],
  sprint: SprintCandidate[],
  agentLog: AgentLogCandidate[],
  vaultScan: VaultScanCandidate[],
  deferredBodies: Map<string, string>,
  nowMs: number,
): PrioritizedItem[] {
  const scored: ScoredCandidate[] = [
    ...deferred.map((c) => scoreDeferredCandidate(c, deferredBodies.get(c.title) ?? "", nowMs)),
    ...sprint.map(scoreSprintCandidate),
    ...agentLog.map((c) => scoreAgentLogCandidate(c, nowMs)),
    ...vaultScan.map((c) => scoreVaultScanCandidate(c, nowMs)),
  ];

  scored.sort((a, b) => {
    if (b.rankScore !== a.rankScore) {
      return b.rankScore - a.rankScore;
    }
    const catDiff = CATEGORY_PRIORITY[b.category] - CATEGORY_PRIORITY[a.category];
    if (catDiff !== 0) {
      return catDiff;
    }
    return a.title.localeCompare(b.title);
  });

  return scored.slice(0, GLOBAL_ITEM_CAP).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

export type CollectInternalDevStateOptions = {
  repoRoot: string;
  vaultRoot: string;
  now?: number;
};

export async function collectInternalDevState(
  opts: CollectInternalDevStateOptions,
): Promise<PrioritizedItem[]> {
  const repoRoot = path.resolve(opts.repoRoot);
  const vaultRoot = path.resolve(opts.vaultRoot);
  const nowMs = opts.now ?? Date.now();

  const deferredPath = path.join(repoRoot, DEFERRED_WORK_REL);
  const sprintPath = path.join(repoRoot, SPRINT_STATUS_REL);
  const vaultScanPath = path.join(vaultRoot, VAULT_SCAN_REL);

  let deferredRaw: DeferredCandidate[] = [];
  const deferredBodies = new Map<string, string>();

  if (await pathExists(deferredPath)) {
    const content = await readFile(deferredPath, "utf8");
    deferredRaw = parseDeferredWorkContent(content);
    const sections = content.split(/^## /m).slice(1);
    for (const section of sections) {
      const nl = section.indexOf("\n");
      const heading = nl >= 0 ? section.slice(0, nl).trim() : section.trim();
      const body = nl >= 0 ? section.slice(nl + 1) : "";
      deferredBodies.set(heading, body);
    }
  }

  let sprintRaw: SprintCandidate[] = [];
  if (await pathExists(sprintPath)) {
    const yaml = await readFile(sprintPath, "utf8");
    sprintRaw = parseSprintStatusContent(yaml);
  }

  let agentLogRaw: AgentLogCandidate[] = [];
  if (await pathExists(path.join(vaultRoot, AGENT_LOG_SOURCE_PATH))) {
    const entries = await readAgentLogEntries(vaultRoot);
    agentLogRaw = parseAgentLogCandidates(entries);
  }

  let vaultScanRaw: VaultScanCandidate[] = [];
  if (await pathExists(vaultScanPath)) {
    const content = await readFile(vaultScanPath, "utf8");
    vaultScanRaw = parseVaultScanContent(content);
  }

  return scoreAndRankCandidates(
    deferredRaw,
    sprintRaw,
    agentLogRaw,
    vaultScanRaw,
    deferredBodies,
    nowMs,
  );
}

/** Test helper — parse agent log from raw content without filesystem. */
export function parseAgentLogCandidatesFromContent(content: string): AgentLogCandidate[] {
  return parseAgentLogCandidates(parseAgentLogContent(content));
}
