/**
 * Parse morning-digest artifact markdown into sourceOutcomes push metadata (Story 69-3).
 */

/** Canonical registry order — addendum A1. */
export const DIGEST_SOURCE_SECTION_MAP = [
	{ sourceKey: 'google_trends', patterns: [/google trends/i, /^trends\b/i] },
	{ sourceKey: 'newsapi', patterns: [/newsapi/i, /^headlines\b/i] },
	{ sourceKey: 'deep_signal', patterns: [/deep signal/i, /perplexity/i] },
	{ sourceKey: 'arxiv', patterns: [/arxiv/i] },
	{ sourceKey: 'hackernews', patterns: [/hackernews/i, /\bhn\b/i] },
	{ sourceKey: 'notebook', patterns: [/notebook/i, /vault context/i] },
	{ sourceKey: 'github', patterns: [/github/i] },
	{ sourceKey: 'reddit', patterns: [/reddit/i] },
	{ sourceKey: 'rss', patterns: [/newsletters/i, /\brss\b/i] },
	{ sourceKey: 'producthunt', patterns: [/product hunt/i] },
	{ sourceKey: 'twitter', patterns: [/\bx\b/i, /twitter/i] },
	{ sourceKey: 'bluesky', patterns: [/bluesky/i] },
];

const UNAVAILABLE_LINE_RE = /-\s*\(source unavailable:\s*(.+?)\)/i;

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

		const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
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
 * @param {{
 *   run?: Record<string, unknown>;
 *   signals?: Array<Record<string, unknown>>;
 *   adapterResults?: Record<string, unknown>;
 * }} ctx
 * @returns {Array<{ sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>}
 */
export function buildSourceOutcomesFromPayload(ctx = {}) {
	const run = ctx.run ?? {};
	const signals = Array.isArray(ctx.signals) ? ctx.signals : [];
	const adapterResults = ctx.adapterResults ?? {};

	/** @type {Map<string, { sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>} */
	const outcomes = new Map();

	const signalCounts = new Map();
	for (const signal of signals) {
		const sourceType = typeof signal?.sourceType === 'string' ? signal.sourceType : null;
		if (!sourceType) {
			continue;
		}
		signalCounts.set(sourceType, (signalCounts.get(sourceType) ?? 0) + 1);
	}

	for (const entry of DIGEST_SOURCE_SECTION_MAP) {
		const { sourceKey } = entry;
		let status = /** @type {'fired' | 'unavailable' | 'error' | null} */ (null);
		let reason;
		let signalCount = signalCounts.get(sourceKey) ?? 0;

		if (sourceKey === 'google_trends' && String(run.topTrend ?? '').trim()) {
			status = 'fired';
		} else if (sourceKey === 'deep_signal' && String(run.deepSignalSummary ?? '').trim()) {
			status = 'fired';
		} else if (sourceKey === 'notebook' && String(run.notebookId ?? '').trim()) {
			status = 'fired';
		} else if (signalCount > 0) {
			status = 'fired';
		}

		const adapterKey =
			sourceKey === 'newsapi'
				? 'newsapi'
				: sourceKey === 'deep_signal'
					? 'deepSignal'
					: sourceKey;
		const adapterPayload = adapterResults[adapterKey];
		if (adapterPayload && typeof adapterPayload === 'object' && 'error' in adapterPayload) {
			status = 'error';
			reason = String(/** @type {{ error?: unknown }} */ (adapterPayload).error ?? 'adapter error');
		}

		if (status) {
			outcomes.set(sourceKey, {
				sourceKey,
				status,
				signalCount: signalCount > 0 ? signalCount : undefined,
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
export function mergeSourceOutcomeRows(payloadRows, markdownRows) {
	/** @type {Map<string, { sourceKey: string; status: 'fired' | 'unavailable' | 'error'; signalCount?: number; reason?: string }>} */
	const merged = new Map(payloadRows.map((row) => [row.sourceKey, row]));
	for (const row of markdownRows) {
		merged.set(row.sourceKey, row);
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
	for (const value of candidates) {
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return undefined;
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
	if (!markdown) {
		return fromPayload;
	}
	const fromMarkdown = parseSourceOutcomesFromArtifact(markdown);
	if (fromMarkdown.length === 0) {
		return fromPayload;
	}
	return mergeSourceOutcomeRows(fromPayload, fromMarkdown);
}
