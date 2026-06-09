import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  dedupeReposByUrl,
  isGithubEnabled,
  loadGithubConfig,
  mapGithubRepoItem,
  parseGithubQueries,
  parseSearchResponse,
  runGithubFetch,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs';
import { normalizeEngagement } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

/**
 * Mirrors task-prompt §9 GitHub assembly: nest repos[] engagement under sourceMetadata.
 *
 * @param {{ title: string, url: string, stars: number, forks?: number, publishedAt?: string }} repo
 * @param {number} rank
 */
function githubRepoToDigestSignal(repo, rank) {
  /** @type {Record<string, unknown>} */
  const sourceMetadata = { stars: repo.stars };
  if (repo.forks !== undefined) {
    sourceMetadata.forks = repo.forks;
  }
  if (repo.publishedAt) {
    sourceMetadata.publishedAt = repo.publishedAt;
  }
  return {
    section: 'github',
    sourceType: 'github',
    title: repo.title,
    url: repo.url,
    rank,
    sourceMetadata,
  };
}

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchScript = join(
  repoRoot,
  'scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs',
);

const FIXTURE_SEARCH = {
  total_count: 3,
  items: [
    {
      full_name: 'owner/repo-one',
      html_url: 'https://github.com/owner/repo-one',
      stargazers_count: 1234,
      forks_count: 56,
      pushed_at: '2026-06-01T12:00:00.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
    },
    {
      full_name: 'owner/repo-two',
      html_url: 'https://github.com/owner/repo-two',
      stargazers_count: 900,
      forks_count: 12,
      created_at: '2025-03-01T00:00:00.000Z',
    },
    {
      full_name: 'owner/repo-dup',
      html_url: 'https://github.com/owner/repo-one',
      stargazers_count: 50,
      forks_count: 1,
      pushed_at: '2026-05-01T00:00:00.000Z',
    },
  ],
};

describe('fetch-github-signals.mjs parsing', () => {
  it('maps API fields to stdout repo shape', () => {
    const mapped = mapGithubRepoItem(FIXTURE_SEARCH.items[0]);
    assert.deepEqual(mapped, {
      title: 'owner/repo-one',
      url: 'https://github.com/owner/repo-one',
      stars: 1234,
      forks: 56,
      publishedAt: '2026-06-01T12:00:00.000Z',
    });
  });

  it('prefers pushed_at over created_at for publishedAt', () => {
    const mapped = mapGithubRepoItem({
      full_name: 'owner/with-push',
      html_url: 'https://github.com/owner/with-push',
      stargazers_count: 10,
      forks_count: 1,
      pushed_at: '2026-06-02T00:00:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
    });
    assert.equal(mapped?.publishedAt, '2026-06-02T00:00:00.000Z');
  });

  it('parseSearchResponse caps at perQuery', () => {
    const repos = parseSearchResponse(FIXTURE_SEARCH, 2);
    assert.equal(repos.length, 2);
    assert.equal(repos[0].title, 'owner/repo-one');
    assert.equal(repos[1].title, 'owner/repo-two');
  });

  it('dedupeReposByUrl keeps first occurrence and respects maxRepos', () => {
    const repos = parseSearchResponse(FIXTURE_SEARCH, 3);
    const deduped = dedupeReposByUrl(repos, 5);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].url, 'https://github.com/owner/repo-one');
  });
});

describe('fetch-github-signals.mjs runGithubFetch', () => {
  it('returns repos from fixture without network', async () => {
    const payload = await runGithubFetch(
      { MORNING_DIGEST_GITHUB_QUERIES: 'agents' },
      { fixtureJson: FIXTURE_SEARCH },
    );
    assert.ok(Array.isArray(payload.repos));
    assert.equal(payload.repos.length, 2);
    assert.equal(payload.repos[0].stars, 1234);
  });

  it('returns github disabled when enabled flag is false', async () => {
    const payload = await runGithubFetch({
      MORNING_DIGEST_GITHUB_ENABLED: 'false',
      MORNING_DIGEST_GITHUB_QUERIES: 'agents',
    });
    assert.deepEqual(payload, { error: 'github disabled' });
  });

  it('returns missing-queries when enabled but queries unset', async () => {
    const payload = await runGithubFetch({});
    assert.deepEqual(payload, { error: 'missing-queries' });
  });

  it('dedupes across multiple queries', async () => {
    const payload = await runGithubFetch(
      {
        MORNING_DIGEST_GITHUB_QUERIES: 'agents,llm',
        MORNING_DIGEST_GITHUB_MAX_REPOS: '5',
        MORNING_DIGEST_GITHUB_PER_QUERY: '3',
      },
      {
        fixtureJsonByQuery: {
          agents: FIXTURE_SEARCH,
          llm: FIXTURE_SEARCH,
        },
      },
    );
    assert.equal(payload.repos?.length, 2);
  });

  it('returns error JSON on fetch failure', async () => {
    const failingFetch = async () => {
      throw new Error('network down');
    };
    const payload = await runGithubFetch(
      { MORNING_DIGEST_GITHUB_QUERIES: 'agents' },
      { fetch: failingFetch },
    );
    assert.ok(payload.error);
  });

  it('CLI exits 0 and prints JSON on failure', async () => {
    const { stdout } = await execFileAsync('node', [fetchScript], {
      env: {
        ...process.env,
        MORNING_DIGEST_GITHUB_ENABLED: 'false',
      },
    });
    const cli = JSON.parse(stdout.trim());
    assert.deepEqual(cli, { error: 'github disabled' });
  });

  it('fetch stdout → sourceMetadata assembly → normalizeEngagement round-trip (§6.1)', async () => {
    const payload = await runGithubFetch(
      { MORNING_DIGEST_GITHUB_QUERIES: 'agents' },
      { fixtureJson: FIXTURE_SEARCH },
    );
    assert.ok(Array.isArray(payload.repos) && payload.repos.length > 0);

    for (const [index, repo] of payload.repos.entries()) {
      const signal = githubRepoToDigestSignal(repo, index + 1);
      const norm = normalizeEngagement(signal);
      assert.ok(
        norm !== null && norm >= 0 && norm <= 100,
        `expected non-null engagement for ${repo.title}`,
      );
      assert.equal(signal.sourceMetadata.stars, repo.stars);
      if (repo.forks !== undefined) {
        assert.equal(signal.sourceMetadata.forks, repo.forks);
      }
    }

    const rootLevelStars = {
      section: 'github',
      sourceType: 'github',
      title: payload.repos[0].title,
      url: payload.repos[0].url,
      rank: 1,
      stars: payload.repos[0].stars,
      forks: payload.repos[0].forks,
    };
    assert.equal(normalizeEngagement(rootLevelStars), null);
  });
});

describe('loadGithubConfig', () => {
  it('defaults maxRepos and perQuery when unset or invalid', () => {
    const config = loadGithubConfig({
      MORNING_DIGEST_GITHUB_QUERIES: 'agents, llm',
    });
    assert.equal(config.maxRepos, 5);
    assert.equal(config.perQuery, 3);
    assert.deepEqual(config.queries, ['agents', 'llm']);
  });

  it('isGithubEnabled treats empty as enabled', () => {
    assert.equal(isGithubEnabled(undefined), true);
    assert.equal(isGithubEnabled('false'), false);
    assert.equal(isGithubEnabled('off'), false);
  });

  it('parseGithubQueries trims and drops empty segments', () => {
    assert.deepEqual(parseGithubQueries(' agents , , llm '), ['agents', 'llm']);
  });
});
