/**
 * Epic 73 — deterministic entity extraction from structured digest signal fields (ADR-E73-003).
 * Pure functions only: no Convex, no fetch, no filesystem.
 */

import { URL } from 'node:url';

/** @typedef {'person' | 'account' | 'org'} EntityType */

/**
 * @typedef {{
 *   entityType: EntityType,
 *   entityKey: string,
 *   displayName: string,
 *   platform?: string,
 *   tracked: boolean,
 * }} ExtractedEntity
 */

/**
 * @typedef {{
 *   entityType: EntityType,
 *   entityKey: string,
 *   displayName: string,
 *   platform?: string,
 *   tracked: boolean,
 *   mentionCount: number,
 *   distinctSignalCount: number,
 *   sourceTypes: string[],
 *   maxPersonalRelevance?: number,
 *   maxRankScore?: number,
 *   coMentionedTrackedEntities: string[],
 *   signalRefs: Array<{
 *     digestSignalId: string,
 *     title: string,
 *     url?: string,
 *     sourceType: string,
 *   }>,
 * }} RunEntityAggregate
 */

/** Sources where `sourceMetadata.author` is the account identifier (not authorHandle). */
const AUTHOR_ACCOUNT_SOURCE_TYPES = new Set([
  'rss',
  'youtube',
  'tiktok',
  'instagram',
  'pinterest',
]);

/** Non-repo GitHub path prefixes — not owner/repo pairs (ADR-E73-003). */
const GITHUB_RESERVED_OWNER_SEGMENTS = new Set([
  'about',
  'account',
  'apps',
  'codespaces',
  'events',
  'explore',
  'issues',
  'new',
  'notifications',
  'orgs',
  'pricing',
  'pulls',
  'search',
  'security',
  'users',
  'settings',
  'marketplace',
  'topics',
  'collections',
  'sponsors',
  'login',
  'join',
  'features',
  'enterprise',
]);

/**
 * Trim, lowercase, collapse internal whitespace (ADR-E73-003 normalize).
 *
 * @param {unknown} text
 * @returns {string}
 */
