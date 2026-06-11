/* global AbortController */
import { clearTimeout, setTimeout } from 'node:timers';

import { resolveDigestMarkdownFromPayload } from './parse-digest-source-outcomes.mjs';

const DEFAULT_HERMES_CHANNEL_ID = '1500733488897462382';
const DISCORD_MAX_CONTENT = 2000;
const DISCORD_POST_TIMEOUT_MS = 10_000;

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} key
 * @returns {string}
 */
function readTrimmedEnv(env, key) {
  return typeof env[key] === 'string' ? env[key].trim() : '';
}

/**
 * Split long text at word-safe boundaries (space, newline, or paragraph break).
 *
 * @param {string} segment
 * @param {number} maxLen
 * @returns {string[]}
 */
function splitLongSegment(segment, maxLen) {
  /** @type {string[]} */
  const pieces = [];
  let remaining = segment;

  while (remaining.length > maxLen) {
    const slice = remaining.slice(0, maxLen);
    let splitAt = slice.lastIndexOf('\n\n');
    if (splitAt <= 0) {
      splitAt = slice.lastIndexOf('\n');
    }
    if (splitAt <= 0) {
      splitAt = slice.lastIndexOf(' ');
    }
    if (splitAt <= 0) {
      splitAt = maxLen;
    }
    pieces.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) {
    pieces.push(remaining);
  }

  return pieces;
}

/**
 * Split digest markdown into Discord message chunks (2000 char limit).
 * Prefers double-newline paragraph boundaries; falls back to word boundaries.
 *
 * @param {string} content
 * @param {number} [maxLen]
 * @returns {string[]}
 */
export function splitDiscordMessages(content, maxLen = DISCORD_MAX_CONTENT) {
  const text = String(content ?? '').trim();
  if (!text) {
    return [];
  }
  if (text.length <= maxLen) {
    return [text];
  }

  /** @type {string[]} */
  const result = [];
  const blocks = text.split(/\n\n+/);
  let current = '';

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }

    if (current) {
      result.push(current);
      current = '';
    }

    if (block.length <= maxLen) {
      current = block;
      continue;
    }

    const pieces = splitLongSegment(block, maxLen);
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i];
      if (i === pieces.length - 1 && piece.length <= maxLen) {
        current = piece;
      } else {
        result.push(piece);
      }
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

/**
 * @param {string} channelId
 * @param {string} token
 * @param {string} content
 * @param {typeof fetch} fetchFn
 * @param {number} timeoutMs
 * @returns {Promise<{ ok: true; messageId: string } | { ok: false; error: string }>}
 */
async function postDiscordMessage(channelId, token, content, fetchFn, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const error = `Discord post failed: ${response.status} ${response.statusText}`;
      process.stderr.write(`[digest-discord] ${error}\n`);
      return { ok: false, error };
    }

    const data = await response.json();
    const messageId = typeof data?.id === 'string' ? data.id : '';
    return { ok: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[digest-discord] Discord post error: ${message}\n`);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Post morning digest markdown to Discord #hermes via REST API (non-fatal).
 *
 * @param {Record<string, unknown>} payload
 * @param {Record<string, string | undefined>} env
 * @param {{ fetchFn?: typeof fetch; postTimeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean; messageIds: string[]; error?: string }>}
 */
export async function postDigestToDiscord(payload, env, options = {}) {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const postTimeoutMs = options.postTimeoutMs ?? DISCORD_POST_TIMEOUT_MS;
  const token = readTrimmedEnv(env, 'HERMES_DISCORD_TOKEN');
  const channelId =
    readTrimmedEnv(env, 'CNS_DISCORD_HERMES_CHANNEL_ID') || DEFAULT_HERMES_CHANNEL_ID;

  if (!token) {
    process.stderr.write('[digest-discord] HERMES_DISCORD_TOKEN missing — skipping Discord post\n');
    return { ok: false, messageIds: [], error: 'HERMES_DISCORD_TOKEN missing' };
  }

  const markdown = resolveDigestMarkdownFromPayload(payload);
  if (!markdown) {
    process.stderr.write('[digest-discord] No digest markdown in payload — skipping Discord post\n');
    return { ok: false, messageIds: [], error: 'no digest markdown' };
  }

  const chunks = splitDiscordMessages(markdown);
  if (chunks.length === 0) {
    return { ok: false, messageIds: [], error: 'empty digest markdown' };
  }

  /** @type {string[]} */
  const messageIds = [];

  for (const chunk of chunks) {
    const result = await postDiscordMessage(channelId, token, chunk, fetchFn, postTimeoutMs);
    if (!result.ok) {
      return { ok: false, messageIds, error: result.error };
    }
    if (result.messageId) {
      messageIds.push(result.messageId);
    }
  }

  return { ok: true, messageIds };
}
