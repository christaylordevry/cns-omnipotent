/* global AbortController */
import { clearTimeout, setTimeout } from "node:timers";

export const MS_PER_DAY = 86_400_000;
const DEFAULT_STALE_DAYS = 7;
const DISCORD_POST_TIMEOUT_MS = 10_000;
const ISO_8601_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function readTrimmedEnv(env, key) {
  return typeof env[key] === "string" ? env[key].trim() : "";
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {number}
 */
export function resolveStaleThreshold(env = process.env) {
  const raw = readTrimmedEnv(env, "NOTEBOOK_STALE_DAYS");
  const parsed = /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_DAYS;
}

/**
 * @param {import('./sync-notebook-registry.mjs').NotebookRegistryEntry[]} entries
 * @param {number} staleDays
 * @param {number} [nowMs]
 * @returns {Array<{ entry: import('./sync-notebook-registry.mjs').NotebookRegistryEntry, daysStale: number }>}
 */
export function checkStaleNotebooks(entries, staleDays, nowMs = Date.now()) {
  const results = [];

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry.watch !== true) {
      continue;
    }
    if (entry.last_updated === null || typeof entry.last_updated !== "string") {
      continue;
    }

    if (!ISO_8601_TIMESTAMP_RE.test(entry.last_updated)) {
      continue;
    }

    const lastUpdatedMs = Date.parse(entry.last_updated);
    if (!Number.isFinite(lastUpdatedMs) || lastUpdatedMs > nowMs) {
      continue;
    }

    const daysStale = Math.floor((nowMs - lastUpdatedMs) / MS_PER_DAY);
    if (daysStale >= staleDays) {
      results.push({ entry, daysStale });
    }
  }

  return results;
}

/**
 * @param {{ title: string, last_updated: string | null }} entry
 * @param {number} nowMs
 * @returns {string}
 */
export function buildStaleAlertMessage(entry, nowMs = Date.now()) {
  const lastUpdatedMs =
    typeof entry.last_updated === "string" ? Date.parse(entry.last_updated) : NaN;
  const daysStale = Number.isFinite(lastUpdatedMs)
    ? Math.floor((nowMs - lastUpdatedMs) / MS_PER_DAY)
    : 0;
  return `⚠️ Notebook stale: **${entry.title}** — last updated ${daysStale} days ago`;
}

/**
 * @param {string} channelId
 * @param {string} token
 * @param {string} content
 * @param {typeof fetch} fetchFn
 * @param {number} timeoutMs
 */
async function postDiscordMessage(channelId, token, content, fetchFn, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      process.stderr.write(
        `[stale-alerts] Discord post failed: ${response.status} ${response.statusText}\n`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[stale-alerts] Discord post error: ${message}\n`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {import('./sync-notebook-registry.mjs').NotebookRegistryEntry[]} entries
 * @param {{
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   nowMs?: number,
 *   fetchFn?: typeof fetch,
 *   registryPath?: string,
 *   postTimeoutMs?: number,
 * }} [options]
 * @returns {Promise<void>}
 */
export async function alertStaleNotebooks(entries, options = {}) {
  const env = options.env ?? process.env;
  const nowMs = options.nowMs ?? Date.now();
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const postTimeoutMs = options.postTimeoutMs ?? DISCORD_POST_TIMEOUT_MS;
  const staleDays = resolveStaleThreshold(env);
  const staleNotebooks = checkStaleNotebooks(entries, staleDays, nowMs);

  if (staleNotebooks.length === 0) {
    return;
  }

  const token =
    readTrimmedEnv(env, "HERMES_DISCORD_TOKEN") ||
    readTrimmedEnv(env, "DISCORD_BOT_TOKEN");
  const channelId = readTrimmedEnv(env, "CNS_DISCORD_HERMES_CHANNEL_ID");

  if (!token || !channelId) {
    process.stderr.write("[stale-alerts] Discord not configured — skipping alert posts\n");
    return;
  }

  for (const { entry } of staleNotebooks) {
    await postDiscordMessage(
      channelId,
      token,
      buildStaleAlertMessage(entry, nowMs),
      fetchFn,
      postTimeoutMs,
    );
  }
}