export function normalizeEntityName(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Strip leading `@`, then apply entity-name normalization.
 *
 * @param {unknown} handle
 * @returns {string}
 */
export function normalizeAccountIdentifier(handle) {
  const trimmed = String(handle ?? '').trim();
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return normalizeEntityName(withoutAt);
}

/**
 * Build canonical entity key per ADR-E73-003.
 *
 * @param {EntityType} entityType
 * @param {string} platformOrPersonName — platform for account/org; personName for person
 * @param {string} [raw] — handle, author, or org owner when platform is separate
 * @returns {string}
 */
export function normalizeEntityKey(entityType, platformOrPersonName, raw) {
  if (entityType === 'person') {
    const personName = raw ?? platformOrPersonName;
    return `person:${normalizeEntityName(personName)}`;
  }
  if (entityType === 'account') {
    const platform = platformOrPersonName;
    const identifier = raw ?? platformOrPersonName;
    return `account:${platform}:${normalizeAccountIdentifier(identifier)}`;
  }
  if (entityType === 'org') {
    const platform = platformOrPersonName;
    const owner = raw ?? platformOrPersonName;
    return `org:${platform}:${normalizeEntityName(owner)}`;
  }
  throw new Error(`Unsupported entityType: ${entityType}`);
}

/**
 * @param {string | undefined} url
 * @returns {{ owner: string, repo: string } | null}
 */
export function parseGithubRepoUrl(url) {
  const rawUrl = String(url ?? '').trim();
  if (!rawUrl) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`,
    );
  } catch {
    return null;
  }

  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    (parsed.hostname.toLowerCase() !== 'github.com' &&
      parsed.hostname.toLowerCase() !== 'www.github.com')
  ) {
    return null;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const owner = segments[0];
  const repo = segments[1];
  if (
    !owner ||
    !repo ||
    !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(owner) ||
    !/^[a-z\d._-]+$/i.test(repo) ||
    repo === '.' ||
    repo === '..' ||
    GITHUB_RESERVED_OWNER_SEGMENTS.has(owner.toLowerCase())
  ) {
    return null;
  }
  return { owner, repo };
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {string}
 */
export function getSignalRefId(signal) {
  if (signal.digestSignalId != null) {
    const digestSignalId = String(signal.digestSignalId).trim();
    if (digestSignalId) {
      return digestSignalId;
    }
  }
  throw new Error('aggregateRunEntities requires a Convex-assigned digestSignalId');
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {ExtractedEntity[]}
 */
export function extractEntitiesFromSignal(signal) {
  /** @type {ExtractedEntity[]} */
  const entities = [];
  const sourceType = String(signal.sourceType ?? '').trim();
  const meta =
    signal.sourceMetadata && typeof signal.sourceMetadata === 'object'
      ? /** @type {Record<string, unknown>} */ (signal.sourceMetadata)
      : {};

  const personName =
    meta.peopleMatch &&
    typeof meta.peopleMatch === 'object' &&
    /** @type {{ personName?: unknown }} */ (meta.peopleMatch).personName != null
      ? String(/** @type {{ personName: unknown }} */ (meta.peopleMatch).personName).trim()
      : '';

  if (personName) {
    entities.push({
      entityType: 'person',
      entityKey: normalizeEntityKey('person', personName),
      displayName: personName,
      platform: sourceType || undefined,
      tracked: true,
    });
  } else if (meta.authorHandle != null && String(meta.authorHandle).trim() !== '') {
    const handle = String(meta.authorHandle).trim();
    entities.push({
      entityType: 'account',
      entityKey: normalizeEntityKey('account', sourceType, handle),
      displayName: handle.startsWith('@') ? handle.slice(1) : handle,
      platform: sourceType || undefined,
      tracked: false,
    });
  } else if (
    meta.author != null &&
    String(meta.author).trim() !== '' &&
    AUTHOR_ACCOUNT_SOURCE_TYPES.has(sourceType)
  ) {
    const author = String(meta.author).trim();
    entities.push({
      entityType: 'account',
      entityKey: normalizeEntityKey('account', sourceType, author),
      displayName: author,
      platform: sourceType || undefined,
      tracked: false,
    });
  }

  if (sourceType === 'github') {
    const parsed = parseGithubRepoUrl(signal.url != null ? String(signal.url) : undefined);
    if (parsed) {
      entities.push({
        entityType: 'org',
        entityKey: normalizeEntityKey('org', 'github', parsed.owner),
        displayName: parsed.owner,
        platform: 'github',
        tracked: false,
      });
    }
  }

  return entities;
}

/**
 * Tracked person entity keys for the run (signals carrying peopleMatch).
 *
 * @param {Array<Record<string, unknown>>} signals
 * @returns {string[]}
 */
export function collectTrackedEntityKeys(signals) {
  /** @type {Set<string>} */
  const keys = new Set();
  for (const signal of signals) {
    for (const entity of extractEntitiesFromSignal(signal)) {
      if (entity.tracked) {
        keys.add(entity.entityKey);
      }
    }
  }
  return [...keys].sort();
}

/**
 * Other tracked entity keys co-occurring in the same run.
 *
 * @param {Array<Record<string, unknown>>} signals
 * @param {string} entityKey
 * @returns {string[]}
 */
export function collectCoMentionedTracked(signals, entityKey) {
  return collectTrackedEntityKeys(signals).filter((key) => key !== entityKey);
}

/**
 * @param {number | undefined} current
 * @param {number | undefined} candidate
 * @returns {number | undefined}
 */
function maxOptionalNumber(current, candidate) {
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
    return current;
  }
  if (typeof current !== 'number' || !Number.isFinite(current)) {
    return candidate;
  }
  return Math.max(current, candidate);
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {number}
 */
function signalRankScore(signal) {
  return typeof signal.rankScore === 'number' && Number.isFinite(signal.rankScore)
    ? signal.rankScore
    : 0;
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {number | undefined}
 */
function signalPersonalRelevance(signal) {
  const scores =
    signal.scores && typeof signal.scores === 'object'
      ? /** @type {{ personalRelevance?: unknown }} */ (signal.scores)
      : {};
  const value = scores.personalRelevance;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {{
 *   digestSignalId: string,
 *   title: string,
 *   url?: string,
 *   sourceType: string,
 * }}
 */
export function toSignalRef(signal) {
  /** @type {{ digestSignalId: string, title: string, url?: string, sourceType: string }} */
  const ref = {
    digestSignalId: getSignalRefId(signal),
    title: String(signal.title ?? ''),
    sourceType: String(signal.sourceType ?? ''),
  };
  if (signal.url != null && String(signal.url).trim() !== '') {
    ref.url = String(signal.url);
  }
  return ref;
}

/**
 * Highest-rankScore evidence refs for an entity's signals.
 *
 * @param {Array<Record<string, unknown>>} signals
 * @param {number} [limit=5]
 * @returns {ReturnType<typeof toSignalRef>[]}
 */
export function pickTopSignalRefs(signals, limit = 5) {
  if (limit === 0) {
    return [];
  }
  const seenSignalIds = new Set();
  const refs = [];
  for (const signal of [...signals].sort(
    (a, b) => signalRankScore(b) - signalRankScore(a),
  )) {
    const signalId = getSignalRefId(signal);
    if (seenSignalIds.has(signalId)) {
      continue;
    }
    seenSignalIds.add(signalId);
    refs.push(toSignalRef(signal));
    if (refs.length === limit) {
      break;
    }
  }
  return refs;
}

/**
 * @param {Array<Record<string, unknown>>} signals
 * @returns {Record<string, RunEntityAggregate>}
 */
export function aggregateRunEntities(signals) {
  /** @type {Record<string, RunEntityAggregate>} */
  const grouped = {};
  const trackedKeys = collectTrackedEntityKeys(signals);

  for (const signal of signals) {
    const signalId = getSignalRefId(signal);
    const entities = extractEntitiesFromSignal(signal);

    for (const entity of entities) {
      let aggregate = grouped[entity.entityKey];
      if (!aggregate) {
        aggregate = {
          entityType: entity.entityType,
          entityKey: entity.entityKey,
          displayName: entity.displayName,
          platform: entity.platform,
          tracked: entity.tracked,
          mentionCount: 0,
          distinctSignalCount: 0,
          sourceTypes: [],
          coMentionedTrackedEntities: [],
          signalRefs: [],
          /** @type {Set<string>} */
          _signalIds: new Set(),
          /** @type {Set<string>} */
          _sourceTypes: new Set(),
          /** @type {Array<Record<string, unknown>>} */
          _signals: [],
        };
        grouped[entity.entityKey] = aggregate;
      }

      aggregate.mentionCount += 1;
      aggregate._signalIds.add(signalId);
      if (entity.platform) {
        aggregate._sourceTypes.add(entity.platform);
      } else if (signal.sourceType) {
        aggregate._sourceTypes.add(String(signal.sourceType));
      }
      aggregate._signals.push(signal);
      aggregate.maxPersonalRelevance = maxOptionalNumber(
        aggregate.maxPersonalRelevance,
        signalPersonalRelevance(signal),
      );
      aggregate.maxRankScore = maxOptionalNumber(
        aggregate.maxRankScore,
        typeof signal.rankScore === 'number' ? signal.rankScore : undefined,
      );
    }
  }

  /** @type {Record<string, RunEntityAggregate>} */
  const result = {};
  for (const [entityKey, aggregate] of Object.entries(grouped)) {
    result[entityKey] = {
      entityType: aggregate.entityType,
      entityKey: aggregate.entityKey,
      displayName: aggregate.displayName,
      platform: aggregate.platform,
      tracked: aggregate.tracked,
      mentionCount: aggregate.mentionCount,
      distinctSignalCount: aggregate._signalIds.size,
      sourceTypes: [...aggregate._sourceTypes].sort(),
      maxPersonalRelevance: aggregate.maxPersonalRelevance,
      maxRankScore: aggregate.maxRankScore,
      coMentionedTrackedEntities:
        trackedKeys.length > 0
          ? trackedKeys.filter((key) => key !== entityKey)
          : [],
      signalRefs: pickTopSignalRefs(aggregate._signals),
    };
  }

  return result;
}
