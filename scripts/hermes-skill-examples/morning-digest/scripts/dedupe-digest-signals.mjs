// dedupe-digest-signals.mjs — Epic 68-1 cross-source dedup (FR-1, FR-2)
// Reads DIGEST_SIGNALS_JSON; writes deduped JSON array to stdout; always exit 0.

import { URL } from 'node:url';

import { tokenizeSignalText } from './score-digest-signals.mjs';

const JACCARD_THRESHOLD = 0.85;
const ENTITY_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

const SOURCE_PRIORITY = {
  newsapi: 8,
  hackernews: 7,
  twitter: 6,
  bluesky: 5,
  youtube: 4,
  tiktok: 4,
  instagram: 4,
  pinterest: 3,
  polymarket: 4,
  threads: 4,
  linkedin: 4,
  rss: 4,
  reddit: 3,
  github: 2,
  producthunt: 1,
};

const ENGAGEMENT_FIELDS = [
  'points',
  'upvotes',
  'stars',
  'viewCount',
  'forks',
  'commentCount',
  'comments',
  'likes',
  'reposts',
  'replies',
  'quotes',
];

const HN_REDIRECTOR_RE = /^https?:\/\/news\.ycombinator\.com\/item\?id=\d+/i;

function stripQueryAndFragmentFromString(s) {
  let cut = s.length;
  const q = s.indexOf('?');
  const h = s.indexOf('#');
  if (q >= 0) cut = Math.min(cut, q);
  if (h >= 0) cut = Math.min(cut, h);
  return s.slice(0, cut);
}

function stripWwwAuthority(authority) {
  const userinfoEnd = authority.lastIndexOf('@');
  const prefix = userinfoEnd >= 0 ? authority.slice(0, userinfoEnd + 1) : '';
  const hostPort = userinfoEnd >= 0 ? authority.slice(userinfoEnd + 1) : authority;
  if (hostPort.startsWith('[')) return authority;
  return `${prefix}${/^www\./i.test(hostPort) ? hostPort.slice(4) : hostPort}`;
}

function stripTrailingSlashesIteratively(s) {
  let out = s;
  while (out.endsWith('/')) {
    out = out.slice(0, -1);
  }
  return out;
}

