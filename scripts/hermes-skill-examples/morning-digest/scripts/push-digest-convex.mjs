#!/usr/bin/env node
/**
 * Push morning-digest run metadata and per-source signals to Convex digestRuns/digestSignals.
 *
 * Env:
 *   DIGEST_PUSH_JSON — JSON payload { run, signals[] }
 *   run.date must be Australia/Sydney civil YYYY-MM-DD from the orchestrator (formatSydneyDate).
 *   CONVEX_URL, CONVEX_DEPLOY_KEY (via mergeTrendIngestEnv / operator home)
 */

import { createHash } from 'node:crypto';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const CREATE_PATH = 'digest:createDigestRun';
const ADD_PATH = 'digest:addDigestSignal';
const FINALIZE_PATH = 'digest:finalizeDigestRun';

/**
 * @param {string} convexUrl
 * @returns {string}
 */
export function normalizeConvexUrl(convexUrl) {
  return convexUrl.replace(/\/$/, '');
}

/**
 * @param {...string} parts
 * @returns {string}
 */
export function shortSha256Hex(...parts) {
  return createHash('sha256').update(parts.join('')).digest('hex').slice(0, 16);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ run: Record<string, unknown>; signals: unknown[] } | null}
 */
export function readDigestPushPayload(env) {
  const raw = env.DIGEST_PUSH_JSON?.trim() ?? '';
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    const date = parsed?.run?.date;
    if (typeof date !== 'string' || !date.trim()) {
      return null;
    }
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    return { run: parsed.run, signals };
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, string | undefined>} [baseEnv]
 * @returns {Promise<{ convexUrl: string; convexDeployKey: string } | null>}
 */
export async function resolveConvexPushEnv(baseEnv = process.env) {
  const merged = await mergeTrendIngestEnv(baseEnv);
  const convexUrl = merged.CONVEX_URL?.trim();
  const convexDeployKey = merged.CONVEX_DEPLOY_KEY?.trim();
  if (convexUrl && convexDeployKey) {
    return { convexUrl, convexDeployKey };
  }
  return null;
}

/**
 * @param {typeof fetch} fetchFn
 * @param {{ convexUrl: string; convexDeployKey: string }} convexEnv
 * @param {string} path
 * @param {Record<string, unknown>} args
 * @returns {Promise<unknown>}
 */
async function postMutation(fetchFn, convexEnv, path, args) {
  const response = await fetchFn(`${normalizeConvexUrl(convexEnv.convexUrl)}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Convex ${convexEnv.convexDeployKey}`,
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  });

  const bodyText = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`Convex HTTP ${response.status}: ${bodyText.slice(0, 200)}`);
  }

  let payload;
  try {
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    throw new Error('Convex mutation response was not valid JSON');
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.status === 'error') {
      const message =
        typeof payload.errorMessage === 'string' ? payload.errorMessage : 'Convex mutation failed';
      throw new Error(message);
    }
    if (payload.status && payload.status !== 'success') {
      throw new Error('Convex mutation returned unexpected status');
    }
    return payload.value;
  }

  return payload;
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   fetchFn?: typeof fetch;
 * }} [opts]
 */
export async function pushDigestToConvex(opts = {}) {
  const env = opts.env ?? process.env;
  const payload = readDigestPushPayload(env);
  if (!payload) {
    console.error('push-digest-convex: missing required payload (run.date)');
    return { status: 'error', reason: 'invalid-input', exitCode: 0 };
  }

  const convexEnv = await resolveConvexPushEnv(env);
  if (!convexEnv) {
    console.error('push-digest-convex: skipped — missing CONVEX_URL or CONVEX_DEPLOY_KEY');
    return { status: 'skipped', reason: 'missing-convex-env', exitCode: 0 };
  }

  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  /** @type {string | null} */
  let digestRunId = null;

  try {
    const createdId = await postMutation(fetchFn, convexEnv, CREATE_PATH, {
      run: { ...payload.run, ranAt: payload.run.ranAt ?? Date.now(), status: 'started' },
    });

    if (typeof createdId !== 'string' || !createdId) {
      throw new Error('createDigestRun did not return an id');
    }
    digestRunId = createdId;

    for (const signal of payload.signals) {
      if (!signal || typeof signal !== 'object') {
        continue;
      }
      await postMutation(fetchFn, convexEnv, ADD_PATH, {
        signal: { ...signal, digestRunId },
      });
    }

    await postMutation(fetchFn, convexEnv, FINALIZE_PATH, {
      id: digestRunId,
      status: 'published',
    });

    return { status: 'ok', reason: 'pushed', exitCode: 0, digestRunId };
  } catch (err) {
    if (digestRunId) {
      try {
        await postMutation(fetchFn, convexEnv, FINALIZE_PATH, {
          id: digestRunId,
          status: 'failed',
        });
      } catch {
        // Best-effort — primary error already captured below.
      }
    }
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
        : 'unexpected error';
    console.error(`push-digest-convex: warning — ${reason}`);
    return { status: 'failed', reason, exitCode: 0, digestRunId };
  }
}

async function main() {
  await pushDigestToConvex();
  process.exit(0);
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('push-digest-convex.mjs');

if (isMain) {
  main().catch((err) => {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
        : 'unexpected error';
    console.error(`push-digest-convex: warning — ${reason}`);
    process.exit(0);
  });
}
