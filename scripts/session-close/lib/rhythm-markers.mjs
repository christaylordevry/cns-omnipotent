import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  parseAgentsSection8,
  parseDevelopmentStatus,
  readHermesProviderLine,
  readVaultLintSummary,
} from "./read-sources.mjs";
import { applyAutoMarkers } from "./replace-auto.mjs";

export const AUTO_MARKER_TAGS = [
  "PROVIDER",
  "VAULT_NOTES",
  "VAULT_HEALTH",
  "SPRINT",
  "AGENTS_VERSION",
  "SKILLS_COUNT",
  "TESTS",
  "LAST_SESSION",
  "ACTIVE_PROJECTS",
  "DEFERRED_SUMMARY",
  "ROADMAP",
];

const NOTABLE_SPRINT_STATUSES = new Set(["ready-for-dev", "review", "deferred", "done"]);
const ACTIVE_PROJECT_STATUSES = new Set(["in-progress", "ready-for-dev", "review"]);
const EPIC_KEY_RE = /^epic-(\d+)$/;
const STORY_EPIC_RE = /^(\d+)-\d+-/;
const FOOTER_RE =
  /^\*Last auto-update:.*\*$/m;

/**
 * @param {string} cell
 */
export function sanitizeTableCell(cell) {
  return String(cell).replace(/\|/g, " - ").trim();
}

/**
 * @param {string} text
 * @param {string} sectionHeading e.g. "### Current Priorities"
 */
