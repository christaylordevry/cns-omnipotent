/**
 * Deterministic AGENTS §8 patch (FR-18 / SC-4).
 * Draft convention: fragment only (no `## 8.` heading); apply adds `## 8. Current Focus`.
 */

/**
 * @param {string} version
 * @returns {string}
 */
export function bumpPatchVersion(version) {
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid AGENTS version: ${version}`);
  }
  parts[2] += 1;
  return parts.join(".");
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function formatLocalDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @param {string} draft
 * @returns {string}
 */
export function normalizeSection8Draft(draft) {
  let text = draft.trim();
  if (!text) {
    throw new Error("section8 draft is empty");
  }
  if (/^##\s+8\./m.test(text)) {
    text = text.replace(/^##\s+8\.[^\n]*\n?/, "").trimStart();
  }
  if (!text) {
    throw new Error("section8 draft is empty after removing ## 8. header");
  }
  return `## 8. Current Focus\n\n${text}`.trimEnd();
}

/**
 * @param {string} agentsText
 * @param {string} section8Block normalized block including ## 8. heading
 * @returns {string}
 */
export function replaceSection8InAgents(agentsText, section8Block) {
  const start = agentsText.indexOf("## 8.");
  const end = agentsText.indexOf("## 9.");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AGENTS.md missing ## 8. or ## 9. section boundaries");
  }
  const before = agentsText.slice(0, start);
  const after = agentsText.slice(end);
  const section = section8Block.endsWith("\n") ? section8Block : `${section8Block}\n`;
  return `${before}${section}\n${after}`;
}

/**
 * @param {string} text
 * @param {string} newVersion
 * @param {string} dateStr
 * @returns {string}
 */
export function patchAgentsVersionHeader(text, newVersion, dateStr) {
  const patched = text.replace(
    />\s*Version:\s*[0-9.]+\s*\|\s*Last updated:\s*\d{4}-\d{2}-\d{2}/,
    `> Version: ${newVersion} | Last updated: ${dateStr}`,
  );
  if (patched === text) {
    throw new Error("AGENTS.md missing > Version: | Last updated: header blockquote");
  }
  return patched;
}

/**
 * @param {string} text
 * @param {string} row full markdown table row
 * @returns {string}
 */
export function insertChangelogRow(text, row) {
  const changelogIdx = text.indexOf("## Changelog");
  if (changelogIdx === -1) {
    throw new Error("AGENTS.md missing ## Changelog section");
  }

  const tail = text.slice(changelogIdx);
  const lines = tail.split("\n");
  let insertAt = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\|\s*Date\s*\|/i.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^\|[-|\s]+\|$/.test(lines[j])) {
          insertAt = j + 1;
          break;
        }
      }
      break;
    }
  }
  if (insertAt === -1) {
    throw new Error("Could not locate changelog table rows in AGENTS.md");
  }

  lines.splice(insertAt, 0, row);
  return text.slice(0, changelogIdx) + lines.join("\n");
}

/**
 * @param {string} dateStr
 * @param {string} version
 * @param {string} message
 * @returns {string}
 */
export function buildChangelogRow(dateStr, version, message) {
  return `| ${dateStr} | ${version} | ${message} |`;
}

const DEFAULT_CHANGELOG_MESSAGE =
  "Section 8 applied via session-close apply-section8.mjs; current focus from context pack.";

/**
 * @param {string} agentsText
 * @param {string} section8Draft raw LLM draft (fragment or with ## 8. header)
 * @param {{
 *   dateStr?: string;
 *   changelogMessage?: string;
 *   versionOverride?: string;
 * }} [options]
 */
export function applySection8ToAgentsText(agentsText, section8Draft, options = {}) {
  const dateStr = options.dateStr ?? formatLocalDate();
  const versionMatch = agentsText.match(/>\s*Version:\s*([0-9.]+)/);
  if (!versionMatch) {
    throw new Error("AGENTS.md missing > Version: header");
  }
  const newVersion = options.versionOverride ?? bumpPatchVersion(versionMatch[1]);
  const section8Block = normalizeSection8Draft(section8Draft);
  let next = replaceSection8InAgents(agentsText, section8Block);
  next = patchAgentsVersionHeader(next, newVersion, dateStr);
  const changelogMessage = options.changelogMessage ?? DEFAULT_CHANGELOG_MESSAGE;
  const changelogRow = buildChangelogRow(dateStr, newVersion, changelogMessage);
  next = insertChangelogRow(next, changelogRow);
  return { text: next, newVersion, changelogRow, section8Block };
}
