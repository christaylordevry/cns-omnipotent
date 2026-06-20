import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  dedupeAndFilterPosts,
  extractCompanySlug,
  extractProfileVanity,
  loadLinkedinConfig,
  mapLinkedinCompanyPost,
  mapLinkedinProfileRecentPost,
  mapLinkedinSearchPost,
  normalizeLinkedinCompanyEntry,
  normalizeLinkedinProfileEntry,
  parseLinkedinKeywords,
  parseLinkedinList,
  runLinkedinFetch,
  linkedinDedupeKey,
  LINKEDIN_SEARCH_ENDPOINT_AVAILABLE,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-linkedin-signals.mjs';
import { buildDigestPushPayload } from '../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';
import { normalizeEngagement } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';
import {
  buildCanonicalLinkedinDigestSignal,
  CANONICAL_LINKEDIN_POST,
  LINKEDIN_VALIDATOR_METADATA_KEYS,
} from './fixtures/linkedin-digest-signal.fixture.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-linkedin-signals.mjs',
);

const FIXTURE_NOW = new Date('2026-06-20T12:00:00.000Z');

const FIXTURE_COMPANY_POST_RAW = {
  url: CANONICAL_LINKEDIN_POST.url,
  id: CANONICAL_LINKEDIN_POST.postId,
  datePublished: CANONICAL_LINKEDIN_POST.publishedAt,
  text: CANONICAL_LINKEDIN_POST.title,
};

const FIXTURE_SEARCH_POST_RAW = {
  url: 'https://www.linkedin.com/posts/chrisfitkin_ai-agents-activity-7472301941688250369-C_DV',
  datePublished: '2026-06-15T15:00:11.530Z',
  description: 'There is so much buzz around AI agents right now.',
  likeCount: 9,
  commentCount: 2,
  author: {
    name: 'Christopher Fitkin',
    url: 'https://www.linkedin.com/in/chrisfitkin',
  },
};

const FIXTURE_PROFILE_RECENT = {
  link: 'https://www.linkedin.com/posts/emollick_more-evidence-activity-7473755086280806400-z_oh',
  id: '7473755086280806400',
  title: 'More evidence from a large-scale study in China.',
  datePublished: '2026-06-19T15:14:28.206Z',
};

describe('fetch-linkedin-signals.mjs parsing', () => {
  it('normalizeLinkedinCompanyEntry accepts slug and full URL', () => {
    assert.equal(normalizeLinkedinCompanyEntry('openai'), 'https://www.linkedin.com/company/openai');
    assert.equal(
      normalizeLinkedinCompanyEntry('https://www.linkedin.com/company/anthropic'),
      'https://www.linkedin.com/company/anthropic',
    );
  });

  it('normalizeLinkedinProfileEntry accepts vanity and full URL', () => {
    assert.equal(normalizeLinkedinProfileEntry('emollick'), 'https://www.linkedin.com/in/emollick');
    assert.equal(
      normalizeLinkedinProfileEntry('https://www.linkedin.com/in/karpathy'),
      'https://www.linkedin.com/in/karpathy',
    );
  });

  it('parseLinkedinList dedupes case-insensitively', () => {
    assert.deepEqual(parseLinkedinList('OpenAI,openai,anthropic'), ['OpenAI', 'anthropic']);
  });

  it('parseLinkedinKeywords caps at 5 keywords', () => {
    assert.equal(parseLinkedinKeywords('a,b,c,d,e,f,g').length, 5);
  });

  it('maps company post to stdout shape', () => {
    const mapped = mapLinkedinCompanyPost(FIXTURE_COMPANY_POST_RAW, {
      companyUrl: 'https://www.linkedin.com/company/openai',
      companySlug: 'openai',
    });
    assert.equal(mapped?.title, CANONICAL_LINKEDIN_POST.title);
    assert.equal(mapped?.authorHandle, 'openai');
    assert.equal(mapped?.postId, CANONICAL_LINKEDIN_POST.postId);
    assert.equal(mapped?.sourceKind, 'company');
  });

  it('maps search post with authorHandle from author URL', () => {
    const mapped = mapLinkedinSearchPost(FIXTURE_SEARCH_POST_RAW);
    assert.equal(mapped?.authorHandle, 'chrisfitkin');
    assert.equal(mapped?.likes, 9);
    assert.equal(mapped?.commentCount, 2);
  });

  it('maps profile recent post without work history fields', () => {
    const mapped = mapLinkedinProfileRecentPost(FIXTURE_PROFILE_RECENT, {
      profileUrl: 'https://www.linkedin.com/in/emollick',
      profileName: 'Ethan Mollick',
      profileVanity: 'emollick',
    });
    assert.equal(mapped?.authorHandle, 'emollick');
    assert.equal(mapped?.sourceKind, 'profile');
    assert.equal('jobTitle' in (mapped ?? {}), false);
  });

  it('linkedinDedupeKey prefers postId then url', () => {
    assert.equal(linkedinDedupeKey({ postId: '123' }), 'li:123');
    assert.equal(
      linkedinDedupeKey({ url: 'https://www.linkedin.com/posts/openai_test' }),
      'li:url:https://www.linkedin.com/posts/openai_test',
    );
  });

  it('buildCanonicalLinkedinDigestSignal metadata keys stay validator-bound', () => {
    const signal = buildCanonicalLinkedinDigestSignal();
    assert.equal(signal.sourceType, 'linkedin');
    assert.deepEqual(Object.keys(signal.sourceMetadata ?? {}).sort(), [
      ...LINKEDIN_VALIDATOR_METADATA_KEYS,
    ].sort());
    assert.equal('postId' in (signal.sourceMetadata ?? {}), false);
    assert.equal('sourceKind' in (signal.sourceMetadata ?? {}), false);
  });

  it('buildDigestPushPayload externalId uses postId when present', () => {
    const payload = buildDigestPushPayload({
      date: '2026-06-11',
      ranAt: 1_781_000_000_000,
      linkedin: { posts: [CANONICAL_LINKEDIN_POST] },
      runMeta: { topTrend: 'AI' },
    });
    const signal = payload.signals.find((row) => row.sourceType === 'linkedin');
    assert.equal(signal?.externalId, CANONICAL_LINKEDIN_POST.postId);
  });

  it('normalizeEngagement round-trip for linkedin via likes + commentCount', () => {
    const signal = buildCanonicalLinkedinDigestSignal();
    const score = normalizeEngagement({
      sourceType: 'linkedin',
      sourceMetadata: signal.sourceMetadata,
    });
    assert.ok(typeof score === 'number' && score > 0);
  });
});