export function extractSection8Subsection(text, sectionHeading) {
  const section8Start = text.indexOf("## 8.");
  const section9Start = text.indexOf("## 9.");
  if (section8Start === -1) {
    return "";
  }
  const section8 =
    section9Start !== -1 && section9Start > section8Start
      ? text.slice(section8Start, section9Start)
      : text.slice(section8Start);
  const idx = section8.indexOf(sectionHeading);
  if (idx === -1) {
    return "";
  }
  const after = section8.slice(idx + sectionHeading.length);
  const nextHeading = after.search(/\n### |\n## /);
  return nextHeading === -1 ? after : after.slice(0, nextHeading);
}

/**
 * @param {string} prioritiesBlock
 */
export function extractFirstPriority(prioritiesBlock) {
  for (const line of prioritiesBlock.split("\n")) {
    const match = line.match(/^\s*1\.\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  return "See AGENTS.md Section 8 Current Priorities.";
}

/**
 * @param {string} contextBlock
 * @param {number} limit
 */
export function extractRecentBullets(contextBlock, limit = 3) {
  const bullets = [];
  for (const line of contextBlock.split("\n")) {
    const match = line.match(/^\s*-\s+(.+)$/);
    if (match) {
      bullets.push(match[1].trim());
      if (bullets.length >= limit) {
        break;
      }
    }
  }
  while (bullets.length < limit) {
    bullets.push("—");
  }
  return bullets.slice(0, limit);
}

/**
 * @param {string} skillsRoot
 */
export async function countHermesSkills(skillsRoot) {
  const packages = new Set();
  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const top = join(skillsRoot, entry.name);
    const topSkill = join(top, "SKILL.md");
    try {
      const s = await stat(topSkill);
      if (s.isFile()) {
        packages.add(topSkill);
      }
    } catch {
      // no top-level SKILL
    }

    let nested;
    try {
      nested = await readdir(top, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of nested) {
      if (!child.isDirectory()) {
        continue;
      }
      const nestedSkill = join(top, child.name, "SKILL.md");
      try {
        const s = await stat(nestedSkill);
        if (s.isFile()) {
          packages.add(nestedSkill);
        }
      } catch {
        // skip
      }
    }
  }

  return packages.size;
}

/**
 * @param {{ key: string, status: string }[]} entries
 */
export function buildSprintNarrative(entries) {
  const epicStatus = new Map();
  const storiesByEpic = new Map();

  for (const { key, status } of entries) {
    const epicMatch = key.match(EPIC_KEY_RE);
    if (epicMatch) {
      epicStatus.set(key, status);
      continue;
    }
    const storyMatch = key.match(STORY_EPIC_RE);
    if (!storyMatch || !NOTABLE_SPRINT_STATUSES.has(status)) {
      continue;
    }
    const epicId = `epic-${storyMatch[1]}`;
    if (!storiesByEpic.has(epicId)) {
      storiesByEpic.set(epicId, []);
    }
    storiesByEpic.get(epicId).push(`${key.split("-").slice(0, 2).join("-")} ${status}`);
  }

  const parts = [];
  for (const { key: epicKey, status } of entries) {
    const m = epicKey.match(EPIC_KEY_RE);
    if (!m || status !== "in-progress") {
      continue;
    }
    const n = m[1];
    const notable = (storiesByEpic.get(epicKey) ?? []).slice(0, 4).join(", ");
    const frag = notable
      ? `Epic ${n} in-progress (${notable})`
      : `Epic ${n} in-progress`;
    parts.push(frag);
  }

  let line = parts.join("; ");
  if (line.length > 120) {
    line = `${line.slice(0, 117)}…`;
  }
  return line || "No epics in-progress in sprint-status.yaml";
}

/**
 * @param {string} epicsMd
 * @param {number} epicNum
 */
export function epicTitleFromEpicsMd(epicsMd, epicNum) {
  const re = new RegExp(`^### Epic ${epicNum}:\\s*(.+)$`, "m");
  const match = epicsMd.match(re);
  return match?.[1]?.trim() ?? null;
}

/**
 * @param {string} staticMd
 */
export function parseStaticActiveRows(staticMd) {
  const section = staticMd.match(
    /## Active projects — operator business rows\s+([\s\S]*?)(?=\n## |\n$)/,
  );
  if (!section) {
    return [];
  }
  const rows = [];
  for (const line of section[1].split("\n")) {
    if (!line.trim().startsWith("|") || line.includes("---")) {
      continue;
    }
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length >= 3 && cells[0] !== "Project") {
      rows.push({ project: cells[0], status: cells[1], nextAction: cells[2] });
    }
  }
  return rows;
}

/**
 * @param {string} staticMd
 */
export function parseStaticRoadmapFallbacks(staticMd) {
  const section = staticMd.match(/## Roadmap — epic theme fallbacks\s+([\s\S]*?)(?=\n## |\n\*\*|$)/);
  /** @type {Map<string, { theme: string, status: string }>} */
  const map = new Map();
  if (!section) {
    return map;
  }
  for (const line of section[1].split("\n")) {
    if (!line.trim().startsWith("|") || line.includes("---")) {
      continue;
    }
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length >= 3 && cells[0].startsWith("epic-")) {
      map.set(cells[0], { theme: cells[1], status: cells[2] });
    }
  }
  return map;
}

/**
 * @param {string} deferredMd
 */
export function parseDeferredSummaryRows(deferredMd) {
  const summaryIdx = deferredMd.indexOf("## Summary table");
  if (summaryIdx === -1) {
    return [];
  }
  const tail = deferredMd.slice(summaryIdx);
  const rows = [];
  for (const line of tail.split("\n")) {
    if (!line.trim().startsWith("|") || line.includes("---")) {
      continue;
    }
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2 || cells[0] === "Item (short)") {
      continue;
    }
    const item = cells[0];
    const klass = cells[cells.length - 1];
    if (!/\(b\)/i.test(klass)) {
      continue;
    }
    rows.push({ item, klass, priority: deriveDeferredPriority(klass) });
  }

  rows.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  return rows.slice(0, 12);
}

/**
 * @param {string} klass
 */
function deriveDeferredPriority(klass) {
  if (/\bP0\b/i.test(klass)) return "P0";
  if (/\bP1\b/i.test(klass) || /High/i.test(klass)) return "P1";
  if (/\bP2\b/i.test(klass) || /Medium/i.test(klass)) return "P2";
  if (/\bP3\b/i.test(klass) || /Low/i.test(klass)) return "P3";
  if (/\bP4\b/i.test(klass)) return "P4";
  return "P9";
}

/**
 * @param {string} p
 */
function priorityRank(p) {
  const order = ["P0", "P1", "P2", "P3", "P4", "P9"];
  const idx = order.indexOf(p);
  return idx === -1 ? 99 : idx;
}

/**
 * @param {{ key: string, status: string }[]} entries
 * @param {string} epicsMd
 * @param {string} staticMd
 */
export function buildActiveProjectsTable(entries, epicsMd, staticMd) {
  const lines = ["| Project | Status | Next action |", "|---|---|---|"];
  const seen = new Set();

  for (const { key, status } of entries) {
    const m = key.match(EPIC_KEY_RE);
    if (!m || status !== "in-progress") {
      continue;
    }
    const epicNum = Number.parseInt(m[1], 10);
    const title = epicTitleFromEpicsMd(epicsMd, epicNum) ?? `Epic ${epicNum}`;
    const storyKeys = [];
    for (const { key: storyKey, status: storyStatus } of entries) {
      const sm = storyKey.match(STORY_EPIC_RE);
      if (!sm || sm[1] !== m[1] || !ACTIVE_PROJECT_STATUSES.has(storyStatus)) {
        continue;
      }
      storyKeys.push(`${storyKey.split("-").slice(0, 2).join("-")} ${storyStatus}`);
      if (storyKeys.length >= 3) {
        break;
      }
    }
    const project = sanitizeTableCell(title);
    seen.add(project.toLowerCase());
    lines.push(
      `| ${project} | in-progress | ${sanitizeTableCell(storyKeys.join(", ") || "—")} |`,
    );
  }

  for (const row of parseStaticActiveRows(staticMd)) {
    if (seen.has(row.project.toLowerCase())) {
      continue;
    }
    lines.push(
      `| ${sanitizeTableCell(row.project)} | ${sanitizeTableCell(row.status)} | ${sanitizeTableCell(row.nextAction)} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

/**
 * @param {{ item: string, klass: string, priority: string }[]} rows
 */
export function formatDeferredSummaryTable(rows) {
  const lines = ["| Item | Priority | Class |", "|---|---|---|"];
  for (const row of rows) {
    lines.push(
      `| ${sanitizeTableCell(row.item)} | ${sanitizeTableCell(row.priority)} | ${sanitizeTableCell(row.klass)} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {{ key: string, status: string }[]} entries
 * @param {string} epicsMd
 * @param {string} staticMd
 */
export function buildRoadmapTable(entries, epicsMd, staticMd) {
  const fallbacks = parseStaticRoadmapFallbacks(staticMd);
  const statusByEpic = new Map();
  for (const { key, status } of entries) {
    const m = key.match(EPIC_KEY_RE);
    if (m) {
      statusByEpic.set(Number.parseInt(m[1], 10), status);
    }
  }

  let minEpic = 38;
  let maxEpic = 42;
  for (const n of statusByEpic.keys()) {
    minEpic = Math.min(minEpic, n);
    maxEpic = Math.max(maxEpic, n);
  }

  const lines = ["| Epic | Theme | Status |", "|---|---|---|"];
  for (let n = minEpic; n <= maxEpic; n += 1) {
    const epicKey = `epic-${n}`;
    const theme =
      epicTitleFromEpicsMd(epicsMd, n) ?? fallbacks.get(epicKey)?.theme ?? `Epic ${n}`;
    const status =
      statusByEpic.get(n) ?? fallbacks.get(epicKey)?.status ?? "planned";
    lines.push(`| ${n} | ${sanitizeTableCell(theme)} | ${sanitizeTableCell(status)} |`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {{
 *   agentsText: string;
 *   sprintYaml: string;
 *   testsLine: string | null;
 *   sessionDate: string;
 *   realClose: boolean;
 *   staticRowsMd: string;
 *   deferredMd: string;
 *   epicsMd: string;
 *   vaultLint: { scanned: number; clean: number; errors: number; warnings: number; stale: boolean };
 *   providerLine: string | null;
 *   skillsCount: number;
 * }} input
 */
export function buildAutoMarkerValues(input) {
  const entries = parseDevelopmentStatus(input.sprintYaml);
  const { version } = parseAgentsSection8(input.agentsText);
  const agentsVersion = version ? `v${version}` : "vunknown";

  const sprintLine = buildSprintNarrative(entries);
  const vaultNotes = String(input.vaultLint.scanned);
  let vaultHealth = `${input.vaultLint.clean}/${input.vaultLint.scanned} clean — ERRORS: ${input.vaultLint.errors}, WARNINGS: ${input.vaultLint.warnings}`;
  if (input.vaultLint.stale) {
    vaultHealth += " — STALE REPORT (>7d); run /vault-lint";
  }

  const provider = input.providerLine ?? "unknown / unknown";
  const testsInner =
    input.testsLine && input.testsLine.length > 0
      ? input.testsLine
      : "FAILED (see session-close log)";

  const lastSession = input.realClose ? input.sessionDate : "";

  return {
    PROVIDER: provider,
    VAULT_NOTES: vaultNotes,
    VAULT_HEALTH: vaultHealth,
    SPRINT: sprintLine,
    AGENTS_VERSION: agentsVersion,
    SKILLS_COUNT: `${input.skillsCount} available`,
    TESTS: testsInner,
    LAST_SESSION: lastSession,
    ACTIVE_PROJECTS: buildActiveProjectsTable(entries, input.epicsMd, input.staticRowsMd),
    DEFERRED_SUMMARY: formatDeferredSummaryTable(parseDeferredSummaryRows(input.deferredMd)),
    ROADMAP: buildRoadmapTable(entries, input.epicsMd, input.staticRowsMd),
  };
}

/**
 * @param {string} text
 * @param {string} date
 * @param {string} agentsVersion e.g. v2.1.12
 * @param {string} providerLine
 */
export function updateRhythmFooter(text, date, agentsVersion, providerLine) {
  const [provider, model] = providerLine.includes(" / ")
    ? providerLine.split(" / ").map((s) => s.trim())
    : [providerLine, "unknown"];
  const footer = `*Last auto-update: ${date} | AGENTS.md ${agentsVersion.replace(/^v/, "")} | Provider: ${provider}/${model}*`;
  if (FOOTER_RE.test(text)) {
    return text.replace(FOOTER_RE, footer);
  }
  return `${text.trimEnd()}\n\n${footer}\n`;
}

/**
 * @param {string} rhythmText
 * @param {Record<string, string>} markers
 * @param {{ date: string; agentsVersion: string; providerLine: string; realClose: boolean }} opts
 */
export function refreshRhythmDocument(rhythmText, markers, opts) {
  let text = applyAutoMarkers(rhythmText, markers);
  if (opts.realClose) {
    text = updateRhythmFooter(text, opts.date, opts.agentsVersion, opts.providerLine);
  }
  return text;
}

/**
 * @param {{
 *   repoRoot: string;
 *   vaultRoot: string;
 *   agentsPath: string;
 *   rhythmPath: string;
 *   staticRowsPath: string;
 *   sprintPath: string;
 *   deferredPath: string;
 *   epicsPath: string;
 *   testsLine: string | null;
 *   dryRun: boolean;
 *   sessionDate?: string;
 * }} opts
 */
export async function loadRhythmRefreshInputs(opts) {
  const [
    agentsText,
    sprintYaml,
    staticRowsMd,
    deferredMd,
    epicsMd,
    vaultLint,
    providerLine,
    skillsCount,
  ] = await Promise.all([
    readFile(opts.agentsPath, "utf8"),
    readFile(opts.sprintPath, "utf8"),
    readFile(opts.staticRowsPath, "utf8").catch(() => ""),
    readFile(opts.deferredPath, "utf8").catch(() => ""),
    readFile(opts.epicsPath, "utf8").catch(() => ""),
    readVaultLintSummary(opts.vaultRoot),
    readHermesProviderLine(),
    countHermesSkills(join(homedir(), ".hermes", "skills")),
  ]);

  const sessionDate =
    opts.sessionDate ??
    new Date().toISOString().slice(0, 10);

  const markers = buildAutoMarkerValues({
    agentsText,
    sprintYaml,
    testsLine: opts.testsLine,
    sessionDate,
    realClose: !opts.dryRun,
    staticRowsMd,
    deferredMd,
    epicsMd,
    vaultLint,
    providerLine,
    skillsCount,
  });

  return { agentsText, markers, providerLine: providerLine ?? "unknown / unknown", sessionDate };
}
