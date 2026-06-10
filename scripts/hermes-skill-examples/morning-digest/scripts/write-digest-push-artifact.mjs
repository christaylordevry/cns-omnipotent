#!/usr/bin/env node
/**
 * Persist post-scoring digest_push_payload to ~/.hermes/digest-push-YYYY-MM-DD.json
 * for §9 recovery when the agent skips push-digest-convex.mjs (Story 67-10).
 *
 * Env:
 *   DIGEST_PUSH_JSON — JSON payload { run: { date }, signals[] }
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { readDigestPushPayload } from './push-digest-convex.mjs';
import { resolveOperatorHome } from './fetch-arxiv-rss.mjs';

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<{ status: 'ok' | 'invalid-input'; path?: string; reason?: string }>}
 */
export async function writeDigestPushArtifact(env = process.env) {
  const payload = readDigestPushPayload(env);
  if (!payload) {
    console.error('write-digest-push-artifact: missing required payload (run.date)');
    return { status: 'invalid-input', reason: 'invalid-input' };
  }

  const date = payload.run.date.trim();
  const operatorHome = await resolveOperatorHome(env);
  const hermesDir = join(operatorHome, '.hermes');
  const artifactPath = join(hermesDir, `digest-push-${date}.json`);

  await mkdir(hermesDir, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  return { status: 'ok', path: artifactPath };
}

async function main() {
  await writeDigestPushArtifact();
  process.exit(0);
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('write-digest-push-artifact.mjs');

if (isMain) {
  main().catch((err) => {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
        : 'unexpected error';
    console.error(`write-digest-push-artifact: warning — ${reason}`);
    process.exit(0);
  });
}
