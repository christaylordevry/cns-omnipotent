// spike-reddit-public-json.mjs — Reddit public-JSON cron viability spike (65-2 gate)
// Reddit public-JSON pattern informed by last30days reference (MIT) — no runtime dependency
// Usage: node spike-reddit-public-json.mjs
// stdout: {"cycles":[...],"summary":{...},"goNoGo":"PASS"|"FAIL"|"PARTIAL"} or {"error":"..."}; always exit 0

import { fileURLToPath } from 'node:url';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const FETCH_TIMEOUT_MS = 15_000;
const SPIKE_CYCLES_DEFAULT = 3;
const SPIKE_DELAY_MS_DEFAULT = 180_000;
const REDDIT_HOT_BASE = 'https://www.reddit.com/r';
const USER_AGENT = 'CNS-morning-digest/1.0';

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseSubreddits(raw) {
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ subreddits: string[], cycles: number, delayMs: number }}
 */
export function loadSpikeConfig(env = process.env) {
  const subreddits = parseSubreddits(env.MORNING_DIGEST_REDDIT_SUBREDDITS);
  const rawCycles = parseInt(String(env.MORNING_DIGEST_REDDIT_SPIKE_CYCLES ?? ''), 10);
  const rawDelay = parseInt(String(env.MORNING_DIGEST_REDDIT_SPIKE_DELAY_MS ?? ''), 10);
  const cycles =
    Number.isFinite(rawCycles) && rawCycles > 0 ? rawCycles : SPIKE_CYCLES_DEFAULT;
  const delayMs =
    Number.isFinite(rawDelay) && rawDelay >= 0 ? rawDelay : SPIKE_DELAY_MS_DEFAULT;
  return { subreddits, cycles, delayMs };
}

/**
 * @param {unknown} json
 * @returns {{ parseOk: boolean, postCount: number }}
 */
export function parseRedditListing(json) {
  if (!json || typeof json !== 'object') {
    return { parseOk: false, postCount: 0 };
  }
  const children = /** @type {{ data?: { children?: unknown[] } }} */ (json).data?.children;
  if (!Array.isArray(children)) {
    return { parseOk: false, postCount: 0 };
  }
  let titledPosts = 0;
  for (const child of children) {
    if (!child || typeof child !== 'object') {
      continue;
    }
    const title = /** @type {{ data?: { title?: unknown } }} */ (child).data?.title;
    if (title != null && String(title).trim()) {
      titledPosts += 1;
    }
  }
  return {
    parseOk: titledPosts >= 1,
    postCount: children.length,
  };
}

/**
 * @param {number} httpStatus
 * @param {string} body
 * @param {{ parseOk: boolean, postCount: number }} [parsed]
 * @param {boolean} [jsonParseFailed]
 * @returns {string | null}
 */
export function detectBlockIndicator(httpStatus, body, parsed, jsonParseFailed = false) {
  if (httpStatus === 429) {
    return 'http-429';
  }
  if (httpStatus === 403) {
    return 'http-403';
  }
  const trimmed = String(body ?? '').trimStart();
  if (/^<!DOCTYPE/i.test(trimmed) || /^<html/i.test(trimmed)) {
    return 'html-response';
  }
  const lower = String(body ?? '').toLowerCase();
  if (lower.includes('captcha') || lower.includes('blocked')) {
    return 'captcha-marker';
  }
  if (jsonParseFailed) {
    return 'parse-error';
  }
  if (parsed) {
    if (parsed.parseOk) {
      return null;
    }
    if (parsed.postCount === 0) {
      return 'empty-listing';
    }
    return 'parse-error';
  }
  return 'parse-error';
}

/**
 * @param {number[]} values
 * @param {number} percentile
 * @returns {number}
 */
export function percentileMs(values, percentile) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

/**
 * @param {Array<{ latencyMs: number, parseOk: boolean, blockIndicator: string | null }>} cycles
 * @returns {{ totalCycles: number, parseSuccessRate: number, p95LatencyMs: number, sustainedBlock: boolean }}
 */
export function computeSpikeSummary(cycles) {
  const totalCycles = cycles.length;
  const parseSuccessRate =
    totalCycles === 0
      ? 0
      : cycles.filter((cycle) => cycle.parseOk).length / totalCycles;
  const latencies = cycles.map((cycle) => cycle.latencyMs);
  const p95LatencyMs = percentileMs(latencies, 95);

  let sustainedBlock = false;
  let consecutiveBlocks = 0;
  for (const cycle of cycles) {
    const blocked =
      cycle.blockIndicator === 'http-429' || cycle.blockIndicator === 'http-403';
    if (blocked) {
      consecutiveBlocks += 1;
      if (consecutiveBlocks >= 2) {
        sustainedBlock = true;
        break;
      }
    } else {
      consecutiveBlocks = 0;
    }
  }

  return {
    totalCycles,
    parseSuccessRate,
    p95LatencyMs,
    sustainedBlock,
  };
}

/**
 * @param {{ parseSuccessRate: number, p95LatencyMs: number, sustainedBlock: boolean }} summary
 * @param {Array<{ parseOk: boolean, postCount: number, blockIndicator: string | null }>} cycles
 * @returns {'PASS' | 'FAIL' | 'PARTIAL'}
 */
