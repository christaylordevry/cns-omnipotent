/**
 * Digest entity intelligence markdown renderer (Story 73-7, EXPERIENCE.md § DigestEntitySection).
 * Read-only: one HTTP query to getEntityIntelligence — no lane qualification in Node.
 */

import { postQuery } from '../../../push-digest-watchdog.mjs';
import { resolveConvexPushEnv } from './push-digest-convex.mjs';

export const DIGEST_ENTITY_MAX_LINES_PER_LANE = 5;
export const DIGEST_ENTITY_FETCH_TIMEOUT_MS = 10_000;

export const TRACKED_DIGEST_SECTION_TITLE = 'Tracked entities accelerating now';
export const EMERGING_DIGEST_SECTION_TITLE = 'Emerging entities worth a look';

const ENTITY_COCKPIT_LINK = '[Open entity cockpit](/nexus/entities)';

const MOMENTUM_MAX_LENGTH = 48;
const REASON_LABEL_MAX_LENGTH = 40;
const EMOJI_PATTERN = /[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/gu;
const MARKDOWN_CONTROL_CHARS = new Set(['\\', '`', '*', '_', '[', ']', '|', '~']);

/**
 * Keep externally sourced entity fields on one inert Discord markdown line.
 *
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function sanitizeEntityDigestField(value, fallback = '') {
  const normalized = String(value ?? '')
    .replace(EMOJI_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/@/g, '@\u200B');
  const escaped = [...normalized]
    .map((character) => (MARKDOWN_CONTROL_CHARS.has(character) ? `\\${character}` : character))
    .join('');
  return escaped || fallback;
}

/**
 * @param {unknown} value
 * @returns {{ trackedInMotion: Array<Record<string, unknown>>; emergingToReview: Array<Record<string, unknown>> }}
 */
export function normalizeEntityIntelligenceResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { trackedInMotion: [], emergingToReview: [] };
  }
  const trackedInMotion = Array.isArray(value.trackedInMotion) ? value.trackedInMotion : [];
  const emergingToReview = Array.isArray(value.emergingToReview) ? value.emergingToReview : [];
  return { trackedInMotion, emergingToReview };
}

/**
 * @param {string} code
 * @param {string} [detail]
 * @returns {string}
 */
export function reasonCodeToDigestLabel(code, detail = '') {
  const normalizedDetail = String(detail ?? '');
  switch (code) {
    case 'acceleration': {
      const ratio = normalizedDetail.match(/≈([\d.]+×)/)?.[1];
      return ratio ? `≈${ratio} vs baseline` : 'acceleration';
    }
    case 'cold_start':
      return 'cold start';
    case 'cross_source': {
      const count =
        normalizedDetail.match(/across\s+(\d+)\s+sources?/i)?.[1] ??
        normalizedDetail.match(/\((\d+)\)/)?.[1];
      return count ? `cross-source (${count})` : 'cross-source';
    }
    case 'new_source': {
      const source = normalizedDetail.match(/:\s*([^,]+)/)?.[1]?.trim();
      return source ? `new source: ${source}` : 'new source';
    }
    case 'theme_adjacent':
      return 'theme';
    case 'co_mentioned':
      return 'co-mentioned';
    case 'high_priority_source':
      return 'high rank';
    default:
      return String(code).replace(/_/g, ' ');
  }
}

/**
 * @param {string} momentumSummary
 * @returns {string}
 */
