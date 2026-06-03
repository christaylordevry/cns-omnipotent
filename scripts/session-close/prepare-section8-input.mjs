#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { resolvePaths } from "./lib/paths.mjs";
import { buildContextPack, writeContextPack } from "./prepare-context.mjs";
import {
  estimateTokens,
  SECTION8_EXCERPT_LIMIT,
  truncateToTokens,
} from "./lib/token-estimate.mjs";

export const SECTION8_INPUT_TOKEN_LIMIT = 1200;

/**
 * @param {Record<string, unknown>} pack
 * @returns {Record<string, unknown>}
 */
export function buildSection8Input(pack) {
  const sprint =
    pack.sprint && typeof pack.sprint === "object" && !Array.isArray(pack.sprint)
      ? /** @type {Record<string, unknown>} */ (pack.sprint)
      : {};
  const agents =
    pack.agents && typeof pack.agents === "object" && !Array.isArray(pack.agents)
      ? /** @type {Record<string, unknown>} */ (pack.agents)
      : {};

  const recentStories = Array.isArray(pack.recent_stories)
    ? pack.recent_stories.slice(0, 3).map((story) => {
        if (!story || typeof story !== "object" || Array.isArray(story)) {
          return story;
        }
        const row = /** @type {{ key?: unknown; bullet?: unknown }} */ ({ ...story });
        if (typeof row.bullet === "string") {
          row.bullet = truncateToTokens(row.bullet, 80);
        }
        return row;
      })
    : [];

  /** @type {Record<string, unknown>} */
  const input = {
    generated_at: typeof pack.generated_at === "string" ? pack.generated_at : new Date().toISOString(),
    mode: pack.mode ?? "real",
    sprint: {
      active_epics: sprint.active_epics ?? [],
      project_status_line:
        typeof sprint.project_status_line === "string" ? sprint.project_status_line : "",
    },
    recent_stories: recentStories,
    agents: {
      version: agents.version ?? null,
      section8_excerpt:
        typeof agents.section8_excerpt === "string"
          ? truncateToTokens(agents.section8_excerpt, SECTION8_EXCERPT_LIMIT)
          : "",
      changelog_anchor_row:
        typeof agents.changelog_anchor_row === "string" ? agents.changelog_anchor_row : "",
    },
    token_budget: {
      input_tokens: 0,
      input_limit: SECTION8_INPUT_TOKEN_LIMIT,
    },
  };

  return enforceSection8InputBudget(input);
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
export function enforceSection8InputBudget(input) {
  const next = /** @type {Record<string, unknown>} */ (JSON.parse(JSON.stringify(input)));

  const refresh = () => {
    next.token_budget = {
      input_limit: SECTION8_INPUT_TOKEN_LIMIT,
      input_tokens: estimateTokens(JSON.stringify(next)),
    };
    return next.token_budget.input_tokens <= SECTION8_INPUT_TOKEN_LIMIT;
  };

  if (refresh()) {
    return next;
  }

  if (next.agents && typeof next.agents === "object") {
    const agents = /** @type {Record<string, unknown>} */ (next.agents);
    agents.section8_excerpt = "";
  }
  if (refresh()) {
    return next;
  }

  if (Array.isArray(next.recent_stories)) {
    for (const story of next.recent_stories) {
      if (story && typeof story === "object" && !Array.isArray(story)) {
        const row = /** @type {{ bullet?: unknown }} */ (story);
        if (typeof row.bullet === "string") {
          row.bullet = truncateToTokens(row.bullet, 40);
        }
      }
    }
  }
  if (refresh()) {
    return next;
  }

  if (next.sprint && typeof next.sprint === "object") {
    const sprint = /** @type {Record<string, unknown>} */ (next.sprint);
    if (typeof sprint.project_status_line === "string") {
      sprint.project_status_line = truncateToTokens(sprint.project_status_line, 60);
    }
  }
  if (refresh()) {
    return next;
  }

  let guard = 0;
  while (!refresh() && guard < 100) {
    guard += 1;
    if (Array.isArray(next.recent_stories) && next.recent_stories.length > 0) {
      next.recent_stories.pop();
      continue;
    }
    if (next.sprint && typeof next.sprint === "object") {
      const sprint = /** @type {Record<string, unknown>} */ (next.sprint);
      if (Array.isArray(sprint.active_epics) && sprint.active_epics.length > 0) {
        for (const epic of sprint.active_epics) {
          if (epic && typeof epic === "object" && !Array.isArray(epic)) {
            const row = /** @type {{ stories?: unknown }} */ (epic);
            if (Array.isArray(row.stories) && row.stories.length > 0) {
              row.stories.pop();
              break;
            }
          }
        }
      }
    }
    break;
  }

  refresh();
  return next;
}

/**
 * @param {Record<string, unknown>} input
 * @param {string} outputPath
 */
export async function writeSection8Input(input, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
  return input;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  try {
    const paths = resolvePaths();
    const pack = await buildContextPack({ dryRun });
    await writeContextPack(pack, paths.contextPackPath, { dryRun });
    const input = buildSection8Input(pack);
    if (dryRun) {
      process.stdout.write(
        `session-close: section8-input ready (${input.token_budget.input_tokens}/${input.token_budget.input_limit} tokens) → (dry-run, not written)\n`,
      );
      return;
    }
    await writeSection8Input(input, paths.section8InputPath);
    process.stdout.write(
      `session-close: section8-input ready (${input.token_budget.input_tokens}/${input.token_budget.input_limit} tokens) → ${paths.section8InputPath}\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: prepare-section8-input failed: ${message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: prepare-section8-input failed: ${message}\n`);
    process.exit(1);
  });
}
