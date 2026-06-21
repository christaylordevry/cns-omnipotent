#!/usr/bin/env node
/**
 * Epic 73 — post-push entity mention orchestrator (ADR-E73-001, ADR-E73-002).
 * Builds entityMentions payloads from in-memory pushed signals and writes via HTTP mutations.
 * Degraded mode: stderr warning, no throw (architecture §8).
 */

import { buildEntityMentionPayload } from './build-entity-mention-payload.mjs';
import { postConvexMutation, resolveConvexPushEnv } from './push-digest-convex.mjs';

export const CLEAR_ENTITY_MENTIONS_PATH = 'entityIntelligence:clearEntityMentionsForRun';
export const RECORD_ENTITY_MENTIONS_PATH = 'entityIntelligence:recordEntityMentions';
export const REPLACE_ENTITY_MENTIONS_PATH = 'entityIntelligence:replaceEntityMentionsForRun';
export const ENTITY_ANALYSIS_TIMEOUT_MS = 30_000;

/**
 * @param {unknown} err
 * @returns {string}
 */
function formatErrorMessage(err) {
  if (err && typeof err === 'object' && 'message' in err) {
    return String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200);
  }
  return 'unexpected error';
}

/**
 * Post-push entity intelligence stage: clear-then-write per-run snapshots.
 *
 * @param {{
 *   run: { digestRunId: string; ranAt: number; date: string; workspaceId?: string };
 *   signals: Array<Record<string, unknown>>;
 * }} scoredPayload — in-memory pushed run + Convex-assigned digestSignalId per signal
 * @param {Record<string, string | undefined>} env
 * @param {{ fetchFn?: typeof fetch; timeoutMs?: number }} [options]
 * @returns {Promise<{ status: 'ok' | 'skipped' | 'failed'; mentionsWritten: number; reason: string | null }>}
 */
export async function runAnalyzeEntityIntelligence(scoredPayload, env, options = {}) {
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  try {
    const convexEnv = await resolveConvexPushEnv(env);
    if (!convexEnv) {
      console.error('analyze-entity-intelligence: skipped — missing CONVEX_URL or CONVEX_DEPLOY_KEY');
      return { status: 'skipped', mentionsWritten: 0, reason: 'missing-convex-env' };
    }

    const mentions = buildEntityMentionPayload(scoredPayload.run, scoredPayload.signals);
    const digestRunId = scoredPayload.run.digestRunId;
    await postConvexMutation(
      fetchFn,
      convexEnv,
      REPLACE_ENTITY_MENTIONS_PATH,
      { digestRunId, mentions },
      { signal: globalThis.AbortSignal.timeout(options.timeoutMs ?? ENTITY_ANALYSIS_TIMEOUT_MS) },
    );
    return { status: 'ok', mentionsWritten: mentions.length, reason: null };
  } catch (err) {
    const reason = formatErrorMessage(err);
    console.error(`analyze-entity-intelligence: warning — ${reason}`);
    return { status: 'failed', mentionsWritten: 0, reason };
  }
}

async function main() {
  const raw = process.env.DIGEST_PUSH_JSON?.trim() ?? '';
  if (!raw) {
    console.error('analyze-entity-intelligence: missing DIGEST_PUSH_JSON');
    process.exit(0);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('analyze-entity-intelligence: invalid DIGEST_PUSH_JSON');
    process.exit(0);
  }

  const digestRunId = String(parsed?.run?.digestRunId ?? parsed?.digestRunId ?? '').trim();
  if (!digestRunId) {
    console.error('analyze-entity-intelligence: missing run.digestRunId');
    process.exit(0);
  }

  await runAnalyzeEntityIntelligence(
    {
      run: {
        digestRunId,
        ranAt: parsed.run?.ranAt ?? Date.now(),
        date: String(parsed.run?.date ?? ''),
        workspaceId: parsed.run?.workspaceId,
      },
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
    },
    process.env,
  );
  process.exit(0);
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('analyze-entity-intelligence.mjs');

if (isMain) {
  main().catch((err) => {
    console.error(`analyze-entity-intelligence: warning — ${formatErrorMessage(err)}`);
    process.exit(0);
  });
}
