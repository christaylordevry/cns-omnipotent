import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  buildNewsapiQuery,
  computeFromIso,
  DEFAULT_NEWSAPI_QUERY,
  filterOnTopicHeadlines,
  isOnTopicHeadline,
  loadNewsapiConfig,
  parseNewsapiPayload,
  runNewsapiFetch,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-newsapi-headlines.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-newsapi-headlines.mjs',
);

const FIXTURE_OK = {
  status: 'ok',
  articles: [
    {
      title: 'OpenAI ships new agent framework for developers',
      url: 'https://example.com/openai-agents',
      description: 'Large language model tooling for agentic AI workflows.',
      publishedAt: '2026-06-07T10:00:00Z',
    },
    {
      title: 'Lakers win NBA championship in overtime thriller',
      url: 'https://example.com/sports',
      description: 'Sports headline that should be filtered out.',
      publishedAt: '2026-06-07T09:00:00Z',
    },
    {
      title: 'Bitcoin hits new all-time high',
      url: 'https://example.com/btc',
      description: 'Cryptocurrency markets rally on macro sentiment.',
      publishedAt: '2026-06-07T08:00:00Z',
    },
    {
      title: 'Anthropic expands Claude knowledge management features',
      url: 'https://example.com/claude-km',
      description: 'Enterprise knowledge workflows.',
      publishedAt: '2026-06-07T07:00:00Z',
    },
    {
      title: '   ',
      url: 'https://example.com/empty',
      description: 'Whitespace title only.',
      publishedAt: '2026-06-07T06:00:00Z',
    },
    {
      title: 'Home automation systems get smarter thermostats',
      url: 'https://example.com/home-auto',
      description: 'Industrial home automation and thermostat vendors.',
      publishedAt: '2026-06-07T05:00:00Z',
    },
  ],
};

describe('loadNewsapiConfig', () => {
  it('defaults window, max headlines, and page size', () => {
    const config = loadNewsapiConfig({});
    assert.equal(config.enabled, true);
    assert.equal(config.windowHours, 48);
    assert.equal(config.maxHeadlines, 5);
    assert.equal(config.pageSize, 20);
    assert.equal(config.queryOverride, null);
    assert.equal(config.apiKey, '');
  });

  it('coerces invalid numeric env vars to defaults', () => {
    const config = loadNewsapiConfig({
      MORNING_DIGEST_NEWSAPI_WINDOW_HOURS: '0',
      MORNING_DIGEST_NEWSAPI_MAX_HEADLINES: 'abc',
      MORNING_DIGEST_NEWSAPI_PAGE_SIZE: '-3',
    });
    assert.equal(config.windowHours, 48);
    assert.equal(config.maxHeadlines, 5);
    assert.equal(config.pageSize, 20);
  });

  it('honors query override and disabled flag', () => {
    const config = loadNewsapiConfig({
      MORNING_DIGEST_NEWSAPI_QUERY: 'custom query',
      MORNING_DIGEST_NEWSAPI_ENABLED: 'off',
      NEWSAPI_API_KEY: 'secret',
    });
    assert.equal(config.queryOverride, 'custom query');
    assert.equal(config.enabled, false);
    assert.equal(config.apiKey, 'secret');
  });
});

describe('buildNewsapiQuery', () => {
  it('returns tightened default when override is null', () => {
    assert.equal(buildNewsapiQuery(null), DEFAULT_NEWSAPI_QUERY);
    assert.ok(DEFAULT_NEWSAPI_QUERY.includes('agentic AI'));
    assert.ok(!DEFAULT_NEWSAPI_QUERY.match(/\bautomation\b(?!\s*\))/));
  });

  it('returns operator override when provided', () => {
    assert.equal(buildNewsapiQuery('notebooklm OR MCP'), 'notebooklm OR MCP');
  });
});

