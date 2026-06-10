import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  getPostedAfterIso,
  isProductHuntEnabled,
  loadProductHuntConfig,
  mapLaunchNode,
  parseGraphQLResponse,
  runProductHuntFetch,
  sortAndCapLaunches,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-producthunt-launches.mjs';
import { normalizeEngagement } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

/**
 * Mirrors task-prompt §9 Product Hunt assembly: nest votesCount under sourceMetadata.upvotes.
 *
 * @param {{ title: string, tagline: string, url: string, votesCount: number, createdAt?: string }} launch
 * @param {number} rank
 */
function productHuntLaunchToDigestSignal(launch, rank) {
  /** @type {Record<string, unknown>} */
  const sourceMetadata = { upvotes: launch.votesCount };
  if (launch.createdAt) {
    sourceMetadata.publishedAt = launch.createdAt;
  }
  return {
    section: 'producthunt',
    sourceType: 'producthunt',
    title: launch.title,
    summary: launch.tagline,
    url: launch.url,
    rank,
    sourceMetadata,
  };
}

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-producthunt-launches.mjs',
);

const FIXTURE_GRAPHQL = {
  data: {
    posts: {
      edges: [
        {
          node: {
            name: 'Launch Alpha',
            tagline: 'First launch',
            url: 'https://www.producthunt.com/posts/launch-alpha',
            votesCount: 420,
            createdAt: '2026-06-09T10:00:00.000Z',
          },
        },
        {
          node: {
            name: 'Launch Beta',
            tagline: 'Second launch',
            url: 'https://www.producthunt.com/posts/launch-beta',
            votesCount: 900,
            createdAt: '2026-06-09T11:00:00.000Z',
          },
        },
        {
          node: {
            name: '',
            tagline: 'missing name',
            url: 'https://www.producthunt.com/posts/invalid',
            votesCount: 1,
          },
        },
      ],
    },
  },
};

describe('fetch-producthunt-launches.mjs parsing', () => {
  it('maps GraphQL name to stdout title', () => {
    const mapped = mapLaunchNode(FIXTURE_GRAPHQL.data.posts.edges[0].node);
    assert.deepEqual(mapped, {
      title: 'Launch Alpha',
      tagline: 'First launch',
      url: 'https://www.producthunt.com/posts/launch-alpha',
      votesCount: 420,
      createdAt: '2026-06-09T10:00:00.000Z',
    });
  });

  it('parseGraphQLResponse skips invalid nodes', () => {
    const launches = parseGraphQLResponse(FIXTURE_GRAPHQL);
    assert.equal(launches.length, 2);
    assert.equal(launches[0].title, 'Launch Alpha');
    assert.equal(launches[1].title, 'Launch Beta');
  });

  it('sortAndCapLaunches orders by votesCount desc and caps', () => {
    const launches = parseGraphQLResponse(FIXTURE_GRAPHQL);
    const capped = sortAndCapLaunches(launches, 1);
    assert.equal(capped.length, 1);
    assert.equal(capped[0].title, 'Launch Beta');
  });

  it('getPostedAfterIso returns start of previous UTC day', () => {
    const iso = getPostedAfterIso(new Date('2026-06-10T15:30:00.000Z'));
    assert.equal(iso, '2026-06-09T00:00:00.000Z');
  });
});

