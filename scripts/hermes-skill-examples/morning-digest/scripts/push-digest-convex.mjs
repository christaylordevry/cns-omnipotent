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
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { mergeTrendIngestEnv, resolveOperatorHome } from './fetch-arxiv-rss.mjs';

export const MISSING_CONVEX_ENV_ERROR = 'missing-convex-env';

const CREATE_PATH = 'digest:createDigestRun';
const ADD_PATH = 'digest:addDigestSignal';
const FINALIZE_PATH = 'digest:finalizeDigestRun';
const RESCORE_PATH = 'digest:rescoreDigestRun';
export const DIGEST_PUSH_TIMEOUT_MS = 45_000;

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
 * @param {unknown[]} signals
 * @returns {number}
 */
export function countValidSignals(signals) {
  if (!Array.isArray(signals)) {
    return 0;
  }
  return signals.filter((signal) => signal && typeof signal === 'object').length;
}

/**
 * @param {Record<string, unknown>} run
 * @param {string} digestRunId
 * @param {Array<Record<string, unknown>>} pushedSignals
 * @returns {{
 *   run: { digestRunId: string; ranAt: number; date: string; workspaceId?: string };
 *   signals: Array<Record<string, unknown>>;
 * }}
 */
export function buildPushedScoredPayload(run, digestRunId, pushedSignals) {
  const ranAt =
    typeof run?.ranAt === 'number' && Number.isFinite(run.ranAt) ? run.ranAt : Date.now();
  const date = String(run?.date ?? '').trim();
  const pushedRun = { ...run, digestRunId, ranAt, date };
  return { run: pushedRun, signals: pushedSignals };
}

/**
 * @param {Record<string, unknown>} input
 * @param {string[]} keys
 */
function omitKeys(input, keys) {
  const output = { ...input };
  for (const key of keys) {
    delete output[key];
  }
  return output;
}

/**
 * @param {{ run: Record<string, unknown>; signals: unknown[] }} payload
 * @returns {{ digestRunId: string; signals: Array<Record<string, unknown>> } | null}
 */
export function readRescoreIdentity(payload) {
  const digestRunId = String(payload.run?.digestRunId ?? '').trim();
  const validSignals = payload.signals.filter(
    (signal) => signal && typeof signal === 'object' && !Array.isArray(signal),
  );
  const signalIds = validSignals.map((signal) =>
    String(/** @type {Record<string, unknown>} */ (signal).digestSignalId ?? '').trim(),
  );
  const hasAnyIdentity = Boolean(digestRunId) || signalIds.some(Boolean);
  if (!hasAnyIdentity) {
    return null;
  }
  if (!digestRunId || signalIds.some((id) => !id)) {
    throw new Error('rescore payload requires digestRunId and digestSignalId on every signal');
  }
  return {
    digestRunId,
    signals: validSignals.map((signal, index) => ({
      .../** @type {Record<string, unknown>} */ (signal),
      digestRunId,
      digestSignalId: signalIds[index],
    })),
  };
}