describe('computeFromIso', () => {
  it('subtracts window hours from now in UTC', () => {
    const now = new Date('2026-06-08T12:00:00.000Z');
    assert.equal(computeFromIso(48, now), '2026-06-06T12:00:00');
  });

  it('falls back to 48 hours for invalid window', () => {
    const now = new Date('2026-06-08T12:00:00.000Z');
    assert.equal(computeFromIso(0, now), '2026-06-06T12:00:00');
  });
});

describe('parseNewsapiPayload', () => {
  it('parses ok status and articles', () => {
    const parsed = parseNewsapiPayload(FIXTURE_OK);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.articles.length, 6);
    }
  });

  it('returns error reason for non-ok status', () => {
    const parsed = parseNewsapiPayload({ status: 'error', code: 'apiKeyInvalid' });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.reason, 'apiKeyInvalid');
    }
  });

  it('returns invalid json for non-object payload', () => {
    const parsed = parseNewsapiPayload('not-json');
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.reason, 'invalid json');
    }
  });
});

describe('isOnTopicHeadline and filterOnTopicHeadlines', () => {
  it('accepts CNS-relevant titles', () => {
    assert.equal(
      isOnTopicHeadline('OpenAI ships new agent framework for developers'),
      true,
    );
    assert.equal(
      isOnTopicHeadline('Anthropic expands Claude knowledge management features'),
      true,
    );
  });

  it('rejects sports, crypto, and generic automation fixtures', () => {
    assert.equal(isOnTopicHeadline('Lakers win NBA championship in overtime thriller'), false);
    assert.equal(isOnTopicHeadline('Bitcoin hits new all-time high'), false);
    assert.equal(
      isOnTopicHeadline('Home automation systems get smarter thermostats'),
      false,
    );
    assert.equal(isOnTopicHeadline('Celebrity gossip roundup'), false);
  });

  it('filters articles and omits url key when absent', () => {
    const filtered = filterOnTopicHeadlines(
      [
        { title: 'OpenAI agent release', url: 'https://example.com/a' },
        { title: 'NBA finals recap' },
        { title: 'Gemini adds MCP support' },
      ],
      5,
    );
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].title, 'OpenAI agent release');
    assert.equal(filtered[0].url, 'https://example.com/a');
    assert.equal('url' in filtered[1], false);
  });
});

describe('runNewsapiFetch', () => {
  it('returns headlines from fixture without network', async () => {
    const payload = await runNewsapiFetch(
      { NEWSAPI_API_KEY: 'test-key' },
      { fixturePayload: FIXTURE_OK },
    );
    assert.ok(Array.isArray(payload.headlines));
    assert.equal(payload.headlines.length, 2);
    assert.equal(payload.headlines[0].title, 'OpenAI ships new agent framework for developers');
    assert.equal(payload.headlines[0].url, 'https://example.com/openai-agents');
  });

  it('returns newsapi disabled when enabled flag is false', async () => {
    const payload = await runNewsapiFetch({
      MORNING_DIGEST_NEWSAPI_ENABLED: 'false',
      NEWSAPI_API_KEY: 'test-key',
    });
    assert.deepEqual(payload, { error: 'newsapi disabled' });
  });

  it('returns missing key error without network', async () => {
    const payload = await runNewsapiFetch({});
    assert.deepEqual(payload, { error: 'missing NEWSAPI_API_KEY' });
  });

  it('returns no on-topic headlines when filter removes all articles', async () => {
    const payload = await runNewsapiFetch(
      { NEWSAPI_API_KEY: 'test-key' },
      {
        fixturePayload: {
          status: 'ok',
          articles: [{ title: 'NBA playoffs continue', description: 'sports only' }],
        },
      },
    );
    assert.deepEqual(payload, { error: 'no on-topic headlines' });
  });

  it('returns error JSON on fetch failure', async () => {
    const failingFetch = async () => {
      throw new Error('network down');
    };
    const payload = await runNewsapiFetch(
      { NEWSAPI_API_KEY: 'test-key' },
      { fetch: failingFetch },
    );
    assert.ok(payload.error);
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_NEWSAPI_ENABLED: 'false',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'newsapi disabled' });
  });
});
