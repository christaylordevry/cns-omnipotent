import {
  extractFirstPriority,
  extractRecentBullets,
  extractSection8Subsection,
} from "./rhythm-markers.mjs";
import { parseDevelopmentStatus } from "./read-sources.mjs";

const MEMORY_CHAR_LIMIT = 2000;
const STORY_DONE_RE = /^(\d+)-(\d+)-/;
const EPIC_KEY_RE = /^epic-(\d+)$/;

/**
 * @param {{ key: string, status: string }[]} entries
 */
export function collectDoneStoryIds(entries) {
  const done = [];
  for (const { key, status } of entries) {
    if (status !== "done" || !STORY_DONE_RE.test(key)) {
      continue;
    }
    const short = key.split("-").slice(0, 2).join("-");
    if (!done.includes(short)) {
      done.push(short);
    }
    if (done.length >= 8) {
      break;
    }
  }
  return done;
}

/**
 * @param {{ key: string, status: string }[]} entries
 */
export function primaryInProgressEpic(entries) {
  for (const { key, status } of entries) {
    const m = key.match(EPIC_KEY_RE);
    if (m && status === "in-progress") {
      return { num: m[1], status };
    }
  }
  return null;
}

/**
 * @param {{
 *   agentsText: string;
 *   sprintYaml: string;
 *   projectStatusLine?: string;
 *   vaultRoot?: string;
 * }} input
 */
export function buildMemoryMarkdown(input) {
  const entries = parseDevelopmentStatus(input.sprintYaml);
  const epic = primaryInProgressEpic(entries);
  const doneIds = collectDoneStoryIds(entries);
  const phaseLine =
    input.projectStatusLine?.trim() ||
    "Phase 6 complete; active epics in sprint-status.yaml";

  const epicFragment = epic
    ? `Epic ${epic.num} ${epic.status}`
    : "no epic in-progress";
  const doneFragment = doneIds.length > 0 ? doneIds.join(", ") : "none this sprint";

  const priorities = extractSection8Subsection(input.agentsText, "### Current Priorities");
  const recent = extractSection8Subsection(input.agentsText, "### Recent Session Context");
  const priority1 = extractFirstPriority(priorities);
  const bullets = extractRecentBullets(recent, 3);
  const vaultLine = input.vaultRoot?.trim() || "Knowledge-Vault-ACTIVE (see CNS_VAULT_ROOT)";

  const body = `## CNS State (auto — /session-close)
${phaseLine}. ${epicFragment}. Done: ${doneFragment}.

## Last Session Decisions
- ${bullets[0]}
- ${bullets[1]}
- ${bullets[2]}

## Environment
- Gateway: WSL \`@reboot\` cron runs \`scripts/hermes-gateway-start.sh\` (idempotent; logs \`~/.hermes/logs/gateway-cron.log\`, reboot wrapper \`gateway-reboot-cron.log\`)
- SOUL.md: remove after every hermes version/gateway start
- Vault: ${vaultLine}/

## Next Session
${priority1}
`;

  if (body.length > MEMORY_CHAR_LIMIT) {
    throw new Error(
      `MEMORY.md body exceeds ${MEMORY_CHAR_LIMIT} characters (${body.length})`,
    );
  }
  return body.endsWith("\n") ? body : `${body}\n`;
}
