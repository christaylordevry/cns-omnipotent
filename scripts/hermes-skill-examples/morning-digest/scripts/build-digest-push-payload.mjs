#!/usr/bin/env node
/**
 * Build unscored digest_push_payload from adapter stdout JSON (Story 68-10).
 * Used by run-digest-convex-completion.mjs when agent skips §9 map under compression.
 */

import { createHash } from 'node:crypto';

/**
 * @param {string} input
 * @returns {string}
 */
export function shortSha256(input) {
  return createHash('sha256').update(String(input)).digest('hex').slice(0, 16);
}

/**
 * @param {string | undefined} text
 * @param {number} max
 * @returns {string | undefined}
 */
export function truncateSummary(text, max = 200) {
  const normalized = String(text ?? '').trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length <= max) {
    return normalized;
  }
  return normalized.slice(0, max).trim();
}

/**
 * @param {string | undefined} link
 * @returns {string | undefined}
 */
export function extractArxivId(link) {
  const match = String(link ?? '').match(/(\d{4}\.\d{4,5})/);
  return match ? match[1] : undefined;
}

/**
 * @param {string | undefined} link
 * @returns {string | undefined}
 */
export function extractHnItemId(link) {
  const match = String(link ?? '').match(/[?&]id=(\d+)/);
  return match ? match[1] : undefined;
}

/**
 * @param {Record<string, unknown>} opts
 * @returns {Record<string, unknown>}
 */