export function compactMomentumSummary(momentumSummary) {
  const text = String(momentumSummary ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }

  const coldStartMatch = text.match(/^(\d+)\s+mentions\s*\/\s*7d\b/i);
  if (/no baseline/i.test(text) && coldStartMatch) {
    return `new, ${coldStartMatch[1]} mentions/7d`;
  }

  const ratioMatch = text.match(/\(≈([\d.]+×)\)/);
  if (ratioMatch) {
    return `≈${ratioMatch[1]} vs baseline`;
  }

  if (text.length <= MOMENTUM_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, MOMENTUM_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * @param {Array<Record<string, unknown>>} reasons
 * @param {string} momentumShort
 * @returns {Record<string, unknown> | null}
 */
function selectTopReasonForDigest(reasons, momentumShort) {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return null;
  }
  const momentumHasRatio = /× vs baseline/.test(momentumShort);
  if (momentumHasRatio) {
    const nonAcceleration = reasons.find(
      (reason) => reason && typeof reason === 'object' && reason.code !== 'acceleration',
    );
    if (nonAcceleration) {
      return nonAcceleration;
    }
  }
  const first = reasons[0];
  return first && typeof first === 'object' ? first : null;
}

/**
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function renderEntityDigestLine(item) {
  const displayName = sanitizeEntityDigestField(item.displayName, 'Unknown');
  const entityType = sanitizeEntityDigestField(item.entityType, 'person');
  const momentumShort = sanitizeEntityDigestField(
    compactMomentumSummary(String(item.momentumSummary ?? '')),
  );
  const reasons = Array.isArray(item.reasons) ? item.reasons : [];
  const topReason = selectTopReasonForDigest(reasons, momentumShort);
  const topReasonLabel = topReason
    ? reasonCodeToDigestLabel(String(topReason.code ?? ''), String(topReason.detail ?? ''))
    : '';
  const reasonPart = sanitizeEntityDigestField(topReasonLabel).slice(0, REASON_LABEL_MAX_LENGTH);
  const segments = [momentumShort, reasonPart].filter(Boolean);
  const tail = segments.length > 0 ? ` — ${segments.join(' · ')}` : '';
  return `• **${displayName}** (${entityType})${tail}`;
}

/**
 * @param {string} title
 * @param {Array<Record<string, unknown>>} items
 * @param {number} maxPerLane
 * @returns {string}
 */
function renderLaneSection(title, items, maxPerLane) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }
  const lines = items
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .slice(0, maxPerLane)
    .map((item) => renderEntityDigestLine(item));
  if (lines.length === 0) {
    return '';
  }
  return `## ${title}\n${lines.join('\n')}`;
}

/**
 * @param {{
 *   trackedInMotion?: Array<Record<string, unknown>>;
 *   emergingToReview?: Array<Record<string, unknown>>;
 * }} result
 * @param {{
 *   maxPerLane?: number;
 *   includeDeepLink?: boolean;
 * }} [options]
 * @returns {string}
 */
export function renderDigestEntitySection(result, options = {}) {
  const maxPerLane = options.maxPerLane ?? DIGEST_ENTITY_MAX_LINES_PER_LANE;
  const includeDeepLink = options.includeDeepLink !== false;
  const normalized = normalizeEntityIntelligenceResult(result);
  const sections = [
    renderLaneSection(TRACKED_DIGEST_SECTION_TITLE, normalized.trackedInMotion, maxPerLane),
    renderLaneSection(EMERGING_DIGEST_SECTION_TITLE, normalized.emergingToReview, maxPerLane),
  ].filter(Boolean);

  if (sections.length === 0) {
    return '';
  }

  const body = sections.join('\n\n');
  return includeDeepLink ? `${body}\n\n${ENTITY_COCKPIT_LINK}` : body;
}

/**
 * Trim entity digest lines (lowest rank first) when append would exceed markdown pack limit.
 *
 * @param {string} entityBlock
 * @param {number} baseMarkdownLength
 * @param {number} maxTotalLength
 * @returns {string}
 */
