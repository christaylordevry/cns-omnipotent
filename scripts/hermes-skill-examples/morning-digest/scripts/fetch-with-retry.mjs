/**
 * Shared fetch retry helper for morning-digest adapters (Story 81-2 AC2).
 */

import { setTimeout as delayMs } from 'node:timers/promises';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_RETRYABLE = /^http-(429|503|502)|timeout|AbortError|ETIMEDOUT/i;

/**
 * @param {unknown} reason
 * @param {RegExp} pattern
 * @returns {boolean}
 */
export function isRetryableFetchReason(reason, pattern = DEFAULT_RETRYABLE) {
  return pattern.test(String(reason ?? ''));
}

/**
 * @template T
 * @param {() => Promise<{ ok: true; value: T } | { ok: false; reason: string }>} fn
 * @param {{
 *   maxAttempts?: number;
 *   baseDelayMs?: number;
 *   retryable?: RegExp;
 *   sleepFn?: (ms: number) => Promise<void>;
 * }} [options]
 * @returns {Promise<{ ok: true; value: T } | { ok: false; reason: string }>}
 */
export async function fetchWithRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const retryable = options.retryable ?? DEFAULT_RETRYABLE;
  const sleepFn = options.sleepFn ?? ((ms) => delayMs(ms));

  /** @type {{ ok: false; reason: string } | null} */
  let lastFailure = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fn();
    if (result.ok) {
      return result;
    }
    lastFailure = result;
    if (!isRetryableFetchReason(result.reason, retryable) || attempt >= maxAttempts) {
      return result;
    }
    await sleepFn(baseDelayMs * attempt);
  }

  return lastFailure ?? { ok: false, reason: 'fetch-retry-exhausted' };
}
