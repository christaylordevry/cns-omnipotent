import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  DEFAULT_X_ACCOUNTS,
  X_AUTH_REMEDIATION,
  appendSinceToQuery,
  buildSinceDate,
  checkXSession,
  dedupePostsByUrl,
  emitXFetchStderr,
  getCheckExitCode,
  isSessionInvalidError,
  loadXConfig,
  mapBirdTweet,
  unescapeHtmlEntities,
  parseAccounts,
  parseSearchQueries,
  runXFetch,
  sortAndCapPosts,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs';
import {
  X_LIKES_CAP,
  X_QUOTES_CAP,
  X_REPLIES_CAP,
  X_REPOSTS_CAP,
  normalizeEngagement,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

/**
 * Mirrors task-prompt §9 X / Twitter assembly.
 *
 * @param {{
 *   title: string,
 *   authorHandle: string,
 *   url: string,
 *   likes: number,
 *   reposts: number,
 *   replies: number,
 *   quotes: number,
 *   publishedAt?: string,
 * }} post
 * @param {number} rank
 */
function twitterPostToDigestSignal(post, rank) {
  /** @type {Record<string, unknown>} */
  const sourceMetadata = {
    authorHandle: post.authorHandle,
    likes: post.likes,
    reposts: post.reposts,
    replies: post.replies,
    quotes: post.quotes,
  };
  if (post.publishedAt) {
    sourceMetadata.publishedAt = post.publishedAt;
  }
  return {
    section: 'twitter',
    sourceType: 'twitter',
    title: post.title,
    summary: post.title.slice(0, 200),
    url: post.url,
    rank,
    sourceMetadata,
  };
}

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs',
);

const FIXTURE_TWEET = {
  text: 'Graph neural networks are scaling again.',
  author: { username: 'karpathy' },
  permanent_url: 'https://x.com/karpathy/status/1234567890',
  likeCount: 1200,
  retweetCount: 340,
  replyCount: 89,
  quoteCount: 12,
  createdAt: '2026-06-11T08:00:00.000Z',
};

const FIXTURE_TWEET_SNAKE = {
  full_text: 'Legacy snake_case tweet body for mapping.',
  user: { screen_name: '@simonw' },
  id: '9876543210',
  like_count: 50,
  retweet_count: 10,
  reply_count: 3,
  quote_count: 1,
  created_at: 'Wed Jun 11 07:30:00 +0000 2026',
};