export async function persistPushedPayloadArtifact(pushedPayload, env = process.env) {
  const date = String(pushedPayload?.run?.date ?? '').trim();
  if (!date) {
    throw new Error('pushed payload artifact requires run.date');
  }
  const operatorHome = await resolveOperatorHome(env);
  const hermesDir = join(operatorHome, '.hermes');
  const artifactPath = join(hermesDir, `digest-push-${date}.json`);
  await mkdir(hermesDir, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(pushedPayload, null, 2)}\n`, 'utf8');
  return artifactPath;
}

export async function runPushCliEntityStage(result, env = process.env, options = {}) {
  if (!result.ok || !result.pushedPayload) {
    return null;
  }
  const persist = options.persistFn ?? persistPushedPayloadArtifact;
  try {
    await persist(result.pushedPayload, env);
  } catch (err) {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
        : 'artifact-write-failed';
    console.error(`push-digest-convex: warning — pushed artifact not updated: ${reason}`);
  }
  const analyze =
    options.analyzeFn ??
    (await import('./analyze-entity-intelligence.mjs')).runAnalyzeEntityIntelligence;
  return analyze(result.pushedPayload, env);
}

/**
 * @param {{
 *   status: 'ok' | 'failed' | 'skipped' | 'error';
 *   digestRunId?: string | null;
 *   signalsWritten?: number;
 *   reason?: string;
 *   expectedCount?: number;
 *   pushedPayload?: { run: Record<string, unknown>; signals: Array<Record<string, unknown>> } | null;
 * }} input
 * @returns {{
 *   ok: boolean;
 *   runId: string | null;
 *   signalsWritten: number;
 *   error: string | null;
 *   exitCode: number;
 *   pushedPayload?: { run: Record<string, unknown>; signals: Array<Record<string, unknown>> } | null;
 * }}
 */
export function formatPushResult({
  status,
  digestRunId = null,
  signalsWritten = 0,
  reason,
  expectedCount = 0,
  pushedPayload = null,
}) {
  if (status === 'skipped') {
    return {
      ok: false,
      runId: null,
      signalsWritten: 0,
      error: MISSING_CONVEX_ENV_ERROR,
      exitCode: 0,
      pushedPayload: null,
    };
  }

  if (status === 'error') {
    return {
      ok: false,
      runId: null,
      signalsWritten: 0,
      error: reason === 'invalid-input' ? 'invalid-input' : String(reason ?? 'invalid-input'),
      exitCode: 2,
      pushedPayload: null,
    };
  }

  if (status === 'ok') {
    const ok = signalsWritten === expectedCount;
    return {
      ok,
      runId: digestRunId ?? null,
      signalsWritten,
      error: ok ? null : `partial-write:${signalsWritten}/${expectedCount}`,
      exitCode: ok ? 0 : 1,
      pushedPayload: ok ? pushedPayload : null,
    };
  }

  return {
    ok: false,
    runId: digestRunId ?? null,
    signalsWritten,
    error: reason ? String(reason).slice(0, 200) : 'unexpected error',
    exitCode: 1,
    pushedPayload: null,
  };
}

/**
 * @param {typeof fetch} fetchFn
 * @param {{ convexUrl: string; convexDeployKey: string }} convexEnv
 * @param {string} path
 * @param {Record<string, unknown>} args
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<unknown>}
 */
export async function postConvexMutation(fetchFn, convexEnv, path, args, options = {}) {
  const response = await fetchFn(`${normalizeConvexUrl(convexEnv.convexUrl)}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Convex ${convexEnv.convexDeployKey}`,
    },
    body: JSON.stringify({ path, args, format: 'json' }),
    signal: options.signal,
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
 *   timeoutMs?: number;
 * }} [opts]
 */
export async function pushDigestToConvex(opts = {}) {
  const env = opts.env ?? process.env;
  const payload = readDigestPushPayload(env);
  if (!payload) {
    console.error('push-digest-convex: missing required payload (run.date)');
    return formatPushResult({ status: 'error', reason: 'invalid-input' });
  }

  const expectedCount = countValidSignals(payload.signals);
  const convexEnv = await resolveConvexPushEnv(env);
  if (!convexEnv) {
    console.error('push-digest-convex: skipped — missing CONVEX_URL or CONVEX_DEPLOY_KEY');
    return formatPushResult({ status: 'skipped' });
  }

  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const timeoutSignal = globalThis.AbortSignal.timeout(opts.timeoutMs ?? DIGEST_PUSH_TIMEOUT_MS);
  /** @type {string | null} */
  let digestRunId = null;
  let signalsWritten = 0;
  let createdNewRun = false;
  /** @type {Array<Record<string, unknown>>} */
  const pushedSignals = [];

  try {
    const rescoreIdentity = readRescoreIdentity(payload);
    if (rescoreIdentity) {
      digestRunId = rescoreIdentity.digestRunId;
      const run = omitKeys(payload.run, ['digestRunId']);
      const signals = rescoreIdentity.signals.map((signal) => ({
        digestSignalId: signal.digestSignalId,
        signal: {
          ...omitKeys(signal, ['digestSignalId']),
          digestRunId,
        },
      }));
      const value = await postConvexMutation(
        fetchFn,
        convexEnv,
        RESCORE_PATH,
        { id: digestRunId, run, signals },
        { signal: timeoutSignal },
      );
      const updated =
        value && typeof value === 'object' && 'signalsUpdated' in value
          ? Number(/** @type {{ signalsUpdated: unknown }} */ (value).signalsUpdated)
          : Number.NaN;
      if (!Number.isInteger(updated) || updated !== expectedCount) {
        throw new Error('rescoreDigestRun returned an unexpected signalsUpdated count');
      }
      signalsWritten = updated;
      return formatPushResult({
        status: 'ok',
        digestRunId,
        signalsWritten,
        expectedCount,
        pushedPayload: buildPushedScoredPayload(
          { ...payload.run, status: 'published' },
          digestRunId,
          rescoreIdentity.signals,
        ),
      });
    }

    const ranAt =
      typeof payload.run.ranAt === 'number' && Number.isFinite(payload.run.ranAt)
        ? payload.run.ranAt
        : Date.now();
    const persistedRun = { ...payload.run, ranAt, status: 'started' };
    const createdId = await postConvexMutation(
      fetchFn,
      convexEnv,
      CREATE_PATH,
      { run: persistedRun },
      { signal: timeoutSignal },
    );

    if (typeof createdId !== 'string' || !createdId.trim()) {
      throw new Error('createDigestRun did not return an id');
    }
    digestRunId = createdId.trim();
    createdNewRun = true;

    for (const signal of payload.signals) {
      if (!signal || typeof signal !== 'object') {
        continue;
      }
      const signalId = await postConvexMutation(
        fetchFn,
        convexEnv,
        ADD_PATH,
        { signal: { ...signal, digestRunId } },
        { signal: timeoutSignal },
      );
      if (typeof signalId !== 'string' || !signalId.trim()) {
        throw new Error('addDigestSignal did not return an id');
      }
      pushedSignals.push({ ...signal, digestRunId, digestSignalId: signalId.trim() });
      signalsWritten += 1;
    }

    await postConvexMutation(
      fetchFn,
      convexEnv,
      FINALIZE_PATH,
      { id: digestRunId, status: 'published' },
      { signal: timeoutSignal },
    );

    return formatPushResult({
      status: 'ok',
      digestRunId,
      signalsWritten,
      expectedCount,
      pushedPayload: buildPushedScoredPayload(
        { ...persistedRun, status: 'published' },
        digestRunId,
        pushedSignals,
      ),
    });
  } catch (err) {
    if (digestRunId && createdNewRun) {
      try {
        await postConvexMutation(
          fetchFn,
          convexEnv,
          FINALIZE_PATH,
          { id: digestRunId, status: 'failed' },
          { signal: timeoutSignal },
        );
      } catch {
        // Best-effort — primary error already captured below.
      }
    }
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
        : 'unexpected error';
    console.error(`push-digest-convex: warning — ${reason}`);
    return formatPushResult({
      status: 'failed',
      digestRunId,
      signalsWritten,
      reason,
      expectedCount,
    });
  }
}

async function main() {
  const result = await pushDigestToConvex();
  const entityResult = await runPushCliEntityStage(result, process.env);
  console.log(JSON.stringify({
    ok: result.ok,
    runId: result.runId,
    signalsWritten: result.signalsWritten,
    error: result.error,
    pushedPayload: result.pushedPayload ?? null,
    entityResult,
  }));
  process.exit(result.exitCode);
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
    const result = formatPushResult({ status: 'failed', reason });
    console.log(JSON.stringify({
      ok: result.ok,
      runId: result.runId,
      signalsWritten: result.signalsWritten,
      error: result.error,
      pushedPayload: null,
      entityResult: null,
    }));
    process.exit(result.exitCode);
  });
}
