#!/usr/bin/env node
/**
 * Log a successful /notebook-query answer to Convex notebookQueries table.
 *
 * Env:
 *   NOTEBOOK_QUERY, NOTEBOOK_ANSWER, NOTEBOOK_ID, NOTEBOOK_TITLE, NOTEBOOK_DOMAIN
 *   CONVEX_URL, CONVEX_DEPLOY_KEY (or ~/.hermes/trend-ingest.env fallback)
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MUTATION_PATH = 'notebookQueries:logNotebookQuery';
const DEFAULT_TREND_INGEST_ENV_PATH = join(homedir(), '.hermes', 'trend-ingest.env');

/**
 * @param {string} convexUrl
 * @returns {string}
 */
function normalizeConvexUrl(convexUrl) {
  return convexUrl.replace(/\/$/, '');
}

/**
 * @param {string} value
 * @returns {string}
 */
function stripEnvQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * @param {string} raw
 * @returns {Record<string, string>}
 */
export function parseKeyValueEnv(raw) {
  const values = {};
  for (const rawLine of raw.split('\n')) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('export ')) {
      line = line.slice('export '.length).trim();
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    if (!key) {
      continue;
    }
    values[key] = stripEnvQuotes(line.slice(separator + 1));
  }
  return values;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
function trendIngestEnvPath(env) {
  const override =
    env.CNS_TREND_INGEST_ENV_PATH?.trim() || env.TREND_INGEST_ENV?.trim();
  return override || DEFAULT_TREND_INGEST_ENV_PATH;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<{ convexUrl: string; convexDeployKey: string } | null>}
 */
export async function resolveConvexPushEnv(env) {
  const convexUrl = env.CONVEX_URL?.trim();
  const convexDeployKey = env.CONVEX_DEPLOY_KEY?.trim();
  if (convexUrl && convexDeployKey) {
    return { convexUrl, convexDeployKey };
  }

  try {
    const parsed = parseKeyValueEnv(await readFile(trendIngestEnvPath(env), 'utf8'));
    const fallbackUrl = convexUrl || parsed.CONVEX_URL?.trim();
    const fallbackKey = convexDeployKey || parsed.CONVEX_DEPLOY_KEY?.trim();
    if (fallbackUrl && fallbackKey) {
      return { convexUrl: fallbackUrl, convexDeployKey: fallbackKey };
    }
  } catch (err) {
    if (!(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT')) {
      throw err;
    }
  }

  return null;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ question: string; answer: string; notebookId: string; notebookTitle: string; domain: string } | null}
 */
export function readLogPayload(env) {
  const question = env.NOTEBOOK_QUERY?.trim() ?? '';
  const answer = env.NOTEBOOK_ANSWER?.trim() ?? '';
  const notebookId = env.NOTEBOOK_ID?.trim() ?? '';
  const notebookTitle = env.NOTEBOOK_TITLE?.trim() ?? '';
  const domain = env.NOTEBOOK_DOMAIN?.trim() ?? '';

  if (!question || !answer || !notebookId || !notebookTitle) {
    return null;
  }

  return { question, answer, notebookId, notebookTitle, domain };
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   fetchFn?: typeof fetch;
 * }} [opts]
 */
export async function logNotebookQueryToConvex(opts = {}) {
  const env = opts.env ?? process.env;
  const payload = readLogPayload(env);
  if (!payload) {
    console.error('log-notebook-query: missing required env (NOTEBOOK_QUERY, NOTEBOOK_ANSWER, NOTEBOOK_ID, NOTEBOOK_TITLE)');
    return { status: 'error', reason: 'invalid-input' };
  }

  const convexEnv = await resolveConvexPushEnv(env);
  if (!convexEnv) {
    console.error('log-notebook-query: skipped — missing CONVEX_URL or CONVEX_DEPLOY_KEY');
    return { status: 'skipped', reason: 'missing-convex-env' };
  }

  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const response = await fetchFn(`${normalizeConvexUrl(convexEnv.convexUrl)}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Convex ${convexEnv.convexDeployKey}`,
    },
    body: JSON.stringify({
      path: MUTATION_PATH,
      args: { entry: payload },
      format: 'json',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`log-notebook-query: Convex push failed (${response.status}): ${body}`);
    return { status: 'error', reason: 'convex-http-error' };
  }

  return { status: 'ok' };
}

async function main() {
  const result = await logNotebookQueryToConvex();
  if (result.status === 'error') {
    process.exit(1);
  }
  process.exit(0);
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('log-notebook-query.mjs');

if (isMain) {
  main().catch((err) => {
    console.error('log-notebook-query: unexpected error', err);
    process.exit(1);
  });
}
