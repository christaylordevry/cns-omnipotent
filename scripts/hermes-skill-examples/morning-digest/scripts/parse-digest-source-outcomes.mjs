/**
 * Parse morning-digest artifact markdown into sourceOutcomes push metadata (Story 69-3).
 */

import { URL } from 'node:url';

import {
	countAdapterPayloadItems,
	unwrapAdapterResult,
} from './adapter-result.mjs';
import {
	trimEntityBlockForDigestAppend,
} from './render-digest-entity-section.mjs';

/** Canonical registry order — addendum A1. */
export const DIGEST_SOURCE_SECTION_MAP = [
	{ sourceKey: 'google_trends', label: 'Google Trends', patterns: [/google trends/i, /^trends\b/i] },
	{ sourceKey: 'newsapi', label: 'Headlines', patterns: [/newsapi/i, /^headlines\b/i] },
	{ sourceKey: 'deep_signal', label: 'Deep Signal', patterns: [/deep signal/i, /perplexity/i] },
	{ sourceKey: 'arxiv', label: 'arXiv', patterns: [/arxiv/i] },
	{ sourceKey: 'hackernews', label: 'HackerNews', patterns: [/hackernews/i, /\bhn\b/i] },
	{ sourceKey: 'notebook', label: 'Vault Context', patterns: [/notebook/i, /vault context/i] },
	{ sourceKey: 'github', label: 'GitHub', patterns: [/github/i] },
	{ sourceKey: 'reddit', label: 'Reddit', patterns: [/reddit/i] },
	{ sourceKey: 'rss', label: 'Newsletters / RSS', patterns: [/newsletters/i, /\brss\b/i] },
	{ sourceKey: 'producthunt', label: 'Product Hunt', patterns: [/product hunt/i] },
	{ sourceKey: 'twitter', label: 'X / Twitter', patterns: [/\bx\b/i, /twitter/i] },
	{ sourceKey: 'bluesky', label: 'Bluesky', patterns: [/bluesky/i] },
	{ sourceKey: 'youtube', label: 'YouTube', patterns: [/youtube/i] },
	{ sourceKey: 'tiktok', label: 'TikTok', patterns: [/tiktok/i] },
	{ sourceKey: 'instagram', label: 'Instagram', patterns: [/instagram/i] },
	{ sourceKey: 'pinterest', label: 'Pinterest', patterns: [/pinterest/i] },
	{ sourceKey: 'polymarket', label: 'Polymarket', patterns: [/polymarket/i] },
	{ sourceKey: 'threads', label: 'Threads', patterns: [/threads/i] },
	{ sourceKey: 'linkedin', label: 'LinkedIn', patterns: [/linkedin/i, /hiring/i] },
];

const UNAVAILABLE_LINE_RE = /-\s*\(source unavailable:\s*(.+?)\)/i;
export const MAX_SELECTED_MARKDOWN_LENGTH = 3400;
const MAX_DIGEST_DATE_LENGTH = 32;
const MAX_TOP_TREND_LENGTH = 160;
const MAX_SIGNAL_TITLE_LENGTH = 160;
const MAX_SIGNAL_URL_LENGTH = 320;
const MAX_SOURCE_KEY_LENGTH = 64;
const GENERATED_DISCORD_CHUNK_LENGTH = 1998;

const SOURCE_LABELS = new Map(
	DIGEST_SOURCE_SECTION_MAP.map(({ sourceKey, label }) => [sourceKey, label]),
);
const SOURCE_ORDER = new Map(
	DIGEST_SOURCE_SECTION_MAP.map(({ sourceKey }, index) => [sourceKey, index]),
);

/**
 * @param {unknown} value
 * @param {number} [maxLength]
 * @returns {string}
 */