describe('fetch-x-signals.mjs parsing', () => {
  it('unescapeHtmlEntities decodes common HTML entities in tweet text', () => {
    assert.equal(unescapeHtmlEntities('Fish &amp; chips'), 'Fish & chips');
    const mapped = mapBirdTweet({
      ...FIXTURE_TWEET,
      text: 'Fish &amp; chips on the pier',
    });
    assert.equal(mapped?.title, 'Fish & chips on the pier');
  });

  it('maps bird-search tweet to stdout post shape (camelCase)', () => {
    const mapped = mapBirdTweet(FIXTURE_TWEET);
    assert.deepEqual(mapped, {
      title: 'Graph neural networks are scaling again.',
      authorHandle: 'karpathy',
      url: 'https://x.com/karpathy/status/1234567890',
      publishedAt: '2026-06-11T08:00:00.000Z',
      likes: 1200,
      reposts: 340,
      replies: 89,
      quotes: 12,
    });
  });

  it('maps bird-search tweet with snake_case fields and constructed url', () => {
    const mapped = mapBirdTweet(FIXTURE_TWEET_SNAKE);
    assert.ok(mapped);
    assert.equal(mapped?.authorHandle, 'simonw');
    assert.equal(mapped?.url, 'https://x.com/simonw/status/9876543210');
    assert.equal(mapped?.likes, 50);
    assert.equal(mapped?.reposts, 10);
    assert.ok(mapped?.publishedAt);
  });

  it('drops tweets without resolvable url', () => {
    assert.equal(mapBirdTweet({ text: 'no url', author: { username: 'a' } }), null);
  });

  it('parseAccounts dedupes case-insensitively and strips @', () => {
    assert.deepEqual(parseAccounts('@Karpathy,KARPATHY,sama'), ['Karpathy', 'sama']);
  });

  it('parseSearchQueries caps at 3 queries', () => {
    assert.equal(
      parseSearchQueries('q1,q2,q3,q4').length,
      3,
    );
  });

  it('buildSinceDate returns YYYY-MM-DD for lookback window', () => {
    const since = buildSinceDate(24, new Date('2026-06-11T12:00:00.000Z'));
    assert.equal(since, '2026-06-10');
  });

  it('sortAndCapPosts orders by likes + 2×reposts and caps', () => {
    const posts = [
      {
        title: 'low',
        authorHandle: 'a',
        url: 'https://x.com/a/status/1',
        likes: 10,
        reposts: 1,
        replies: 0,
        quotes: 0,
      },
      {
        title: 'high',
        authorHandle: 'b',
        url: 'https://x.com/b/status/2',
        likes: 100,
        reposts: 50,
        replies: 0,
        quotes: 0,
      },
    ];
    const capped = sortAndCapPosts(posts, 1);
    assert.equal(capped.length, 1);
    assert.equal(capped[0].title, 'high');
  });

  it('dedupePostsByUrl keeps first occurrence per url', () => {
    const deduped = dedupePostsByUrl([
      { url: 'https://x.com/a/status/1', title: 'first' },
      { url: 'https://x.com/a/status/1', title: 'duplicate' },
    ]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].title, 'first');
  });

  it('dedupePostsByUrl treats x.com and twitter.com status URLs as duplicates', () => {
    const deduped = dedupePostsByUrl([
      { url: 'https://x.com/karpathy/status/1234567890', title: 'first' },
      { url: 'https://twitter.com/karpathy/status/1234567890?ref=foo', title: 'dup' },
    ]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].title, 'first');
  });

  it('appendSinceToQuery avoids double since: clauses', () => {
    assert.equal(
      appendSinceToQuery('AI agents since:2026-06-01', '2026-06-10'),
      'AI agents since:2026-06-01',
    );
    assert.equal(
      appendSinceToQuery('AI agents', '2026-06-10'),
      'AI agents since:2026-06-10',
    );
  });

  it('isSessionInvalidError detects auth codes and HTML login interstitials', () => {
    assert.equal(isSessionInvalidError('HTTP 401: Unauthorized'), true);
    assert.equal(isSessionInvalidError('<!doctype html><html>login</html>'), true);
    assert.equal(isSessionInvalidError('network reset'), false);
  });

  it('DEFAULT_X_ACCOUNTS has 5 curated handles for timeout budget', () => {
    assert.equal(DEFAULT_X_ACCOUNTS.length, 5);
  });
});

describe('fetch-x-signals.mjs loadXConfig', () => {
  it('returns credential-missing config when X_AUTH_TOKEN absent', () => {
    const config = loadXConfig({
      X_CT0: 'ct0-value',
      MORNING_DIGEST_X_ENABLED: '1',
    });
    assert.equal(config.authToken, '');
    assert.equal(config.ct0, 'ct0-value');
  });

  it('accepts legacy AUTH_TOKEN and CT0 aliases', () => {
    const config = loadXConfig({
      AUTH_TOKEN: 'auth',
      CT0: 'ct0',
    });
    assert.equal(config.authToken, 'auth');
    assert.equal(config.ct0, 'ct0');
  });

  it('respects MORNING_DIGEST_X_ENABLED=0', () => {
    const config = loadXConfig({
      MORNING_DIGEST_X_ENABLED: '0',
      X_AUTH_TOKEN: 'a',
      X_CT0: 'b',
    });
    assert.equal(config.enabled, false);
  });
});