describe('fetch-linkedin-signals.mjs runLinkedinFetch', () => {
  const baseEnv = {
    SCRAPECREATORS_API_KEY: 'test-key',
    MORNING_DIGEST_LINKEDIN_COMPANIES: 'openai',
    MORNING_DIGEST_LINKEDIN_PROFILES: 'emollick',
  };

  it('returns linkedin disabled when enabled flag is false', async () => {
    const payload = await runLinkedinFetch({
      ...baseEnv,
      MORNING_DIGEST_LINKEDIN_ENABLED: '0',
    });
    assert.deepEqual(payload, { error: 'linkedin disabled' });
  });

  it('returns missing-api-key when key absent', async () => {
    const payload = await runLinkedinFetch({
      MORNING_DIGEST_LINKEDIN_COMPANIES: 'openai',
    });
    assert.deepEqual(payload, { error: 'missing-api-key' });
  });

  it('returns missing-watchlist when both lists empty', async () => {
    const payload = await runLinkedinFetch({
      SCRAPECREATORS_API_KEY: 'test-key',
    });
    assert.deepEqual(payload, { error: 'missing-watchlist' });
  });

  it('keywords alone do not satisfy primary watchlist', async () => {
    const payload = await runLinkedinFetch({
      SCRAPECREATORS_API_KEY: 'test-key',
      MORNING_DIGEST_LINKEDIN_KEYWORDS: 'ai agents',
    });
    assert.deepEqual(payload, { error: 'missing-watchlist' });
  });

  it('keeps company posts when a profile returns karpathy-style 404 private/not-found (Story 72-8 review)', async () => {
    const payload = await runLinkedinFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_LINKEDIN_COMPANIES: 'openai',
        MORNING_DIGEST_LINKEDIN_PROFILES: 'karpathy',
      },
      {
        now: FIXTURE_NOW,
        fetch: async (url) => {
          if (url.includes('/company/posts')) {
            return {
              ok: true,
              json: async () => ({ success: true, posts: [FIXTURE_COMPANY_POST_RAW] }),
            };
          }
          if (url.includes('/profile')) {
            return {
              ok: true,
              json: async () => ({
                success: false,
                errorStatus: 404,
                message: 'Profile is private or not publicly available',
              }),
            };
          }
          return { ok: false, status: 404, json: async () => ({ success: false }) };
        },
      },
    );
    assert.ok(Array.isArray(payload.posts), 'partial profile failure must not return top-level error');
    assert.equal(payload.error, undefined);
    assert.equal(payload.posts?.length, 1);
    assert.equal(payload.posts?.[0]?.authorHandle, 'openai');
    assert.equal(payload.posts?.[0]?.postId, CANONICAL_LINKEDIN_POST.postId);
  });

  it('keeps company posts when profile HTTP 404 is non-fatal (karpathy live shape)', async () => {
    const payload = await runLinkedinFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_LINKEDIN_COMPANIES: 'openai',
        MORNING_DIGEST_LINKEDIN_PROFILES: 'karpathy',
      },
      {
        now: FIXTURE_NOW,
        fetch: async (url) => {
          if (url.includes('/company/posts')) {
            return {
              ok: true,
              json: async () => ({ success: true, posts: [FIXTURE_COMPANY_POST_RAW] }),
            };
          }
          if (url.includes('/profile')) {
            return {
              ok: false,
              status: 404,
              json: async () => ({
                message: 'Profile is private or not publicly available',
              }),
            };
          }
          return { ok: false, status: 404, json: async () => ({ success: false }) };
        },
      },
    );
    assert.ok(Array.isArray(payload.posts));
    assert.equal(payload.error, undefined);
    assert.equal(payload.posts?.length, 1);
    assert.equal(payload.posts?.[0]?.authorHandle, 'openai');
  });

  it('fetches company and profile lists separately without cross-list inference', async () => {
    const fetchCalls = [];
    const payload = await runLinkedinFetch(baseEnv, {
      now: FIXTURE_NOW,
      fetch: async (url) => {
        fetchCalls.push(url);
        if (url.includes('/company/posts')) {
          return {
            ok: true,
            json: async () => ({ success: true, posts: [FIXTURE_COMPANY_POST_RAW] }),
          };
        }
        if (url.includes('/profile')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              name: 'Ethan Mollick',
              recentPosts: [FIXTURE_PROFILE_RECENT],
              experience: [{ title: 'Professor' }],
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({ success: false }) };
      },
    });
    assert.ok(payload.posts?.length >= 2);
    assert.ok(fetchCalls.some((u) => u.includes('/company/posts')));
    assert.ok(fetchCalls.some((u) => u.includes('/profile')));
    assert.equal(fetchCalls.some((u) => u.includes('/search/posts')), false);
  });

  it('skips keyword path when env unset', async () => {
    const fetchCalls = [];
    await runLinkedinFetch(
      {
        SCRAPECREATORS_API_KEY: 'test-key',
        MORNING_DIGEST_LINKEDIN_COMPANIES: 'openai',
      },
      {
        now: FIXTURE_NOW,
        fetch: async (url) => {
          fetchCalls.push(url);
          return {
            ok: true,
            json: async () => ({ success: true, posts: [FIXTURE_COMPANY_POST_RAW] }),
          };
        },
      },
    );
    assert.equal(fetchCalls.some((u) => u.includes('/search/posts')), false);
  });

  it('dedupes same postId across company and profile candidates', async () => {
    const duplicate = { ...FIXTURE_COMPANY_POST_RAW };
    const posts = dedupeAndFilterPosts(
      [
        mapLinkedinCompanyPost(duplicate, { companySlug: 'openai' }),
        mapLinkedinCompanyPost(duplicate, { companySlug: 'openai' }),
      ],
      10,
      168,
      FIXTURE_NOW,
    );
    assert.equal(posts.length, 1);
  });

  it('returns credit-exhausted on HTTP 402', async () => {
    const payload = await runLinkedinFetch(baseEnv, {
      fetch: async () => ({
        ok: false,
        status: 402,
        json: async () => ({ message: 'credit exhausted' }),
      }),
    });
    assert.equal(payload.error, 'credit-exhausted');
  });

  it('CLI exits 0 with error JSON when disabled', async () => {
    const { stdout } = await execFileAsync(process.execPath, [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_LINKEDIN_ENABLED: '0',
        MORNING_DIGEST_LINKEDIN_COMPANIES: 'openai',
        SCRAPECREATORS_API_KEY: 'test-key',
      },
    });
    assert.deepEqual(JSON.parse(stdout.trim()), { error: 'linkedin disabled' });
  });
});