function normalizeInlineText(value, maxLength = Number.POSITIVE_INFINITY) {
	const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
	if (normalized.length <= maxLength) {
		return normalized;
	}
	return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeHttpUrl(value) {
	const normalized = normalizeInlineText(value);
	if (!normalized || normalized.length > MAX_SIGNAL_URL_LENGTH) {
		return '';
	}
	try {
		const parsed = new URL(normalized);
		const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
		return isHttp && parsed.href.length <= MAX_SIGNAL_URL_LENGTH ? parsed.href : '';
	} catch {
		return '';
	}
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeMarkdownLabel(value) {
	return value.replace(/([\\[\]])/g, '\\$1');
}

/**
 * @param {string} sourceKey
 * @returns {string}
 */
function resolveSourceLabel(sourceKey) {
	const canonical = SOURCE_LABELS.get(sourceKey);
	if (canonical) {
		return canonical;
	}
	return sourceKey
		.split(/[_-]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');
}

/**
 * @param {Record<string, unknown>} signal
 * @returns {string}
 */
function resolveSignalSourceKey(signal) {
	const sourceType = normalizeInlineText(signal.sourceType, MAX_SOURCE_KEY_LENGTH);
	const section = normalizeInlineText(signal.section, MAX_SOURCE_KEY_LENGTH);
	const canonicalSourceType = resolveSourceKeyFromSectionHeader(sourceType);
	if (canonicalSourceType) {
		return canonicalSourceType;
	}
	const canonicalSection = resolveSourceKeyFromSectionHeader(section);
	if (canonicalSection) {
		return canonicalSection;
	}
	return (sourceType || section)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/**
 * @param {{ title: string; url: string; rankScore: number }} row
 * @returns {string}
 */
function formatSignalBullet(row) {
	const scoreSuffix =
		Number.isFinite(row.rankScore) ? ` · score ${Math.round(row.rankScore)}` : '';
	return `- [${escapeMarkdownLabel(row.title)}](<${row.url}>)${scoreSuffix}`;
}

/**
 * @param {string[]} headerLines
 * @param {Array<[string, Array<{ title: string; url: string; rankScore: number; index: number }>]>} orderedGroups
 * @param {Map<string, number>} selectedCounts
 * @returns {string[]}
 */
function buildGroupedMarkdownLines(headerLines, orderedGroups, selectedCounts) {
	const lines = [...headerLines];
	for (const [sourceKey, rows] of orderedGroups) {
		const selected = rows.slice(0, selectedCounts.get(sourceKey) ?? 0);
		if (selected.length === 0) {
			continue;
		}
		lines.push(`## ${resolveSourceLabel(sourceKey)}`);
		lines.push(...selected.map(formatSignalBullet));
	}
	return lines;
}

/**
 * @param {string[]} headerLines
 * @param {Array<[string, Array<{ title: string; url: string; rankScore: number; index: number }>]>} orderedGroups
 * @param {Map<string, number>} selectedCounts
 * @returns {string}
 */
function packGeneratedMarkdown(headerLines, orderedGroups, selectedCounts) {
	/** @type {string[]} */
	const chunks = [];
	let currentLines = [...headerLines];
	let capacityReached = false;

	const flushCurrent = () => {
		if (currentLines.length > 0) {
			chunks.push(currentLines.join('\n'));
			currentLines = [];
		}
	};

	const appendLines = (additions, overflowAdditions = additions) => {
		const candidate = [...currentLines, ...additions].join('\n');
		if (candidate.length <= GENERATED_DISCORD_CHUNK_LENGTH) {
			currentLines.push(...additions);
			return true;
		}
		if (chunks.length > 0) {
			return false;
		}
		flushCurrent();
		if (overflowAdditions.join('\n').length > GENERATED_DISCORD_CHUNK_LENGTH) {
			return false;
		}
		currentLines.push(...overflowAdditions);
		return true;
	};

	for (const [sourceKey, rows] of orderedGroups) {
		if (capacityReached) {
			break;
		}
		const selected = rows.slice(0, selectedCounts.get(sourceKey) ?? 0);
		if (selected.length === 0) {
			continue;
		}
		const heading = `## ${resolveSourceLabel(sourceKey)}`;
		for (const [index, row] of selected.entries()) {
			const bullet = formatSignalBullet(row);
			const additions = index === 0 ? [heading, bullet] : [bullet];
			const overflowAdditions = index === 0 ? additions : [heading, bullet];
			if (appendLines(additions, overflowAdditions)) {
				continue;
			}
			if (chunks.length > 0) {
				capacityReached = true;
				break;
			}
		}
	}

	flushCurrent();
	return chunks.slice(0, 2).join('\n\n');
}

/**
 * Render deterministic markdown for Node-collected payloads that do not include
 * the pre-rendered Hermes output contract.
 *
 * @param {Record<string, unknown>} payload
 * @returns {string | undefined}
 */
export function renderDigestMarkdownFromPayload(payload) {
	const run =
		payload.run && typeof payload.run === 'object'
			? /** @type {Record<string, unknown>} */ (payload.run)
			: {};
	const date = normalizeInlineText(run.date, MAX_DIGEST_DATE_LENGTH);
	const topTrend = normalizeInlineText(run.topTrend, MAX_TOP_TREND_LENGTH);
	const rawSignals = Array.isArray(payload.signals) ? payload.signals : [];

	/** @type {Map<string, Array<{ title: string; url: string; rankScore: number; index: number }>>} */
	const groups = new Map();
	for (const [index, rawSignal] of rawSignals.entries()) {
		if (!rawSignal || typeof rawSignal !== 'object') {
			continue;
		}
		const signal = /** @type {Record<string, unknown>} */ (rawSignal);
		const title = normalizeInlineText(signal.title, MAX_SIGNAL_TITLE_LENGTH);
		const url = normalizeHttpUrl(signal.url);
		const sourceKey = resolveSignalSourceKey(signal);
		if (!title || !url || !sourceKey) {
			continue;
		}
		const rankScore =
			typeof signal.rankScore === 'number' && Number.isFinite(signal.rankScore)
				? signal.rankScore
				: Number.NEGATIVE_INFINITY;
		const rows = groups.get(sourceKey) ?? [];
		rows.push({ title, url, rankScore, index });
		groups.set(sourceKey, rows);
	}

	if (groups.size === 0 && !topTrend) {
		return undefined;
	}

	for (const rows of groups.values()) {
		rows.sort((left, right) => right.rankScore - left.rankScore || left.index - right.index);
	}

	const orderedGroups = [...groups.entries()].sort(([left], [right]) => {
		const leftOrder = SOURCE_ORDER.get(left) ?? Number.POSITIVE_INFINITY;
		const rightOrder = SOURCE_ORDER.get(right) ?? Number.POSITIVE_INFINITY;
		return leftOrder - rightOrder || left.localeCompare(right);
	});

	const headerLines = [date ? `# Morning Digest: ${date}` : '# Morning Digest'];
	if (topTrend) {
		headerLines.push(`**Top trend:** ${topTrend}`);
	}

	const selectedCounts = new Map();
	for (let rowIndex = 0; ; rowIndex += 1) {
		let foundCandidate = false;
		for (const [sourceKey, rows] of orderedGroups) {
			const row = rows[rowIndex];
			if (!row) {
				continue;
			}
			foundCandidate = true;
			const previousCount = selectedCounts.get(sourceKey) ?? 0;
			selectedCounts.set(sourceKey, rowIndex + 1);
			const candidate = buildGroupedMarkdownLines(
				headerLines,
				orderedGroups,
				selectedCounts,
			).join('\n');
			if (candidate.length > MAX_SELECTED_MARKDOWN_LENGTH) {
				selectedCounts.set(sourceKey, previousCount);
				continue;
			}
		}
		if (!foundCandidate) {
			break;
		}
	}

	return packGeneratedMarkdown(headerLines, orderedGroups, selectedCounts);
}

/**
 * @param {string} header
 * @returns {string | null}
 */
export function resolveSourceKeyFromSectionHeader(header) {
	const normalized = String(header ?? '').trim();
	if (!normalized) {
		return null;
	}
	for (const entry of DIGEST_SOURCE_SECTION_MAP) {
		if (entry.patterns.some((pattern) => pattern.test(normalized))) {
			return entry.sourceKey;
		}
	}
	return null;
}

/**
 * @param {string} markdown
 * @returns {Array<{ sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>}
 */
export function parseSourceOutcomesFromArtifact(markdown) {
	const text = String(markdown ?? '');
	/** @type {Map<string, { sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>} */
	const outcomes = new Map();

	let currentSourceKey = null;
	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}

		const headerMatch = line.match(/^#{1,2}\s+(.+)$/);
		if (headerMatch) {
			currentSourceKey = resolveSourceKeyFromSectionHeader(headerMatch[1]);
			continue;
		}

		if (!currentSourceKey) {
			continue;
		}

		const unavailableMatch = line.match(UNAVAILABLE_LINE_RE);
		if (unavailableMatch) {
			outcomes.set(currentSourceKey, {
				sourceKey: currentSourceKey,
				status: 'unavailable',
				reason: unavailableMatch[1].trim(),
			});
			continue;
		}

		if (line.startsWith('- ') && !line.match(UNAVAILABLE_LINE_RE)) {
			const existing = outcomes.get(currentSourceKey);
			if (!existing || existing.status === 'fired') {
				outcomes.set(currentSourceKey, {
					sourceKey: currentSourceKey,
					status: 'fired',
					signalCount: (existing?.signalCount ?? 0) + 1,
				});
			}
		}
	}

	return DIGEST_SOURCE_SECTION_MAP.map((entry) => outcomes.get(entry.sourceKey)).filter(Boolean);
}

/**
 * Count post-dedupe primary vs contributor appearances for one source.
 *
 * @param {Array<Record<string, unknown>>} signals
 * @param {string} sourceKey
 * @returns {{ storedPrimaryCount: number; contributedCount: number }}
 */
export function countSourceSignalStats(signals, sourceKey) {
	let storedPrimaryCount = 0;
	let contributedCount = 0;
	for (const signal of signals) {
		const sourceType = typeof signal?.sourceType === 'string' ? signal.sourceType : null;
		if (sourceType === sourceKey) {
			storedPrimaryCount += 1;
		}
		const contributors = signal?.sourceMetadata?.contributingSources;
		if (!Array.isArray(contributors)) {
			continue;
		}
		for (const contributor of contributors) {
			const contributorKey =
				typeof contributor?.sourceType === 'string' ? contributor.sourceType : null;
			// Count only non-primary contributor slots (cross-source absorptions).
			if (!contributorKey || contributorKey !== sourceKey || contributorKey === sourceType) {
				continue;
			}
			contributedCount += 1;
		}
	}
	return { storedPrimaryCount, contributedCount };
}

/**
 * Fetch-oriented adapter array length for a source key (pre-dedupe).
 *
 * @param {Record<string, unknown>} adapterResults
 * @param {string} sourceKey
 * @returns {number}
 */
export function resolveAdapterFetchCount(adapterResults, sourceKey) {
	const adapterKey =
		sourceKey === 'google_trends'
			? 'trends'
			: sourceKey === 'newsapi'
				? 'newsapi'
				: sourceKey === 'deep_signal'
					? 'deepSignal'
					: sourceKey;
	const adapterPayload = adapterResults[adapterKey];
	if (!adapterPayload || typeof adapterPayload !== 'object') {
		return 0;
	}
	return countAdapterPayloadItems(unwrapAdapterResult(adapterPayload));
}

/**
 * Always-on youtube stage stderr line (Story 90-2). Confirms the known dedupe cliff.
 *
 * @param {{
 *   collect: number;
 *   build: number;
 *   dedupePrimary: number;
 *   dedupeContrib: number;
 *   scorePrimary: number;
 * }} counts
 * @returns {string}
 */
export function formatYoutubeStageLine(counts) {
	return (
		`yt-stage collect=${counts.collect} build=${counts.build}` +
		` dedupe_primary=${counts.dedupePrimary} dedupe_contrib=${counts.dedupeContrib}` +
		` score_primary=${counts.scorePrimary}`
	);
}

/**
 * Emit yt-stage when youtube ran (collect key present), including all-zero collect=0.
 * Not gated on any-stage > 0 (Story 90-2 review decision).
 *
 * @param {Record<string, unknown> | null | undefined} adapterResults
 * @returns {boolean}
 */
export function shouldEmitYoutubeStageLine(adapterResults) {
	return Boolean(
		adapterResults && typeof adapterResults === 'object' && 'youtube' in adapterResults,
	);
}

/** Min fetchCount before primary-absorb alarms fire (Story 90-4 R4). */
export const PRIMARY_ABSORB_ALARM_MIN_FETCH = 5;

/**
 * Hard wipe when primaries are zero; soft heavy-absorb when primaries < 50% of fetch
 * (catches reddit-style partial absorb without a static cap). Pure observability.
 *
 * @param {{ fetchCount?: number; storedPrimaryCount?: number }} counts
 * @returns {'wipe' | 'heavy-absorb' | null}
 */
export function classifyPrimaryAbsorbAlarm(counts) {
	if (counts == null || typeof counts !== 'object') {
		return null;
	}
	const fetchCount =
		typeof counts.fetchCount === 'number' && Number.isFinite(counts.fetchCount)
			? counts.fetchCount
			: 0;
	const storedPrimaryCount =
		typeof counts.storedPrimaryCount === 'number' && Number.isFinite(counts.storedPrimaryCount)
			? counts.storedPrimaryCount
			: 0;
	if (fetchCount < PRIMARY_ABSORB_ALARM_MIN_FETCH) {
		return null;
	}
	if (storedPrimaryCount === 0) {
		return 'wipe';
	}
	if (storedPrimaryCount < 0.5 * fetchCount) {
		return 'heavy-absorb';
	}
	return null;
}

/**
 * @param {string} sourceKey
 * @param {'wipe' | 'heavy-absorb'} kind
 * @param {{ fetchCount?: number; storedPrimaryCount?: number }} counts
 * @returns {string}
 */
export function formatPrimaryAbsorbAlarmLine(sourceKey, kind, counts) {
	const fetchCount = counts.fetchCount ?? 0;
	const storedPrimaryCount = counts.storedPrimaryCount ?? 0;
	if (kind === 'wipe') {
		return (
			`dedupe-primary-wipe: ${sourceKey}` +
			` fetchCount=${fetchCount} storedPrimaryCount=0`
		);
	}
	return (
		`dedupe-heavy-absorb: ${sourceKey}` +
		` fetchCount=${fetchCount} storedPrimaryCount=${storedPrimaryCount}` +
		` (<50% of fetch)`
	);
}

/**
 * Build stderr warning lines from 90-2 triple counts (Story 90-4 R4).
 * Does not mutate outcomes or add Convex fields — log-only, like yt-stage.
 *
 * @param {Array<{
 *   sourceKey: string;
 *   fetchCount?: number;
 *   storedPrimaryCount?: number;
 * }>} outcomes
 * @returns {string[]}
 */
export function collectPrimaryAbsorbAlarmWarnings(outcomes) {
	/** @type {string[]} */
	const warnings = [];
	for (const row of outcomes) {
		const kind = classifyPrimaryAbsorbAlarm({
			fetchCount: row.fetchCount,
			storedPrimaryCount: row.storedPrimaryCount,
		});
		if (!kind) {
			continue;
		}
		warnings.push(formatPrimaryAbsorbAlarmLine(row.sourceKey, kind, row));
	}
	return warnings;
}

/**
 * @param {{
 *   run?: Record<string, unknown>;
 *   signals?: Array<Record<string, unknown>>;
 *   adapterResults?: Record<string, unknown>;
 * }} ctx
 * @returns {Array<{
 *   sourceKey: string;
 *   status: 'fired' | 'unavailable' | 'error';
 *   signalCount?: number;
 *   fetchCount?: number;
 *   storedPrimaryCount?: number;
 *   contributedCount?: number;
 *   reason?: string;
 * }>}
 */
export function buildSourceOutcomesFromPayload(ctx = {}) {
	const run = ctx.run ?? {};
	const signals = Array.isArray(ctx.signals) ? ctx.signals : [];
	const adapterResults = ctx.adapterResults ?? {};

	/** @type {Map<string, {
	 *   sourceKey: string;
	 *   status: 'fired' | 'unavailable' | 'error';
	 *   signalCount?: number;
	 *   fetchCount?: number;
	 *   storedPrimaryCount?: number;
	 *   contributedCount?: number;
	 *   reason?: string;
	 * }>} */
	const outcomes = new Map();

	for (const entry of DIGEST_SOURCE_SECTION_MAP) {
		const { sourceKey } = entry;
		let status = /** @type {'fired' | 'unavailable' | 'error' | null} */ (null);
		let reason;
		const { storedPrimaryCount, contributedCount } = countSourceSignalStats(signals, sourceKey);
		const fetchCount = resolveAdapterFetchCount(adapterResults, sourceKey);
		// Legacy signalCount = stored primaries only — never inflate with contrib (90-2 honesty).
		const signalCount = storedPrimaryCount;

		if (sourceKey === 'google_trends' && String(run.topTrend ?? '').trim()) {
			status = 'fired';
		} else if (sourceKey === 'deep_signal' && String(run.deepSignalSummary ?? '').trim()) {
			status = 'fired';
		} else if (sourceKey === 'notebook' && String(run.notebookId ?? '').trim()) {
			status = 'fired';
		} else if (storedPrimaryCount > 0 || contributedCount > 0) {
			status = 'fired';
		}

		const adapterKey =
			sourceKey === 'google_trends'
				? 'trends'
				: sourceKey === 'newsapi'
					? 'newsapi'
					: sourceKey === 'deep_signal'
						? 'deepSignal'
						: sourceKey;
		const adapterPayload = adapterResults[adapterKey];
		if (adapterPayload && typeof adapterPayload === 'object') {
			if ('success' in adapterPayload) {
				const wrapped = /** @type {{ success?: boolean; error?: unknown; data?: unknown }} */ (
					adapterPayload
				);
				if (wrapped.success === false) {
					status = 'error';
					reason = String(wrapped.error ?? 'adapter failed');
				} else if (
					wrapped.data &&
					typeof wrapped.data === 'object' &&
					'error' in /** @type {Record<string, unknown>} */ (wrapped.data)
				) {
					status = 'error';
					reason = String(
						/** @type {{ error?: unknown }} */ (wrapped.data).error ?? 'adapter error',
					);
				} else if (wrapped.success === true && status === null) {
					// Adapter ran successfully but produced zero signals — still metadata-tracked
					// so health panel distinguishes "ran, no matches" from "unknown".
					status = 'fired';
				}
			} else if ('error' in adapterPayload) {
				status = 'error';
				reason = String(/** @type {{ error?: unknown }} */ (adapterPayload).error ?? 'adapter error');
			}
		}

		if (status) {
			const hasTriple =
				fetchCount > 0 || storedPrimaryCount > 0 || contributedCount > 0 || status === 'fired';
			outcomes.set(sourceKey, {
				sourceKey,
				status,
				signalCount: signalCount > 0 ? signalCount : undefined,
				...(hasTriple
					? {
							fetchCount,
							storedPrimaryCount,
							contributedCount,
						}
					: {}),
				reason,
			});
		}
	}

	return DIGEST_SOURCE_SECTION_MAP.map((entry) => outcomes.get(entry.sourceKey)).filter(Boolean);
}

/**
 * Merge payload-built outcomes with markdown parse; markdown rows win per sourceKey.
 *
 * @param {Array<{ sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>} payloadRows
 * @param {Array<{ sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>} markdownRows
 * @returns {Array<{ sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>}
 */
/**
 * @param {'fired' | 'unavailable' | 'error'} status
 * @returns {boolean}
 */
function isHardSourceOutcomeStatus(status) {
	return status === 'error' || status === 'unavailable';
}

/**
 * Prefer payload triple-count honesty over markdown bullet inflation (Story 90-2).
 *
 * @param {{
 *   sourceKey: string;
 *   status: 'fired' | 'unavailable' | 'error';
 *   signalCount?: number;
 *   fetchCount?: number;
 *   storedPrimaryCount?: number;
 *   contributedCount?: number;
 *   reason?: string;
 * }} base
 * @param {{
 *   sourceKey: string;
 *   status: 'fired' | 'unavailable' | 'error';
 *   signalCount?: number;
 *   fetchCount?: number;
 *   storedPrimaryCount?: number;
 *   contributedCount?: number;
 *   reason?: string;
 * }} overlay
 * @returns {{
 *   sourceKey: string;
 *   status: 'fired' | 'unavailable' | 'error';
 *   signalCount?: number;
 *   fetchCount?: number;
 *   storedPrimaryCount?: number;
 *   contributedCount?: number;
 *   reason?: string;
 * }}
 */
function mergeOutcomeCountFields(base, overlay) {
	const fetchCount = base.fetchCount ?? overlay.fetchCount;
	const storedPrimaryCount = base.storedPrimaryCount ?? overlay.storedPrimaryCount;
	const contributedCount = base.contributedCount ?? overlay.contributedCount;
	const hasTriple =
		fetchCount !== undefined ||
		storedPrimaryCount !== undefined ||
		contributedCount !== undefined;
	/** @type {number | undefined} */
	let signalCount = overlay.signalCount ?? base.signalCount;
	if (storedPrimaryCount !== undefined) {
		// Never let markdown invent a lone high count that hides storedPrimaryCount=0.
		signalCount = storedPrimaryCount > 0 ? storedPrimaryCount : undefined;
	}
	return {
		...overlay,
		...(hasTriple
			? {
					fetchCount: fetchCount ?? 0,
					storedPrimaryCount: storedPrimaryCount ?? 0,
					contributedCount: contributedCount ?? 0,
				}
			: {}),
		signalCount,
	};
}

export function mergeSourceOutcomeRows(payloadRows, markdownRows) {
	/** @type {Map<string, {
	 *   sourceKey: string;
	 *   status: 'fired' | 'unavailable' | 'error';
	 *   signalCount?: number;
	 *   fetchCount?: number;
	 *   storedPrimaryCount?: number;
	 *   contributedCount?: number;
	 *   reason?: string;
	 * }>} */
	const merged = new Map(payloadRows.map((row) => [row.sourceKey, row]));
	for (const markdownRow of markdownRows) {
		const existing = merged.get(markdownRow.sourceKey);
		if (!existing) {
			merged.set(markdownRow.sourceKey, markdownRow);
			continue;
		}
		if (markdownRow.status === 'unavailable') {
			merged.set(markdownRow.sourceKey, mergeOutcomeCountFields(existing, markdownRow));
			continue;
		}
		if (
			isHardSourceOutcomeStatus(existing.status) &&
			markdownRow.status === 'fired'
		) {
			merged.set(
				markdownRow.sourceKey,
				mergeOutcomeCountFields(existing, {
					...existing,
					signalCount: markdownRow.signalCount ?? existing.signalCount,
				}),
			);
			continue;
		}
		merged.set(markdownRow.sourceKey, mergeOutcomeCountFields(existing, markdownRow));
	}
	return DIGEST_SOURCE_SECTION_MAP.map((entry) => merged.get(entry.sourceKey)).filter(Boolean);
}

/**
 * Keep prior error/unavailable rows when adapter results are unavailable (e.g. force-rescore).
 *
 * @param {Array<{ sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>} outcomes
 * @param {Array<{ sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>} priorOutcomes
 */
export function preservePriorHardOutcomes(outcomes, priorOutcomes) {
	/** @type {Map<string, { sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>} */
	const merged = new Map(outcomes.map((row) => [row.sourceKey, row]));
	for (const prior of priorOutcomes) {
		if (!isHardSourceOutcomeStatus(prior.status)) {
			continue;
		}
		const current = merged.get(prior.sourceKey);
		if (!current || current.status === 'fired') {
			merged.set(prior.sourceKey, {
				...prior,
				signalCount: current?.signalCount ?? prior.signalCount,
			});
		}
	}
	return DIGEST_SOURCE_SECTION_MAP.map((entry) => merged.get(entry.sourceKey)).filter(Boolean);
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string | undefined}
 */
export function resolveDigestMarkdownFromPayload(payload) {
	const candidates = [
		payload.digestMarkdown,
		payload.outputContract,
		payload.markdown,
		payload.run && typeof payload.run === 'object' ? payload.run.digestMarkdown : undefined,
		payload.run && typeof payload.run === 'object' ? payload.run.outputContract : undefined,
	];
	let base = '';
	for (const value of candidates) {
		if (typeof value === 'string' && value.trim()) {
			base = value.trim();
			break;
		}
	}
	if (!base) {
		base = renderDigestMarkdownFromPayload(payload);
	}

	const entityBlock =
		typeof payload.entityDigestMarkdown === 'string' ? payload.entityDigestMarkdown.trim() : '';
	if (!entityBlock) {
		return base;
	}

	const trimmedEntityBlock = trimEntityBlockForDigestAppend(
		entityBlock,
		base.length,
		MAX_SELECTED_MARKDOWN_LENGTH,
	);
	if (!trimmedEntityBlock) {
		return base;
	}
	return `${base}\n\n${trimmedEntityBlock}`;
}

/**
 * @param {{
 *   markdown?: string;
 *   run?: Record<string, unknown>;
 *   signals?: Array<Record<string, unknown>>;
 *   adapterResults?: Record<string, unknown>;
 * }} ctx
 * @returns {Array<{ sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>}
 */
export function resolveSourceOutcomes(ctx = {}) {
	const fromPayload = buildSourceOutcomesFromPayload(ctx);
	const markdown = ctx.markdown?.trim();
	let outcomes = fromPayload;
	if (markdown) {
		const fromMarkdown = parseSourceOutcomesFromArtifact(markdown);
		if (fromMarkdown.length > 0) {
			outcomes = mergeSourceOutcomeRows(fromPayload, fromMarkdown);
		}
	}
	const priorOutcomes = Array.isArray(ctx.priorOutcomes) ? ctx.priorOutcomes : [];
	if (priorOutcomes.length > 0) {
		outcomes = preservePriorHardOutcomes(outcomes, priorOutcomes);
	}
	return outcomes;
}