describe('fetch-producthunt-launches.mjs runProductHuntFetch', () => {
  it('returns launches from fixture without network', async () => {
    const payload = await runProductHuntFetch(
      { PRODUCTHUNT_API_KEY: 'test-key' },
      { fixtureJson: FIXTURE_GRAPHQL },
    );
    assert.ok(Array.isArray(payload.launches));
    assert.equal(payload.launches?.length, 2);
    assert.equal(/** @type {{ title: string }} */ (payload.launches[0]).title, 'Launch Beta');
  });

  it('returns exact missing key error when api key absent', async () => {
    const payload = await runProductHuntFetch({});
    assert.deepEqual(payload, { error: 'missing PRODUCTHUNT_API_KEY' });
  });

  it('returns producthunt disabled when enabled flag is false', async () => {
    const payload = await runProductHuntFetch({
      MORNING_DIGEST_PRODUCTHUNT_ENABLED: 'false',
      PRODUCTHUNT_API_KEY: 'test-key',
    });
    assert.deepEqual(payload, { error: 'producthunt disabled' });
  });

  it('respects MORNING_DIGEST_PRODUCTHUNT_MAX_LAUNCHES', async () => {
    const payload = await runProductHuntFetch(
      {
        PRODUCTHUNT_API_KEY: 'test-key',
        MORNING_DIGEST_PRODUCTHUNT_MAX_LAUNCHES: '1',
      },
      { fixtureJson: FIXTURE_GRAPHQL },
    );
    assert.equal(payload.launches?.length, 1);
  });

  it('returns error JSON on fetch failure', async () => {
    const failingFetch = async () => {
      throw new Error('network down');
    };
    const payload = await runProductHuntFetch(
      { PRODUCTHUNT_API_KEY: 'test-key' },
      { fetch: failingFetch },
    );
    assert.ok(payload.error);
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_PRODUCTHUNT_ENABLED: 'false',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'producthunt disabled' });
  });

  it('fetch stdout → sourceMetadata assembly → normalizeEngagement round-trip (§6.1)', async () => {
    const payload = await runProductHuntFetch(
      { PRODUCTHUNT_API_KEY: 'test-key' },
      { fixtureJson: FIXTURE_GRAPHQL },
    );
    assert.ok(Array.isArray(payload.launches) && payload.launches.length > 0);

    for (const [index, launch] of payload.launches.entries()) {
      const signal = productHuntLaunchToDigestSignal(
        /** @type {{ title: string, tagline: string, url: string, votesCount: number, createdAt?: string }} */ (
          launch
        ),
        index + 1,
      );
      const norm = normalizeEngagement(signal);
      assert.ok(
        norm !== null && norm >= 0 && norm <= 100,
        `expected non-null engagement for ${launch.title}`,
      );
      assert.equal(signal.sourceMetadata.upvotes, launch.votesCount);
      assert.equal(signal.section, 'producthunt');
      assert.equal(signal.sourceType, 'producthunt');
    }

    const rootLevelVotes = {
      section: 'producthunt',
      sourceType: 'producthunt',
      title: payload.launches[0].title,
      url: payload.launches[0].url,
      rank: 1,
      votesCount: payload.launches[0].votesCount,
    };
    assert.equal(normalizeEngagement(rootLevelVotes), null);
  });

  it('normalizeEngagement parity with reddit at same upvotes', async () => {
    const payload = await runProductHuntFetch(
      { PRODUCTHUNT_API_KEY: 'test-key' },
      { fixtureJson: FIXTURE_GRAPHQL },
    );
    const launch = /** @type {{ title: string, tagline: string, url: string, votesCount: number }} */ (
      payload.launches?.[0]
    );
    const phSignal = productHuntLaunchToDigestSignal(launch, 1);
    const rdSignal = {
      title: launch.title,
      sourceType: 'reddit',
      sourceMetadata: { upvotes: launch.votesCount },
    };
    assert.equal(normalizeEngagement(phSignal), normalizeEngagement(rdSignal));
  });
});

describe('loadProductHuntConfig', () => {
  it('defaults maxLaunches when unset or invalid', () => {
    const config = loadProductHuntConfig({ PRODUCTHUNT_API_KEY: 'key' });
    assert.equal(config.maxLaunches, 5);
  });

  it('isProductHuntEnabled treats empty as enabled', () => {
    assert.equal(isProductHuntEnabled(undefined), true);
    assert.equal(isProductHuntEnabled('false'), false);
    assert.equal(isProductHuntEnabled('off'), false);
  });
});