describe('fetch-x-signals.mjs runXFetch', () => {
  it('returns posts from fixture without network', async () => {
    const since = buildSinceDate(24, new Date('2026-06-11T12:00:00.000Z'));
    const payload = await runXFetch(
      {
        X_AUTH_TOKEN: 'auth',
        X_CT0: 'ct0',
        MORNING_DIGEST_X_ACCOUNTS: 'karpathy',
      },
      {
        fixtures: {
          [`from:karpathy since:${since}`]: [FIXTURE_TWEET],
        },
        now: new Date('2026-06-11T12:00:00.000Z'),
      },
    );
    assert.ok(Array.isArray(payload.posts));
    assert.equal(payload.posts?.length, 1);
    assert.equal(payload.posts?.[0].authorHandle, 'karpathy');
  });

  it('returns error when credentials missing', async () => {
    const payload = await runXFetch({});
    assert.deepEqual(payload, { error: 'X credentials not configured' });
  });

  it('returns error when disabled', async () => {
    const payload = await runXFetch({
      MORNING_DIGEST_X_ENABLED: 'false',
      X_AUTH_TOKEN: 'a',
      X_CT0: 'b',
    });
    assert.deepEqual(payload, { error: 'x disabled' });
  });

  it('uses mocked SearchClient.search without live network', async () => {
    const searchClient = {
      search: async () => ({
        success: true,
        tweets: [FIXTURE_TWEET],
      }),
    };
    const payload = await runXFetch(
      {
        X_AUTH_TOKEN: 'auth',
        X_CT0: 'ct0',
        MORNING_DIGEST_X_ACCOUNTS: 'karpathy',
      },
      { searchClient },
    );
    assert.equal(payload.posts?.length, 1);
    assert.equal(payload.posts?.[0].likes, 1200);
  });

  it('returns partial posts when a later query hits session invalid', async () => {
    let call = 0;
    const searchClient = {
      search: async () => {
        call += 1;
        if (call === 1) {
          return { success: true, tweets: [FIXTURE_TWEET] };
        }
        return { success: false, error: 'HTTP 403: Forbidden' };
      },
    };
    const stderrChunks = [];
    const originalError = console.error;
    console.error = (...args) => {
      stderrChunks.push(args.join(' '));
    };
    try {
      const payload = await runXFetch(
        {
          X_AUTH_TOKEN: 'auth',
          X_CT0: 'ct0',
          MORNING_DIGEST_X_ACCOUNTS: 'karpathy,sama',
        },
        { searchClient },
      );
      assert.equal(payload.posts?.length, 1);
      assert.equal(payload.posts?.[0].authorHandle, 'karpathy');
      assert.equal('error' in payload, false);
      assert.ok(
        stderrChunks.some((line) =>
          line.includes('X session became invalid mid-run'),
        ),
      );
    } finally {
      console.error = originalError;
    }
  });

  it('returns X session invalid when auth fails before any success', async () => {
    const searchClient = {
      search: async () => ({
        success: false,
        error: 'HTTP 401: Unauthorized',
      }),
    };
    const payload = await runXFetch(
      {
        X_AUTH_TOKEN: 'auth',
        X_CT0: 'ct0',
        MORNING_DIGEST_X_ACCOUNTS: 'karpathy',
      },
      { searchClient },
    );
    assert.deepEqual(payload, { error: 'X session invalid' });
  });

  it('returns x fetch failed when every query fails non-auth', async () => {
    const searchClient = {
      search: async () => ({
        success: false,
        error: 'network timeout',
      }),
    };
    const payload = await runXFetch(
      {
        X_AUTH_TOKEN: 'auth',
        X_CT0: 'ct0',
        MORNING_DIGEST_X_ACCOUNTS: 'karpathy',
      },
      { searchClient },
    );
    assert.deepEqual(payload, { error: 'x fetch failed' });
  });

  it('returns X session invalid for HTML interstitial when no posts yet', async () => {
    const searchClient = {
      search: async () => ({
        success: false,
        error: '<!doctype html><html>Sign in to X</html>',
      }),
    };
    const payload = await runXFetch(
      {
        X_AUTH_TOKEN: 'auth',
        X_CT0: 'ct0',
        MORNING_DIGEST_X_ACCOUNTS: 'karpathy',
      },
      { searchClient },
    );
    assert.deepEqual(payload, { error: 'X session invalid' });
  });
});

describe('fetch-x-signals.mjs §9 round-trip', () => {
  it('twitterPostToDigestSignal → normalizeEngagement non-null for fixture likes', () => {
    const mapped = mapBirdTweet(FIXTURE_TWEET);
    assert.ok(mapped);
    const signal = twitterPostToDigestSignal(mapped, 1);
    const engagement = normalizeEngagement(signal);
    assert.ok(typeof engagement === 'number' && engagement > 0);
  });
});

