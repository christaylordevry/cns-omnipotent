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
 *   youtube?: { videos?: Array<{ title?: string; url?: string; channelTitle?: string; publishedAt?: string; viewCount?: number; likeCount?: number; commentCount?: number }> };
 *   tiktok?: { videos?: Array<{ title?: string; url?: string; author?: string; publishedAt?: string; viewCount?: number; likeCount?: number; commentCount?: number }> };
 *   instagram?: { reels?: Array<{ title?: string; url?: string; author?: string; publishedAt?: string; viewCount?: number; likeCount?: number; commentCount?: number }> };
 *   pinterest?: { pins?: Array<{ title?: string; description?: string; url?: string; link?: string; author?: string; pinId?: string; publishedAt?: string; repinCount?: number }> };
 *   polymarket?: { markets?: Array<{ question?: string; url?: string; marketId?: string; conditionId?: string; slug?: string; outcomes?: string[]; outcomePrices?: number[]; leadingOutcome?: string; leadingProbability?: number; volumeUsd?: number; volume24hrUsd?: number; liquidityUsd?: number; endDate?: string; updatedAt?: string }> };
 *   threads?: { posts?: Array<{ title?: string; url?: string; likes?: number; reposts?: number; replies?: number; authorHandle?: string; author?: string; publishedAt?: string; postCode?: string; postId?: string }> };
 *   linkedin?: { posts?: Array<{ title?: string; url?: string; likes?: number; commentCount?: number; authorHandle?: string; author?: string; publishedAt?: string; postId?: string }> };
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

  for (const video of sources.youtube?.videos ?? []) {
    const title = String(video.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(video.url ?? '').trim() || undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'youtube',
        sourceType: 'youtube',
        title,
        summary: truncateSummary(title, 200),
        url,
        rank: rank++,
        externalId: url ? shortSha256(url) : shortSha256(`${title}:${date}`),
        sourceMetadata: omitUndefinedKeys({
          viewCount: typeof video.viewCount === 'number' ? video.viewCount : undefined,
          likes: typeof video.likeCount === 'number' ? video.likeCount : undefined,
          commentCount: typeof video.commentCount === 'number' ? video.commentCount : undefined,
          author: video.channelTitle,
          publishedAt: video.publishedAt,
        }),
      }),
    );
  }

  for (const video of sources.tiktok?.videos ?? []) {
    const title = String(video.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(video.url ?? '').trim() || undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'tiktok',
        sourceType: 'tiktok',
        title,
        summary: truncateSummary(title, 200),
        url,
        rank: rank++,
        externalId: url ? shortSha256(url) : shortSha256(`${title}:${date}`),
        sourceMetadata: omitUndefinedKeys({
          viewCount: typeof video.viewCount === 'number' ? video.viewCount : undefined,
          likes: typeof video.likeCount === 'number' ? video.likeCount : undefined,
          commentCount: typeof video.commentCount === 'number' ? video.commentCount : undefined,
          author: video.author,
          publishedAt: video.publishedAt,
        }),
      }),
    );
  }

  for (const reel of sources.instagram?.reels ?? []) {
    const title = String(reel.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(reel.url ?? '').trim() || undefined;
    signals.push(
      omitUndefinedKeys({
        section: 'instagram',
        sourceType: 'instagram',
        title,
        summary: truncateSummary(title, 200),
        url,
        rank: rank++,
        externalId: url ? shortSha256(url) : shortSha256(`${title}:${date}`),
        sourceMetadata: omitUndefinedKeys({
          viewCount: typeof reel.viewCount === 'number' ? reel.viewCount : undefined,
          likes: typeof reel.likeCount === 'number' ? reel.likeCount : undefined,
          commentCount: typeof reel.commentCount === 'number' ? reel.commentCount : undefined,
          author: reel.author,
          publishedAt: reel.publishedAt,
        }),
      }),
    );
  }

  for (const pin of sources.pinterest?.pins ?? []) {
    const title = String(pin.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(pin.url ?? '').trim() || undefined;
    const summarySource = String(pin.description ?? pin.title ?? '').trim();
    const pinId = String(pin.pinId ?? '').trim();
    signals.push(
      omitUndefinedKeys({
        section: 'pinterest',
        sourceType: 'pinterest',
        title,
        summary: truncateSummary(summarySource, 200),
        url,
        rank: rank++,
        externalId: pinId || (url ? shortSha256(url) : shortSha256(`${title}:${date}`)),
        sourceMetadata: omitUndefinedKeys({
          upvotes: typeof pin.repinCount === 'number' ? pin.repinCount : undefined,
          author: pin.author,
          publishedAt: pin.publishedAt,
        }),
      }),
    );
  }

  for (const market of sources.polymarket?.markets ?? []) {
    const title = String(market.question ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(market.url ?? '').trim() || undefined;
    const leadingOutcome = String(market.leadingOutcome ?? '').trim();
    const leadingProbability =
      typeof market.leadingProbability === 'number' ? market.leadingProbability : undefined;
    const pct =
      leadingProbability != null ? Math.round(leadingProbability * 1000) / 10 : undefined;
    const volume24hr =
      typeof market.volume24hrUsd === 'number' ? market.volume24hrUsd : undefined;
    const liquidity =
      typeof market.liquidityUsd === 'number' ? market.liquidityUsd : undefined;
    const summaryParts = [];
    if (leadingOutcome && pct != null) {
      summaryParts.push(`${leadingOutcome} ${pct}%`);
    }
    if (volume24hr != null) {
      summaryParts.push(`vol $${Math.round(volume24hr).toLocaleString('en-US')}`);
    }
    if (liquidity != null) {
      summaryParts.push(`liq $${Math.round(liquidity).toLocaleString('en-US')}`);
    }
    const marketId = String(market.marketId ?? '').trim();
    const conditionId = String(market.conditionId ?? '').trim();
    signals.push(
      omitUndefinedKeys({
        section: 'polymarket',
        sourceType: 'polymarket',
        title,
        summary: truncateSummary(summaryParts.join(' · '), 200),
        url,
        rank: rank++,
        externalId:
          marketId ||
          (conditionId
            ? shortSha256(conditionId).slice(0, 16)
            : url
              ? shortSha256(url)
              : shortSha256(`${title}:${date}`)),
        sourceMetadata: omitUndefinedKeys({
          outcomes: Array.isArray(market.outcomes) ? market.outcomes : undefined,
          outcomePrices: Array.isArray(market.outcomePrices) ? market.outcomePrices : undefined,
          leadingOutcome: leadingOutcome || undefined,
          leadingProbability,
          volumeUsd: typeof market.volumeUsd === 'number' ? market.volumeUsd : undefined,
          upvotes: volume24hr,
          liquidityUsd: liquidity,
          publishedAt: market.endDate ?? market.updatedAt,
        }),
      }),
    );
  }

  for (const post of sources.threads?.posts ?? []) {
    const title = String(post.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(post.url ?? '').trim() || undefined;
    const postId = String(post.postId ?? '').trim();
    const postCode = String(post.postCode ?? '').trim();
    signals.push(
      omitUndefinedKeys({
        section: 'threads',
        sourceType: 'threads',
        title,
        summary: truncateSummary(title, 200),
        url,
        rank: rank++,
        externalId:
          postId ||
          (postCode ? shortSha256(postCode).slice(0, 16) : url ? shortSha256(url) : shortSha256(`${title}:${date}`)),
        sourceMetadata: omitUndefinedKeys({
          likes: post.likes,
          reposts: post.reposts,
          replies: post.replies,
          authorHandle: post.authorHandle,
          author: post.author,
          publishedAt: post.publishedAt,
        }),
      }),
    );
  }

  for (const post of sources.linkedin?.posts ?? []) {
    const title = String(post.title ?? '').trim();
    if (!title) {
      continue;
    }
    const url = String(post.url ?? '').trim() || undefined;
    const postId = String(post.postId ?? '').trim();
    signals.push(
      omitUndefinedKeys({
        section: 'linkedin',
        sourceType: 'linkedin',
        title,
        summary: truncateSummary(title, 200),
        url,
        rank: rank++,
        externalId:
          postId || (url ? shortSha256(url).slice(0, 16) : shortSha256(`${title}:${date}`)),
        sourceMetadata: omitUndefinedKeys({
          likes: post.likes,
          commentCount: post.commentCount,
          authorHandle: post.authorHandle,
          author: post.author,
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