function omitUndefinedKeys(opts) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(opts)) {
    if (value !== undefined && value !== null) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * @param {{
 *   date: string;
 *   ranAt: number;
 *   trends?: { events?: Array<{ keyword?: string; normalizedValue?: number }> };
 *   newsapi?: { headlines?: Array<{ title?: string; url?: string }> };
 *   deepSignal?: string;
 *   arxiv?: { papers?: Array<{ title?: string; snippet?: string; link?: string; category?: string }> };
 *   hackernews?: { stories?: Array<{ title?: string; link?: string; score?: number; comments?: number }> };
 *   github?: { repos?: Array<{ title?: string; url?: string; stars?: number; forks?: number; publishedAt?: string }> };
 *   reddit?: { posts?: Array<{ title?: string; url?: string; upvotes?: number; commentCount?: number; publishedAt?: string }> };
 *   rss?: { entries?: Array<{ title?: string; url?: string; publishedAt?: string; author?: string }> };
 *   producthunt?: { launches?: Array<{ title?: string; tagline?: string; url?: string; votesCount?: number; createdAt?: string }> };
 *   twitter?: { posts?: Array<{ title?: string; url?: string; likes?: number; reposts?: number; replies?: number; quotes?: number; authorHandle?: string; publishedAt?: string }> };
 *   bluesky?: { posts?: Array<{ title?: string; url?: string; likes?: number; reposts?: number; replies?: number; quotes?: number; authorHandle?: string; publishedAt?: string }> };
 *   runMeta?: {
 *     topTrend?: string;
 *     focusKeyword?: string;
 *     deepSignalSummary?: string;
 *     notebookId?: string;
 *     vaultContextSummary?: string;
 *   };
 * }} sources
 * @returns {{ run: Record<string, unknown>; signals: Array<Record<string, unknown>> }}
 */
export function buildDigestPushPayload(sources) {
  const { date, ranAt, runMeta = {} } = sources;
  /** @type {Array<Record<string, unknown>>} */
  const signals = [];
  let rank = 1;

  const events = sources.trends?.events ?? [];
  for (const event of events) {
    const keyword = String(event.keyword ?? '').trim();
    if (!keyword) {
      continue;
    }
    signals.push(
      omitUndefinedKeys({
        section: 'trends',
        sourceType: 'google_trends',
        title: keyword,
        score:
          typeof event.normalizedValue === 'number' ? event.normalizedValue : undefined,
        rank: rank++,
        externalId: shortSha256(`${keyword}:${date}`),
      }),
    );
  }

  for (const headline of sources.newsapi?.headlines ?? []) {
    const title = String(headline.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(headline.url ?? '').trim() || undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'headlines',
        sourceType: 'newsapi',
        title,
        url,
        rank: rank++,
        externalId: url ? shortSha256(url) : shortSha256(`${title}:${date}`),
      }),
    );
  }

  const deepSignal = String(sources.deepSignal ?? '').trim();
  if (deepSignal) {
    signals.push(
      omitUndefinedKeys({
        section: 'deep_signal',
        sourceType: 'deep_signal',
        title: truncateSummary(deepSignal, 80) ?? 'Deep Signal',
        summary: deepSignal,
        rank: rank++,
        externalId: shortSha256(`${date}:${runMeta.topTrend ?? 'deep'}`),
      }),
    );
  }

  for (const paper of sources.arxiv?.papers ?? []) {
    const title = String(paper.title ?? '').trim();
    if (!title) {
      continue;
    }
    const link = String(paper.link ?? '').trim() || undefined;
    const snippet = String(paper.snippet ?? '').trim() || undefined;
    const categories = paper.category ? [String(paper.category)] : undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'arxiv',
        sourceType: 'arxiv',
        title,
        summary: snippet,
        url: link,
        rank: rank++,
        externalId: extractArxivId(link) ?? (link ? shortSha256(link) : shortSha256(`${title}:${date}`)),
        sourceMetadata: categories ? { categories } : undefined,
      }),
    );
  }

  for (const story of sources.hackernews?.stories ?? []) {
    const title = String(story.title ?? '').trim();
    if (!title) {
      continue;
    }
    const link = String(story.link ?? '').trim() || undefined;
    const points = typeof story.score === 'number' ? story.score : undefined;
    const commentCount = typeof story.comments === 'number' ? story.comments : undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'hackernews',
        sourceType: 'hackernews',
        title,
        url: link,
        score: points,
        rank: rank++,
        externalId:
          extractHnItemId(link) ?? (link ? shortSha256(link) : shortSha256(`${title}:${date}`)),
        sourceMetadata: omitUndefinedKeys({ points, commentCount }),
      }),
    );
  }

  for (const repo of sources.github?.repos ?? []) {
    const title = String(repo.title ?? '').trim();
    const url = String(repo.url ?? '').trim();
    if (!title || !url) {
      continue;
    }
    signals.push(
      omitUndefinedKeys({
        section: 'github',
        sourceType: 'github',
        title,
        url,
        rank: rank++,
        externalId: shortSha256(url),
        sourceMetadata: omitUndefinedKeys({
          stars: typeof repo.stars === 'number' ? repo.stars : undefined,
          forks: typeof repo.forks === 'number' ? repo.forks : undefined,
          publishedAt: repo.publishedAt,
        }),
      }),
    );
  }

  for (const post of sources.reddit?.posts ?? []) {
    const title = String(post.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(post.url ?? '').trim() || undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'reddit',
        sourceType: 'reddit',
        title,
        url,
        rank: rank++,
        externalId: url ? shortSha256(url) : shortSha256(`${title}:${date}`),
        sourceMetadata: omitUndefinedKeys({
          upvotes: typeof post.upvotes === 'number' ? post.upvotes : undefined,
          commentCount: typeof post.commentCount === 'number' ? post.commentCount : undefined,
          publishedAt: post.publishedAt,
        }),
      }),
    );
  }

  for (const entry of sources.rss?.entries ?? []) {
    const title = String(entry.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(entry.url ?? '').trim() || undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'rss',
        sourceType: 'rss',
        title,
        url,
        rank: rank++,
        externalId: url ? shortSha256(url) : shortSha256(`${title}:${date}`),
        sourceMetadata: omitUndefinedKeys({
          publishedAt: entry.publishedAt,
          author: entry.author,
        }),
      }),
    );
  }

  for (const launch of sources.producthunt?.launches ?? []) {
    const title = String(launch.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(launch.url ?? '').trim() || undefined;
    const tagline = String(launch.tagline ?? '').trim() || undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'producthunt',
        sourceType: 'producthunt',
        title,
        summary: tagline,
        url,
        rank: rank++,
        externalId: url ? shortSha256(url) : shortSha256(`${title}:${date}`),
        sourceMetadata: omitUndefinedKeys({
          upvotes: typeof launch.votesCount === 'number' ? launch.votesCount : undefined,
          publishedAt: launch.createdAt,
        }),
      }),
    );
  }

  for (const post of sources.twitter?.posts ?? []) {
    const title = String(post.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(post.url ?? '').trim() || undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'twitter',
        sourceType: 'twitter',
        title,
        summary: truncateSummary(title, 200),
        url,
        rank: rank++,
        externalId: url ? shortSha256(url) : shortSha256(`${title}:${date}`),
        sourceMetadata: omitUndefinedKeys({
          likes: post.likes,
          reposts: post.reposts,
          replies: post.replies,
          quotes: post.quotes,
          authorHandle: post.authorHandle,
          publishedAt: post.publishedAt,
        }),
      }),
    );
  }

  for (const post of sources.bluesky?.posts ?? []) {
    const title = String(post.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(post.url ?? '').trim() || undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'bluesky',
        sourceType: 'bluesky',
        title,
        summary: truncateSummary(title, 200),
        url,
        rank: rank++,
        externalId: url ? shortSha256(url) : shortSha256(`${title}:${date}`),
        sourceMetadata: omitUndefinedKeys({
          likes: post.likes,
          reposts: post.reposts,
          replies: post.replies,
          quotes: post.quotes,
          authorHandle: post.authorHandle,
          publishedAt: post.publishedAt,
        }),
      }),
    );
  }

  return {
    run: omitUndefinedKeys({
      date,
      ranAt,
      topTrend: runMeta.topTrend,
      focusKeyword: runMeta.focusKeyword,
      deepSignalSummary: runMeta.deepSignalSummary ?? (deepSignal || undefined),
      notebookId: runMeta.notebookId,
      vaultContextSummary: runMeta.vaultContextSummary,
    }),
    signals,
  };
}
