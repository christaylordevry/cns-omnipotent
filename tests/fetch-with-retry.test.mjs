import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fetchWithRetry,
  isRetryableFetchReason,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-with-retry.mjs';
import { fetchNewsapi } from '../scripts/hermes-skill-examples/morning-digest/scripts/fetch-newsapi-headlines.mjs';

describe('fetch-with-retry (Story 81-2 AC2)', () => {
  it('isRetryableFetchReason matches transient HTTP and timeout errors', () => {
    assert.equal(isRetryableFetchReason('http-429'), true);
    assert.equal(isRetryableFetchReason('http-503'), true);
    assert.equal(isRetryableFetchReason('AbortError'), true);
    assert.equal(isRetryableFetchReason('http-401'), false);
  });

  it('fetchWithRetry retries retryable failures then succeeds', async () => {
    /** @type {number[]} */
    const sleeps = [];
    let attempts = 0;
    const result = await fetchWithRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          return { ok: false, reason: 'http-429' };
        }
        return { ok: true, value: 'ok-value' };
      },
      {
        sleepFn: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    assert.deepEqual(result, { ok: true, value: 'ok-value' });
    assert.equal(attempts, 3);
    assert.deepEqual(sleeps, [1000, 2000]);
  });

  it('fetchWithRetry does not retry non-retryable failures', async () => {
    let attempts = 0;
    const result = await fetchWithRetry(async () => {
      attempts += 1;
      return { ok: false, reason: 'http-401' };
    });
    assert.deepEqual(result, { ok: false, reason: 'http-401' });
    assert.equal(attempts, 1);
  });

  it('fetchNewsapi retries transient HTTP errors before succeeding', async () => {
    let attempts = 0;
    const fetchFn = async () => {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, status: 429 };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', articles: [] }),
      };
    };

    const result = await fetchNewsapi(
      {
        apiKey: 'test-key',
        windowHours: 48,
        pageSize: 20,
        queryOverride: null,
      },
      fetchFn,
    );

    assert.equal(result.ok, true);
    assert.equal(attempts, 2);
  });
});