function stripTrackingQueryParams(urlString) {
  try {
    const u = new URL(urlString);
    const toDelete = [];
    for (const key of u.searchParams.keys()) {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_') || lower === 'fbclid') {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return urlString;
  }
}

function normalizeHttpUrlStringFallback(s) {
  let base = stripQueryAndFragmentFromString(s);
  const hostPath = base.match(/^(https?:\/\/)([^/?#]+)(.*)$/i);
  if (hostPath) {
    const rest = hostPath[3] ?? '';
    base = `https://${stripWwwAuthority(hostPath[2] ?? '')}${rest}`;
  } else if (/^http:\/\//i.test(base)) {
    base = `https://${base.slice(7)}`;
  }
  return stripTrailingSlashesIteratively(base);
}

/**
 * @param {string} urlString
 * @returns {string}
 */
function normalizeHnItemUrl(urlString) {
  try {
    const u = new URL(urlString);
    const id = u.searchParams.get('id');
    if (!id || !/^\d+$/.test(id)) {
      return normalizeHttpUrlStringFallback(urlString);
    }
    return `https://news.ycombinator.com/item?id=${id}`;
  } catch {
    return '';
  }
}

/**
 * @param {string | undefined} url
 * @returns {boolean}
 */
function isHnRedirectorUrl(url) {
  return HN_REDIRECTOR_RE.test(String(url ?? '').trim());
}

/**
 * YouTube watch hosts that identify videos via `v=` query (not path).
 * youtu.be /shorts /embed keep identity in the path — no special case needed.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
function isYoutubeWatchHost(hostname) {
  const host = String(hostname ?? '')
    .replace(/^www\./i, '')
    .toLowerCase();
  return (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  );
}

/**
 * @param {string} urlString
 * @returns {boolean}
 */
function isYoutubeWatchUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (!isYoutubeWatchHost(u.hostname)) {
      return false;
    }
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return path === '/watch';
  } catch {
    return false;
  }
}

/**
 * Preserve `v=` identity the same way HN preserves `id` (Story 90-4 R1).
 *
 * @param {string} urlString
 * @returns {string}
 */
function normalizeYoutubeWatchUrl(urlString) {
  try {
    const u = new URL(urlString);
    const videoId = u.searchParams.get('v');
    if (!videoId || !videoId.trim()) {
      return normalizeHttpUrlStringFallback(urlString);
    }
    return `https://youtube.com/watch?v=${encodeURIComponent(videoId.trim())}`;
  } catch {
    return '';
  }
}

/**
 * Inline port of src/ingest/duplicate.ts normalizeSourceUriForDedup + utm/fbclid strip.
 * HN item URLs preserve `id` so unrelated stories do not collapse to /item.
 * YouTube watch URLs preserve `v=` so distinct videos do not collapse to /watch (Story 90-4).
 *
 * @param {string} uri
 * @returns {string}
 */
export function normalizeDigestUrl(uri) {
  const trimmed = String(uri ?? '').trim();
  if (!trimmed) {
    return '';
  }
  const withoutTracking = /^https?:\/\//i.test(trimmed)
    ? stripTrackingQueryParams(trimmed)
    : trimmed;
  if (isHnRedirectorUrl(withoutTracking)) {
    return normalizeHnItemUrl(withoutTracking);
  }
  if (isYoutubeWatchUrl(withoutTracking)) {
    return normalizeYoutubeWatchUrl(withoutTracking);
  }
  if (/^https?:\/\//i.test(withoutTracking)) {
    return normalizeHttpUrlStringFallback(withoutTracking);
  }
  let s = withoutTracking;
  if (/^http:\/\//i.test(s)) {
    s = `https://${s.slice(7)}`;
  }
  return stripTrailingSlashesIteratively(s);
}

/**
 * Domain+path key for cross-source clustering.
 * YouTube `/watch` embeds `v=<id>` so distinct videos stay distinct (Story 90-4 R1).
 * Patching only `normalizeDigestUrl` is insufficient — this arm dropped `u.search`.
 *
 * @param {string} url
 * @returns {string}
 */
export function canonicalDomainPath(url) {
  const normalized = normalizeDigestUrl(url);
  if (!normalized || HN_REDIRECTOR_RE.test(normalized)) {
    return '';
  }
  try {
    const u = new URL(normalized);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const path = u.pathname.replace(/\/+$/, '') || '/';
    if (isYoutubeWatchHost(host) && path === '/watch') {
      const videoId = u.searchParams.get('v');
      if (videoId && videoId.trim()) {
        // Collapse m./music./nocookie variants onto youtube.com for identity.
        // Encode like normalizeYoutubeWatchUrl so both arms agree on identity.
        return `youtube.com/watch?v=${encodeURIComponent(videoId.trim())}`;
      }
    }
    return `${host}${path}`;
  } catch {
    return '';
  }
}

/**
 * @param {string} title
 * @param {string} [summary]
 * @returns {string[]}
 */
export function titleFingerprintTokens(title, summary) {
  const stripped = `${title ?? ''} ${summary ?? ''}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return tokenizeSignalText(stripped, '');
}

/**
 * @param {string[]} tokensA
 * @param {string[]} tokensB
 * @returns {number}
 */
export function jaccardSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {number}
 */
export function titleFingerprintJaccard(a, b) {
  const tokensA = titleFingerprintTokens(String(a.title ?? ''), String(a.summary ?? ''));
  const tokensB = titleFingerprintTokens(String(b.title ?? ''), String(b.summary ?? ''));
  return jaccardSimilarity(tokensA, tokensB);
}

const COMMON_CAPITALIZED_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'to',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'new',
  'show',
]);

/**
 * @param {string} title
 * @returns {string[]}
 */
export function extractProperNounTokens(title) {
  const words = String(title ?? '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  /** @type {string[]} */
  const nouns = [];
  for (const word of words) {
    if (!/^[A-Z]/.test(word) || word.length < 2) {
      continue;
    }
    const lower = word.toLowerCase();
    if (COMMON_CAPITALIZED_STOPWORDS.has(lower)) {
      continue;
    }
    nouns.push(lower);
  }
  return [...new Set(nouns)];
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {number | null}
 */
function signalPublishedAtMs(signal) {
  const meta = signal.sourceMetadata;
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  const publishedAt = /** @type {{ publishedAt?: string }} */ (meta).publishedAt;
  if (typeof publishedAt !== 'string' || !publishedAt.trim()) {
    return null;
  }
  const ms = Date.parse(publishedAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Minimum shared/min(|A|,|B|) for entity-match (Story 90-4 R2). */
const ENTITY_MATCH_PROPORTION = 0.5;

/**
 * Short-title entity disable (Story 90-5 G7): when either side has ≤ this many
 * proper-noun tokens, entity-match returns false (URL/canon/Jaccard still apply).
 */
const ENTITY_MATCH_SHORT_MAX = 3;

/**
 * Lowercase antonym pairs for exclusive-token opposition (Story 90-5 G7).
 * Must be lowercase — extractProperNounTokens only emits Title-Case tokens
 * lowercased. Mid-headline sentence-case antonyms never reach this map; that
 * is an inherent Title-Case filter limit, not a missing lexicon entry.
 * Plurals/inflections are explicit pairs (no stemmer / trailing-'s' strip).
 * @type {ReadonlyArray<readonly [string, string]>}
 */
const ANTONYM_PAIRS = [
  // Seed singular (G7 ship)
  ['shortage', 'surplus'],
  ['rise', 'fall'],
  ['up', 'down'],
  ['gain', 'loss'],
  ['buy', 'sell'],
  ['bull', 'bear'],
  ['win', 'loss'],
  ['hike', 'cut'],
  ['increase', 'decrease'],
  ['boom', 'bust'],
  ['surge', 'slump'],
  ['rally', 'crash'],
  // Seed plural / inflected variants (review B1 — exact-token match only)
  ['shortages', 'surpluses'],
  ['rises', 'falls'],
  ['gains', 'losses'],
  ['buys', 'sells'],
  ['wins', 'losses'],
  ['hikes', 'cuts'],
  ['increases', 'decreases'],
  ['booms', 'busts'],
  ['surges', 'slumps'],
  ['rallies', 'crashes'],
  // Finance / tech expansion + variants (review B2)
  ['inflow', 'outflow'],
  ['inflows', 'outflows'],
  ['soar', 'plunge'],
  ['soars', 'plunges'],
  ['jump', 'drop'],
  ['jumps', 'drops'],
  ['upgrade', 'downgrade'],
  ['upgrades', 'downgrades'],
  ['approve', 'reject'],
  ['approves', 'rejects'],
  ['approval', 'rejection'],
  ['approvals', 'rejections'],
  ['hawkish', 'dovish'],
  ['bullish', 'bearish'],
  ['beat', 'miss'],
  ['beats', 'misses'],
];

/** @type {Map<string, Set<string>>} */
const ANTONYM_OF = (() => {
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  for (const [left, right] of ANTONYM_PAIRS) {
    if (!map.has(left)) {
      map.set(left, new Set());
    }
    if (!map.has(right)) {
      map.set(right, new Set());
    }
    map.get(left)?.add(right);
    map.get(right)?.add(left);
  }
  return map;
})();

/**
 * True when exclusive proper-noun tokens (A−B vs B−A) form a known antonym pair.
 * Shared antonym words (present on both titles) do not fire.
 *
 * @param {string[]} nounsA
 * @param {string[]} nounsB
 * @returns {boolean}
 */
function hasAntonymOpposition(nounsA, nounsB) {
  const setA = new Set(nounsA);
  const setB = new Set(nounsB);
  const exclusiveA = nounsA.filter((n) => !setB.has(n));
  const exclusiveB = new Set(nounsB.filter((n) => !setA.has(n)));
  for (const token of exclusiveA) {
    const opposites = ANTONYM_OF.get(token);
    if (!opposites) {
      continue;
    }
    for (const opposite of opposites) {
      if (exclusiveB.has(opposite)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {boolean}
 */
export function crossTitleEntityMatch(a, b) {
  const nounsA = extractProperNounTokens(String(a.title ?? ''));
  const nounsB = extractProperNounTokens(String(b.title ?? ''));
  if (nounsA.length === 0 || nounsB.length === 0) {
    return false;
  }
  const setB = new Set(nounsB);
  let shared = 0;
  for (const noun of nounsA) {
    if (setB.has(noun)) {
      shared += 1;
    }
  }
  if (shared < 2) {
    return false;
  }
  const denom = Math.min(nounsA.length, nounsB.length);
  if (denom === 0 || shared / denom < ENTITY_MATCH_PROPORTION) {
    return false;
  }
  // Story 90-5 G7: antonym exclusive-token guard (always) + short-title entity disable.
  if (hasAntonymOpposition(nounsA, nounsB)) {
    return false;
  }
  if (Math.min(nounsA.length, nounsB.length) <= ENTITY_MATCH_SHORT_MAX) {
    return false;
  }
  const pubA = signalPublishedAtMs(a);
  const pubB = signalPublishedAtMs(b);
  if (pubA == null || pubB == null) {
    return false;
  }
  return Math.abs(pubA - pubB) <= ENTITY_MATCH_WINDOW_MS;
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {boolean}
 */
export function shouldClusterSignals(a, b) {
  const urlA = normalizeDigestUrl(String(a.url ?? ''));
  const urlB = normalizeDigestUrl(String(b.url ?? ''));
  if (urlA && urlB && urlA === urlB) {
    return true;
  }

  const canonA = canonicalDomainPath(String(a.url ?? ''));
  const canonB = canonicalDomainPath(String(b.url ?? ''));
  if (canonA && canonB && canonA === canonB) {
    return true;
  }

  const hnExternalPair =
    (isHnRedirectorUrl(String(a.url ?? '')) && canonB) ||
    (isHnRedirectorUrl(String(b.url ?? '')) && canonA);
  if (hnExternalPair && titleFingerprintJaccard(a, b) >= JACCARD_THRESHOLD) {
    return true;
  }

  if (titleFingerprintJaccard(a, b) >= JACCARD_THRESHOLD) {
    return true;
  }

  if (crossTitleEntityMatch(a, b)) {
    return true;
  }

  return false;
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {number}
 */
export function rawEngagementProxy(signal) {
  const meta =
    signal.sourceMetadata && typeof signal.sourceMetadata === 'object'
      ? /** @type {Record<string, unknown>} */ (signal.sourceMetadata)
      : {};
  let sum = 0;
  for (const field of ENGAGEMENT_FIELDS) {
    const value = meta[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      sum += value;
    }
  }
  return sum;
}

/**
 * @param {string | undefined} sourceType
 * @returns {number}
 */
function sourcePriority(sourceType) {
  return SOURCE_PRIORITY[String(sourceType ?? '').toLowerCase()] ?? 0;
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {number}
 */
function publishedAtSortKey(signal) {
  const ms = signalPublishedAtMs(signal);
  return ms == null ? Number.POSITIVE_INFINITY : ms;
}

/**
 * @param {Record<string, unknown>[]} cluster
 * @returns {Record<string, unknown>}
 */
export function pickClusterWinner(cluster) {
  if (cluster.length === 0) {
    throw new Error('empty cluster');
  }
  if (cluster.length === 1) {
    return cluster[0];
  }

  return [...cluster].sort((a, b) => {
    const proxyDiff = rawEngagementProxy(b) - rawEngagementProxy(a);
    if (proxyDiff !== 0) {
      return proxyDiff;
    }
    const priorityDiff =
      sourcePriority(String(b.sourceType ?? '')) - sourcePriority(String(a.sourceType ?? ''));
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return publishedAtSortKey(a) - publishedAtSortKey(b);
  })[0];
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {Record<string, unknown>}
 */
function buildContributorEntry(signal) {
  /** @type {Record<string, unknown>} */
  const entry = {
    sourceType: String(signal.sourceType ?? ''),
  };
  const url = String(signal.url ?? '').trim();
  if (url) {
    entry.url = url;
  }
  const meta =
    signal.sourceMetadata && typeof signal.sourceMetadata === 'object'
      ? /** @type {Record<string, unknown>} */ (signal.sourceMetadata)
      : {};
  for (const field of ENGAGEMENT_FIELDS) {
    const value = meta[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      entry[field] = value;
    }
  }
  const publishedAt = meta.publishedAt;
  if (typeof publishedAt === 'string' && publishedAt.trim()) {
    entry.publishedAt = publishedAt.trim();
  }
  return entry;
}

/**
 * @param {Record<string, unknown>[]} cluster
 * @returns {Record<string, unknown>}
 */
export function mergeClusterSignals(cluster) {
  if (cluster.length === 1) {
    return { ...cluster[0] };
  }

  const winner = pickClusterWinner(cluster);
  const contributingSources = cluster.map((signal) => buildContributorEntry(signal));

  const winnerMeta =
    winner.sourceMetadata && typeof winner.sourceMetadata === 'object'
      ? { .../** @type {Record<string, unknown>} */ (winner.sourceMetadata) }
      : {};

  /** @type {Record<string, unknown>} */
  const merged = {
    ...winner,
    sourceMetadata: {
      ...winnerMeta,
      contributingSources,
      dedupClusterSize: cluster.length,
    },
  };
  return merged;
}

class UnionFind {
  /** @param {number} size */
  constructor(size) {
    /** @type {number[]} */
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  /** @param {number} x */
  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  /** @param {number} a @param {number} b */
  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent[rootB] = rootA;
    }
  }
}

/**
 * @param {Record<string, unknown>[]} signals
 * @returns {Record<string, unknown>[]}
 */
export function dedupeDigestSignals(signals) {
  if (!Array.isArray(signals) || signals.length <= 1) {
    return Array.isArray(signals) ? signals.map((signal) => ({ ...signal })) : [];
  }

  const uf = new UnionFind(signals.length);
  for (let i = 0; i < signals.length; i += 1) {
    for (let j = i + 1; j < signals.length; j += 1) {
      if (shouldClusterSignals(signals[i], signals[j])) {
        uf.union(i, j);
      }
    }
  }

  /** @type {Map<number, Record<string, unknown>[]>} */
  const clusters = new Map();
  for (let i = 0; i < signals.length; i += 1) {
    const root = uf.find(i);
    if (!clusters.has(root)) {
      clusters.set(root, []);
    }
    clusters.get(root)?.push(signals[i]);
  }

  /** Preserve original order by first member index in each cluster */
  const clusterOrder = [...clusters.entries()]
    .map(([root, members]) => ({
      root,
      firstIndex: Math.min(...members.map((member) => signals.indexOf(member))),
    }))
    .sort((a, b) => a.firstIndex - b.firstIndex);

  return clusterOrder.map(({ root }) => mergeClusterSignals(clusters.get(root) ?? []));
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>[] | null}
 */
export function parseDigestSignalsJson(raw) {
  if (!raw) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  return parsed.filter((item) => item && typeof item === 'object');
}

/**
 * @param {Record<string, unknown>[]} signals
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, unknown>[]}
 */
export function dedupeDigestSignalsSafe(signals, env = process.env) {
  void env;
  try {
    return dedupeDigestSignals(signals);
  } catch (err) {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
        : 'unexpected error';
    console.error(`dedupe-digest-signals: warning — ${reason}`);
    return signals;
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, unknown>[]}
 */
export async function runDedupeDigestSignalsCli(env = process.env) {
  const parsed = parseDigestSignalsJson(env.DIGEST_SIGNALS_JSON);
  if (parsed == null) {
    console.error('dedupe-digest-signals: warning — missing or invalid DIGEST_SIGNALS_JSON');
    return [];
  }
  return dedupeDigestSignalsSafe(parsed, env);
}

async function main() {
  const deduped = await runDedupeDigestSignalsCli();
  process.stdout.write(`${JSON.stringify(deduped)}\n`);
  process.exit(0);
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('dedupe-digest-signals.mjs');

if (isMain) {
  main().catch((err) => {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 200)
        : 'unexpected error';
    console.error(`dedupe-digest-signals: warning — ${reason}`);
    const parsed = parseDigestSignalsJson(process.env.DIGEST_SIGNALS_JSON);
    process.stdout.write(`${JSON.stringify(parsed ?? [])}\n`);
    process.exit(0);
  });
}
