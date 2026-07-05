/**
 * Digest internal dev-state markdown renderer (Story 81-2, FR20).
 * Read-only: calls collectInternalDevState locally — no Convex round-trip.
 */

import { fileURLToPath } from 'node:url';

import {
  DIGEST_ENTITY_MAX_LINES_PER_LANE,
  sanitizeEntityDigestField,
} from './render-digest-entity-section.mjs';

export const DIGEST_INTERNAL_MAX_LINES = DIGEST_ENTITY_MAX_LINES_PER_LANE;
export const INTERNAL_DIGEST_SECTION_TITLE = 'Internal work prioritized';
export const DISCOVERY_COCKPIT_LINK = '[Open discovery panel](/nexus)';

const DEFAULT_REPO_ROOT = '/home/christ/ai-factory/projects/Omnipotent.md';
const DEFAULT_VAULT_ROOT = '/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE';

/** @type {Record<string, string>} */
const CATEGORY_LABELS = {
  sprint: 'sprint',
  deferred: 'deferred',
  agent_log: 'agent log',
  vault_scan: 'vault scan',
};

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ repoRoot: string; vaultRoot: string }}
 */
export function resolveInternalDevStatePaths(env = process.env) {
  const repoRoot = String(env.OMNIPOTENT_REPO ?? '').trim() || DEFAULT_REPO_ROOT;
  const vaultRoot = String(env.CNS_VAULT_ROOT ?? '').trim() || DEFAULT_VAULT_ROOT;
  return { repoRoot, vaultRoot };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPrioritizedItem(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof /** @type {{ title?: unknown }} */ (value).title === 'string' &&
    typeof /** @type {{ category?: unknown }} */ (value).category === 'string'
  );
}

/**
 * @param {unknown} category
 * @returns {string}
 */
export function categoryLabelForDigest(category) {
  const key = String(category ?? '').trim();
  return CATEGORY_LABELS[key] ?? sanitizeEntityDigestField(key, 'unknown');
}

/**
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function renderInternalDevDigestLine(item) {
  const title = sanitizeEntityDigestField(item.title, 'Unknown');
  const category = categoryLabelForDigest(item.category);
  const rationale = sanitizeEntityDigestField(String(item.rationale ?? ''));
  const tail = rationale ? ` — ${rationale}` : '';
  return `• **${title}** (${category})${tail}`;
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {{ maxLines?: number; includeDeepLink?: boolean }} [options]
 * @returns {string}
 */
export function renderInternalDevStateSection(items, options = {}) {
  const maxLines = options.maxLines ?? DIGEST_INTERNAL_MAX_LINES;
  const includeDeepLink = options.includeDeepLink !== false;
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }

  const sorted = items
    .filter((item) => isPrioritizedItem(item))
    .slice()
    .sort((a, b) => {
      const rankA = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER;
      const rankB = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return String(a.title ?? '').localeCompare(String(b.title ?? ''));
    })
    .slice(0, maxLines);

  if (sorted.length === 0) {
    return '';
  }

  const lines = sorted.map((item) => renderInternalDevDigestLine(item));
  const body = `## ${INTERNAL_DIGEST_SECTION_TITLE}\n${lines.join('\n')}`;
  return includeDeepLink ? `${body}\n\n${DISCOVERY_COCKPIT_LINK}` : body;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ now?: number; collectFn?: (opts: { repoRoot: string; vaultRoot: string; now?: number }) => Promise<Array<Record<string, unknown>>>; maxLines?: number }} [options]
 * @returns {Promise<{ markdown: string; internalDevDigestResult: { status: 'ok' | 'empty' | 'failed'; linesRendered: number; reason: string | null } }>}
 */
export async function runInternalDevStateDigestSection(env, options = {}) {
  const { repoRoot, vaultRoot } = resolveInternalDevStatePaths(env);
  const now =
    typeof options.now === 'number' && Number.isFinite(options.now)
      ? options.now
      : typeof env.DIGEST_RUN_AT === 'string' && env.DIGEST_RUN_AT.trim()
        ? Number(env.DIGEST_RUN_AT)
        : undefined;

  try {
    const collectFn =
      options.collectFn ??
      (async (opts) => {
        const { collectInternalDevState } = await import('../../../lib/collect-internal-dev-state.ts');
        return collectInternalDevState(opts);
      });

    const items = await collectFn({
      repoRoot,
      vaultRoot,
      ...(typeof now === 'number' && Number.isFinite(now) ? { now } : {}),
    });

    const markdown = renderInternalDevStateSection(items, {
      maxLines: options.maxLines ?? DIGEST_INTERNAL_MAX_LINES,
    });

    if (!markdown) {
      return {
        markdown: '',
        internalDevDigestResult: { status: 'empty', linesRendered: 0, reason: null },
      };
    }

    return {
      markdown,
      internalDevDigestResult: {
        status: 'ok',
        linesRendered: markdown.split('\n').filter((line) => line.startsWith('• ')).length,
        reason: null,
      },
    };
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message)
        : 'internal-dev-state-collect-failed';
    process.stderr.write(`[internal-dev-digest] ${message}\n`);
    return {
      markdown: '',
      internalDevDigestResult: {
        status: 'failed',
        linesRendered: 0,
        reason: message.slice(0, 120),
      },
    };
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {Record<string, string | undefined>} env
 * @param {{ collectFn?: (opts: { repoRoot: string; vaultRoot: string; now?: number }) => Promise<Array<Record<string, unknown>>>; maxLines?: number }} [options]
 * @returns {Promise<{ payload: Record<string, unknown>; internalDevDigestResult: { status: 'ok' | 'empty' | 'failed'; linesRendered: number; reason: string | null } }>}
 */
export async function enrichPayloadWithInternalDevDigest(payload, env, options = {}) {
  const run =
    payload.run && typeof payload.run === 'object'
      ? /** @type {{ ranAt?: number }} */ (payload.run)
      : {};
  const ranAt = typeof run.ranAt === 'number' && Number.isFinite(run.ranAt) ? run.ranAt : undefined;

  const result = await runInternalDevStateDigestSection(
    {
      ...env,
      ...(typeof ranAt === 'number' ? { DIGEST_RUN_AT: String(ranAt) } : {}),
    },
    options,
  );

  if (!result.markdown) {
    return { payload, internalDevDigestResult: result.internalDevDigestResult };
  }

  return {
    payload: { ...payload, internalDevDigestMarkdown: result.markdown },
    internalDevDigestResult: result.internalDevDigestResult,
  };
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return fileURLToPath(import.meta.url) === entry;
}

if (isMainModule()) {
  runInternalDevStateDigestSection(process.env)
    .then((result) => {
      process.stdout.write(
        `${JSON.stringify({
          markdown: result.markdown,
          status: result.internalDevDigestResult.status,
          linesRendered: result.internalDevDigestResult.linesRendered,
          reason: result.internalDevDigestResult.reason,
        })}\n`,
      );
      process.exit(0);
    })
    .catch((err) => {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
          : 'unexpected-error';
      process.stderr.write(`[internal-dev-digest] ${message}\n`);
      process.stdout.write(
        `${JSON.stringify({
          markdown: '',
          status: 'failed',
          linesRendered: 0,
          reason: message,
        })}\n`,
      );
      process.exit(0);
    });
}
