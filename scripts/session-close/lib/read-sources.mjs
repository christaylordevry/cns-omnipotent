import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const STORY_BASENAME_RE = /^[0-9]+-[0-9]+-.+\.md$/;
const STORY_EXCLUDE_RE =
  /^(cns-session-handoff-|deferred-work\.md$|epic-.*-retro|.*-retrospective)/i;
const NOTABLE_STORY_STATUSES = new Set(["ready-for-dev", "review", "deferred"]);
const EPIC_KEY_RE = /^epic-(\d+)$/;
const STORY_EPIC_RE = /^(\d+)-\d+-/;
const NOTEBOOK_ID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const LINT_BASENAME_RE = /^vault-lint-(\d{4}-\d{2}-\d{2})\.md$/;

const PROJECT_MAP_CANDIDATES = [
  "03-Resources/notebooklm-project-map.md",
  "03-Resources/NotebookLM-Project-Map.md",
];

/**
 * @param {string} yaml
 * @returns {{ key: string, status: string }[]}
 */
export function parseDevelopmentStatus(yaml) {
  const entries = [];
  let inSection = false;
  for (const line of yaml.split("\n")) {
    if (/^development_status:\s*$/.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) {
      continue;
    }
    const match = line.match(/^ {2}([^:]+):\s*(\S+)(?:\s+#.*)?$/);
    if (match) {
      entries.push({ key: match[1].trim(), status: match[2].trim() });
    }
  }
  return entries;
}

/**
 * @param {{ key: string, status: string }[]} entries
 * @returns {{ id: string, status: string, stories: string[] }[]}
 */
export function buildActiveEpics(entries) {
  const epicStatus = new Map();
  const storiesByEpic = new Map();

  for (const { key, status } of entries) {
    const epicMatch = key.match(EPIC_KEY_RE);
    if (epicMatch) {
      epicStatus.set(key, status);
      continue;
    }
    const storyMatch = key.match(STORY_EPIC_RE);
    if (!storyMatch || !NOTABLE_STORY_STATUSES.has(status)) {
      continue;
    }
    const epicId = `epic-${storyMatch[1]}`;
    if (!storiesByEpic.has(epicId)) {
      storiesByEpic.set(epicId, []);
    }
    storiesByEpic.get(epicId).push(`${key} ${status}`);
  }

  const active = [];
  for (const [id, status] of epicStatus) {
    if (status !== "in-progress") {
      continue;
    }
    active.push({
      id,
      status,
      stories: storiesByEpic.get(id) ?? [],
    });
  }
  return active;
}

/**
 * @param {string} repoRoot
 * @returns {Promise<string>}
 */
export async function readProjectStatusLine(repoRoot) {
  try {
    const claudePath = join(repoRoot, "CLAUDE.md");
    const raw = await readFile(claudePath, "utf8");
    const phaseBlock = raw.match(/## Phase Status\s+([\s\S]*?)(?=\n## |\n---|$)/);
    if (phaseBlock) {
      for (const line of phaseBlock[1].split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("Phase ")) {
          return trimmed.replace(/\.$/, "");
        }
      }
    }
  } catch {
    // fall through
  }
  return "Phase 6 complete; active epics in sprint-status.yaml";
}

/**
 * @param {string} agentsText
 * @returns {{ version: string | null, section8: string, changelogAnchorRow: string | null }}
 */
export function parseAgentsSection8(agentsText) {
  const versionMatch = agentsText.match(/>\s*Version:\s*([0-9.]+)/);
  const version = versionMatch?.[1] ?? null;

  const start = agentsText.indexOf("## 8.");
  const end = agentsText.indexOf("## 9.");
  let section8 = "";
  if (start !== -1 && end !== -1 && end > start) {
    section8 = agentsText.slice(start, end).trimEnd();
  }

  let changelogAnchorRow = null;
  const changelogIdx = agentsText.indexOf("## Changelog");
  if (changelogIdx !== -1) {
    const tail = agentsText.slice(changelogIdx);
    const rowMatch = tail.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*([0-9.]+)\s*\|[^\n]*/m);
    if (rowMatch) {
      changelogAnchorRow = rowMatch[0].trim();
    }
  }

  return { version, section8, changelogAnchorRow };
}

/**
 * @param {string} vaultRoot
 * @returns {Promise<{ scanned: number, clean: number, errors: number, warnings: number, stale: boolean }>}
 */
export async function readVaultLintSummary(vaultRoot) {
  const empty = { scanned: 0, clean: 0, errors: 0, warnings: 0, stale: true };
  const reportsDir = join(vaultRoot, "_meta", "reports");
  let files;
  try {
    files = await readdir(reportsDir);
  } catch {
    return empty;
  }

  const dated = files
    .map((name) => {
      const m = name.match(LINT_BASENAME_RE);
      return m ? { name, date: m[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (dated.length === 0) {
    return empty;
  }

  const newest = dated[0];
  let content;
  try {
    content = await readFile(join(reportsDir, newest.name), "utf8");
  } catch {
    return empty;
  }

  let scanned = 0;
  let clean = 0;
  let errors = 0;
  let warnings = 0;
  for (const line of content.split("\n")) {
    const scannedMatch = line.match(/Scanned:\s*(\d+)/i);
    const cleanMatch = line.match(/Clean:\s*(\d+)/i);
    const errMatch = line.match(/Errors?:\s*(\d+)/i);
    const warnMatch = line.match(/Warnings?:\s*(\d+)/i);
    if (scannedMatch) scanned = Number.parseInt(scannedMatch[1], 10);
    if (cleanMatch) clean = Number.parseInt(cleanMatch[1], 10);
    if (errMatch) errors = Number.parseInt(errMatch[1], 10);
    if (warnMatch) warnings = Number.parseInt(warnMatch[1], 10);
  }

  const reportDate = new Date(`${newest.date}T12:00:00Z`);
  const staleDays = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60 * 24);

  return {
    scanned,
    clean,
    errors,
    warnings,
    stale: staleDays > 7,
  };
}

/**
 * @returns {Promise<string | null>}
 */
export async function readHermesProviderLine() {
  const configPath = join(homedir(), ".hermes", "config.yaml");
  let raw;
  try {
    raw = await readFile(configPath, "utf8");
  } catch {
    return null;
  }
  const providerMatch = raw.match(/^\s*provider:\s*(\S+)/m);
  const modelMatch = raw.match(/^\s*default:\s*(\S+)/m);
  if (!providerMatch && !modelMatch) {
    return null;
  }
  const provider = providerMatch?.[1] ?? "unknown";
  const model = modelMatch?.[1] ?? "unknown";
  return `${provider} / ${model}`;
}

/**
 * @param {string} vaultRoot
 * @param {string} exportPath
 * @returns {Promise<unknown[]>}
 */
export async function readNotebookLmTargets(vaultRoot, exportPath) {
  /** @type {string} */
  let notebookIds = typeof process.env.NOTEBOOKLM_NOTEBOOK_IDS === "string" ? process.env.NOTEBOOKLM_NOTEBOOK_IDS : "";
  if (!notebookIds.trim()) {
    const envPath = join(homedir(), ".hermes", "session-close.env");
    try {
      const rawEnvFile = await readFile(envPath, "utf8");
      for (const line of rawEnvFile.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }
        const match = trimmed.match(/^(?:export\s+)?NOTEBOOKLM_NOTEBOOK_IDS\s*=\s*(.*)$/);
        if (!match) {
          continue;
        }
        let value = (match[1] ?? "").trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1).trim();
        }
        notebookIds = value;
        break;
      }
    } catch {
      // fall through
    }
  }

  if (notebookIds.trim()) {
    const ids = notebookIds
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    if (ids.length > 0) {
      return ids.map((notebook_id) => ({
        notebook_id,
        source_name: "CNS Vault Export",
        source_type: "file",
        file_path: exportPath,
      }));
    }
  }
  for (const rel of PROJECT_MAP_CANDIDATES) {
    const abs = join(vaultRoot, rel);
    let raw;
    try {
      raw = await readFile(abs, "utf8");
    } catch {
      continue;
    }
    const targets = [];
    for (const line of raw.split("\n")) {
      if (!line.trim().startsWith("|") || line.includes("---")) {
        continue;
      }
      const idMatch = line.match(NOTEBOOK_ID_RE);
      if (!idMatch) {
        continue;
      }
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      const title = cells[1] ?? cells[0] ?? "Notebook";
      if (title.includes("unmapped") || title === "—") {
        continue;
      }
      targets.push({ notebook_id: idMatch[0], title });
    }
    if (targets.length > 0) {
      return targets;
    }
  }
  return [];
}

/**
 * @param {string} raw
 * @param {number} maxChars
 */
export function excerptStoryBullet(raw, maxChars = 200) {
  const lines = raw.split("\n");
  let title = "";
  let status = "";
  for (const line of lines) {
    if (!title) {
      const h1 = line.match(/^#\s+(.+)/);
      if (h1) title = h1[1].trim();
    }
    const statusMatch = line.match(/^Status:\s*(.+)/i);
    if (statusMatch) status = statusMatch[1].trim();
  }
  const notesIdx = raw.indexOf("### Completion Notes");
  const devNotesIdx = raw.indexOf("## Dev Notes");
  const sliceEnd =
    notesIdx !== -1 ? notesIdx : devNotesIdx !== -1 ? devNotesIdx : raw.length;
  const body = raw.slice(0, sliceEnd);
  const summary = [title, status].filter(Boolean).join(" — ");
  const flat = body.replace(/\s+/g, " ").trim();
  const bullet = summary ? `${summary}: ${flat}` : flat;
  if (bullet.length <= maxChars) {
    return bullet;
  }
  return `${bullet.slice(0, maxChars - 1)}…`;
}

/**
 * @param {string} artifactsDir
 * @param {number} limit
 */
export async function selectRecentStories(artifactsDir, limit = 3) {
  let names;
  try {
    names = await readdir(artifactsDir);
  } catch {
    return [];
  }

  const candidates = [];
  for (const name of names) {
    if (!STORY_BASENAME_RE.test(name) || STORY_EXCLUDE_RE.test(name)) {
      continue;
    }
    const abs = join(artifactsDir, name);
    try {
      const s = await stat(abs);
      if (!s.isFile()) {
        continue;
      }
      candidates.push({ name, mtimeMs: s.mtimeMs });
    } catch {
      // skip
    }
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const selected = candidates.slice(0, limit);
  const stories = [];

  for (const { name } of selected) {
    const abs = join(artifactsDir, name);
    const raw = await readFile(abs, "utf8");
    const titleMatch = raw.match(/^#\s+(.+)$/m);
    const statusMatch = raw.match(/^Status:\s*(.+)$/im);
    stories.push({
      basename: name.replace(/\.md$/, ""),
      title: titleMatch?.[1]?.trim() ?? name,
      status: statusMatch?.[1]?.trim() ?? "unknown",
      bullet: excerptStoryBullet(raw, 200),
    });
  }

  return stories;
}

/**
 * @param {string} sprintPath
 * @param {string} repoRoot
 */
export async function readSprintSnapshot(sprintPath, repoRoot) {
  const yaml = await readFile(sprintPath, "utf8");
  const entries = parseDevelopmentStatus(yaml);
  const active_epics = buildActiveEpics(entries);
  const project_status_line = await readProjectStatusLine(repoRoot);
  return { active_epics, project_status_line };
}
