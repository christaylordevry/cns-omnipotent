export const PACK_TOKEN_LIMIT = 3500;
export const SECTION8_EXCERPT_LIMIT = 1200;

/**
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil((text ?? "").length / 4);
}

/**
 * @param {string} text
 * @param {number} maxTokens
 * @returns {string}
 */
export function truncateToTokens(text, maxTokens) {
  if (!text || maxTokens <= 0) {
    return "";
  }
  if (estimateTokens(text) <= maxTokens) {
    return text;
  }
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (estimateTokens(text.slice(0, mid)) <= maxTokens) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, lo);
}

/**
 * @param {Record<string, unknown>} pack
 * @returns {number}
 */
export function estimatePackTokens(pack) {
  return estimateTokens(JSON.stringify(pack));
}

/**
 * @param {Record<string, unknown>} pack
 */
function clonePack(pack) {
  return /** @type {Record<string, unknown>} */ (JSON.parse(JSON.stringify(pack)));
}

/**
 * @param {Record<string, unknown>} pack
 * @param {number} limit
 */
function refreshTokenBudget(pack, limit) {
  pack.token_budget = {
    pack_limit: limit,
    pack_tokens: estimatePackTokens(pack),
  };
  return pack.token_budget.pack_tokens <= limit;
}

/**
 * @param {unknown} targets
 * @param {number} maxTitleChars
 */
function shortenNotebooklmTitles(targets, maxTitleChars) {
  if (!Array.isArray(targets)) {
    return;
  }
  for (const row of targets) {
    if (row && typeof row.title === "string") {
      row.title = truncateStoryBullet(row.title, maxTitleChars);
    }
  }
}

/**
 * Enforce ADR-SC-002: drop section8 first, then shorten story bullets; never drop sprint.active_epics.
 * Further reductions trim notebooklm targets and other non-sprint fields until pack_tokens <= limit.
 *
 * @param {Record<string, unknown>} pack
 * @param {number} [limit]
 * @returns {Record<string, unknown>}
 */
export function enforceTokenBudget(pack, limit = PACK_TOKEN_LIMIT) {
  const next = clonePack(pack);

  if (next.agents?.section8_excerpt) {
    next.agents.section8_excerpt = truncateToTokens(
      String(next.agents.section8_excerpt),
      SECTION8_EXCERPT_LIMIT,
    );
  }

  if (refreshTokenBudget(next, limit)) {
    return next;
  }

  if (next.agents) {
    next.agents.section8_excerpt = "";
  }
  if (refreshTokenBudget(next, limit)) {
    return next;
  }

  if (Array.isArray(next.recent_stories)) {
    for (const story of next.recent_stories) {
      if (story && typeof story.bullet === "string") {
        story.bullet = truncateStoryBullet(story.bullet, 40);
      }
    }
  }
  if (refreshTokenBudget(next, limit)) {
    return next;
  }

  if (Array.isArray(next.recent_stories)) {
    for (const story of next.recent_stories) {
      if (story && typeof story.bullet === "string") {
        story.bullet = truncateStoryBullet(story.bullet, 20);
      }
    }
  }
  if (refreshTokenBudget(next, limit)) {
    return next;
  }

  shortenNotebooklmTitles(next.notebooklm_targets, 80);
  if (refreshTokenBudget(next, limit)) {
    return next;
  }

  shortenNotebooklmTitles(next.notebooklm_targets, 40);
  if (refreshTokenBudget(next, limit)) {
    return next;
  }

  if (next.sprint && typeof next.sprint.project_status_line === "string") {
    next.sprint.project_status_line = truncateStoryBullet(next.sprint.project_status_line, 120);
  }
  if (refreshTokenBudget(next, limit)) {
    return next;
  }

  let guard = 0;
  while (!refreshTokenBudget(next, limit) && guard < 10_000) {
    guard += 1;
    if (Array.isArray(next.notebooklm_targets) && next.notebooklm_targets.length > 0) {
      next.notebooklm_targets.pop();
      continue;
    }
    if (Array.isArray(next.recent_stories) && next.recent_stories.length > 0) {
      next.recent_stories.pop();
      continue;
    }
    if (next.deterministic && typeof next.deterministic === "object") {
      const det = /** @type {Record<string, unknown>} */ (next.deterministic);
      if (typeof det.hermes_provider === "string" && det.hermes_provider.length > 0) {
        det.hermes_provider = null;
        continue;
      }
      if (typeof det.export_path === "string" && det.export_path.length > 40) {
        det.export_path = truncateStoryBullet(det.export_path, 40);
        continue;
      }
    }
    if (next.sprint && typeof next.sprint === "object") {
      const sprint = /** @type {Record<string, unknown>} */ (next.sprint);
      if (typeof sprint.project_status_line === "string" && sprint.project_status_line.length > 20) {
        sprint.project_status_line = truncateStoryBullet(sprint.project_status_line, 20);
        continue;
      }
      if (Array.isArray(sprint.active_epics)) {
        for (const epic of sprint.active_epics) {
          if (epic && Array.isArray(epic.stories) && epic.stories.length > 0) {
            epic.stories = epic.stories.map((s) =>
              typeof s === "string" ? truncateStoryBullet(s, 24) : s,
            );
            break;
          }
        }
        if (refreshTokenBudget(next, limit)) {
          return next;
        }
      }
    }
    break;
  }

  refreshTokenBudget(next, limit);
  return next;
}

/**
 * @param {string} bullet
 * @param {number} maxChars
 */
function truncateStoryBullet(bullet, maxChars) {
  const trimmed = bullet.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxChars - 1))}…`;
}