export function evaluateGoNoGo(summary, cycles) {
  if (summary.sustainedBlock || summary.parseSuccessRate < 0.5) {
    return 'FAIL';
  }

  const failures = cycles.filter((cycle) => !cycle.parseOk);
  if (failures.length > 0) {
    const hardFailureIndicators = new Set(['html-response', 'captcha-marker', 'parse-error']);
    const hardFailures = failures.filter(
      (cycle) => cycle.blockIndicator && hardFailureIndicators.has(cycle.blockIndicator),
    );
    if (hardFailures.length > failures.length / 2) {
      return 'FAIL';
    }
  }

  const successful = cycles.filter((cycle) => cycle.parseOk);
  const postsOkRate =
    successful.length === 0
      ? 0
      : successful.filter((cycle) => cycle.postCount >= 1).length / successful.length;

  const pass =
    summary.parseSuccessRate >= 0.8 &&
    !summary.sustainedBlock &&
    summary.p95LatencyMs < 15_000 &&
    postsOkRate >= 0.8;

  if (pass) {
    return 'PASS';
  }

  return 'PARTIAL';
}

/**
 * @param {string} subreddit
 * @returns {string}
 */
export function buildRedditHotUrl(subreddit) {
  return `${REDDIT_HOT_BASE}/${encodeURIComponent(subreddit)}/hot.json?limit=10&raw_json=1`;
}

/**
 * @param {string} subreddit
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<{ httpStatus: number, latencyMs: number, body: string, json?: unknown }>}
 */
export async function fetchRedditHotJson(subreddit, fetchFn, fixtureJson) {
  const start = Date.now();
  if (fixtureJson !== undefined) {
    return {
      httpStatus: 200,
      latencyMs: Date.now() - start,
      body: JSON.stringify(fixtureJson),
      json: fixtureJson,
    };
  }

  const url = buildRedditHotUrl(subreddit);
  try {
    const res = await fetchFn(url, {
      signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    const body = await res.text();
    return {
      httpStatus: res.status,
      latencyMs: Date.now() - start,
      body,
    };
  } catch {
    return {
      httpStatus: 0,
      latencyMs: Date.now() - start,
      body: '',
    };
  }
}

/**
 * @param {number} cycle
 * @param {string} subreddit
 * @param {typeof fetch} fetchFn
 * @param {unknown} [fixtureJson]
 * @returns {Promise<{ cycle: number, subreddit: string, httpStatus: number, latencyMs: number, parseOk: boolean, postCount: number, blockIndicator: string | null }>}
 */
export async function runSpikeCycle(cycle, subreddit, fetchFn, fixtureJson) {
  const fetched = await fetchRedditHotJson(subreddit, fetchFn, fixtureJson);

  if (fetched.httpStatus === 0) {
    return {
      cycle,
      subreddit,
      httpStatus: 0,
      latencyMs: fetched.latencyMs,
      parseOk: false,
      postCount: 0,
      blockIndicator: 'parse-error',
    };
  }

  /** @type {unknown} */
  let json;
  let jsonParseFailed = false;
  if (fetched.json !== undefined) {
    json = fetched.json;
  } else if (fetched.httpStatus === 200) {
    try {
      json = JSON.parse(fetched.body);
    } catch {
      jsonParseFailed = true;
    }
  }

  const parsed = json !== undefined ? parseRedditListing(json) : { parseOk: false, postCount: 0 };
  const blockIndicator = detectBlockIndicator(
    fetched.httpStatus,
    fetched.body,
    json !== undefined ? parsed : undefined,
    jsonParseFailed,
  );

  return {
    cycle,
    subreddit,
    httpStatus: fetched.httpStatus,
    latencyMs: fetched.latencyMs,
    parseOk: parsed.parseOk && blockIndicator === null,
    postCount: parsed.postCount,
    blockIndicator,
  };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch?: typeof fetch, fixtureJsonByCycle?: Record<number, unknown>, delayMs?: number }} [options]
 * @returns {Promise<{ cycles?: unknown[], summary?: unknown, goNoGo?: string, error?: string }>}
 */
export async function runRedditSpike(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const config = loadSpikeConfig(env);

  if (config.subreddits.length === 0) {
    return { error: 'missing-subreddits' };
  }

  const delayMs = options.delayMs ?? config.delayMs;
  /** @type {Array<{ cycle: number, subreddit: string, httpStatus: number, latencyMs: number, parseOk: boolean, postCount: number, blockIndicator: string | null }>} */
  const cycles = [];

  for (let i = 1; i <= config.cycles; i += 1) {
    if (i > 1 && delayMs > 0) {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, delayMs);
      });
    }
    const subreddit = config.subreddits[(i - 1) % config.subreddits.length];
    const fixture = options.fixtureJsonByCycle?.[i];
    const cycleResult = await runSpikeCycle(i, subreddit, fetchFn, fixture);
    cycles.push(cycleResult);
  }

  const summary = computeSpikeSummary(cycles);
  const goNoGo = evaluateGoNoGo(summary, cycles);
  return { cycles, summary, goNoGo };
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return fileURLToPath(import.meta.url) === entry;
}

if (isMainModule()) {
  try {
    const merged = await mergeTrendIngestEnv(process.env);
    const payload = await runRedditSpike(merged);
    process.stdout.write(JSON.stringify(payload) + '\n');
    process.exit(0);
  } catch (err) {
    const reason =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: unknown }} */ (err).message).slice(0, 120)
        : 'unexpected error';
    process.stdout.write(JSON.stringify({ error: reason }) + '\n');
    process.exit(0);
  }
}
