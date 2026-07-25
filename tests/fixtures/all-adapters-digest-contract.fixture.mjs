/**
 * OPS-2 Phase B — exhaustive all-adapter fixture for contract fixture sweep (AC3/AC4).
 *
 * Covers every COLLECT_ADAPTER_TASK_KEYS entry with at least one emitted signal.
 * Includes a shared URL across newsapi + rss + hackernews so dedupe merges and
 * exercises contributingSources / dedupClusterSize (dedupe-digest-signals.mjs:446).
 */

/** Shared URL for an EXTRA cross-source dedupe cluster (does not replace per-adapter rows). */
export const DEDUPE_CLUSTER_URL = 'https://tech.example.com/ops2-contract-cluster-article';

/**
 * Adapter stdout-shaped inputs for buildDigestPushPayload — one unique row per collect key,
 * plus an extra newsapi+rss+hn cluster that exercises the dedupe :446 merge.
 * @returns {Record<string, unknown>}
 */
export function buildAllAdapterContractFixtureSources() {
  return {
    date: '2026-06-20',
    ranAt: 1_750_377_600_000,
    trends: {
      events: [{ keyword: 'AI agents', normalizedValue: 0.87 }],
    },
    newsapi: {
      headlines: [
        {
          title: 'Unique NewsAPI row for adapter coverage',
          url: 'https://news.example.com/ops2-unique-newsapi',
        },
        {
          title: 'OPS2 Contract Cluster Article Launches',
          url: `${DEDUPE_CLUSTER_URL}?utm_source=news`,
        },
      ],
    },
    arxiv: {
      papers: [
        {
          title: 'Scaling Laws for Digest Contract Guards',
          snippet: 'We measure schema drift catch rates.',
          link: 'https://arxiv.org/abs/2406.12345',
          category: 'cs.AI',
        },
      ],
    },
    hackernews: {
      stories: [
        {
          title: 'Unique HN row for adapter coverage',
          link: 'https://news.ycombinator.com/item?id=9990001',
          score: 50,
          comments: 5,
        },
        {
          title: 'Show HN: OPS2 Contract Cluster Article',
          link: DEDUPE_CLUSTER_URL,
          score: 142,
          comments: 38,
        },
      ],
    },
    github: {
      repos: [
        {
          title: 'ops2-contract-guard',
          url: 'https://github.com/example/ops2-contract-guard',
          stars: 1200,
          forks: 40,
          publishedAt: '2026-06-19T12:00:00.000Z',
        },
      ],
    },
    reddit: {
      posts: [
        {
          title: 'Anyone else hit ArgumentValidationError on viewCount?',
          url: 'https://reddit.com/r/LocalLLaMA/comments/ops2viewcount',
          upvotes: 88,
          commentCount: 12,
          publishedAt: '2026-06-20T01:00:00.000Z',
        },
      ],
    },
    rss: {
      entries: [
        {
          title: 'Unique RSS row for adapter coverage',
          url: 'https://feeds.example.com/ops2-unique-rss',
          publishedAt: '2026-06-20T01:30:00.000Z',
          author: 'FeedAuthor',
        },
        {
          title: 'OPS2 Contract Cluster Article — newsletter pick',
          url: 'http://www.tech.example.com/ops2-contract-cluster-article/',
          publishedAt: '2026-06-20T02:00:00.000Z',
          author: 'Editor',
        },
      ],
    },
    producthunt: {
      launches: [
        {
          title: 'ContractGuard',
          tagline: 'Catch Convex schema drift before 07:15',
          url: 'https://www.producthunt.com/posts/contractguard',
          votesCount: 321,
          createdAt: '2026-06-20T03:00:00.000Z',
        },
      ],
    },
    twitter: {
      posts: [
        {
          title: 'viewCount drift will bite you',
          url: 'https://x.com/ops2/status/1',
          likes: 50,
          reposts: 10,
          replies: 4,
          quotes: 2,
          authorHandle: 'ops2',
          publishedAt: '2026-06-20T04:00:00.000Z',
        },
      ],
    },
    bluesky: {
      posts: [
        {
          title: 'schema contracts > hope',
          url: 'https://bsky.app/profile/ops2.bsky.social/post/1',
          likes: 20,
          reposts: 3,
          replies: 1,
          quotes: 0,
          authorHandle: 'ops2.bsky.social',
          publishedAt: '2026-06-20T04:30:00.000Z',
        },
      ],
    },
    youtube: {
      videos: [
        {
          title: 'Reproducing the 06-20 viewCount incident',
          url: 'https://www.youtube.com/watch?v=ops2viewcount',
          channelTitle: 'CNS Ops',
          publishedAt: '2026-06-20T05:00:00.000Z',
          viewCount: 523_806,
          likeCount: 4100,
          commentCount: 220,
        },
      ],
    },
    tiktok: {
      videos: [
        {
          title: 'partial write explained in 60s',
          url: 'https://www.tiktok.com/@ops2/video/1',
          author: 'ops2',
          publishedAt: '2026-06-20T05:30:00.000Z',
          viewCount: 90_000,
          likeCount: 4000,
          commentCount: 180,
        },
      ],
    },
    instagram: {
      reels: [
        {
          title: 'signalsWritten:11 is a truncated day',
          url: 'https://www.instagram.com/reel/ops2partial/',
          author: 'ops2',
          publishedAt: '2026-06-20T06:00:00.000Z',
          viewCount: 12_000,
          likeCount: 900,
          commentCount: 40,
        },
      ],
    },
    pinterest: {
      pins: [
        {
          title: 'Digest signal contract diagram',
          description: 'Producer ⊆ manifest ⊆ validators',
          url: 'https://www.pinterest.com/pin/ops2contract/',
          author: 'ops2',
          pinId: 'ops2-pin-1',
          publishedAt: '2026-06-20T06:30:00.000Z',
          repinCount: 42,
        },
      ],
    },
    polymarket: {
      markets: [
        {
          question: 'Will OPS-2 land before next schema drift?',
          url: 'https://polymarket.com/event/ops2',
          marketId: 'ops2-mkt-1',
          outcomes: ['Yes', 'No'],
          outcomePrices: [0.72, 0.28],
          leadingOutcome: 'Yes',
          leadingProbability: 0.72,
          volumeUsd: 50_000,
          volume24hrUsd: 8_000,
          liquidityUsd: 12_000,
          endDate: '2026-07-01T00:00:00.000Z',
        },
      ],
    },
    threads: {
      posts: [
        {
          title: 'Contracts beat vibes',
          url: 'https://www.threads.com/@ops2/post/ops2threads',
          likes: 15,
          reposts: 2,
          replies: 1,
          authorHandle: 'ops2',
          author: 'ops2',
          publishedAt: '2026-06-20T07:00:00.000Z',
          postId: 'ops2-threads-1',
        },
      ],
    },
    linkedin: {
      posts: [
        {
          title: 'How we closed the viewCount partial-write class',
          url: 'https://www.linkedin.com/feed/update/ops2linkedin',
          likes: 33,
          commentCount: 5,
          authorHandle: 'ops2',
          author: 'Chris',
          publishedAt: '2026-06-20T07:30:00.000Z',
          postId: 'ops2-li-1',
        },
      ],
    },
    runMeta: {
      topTrend: 'AI agents',
      focusKeyword: 'AI agents',
      deepSignalSummary: 'Contract guard closes the 06-20 class.',
      notebookId: 'nb-ops2',
      vaultContextSummary: 'Vault notes on schema drift.',
    },
  };
}
