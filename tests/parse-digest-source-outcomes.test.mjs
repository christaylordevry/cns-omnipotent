import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	buildSourceOutcomesFromPayload,
	parseSourceOutcomesFromArtifact,
	resolveDigestMarkdownFromPayload,
	resolveSourceKeyFromSectionHeader,
	resolveSourceOutcomes,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs';

describe('parse-digest-source-outcomes (Story 69-3)', () => {
	it('maps section headers to canonical source keys', () => {
		assert.equal(resolveSourceKeyFromSectionHeader('X / Twitter'), 'twitter');
		assert.equal(resolveSourceKeyFromSectionHeader('Newsletters / RSS'), 'rss');
		assert.equal(resolveSourceKeyFromSectionHeader('Deep Signal'), 'deep_signal');
	});

	it('parses unavailable markers into sourceOutcomes rows', () => {
		const markdown = [
			'## Google Trends',
			'- AI agents (87)',
			'',
			'## X / Twitter',
			'- (source unavailable: X credentials not configured)',
		].join('\n');

		const outcomes = parseSourceOutcomesFromArtifact(markdown);
		assert.deepEqual(
			outcomes.find((row) => row.sourceKey === 'twitter'),
			{
				sourceKey: 'twitter',
				status: 'unavailable',
				reason: 'X credentials not configured',
			},
		);
		assert.deepEqual(outcomes.find((row) => row.sourceKey === 'google_trends'), {
			sourceKey: 'google_trends',
			status: 'fired',
			signalCount: 1,
		});
	});

	it('builds fired outcomes from payload signals and run fields', () => {
		const outcomes = buildSourceOutcomesFromPayload({
			run: {
				topTrend: 'AI agents',
				deepSignalSummary: 'Sweep summary',
				notebookId: 'nb-1',
			},
			signals: [
				{ sourceType: 'newsapi', title: 'Headline' },
				{ sourceType: 'hackernews', title: 'HN' },
			],
		});

		assert.ok(outcomes.some((row) => row.sourceKey === 'google_trends' && row.status === 'fired'));
		assert.ok(outcomes.some((row) => row.sourceKey === 'newsapi' && row.signalCount === 1));
		assert.ok(outcomes.some((row) => row.sourceKey === 'notebook' && row.status === 'fired'));
	});

	it('resolveSourceOutcomes merges markdown unavailable with payload fired rows', () => {
		const markdown = [
			'## X / Twitter',
			'- (source unavailable: X credentials not configured)',
			'## Google Trends',
			'- AI agents (87)',
		].join('\n');

		const outcomes = resolveSourceOutcomes({
			markdown,
			run: { topTrend: 'AI agents' },
			signals: [{ sourceType: 'newsapi', title: 'Headline' }],
		});

		assert.deepEqual(outcomes.find((row) => row.sourceKey === 'twitter'), {
			sourceKey: 'twitter',
			status: 'unavailable',
			reason: 'X credentials not configured',
		});
		assert.ok(outcomes.some((row) => row.sourceKey === 'newsapi' && row.status === 'fired'));
	});

	it('resolveDigestMarkdownFromPayload reads digestMarkdown and outputContract', () => {
		assert.equal(
			resolveDigestMarkdownFromPayload({ digestMarkdown: '## X / Twitter\n- post' }),
			'## X / Twitter\n- post',
		);
		assert.equal(
			resolveDigestMarkdownFromPayload({ outputContract: '## Bluesky\n- hello' }),
			'## Bluesky\n- hello',
		);
	});
});