describe('fetch-linkedin-signals.mjs config', () => {
  it('LINKEDIN_SEARCH_ENDPOINT_AVAILABLE is true after T0', () => {
    assert.equal(LINKEDIN_SEARCH_ENDPOINT_AVAILABLE, true);
  });

  it('loadLinkedinConfig separates companies and profiles lists', () => {
    const config = loadLinkedinConfig({
      SCRAPECREATORS_API_KEY: 'k',
      MORNING_DIGEST_LINKEDIN_COMPANIES: 'openai,anthropic',
      MORNING_DIGEST_LINKEDIN_PROFILES: 'emollick',
    });
    assert.equal(config.companies.length, 2);
    assert.equal(config.profiles.length, 1);
    assert.equal(extractCompanySlug(config.companies[0]), 'openai');
    assert.equal(extractProfileVanity(config.profiles[0]), 'emollick');
  });

  it('loadLinkedinConfig hard-caps MORNING_DIGEST_LINKEDIN_MAX_PAGES at 7', () => {
    const config = loadLinkedinConfig({
      SCRAPECREATORS_API_KEY: 'k',
      MORNING_DIGEST_LINKEDIN_COMPANIES: 'openai',
      MORNING_DIGEST_LINKEDIN_MAX_PAGES: '99',
    });
    assert.equal(config.maxPages, 7);
  });
});