export function trimEntityBlockForDigestAppend(entityBlock, baseMarkdownLength, maxTotalLength) {
  const block = String(entityBlock ?? '').trim();
  if (!block) {
    return '';
  }
  const separatorLength = baseMarkdownLength > 0 ? 2 : 0;
  if (baseMarkdownLength + separatorLength + block.length <= maxTotalLength) {
    return block;
  }

  const deepLinkSuffix = `\n\n${ENTITY_COCKPIT_LINK}`;
  const hasDeepLink = block.endsWith(deepLinkSuffix);
  const core = hasDeepLink ? block.slice(0, -deepLinkSuffix.length).trimEnd() : block;
  const sections = core.split(/\n\n+/);
  /** @type {string[]} */
  const trimmedSections = [];

  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0]?.startsWith('## ') ? lines[0] : null;
    const bullets = header ? lines.slice(1).filter((line) => line.startsWith('• ')) : lines.filter((line) => line.startsWith('• '));
    if (bullets.length === 0) {
      trimmedSections.push(section);
      continue;
    }
    trimmedSections.push(header ? [header, ...bullets].join('\n') : bullets.join('\n'));
  }

  while (trimmedSections.length > 0) {
    let candidate = trimmedSections.join('\n\n');
    if (hasDeepLink) {
      candidate = `${candidate}\n\n${ENTITY_COCKPIT_LINK}`;
    }
    if (baseMarkdownLength + separatorLength + candidate.length <= maxTotalLength) {
      return candidate;
    }

    let targetIndex = -1;
    let targetBulletCount = 0;
    for (let index = 0; index < trimmedSections.length; index += 1) {
      const lines = trimmedSections[index].split('\n');
      const bulletIndexes = lines
        .map((line, lineIndex) => (line.startsWith('• ') ? lineIndex : -1))
        .filter((lineIndex) => lineIndex >= 0);
      if (bulletIndexes.length >= targetBulletCount && bulletIndexes.length > 0) {
        targetIndex = index;
        targetBulletCount = bulletIndexes.length;
      }
    }
    if (targetIndex < 0) {
      return '';
    }

    {
      const lines = trimmedSections[targetIndex].split('\n');
      const bulletIndexes = lines
        .map((line, lineIndex) => (line.startsWith('• ') ? lineIndex : -1))
        .filter((lineIndex) => lineIndex >= 0);
      const dropIndex = bulletIndexes[bulletIndexes.length - 1];
      const nextLines = lines.filter((_, lineIndex) => lineIndex !== dropIndex);
      const header = nextLines.find((line) => line.startsWith('## '));
      const remainingBullets = nextLines.filter((line) => line.startsWith('• '));
      if (remainingBullets.length === 0) {
        trimmedSections.splice(targetIndex, 1);
      } else {
        trimmedSections[targetIndex] = header
          ? [header, ...remainingBullets].join('\n')
          : remainingBullets.join('\n');
      }
    }
  }

  return '';
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ now?: number; fetchFn?: typeof fetch; timeoutMs?: number; signal?: AbortSignal }} [options]
 * @returns {Promise<{ trackedInMotion: Array<Record<string, unknown>>; emergingToReview: Array<Record<string, unknown>> }>}
 */
export async function fetchEntityIntelligence(env, options = {}) {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const convexEnv = await resolveConvexPushEnv(env);
  if (!convexEnv) {
    throw new Error('missing-convex-env');
  }
  const runAt =
    typeof options.now === 'number' && Number.isFinite(options.now) ? options.now : Date.now();
  const timeoutMs =
    typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : DIGEST_ENTITY_FETCH_TIMEOUT_MS;
  const signal = options.signal ?? globalThis.AbortSignal.timeout(timeoutMs);
  const value = await postQuery(fetchFn, convexEnv, 'entityIntelligence:getEntityIntelligence', {
    now: runAt,
  }, { signal });
  return normalizeEntityIntelligenceResult(value);
}

/**
 * Fetch entity intelligence and attach rendered markdown to payload (fire-and-forget on failure).
 *
 * @param {Record<string, unknown>} payload
 * @param {Record<string, string | undefined>} env
 * @param {{ fetchFn?: typeof fetch; maxPerLane?: number; timeoutMs?: number }} [options]
 * @returns {Promise<{ payload: Record<string, unknown>; entityDigestResult: { status: 'ok' | 'empty' | 'failed'; linesRendered: number; reason: string | null } }>}
 */
export async function enrichPayloadWithEntityDigest(payload, env, options = {}) {
  const run =
    payload.run && typeof payload.run === 'object'
      ? /** @type {{ ranAt?: number }} */ (payload.run)
      : {};
  const ranAt = typeof run.ranAt === 'number' && Number.isFinite(run.ranAt) ? run.ranAt : undefined;

  try {
    const intel = await fetchEntityIntelligence(env, {
      now: ranAt,
      fetchFn: options.fetchFn,
      timeoutMs: options.timeoutMs,
    });
    const entityBlock = renderDigestEntitySection(intel, {
      maxPerLane: options.maxPerLane ?? DIGEST_ENTITY_MAX_LINES_PER_LANE,
    });
    if (!entityBlock) {
      return {
        payload,
        entityDigestResult: { status: 'empty', linesRendered: 0, reason: null },
      };
    }
    return {
      payload: { ...payload, entityDigestMarkdown: entityBlock },
      entityDigestResult: {
        status: 'ok',
        linesRendered: entityBlock.split('\n').filter((line) => line.startsWith('• ')).length,
        reason: null,
      },
    };
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message)
        : 'entity-intelligence-fetch-failed';
    process.stderr.write(`[entity-digest] ${message}\n`);
    return {
      payload,
      entityDigestResult: {
        status: 'failed',
        linesRendered: 0,
        reason: message.slice(0, 120),
      },
    };
  }
}