describe('fetch-x-signals.mjs checkXSession', () => {
  it('returns missing_credentials when cookies absent', async () => {
    const result = await checkXSession({
      MORNING_DIGEST_X_ENABLED: '1',
    });
    assert.equal(result.status, 'missing_credentials');
    assert.equal(result.credentialsPresent, false);
    assert.equal(result.liveProbe, false);
    assert.equal(getCheckExitCode(result), 1);
  });

  it('returns ok when mock probe succeeds', async () => {
    const searchClient = {
      search: async () => ({
        success: true,
        tweets: [FIXTURE_TWEET],
      }),
    };
    const result = await checkXSession(
      {
        X_AUTH_TOKEN: 'auth',
        X_CT0: 'ct0',
        MORNING_DIGEST_X_ENABLED: '1',
      },
      { searchClient },
    );
    assert.equal(result.status, 'ok');
    assert.equal(result.message, 'X session valid');
    assert.equal(result.credentialsPresent, true);
    assert.equal(result.liveProbe, true);
    assert.equal(getCheckExitCode(result), 0);
  });

  it('returns session_invalid for mock 401 probe', async () => {
    const searchClient = {
      search: async () => ({
        success: false,
        error: 'HTTP 401: Unauthorized',
      }),
    };
    const result = await checkXSession(
      {
        X_AUTH_TOKEN: 'auth',
        X_CT0: 'ct0',
      },
      { searchClient },
    );
    assert.equal(result.status, 'session_invalid');
    assert.equal(result.credentialsPresent, true);
    assert.equal(getCheckExitCode(result), 1);
  });

  it('returns session_invalid for HTML interstitial probe', async () => {
    const searchClient = {
      search: async () => ({
        success: false,
        error: '<!doctype html><html>Sign in to X</html>',
      }),
    };
    const result = await checkXSession(
      {
        X_AUTH_TOKEN: 'auth',
        X_CT0: 'ct0',
      },
      { searchClient },
    );
    assert.equal(result.status, 'session_invalid');
    assert.equal(getCheckExitCode(result), 1);
  });

  it('returns disabled with exit 0 when kill switch set', async () => {
    const result = await checkXSession({
      MORNING_DIGEST_X_ENABLED: '0',
      X_AUTH_TOKEN: 'auth',
      X_CT0: 'ct0',
    });
    assert.equal(result.status, 'disabled');
    assert.equal(result.liveProbe, false);
    assert.equal(getCheckExitCode(result), 0);
  });
});

describe('fetch-x-signals.mjs CLI', () => {
  const emptyXCredsEnv = {
    ...process.env,
    X_AUTH_TOKEN: '',
    X_CT0: '',
    AUTH_TOKEN: '',
    CT0: '',
    TWITTER_AUTH_TOKEN: '',
    TWITTER_CT0: '',
    MORNING_DIGEST_X_ENABLED: '1',
  };

  it('stdout JSON error and exit 0 when credentials missing', async () => {
    const { stdout } = await execFileAsync(process.execPath, [fetchScript], {
      env: emptyXCredsEnv,
    });
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.error, 'X credentials not configured');
  });

  it('--check exits 1 with missing_credentials when cookies absent', async () => {
    await assert.rejects(
      async () => {
        await execFileAsync(process.execPath, [fetchScript, '--check'], {
          env: emptyXCredsEnv,
        });
      },
      (err) => {
        assert.equal(err.code, 1);
        const parsed = JSON.parse(String(err.stdout).trim());
        assert.equal(parsed.status, 'missing_credentials');
        return true;
      },
    );
  });

  it('--check exits 0 with disabled when kill switch set', async () => {
    const { stdout } = await execFileAsync(process.execPath, [fetchScript, '--check'], {
      env: {
        ...process.env,
        MORNING_DIGEST_X_ENABLED: '0',
        X_AUTH_TOKEN: 'auth',
        X_CT0: 'ct0',
      },
    });
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.status, 'disabled');
  });

  it('stderr includes remediation when session invalid on normal fetch', () => {
    const stderrChunks = [];
    const originalError = console.error;
    console.error = (...args) => {
      stderrChunks.push(args.join(' '));
    };
    try {
      emitXFetchStderr({ error: 'X session invalid' });
      assert.ok(stderrChunks.some((line) => line.includes(X_AUTH_REMEDIATION)));
    } finally {
      console.error = originalError;
    }
  });

  it('stderr includes configure hint when credentials missing on CLI fetch', async () => {
    const { stderr } = await execFileAsync(process.execPath, [fetchScript], {
      env: emptyXCredsEnv,
    });
    assert.ok(stderr.includes('configure X_AUTH_TOKEN and X_CT0'));
  });
});

describe('score-digest-signals twitter branch', () => {
  it('exports X cap constants', () => {
    assert.equal(X_LIKES_CAP, 50000);
    assert.equal(X_REPOSTS_CAP, 10000);
    assert.equal(X_REPLIES_CAP, 5000);
    assert.equal(X_QUOTES_CAP, 2000);
  });

  it('twitter at engagement caps → 100', () => {
    assert.equal(
      normalizeEngagement({
        title: 'X cap post',
        sourceType: 'twitter',
        sourceMetadata: {
          likes: 50000,
          reposts: 10000,
          replies: 5000,
          quotes: 2000,
        },
      }),
      100,
    );
  });
});
