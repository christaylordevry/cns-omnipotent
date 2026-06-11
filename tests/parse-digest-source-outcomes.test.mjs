import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	buildSourceOutcomesFromPayload,
	parseSourceOutcomesFromArtifact,
	renderDigestMarkdownFromPayload,
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

	it('marks wrapped adapter failures as error outcomes even with zero signals', () => {
		const outcomes = buildSourceOutcomesFromPayload({
			run: { topTrend: 'AI agents' },
			signals: [],
			adapterResults: {
				twitter: { success: false, error: 'invalid-json' },
				reddit: { success: true, data: { posts: [] } },
			},
		});

		const twitter = outcomes.find((row) => row.sourceKey === 'twitter');
		assert.equal(twitter?.status, 'error');
		assert.equal(twitter?.reason, 'invalid-json');
		assert.equal(twitter?.signalCount, undefined);
	});

	it('maps trends collect key failures to google_trends error outcomes', () => {
		const outcomes = buildSourceOutcomesFromPayload({
			run: {},
			signals: [],
			adapterResults: {
				trends: { success: false, error: 'timeout' },
			},
		});

		const googleTrends = outcomes.find((row) => row.sourceKey === 'google_trends');
		assert.equal(googleTrends?.status, 'error');
		assert.equal(googleTrends?.reason, 'timeout');
	});

	it('marks nested adapter data.error as error outcome when success is true', () => {
		const outcomes = buildSourceOutcomesFromPayload({
			run: {},
			signals: [],
			adapterResults: {
				twitter: {
					success: true,
					data: { error: 'X session invalid' },
				},
			},
		});

		const twitter = outcomes.find((row) => row.sourceKey === 'twitter');
		assert.equal(twitter?.status, 'error');
		assert.equal(twitter?.reason, 'X session invalid');
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

	it('renders ranked source-grouped markdown from Node payloads', () => {
		const markdown = resolveDigestMarkdownFromPayload({
			run: { date: '2026-06-12', topTrend: 'AI agents' },
			signals: [
				{
					sourceType: 'github',
					title: 'Lower ranked repo',
					url: 'https://github.com/example/lower',
					rankScore: 20,
				},
				{
					sourceType: 'newsapi',
					title: 'AI headline',
					url: 'https://example.com/news',
					rankScore: 50,
				},
				{
					sourceType: 'github',
					title: 'Higher ranked repo',
					url: 'https://github.com/example/higher',
					rankScore: 80,
				},
				{ sourceType: 'rss', title: 'Missing URL', rankScore: 100 },
			],
		});

		assert.ok(markdown);
		assert.match(markdown, /^# Morning Digest: 2026-06-12/m);
		assert.match(markdown, /\*\*Top trend:\*\* AI agents/);
		assert.match(markdown, /## Headlines/);
		assert.match(markdown, /## GitHub/);
		assert.ok(markdown.indexOf('Higher ranked repo') < markdown.indexOf('Lower ranked repo'));
		assert.doesNotMatch(markdown, /Missing URL|undefined/);
	});

	it('preserves pre-rendered markdown instead of generating a fallback', () => {
		const existing = '# Existing digest\n\n- Hermes output';
		assert.equal(
			resolveDigestMarkdownFromPayload({
				digestMarkdown: existing,
				run: { date: '2026-06-12', topTrend: 'Ignored' },
				signals: [
					{ sourceType: 'github', title: 'Ignored', url: 'https://example.com/ignored' },
				],
			}),
			existing,
		);
	});

	it('caps generated markdown at 4000 characters', () => {
		const signals = Array.from({ length: 120 }, (_, index) => ({
			sourceType: ['github', 'newsapi', 'rss', 'twitter'][index % 4],
			title: `Signal ${index} ${'long title '.repeat(20)}`,
			url: `https://example.com/source/${index}?detail=${'x'.repeat(80)}`,
			rankScore: 120 - index,
		}));

		const markdown = renderDigestMarkdownFromPayload({
			run: { date: '2026-06-12', topTrend: 'AI agents' },
			signals,
		});

		assert.ok(markdown);
		assert.ok(markdown.length <= 4000);
		assert.match(markdown, /## Headlines/);
		assert.match(markdown, /## GitHub/);
		assert.match(markdown, /## Newsletters \/ RSS/);
		assert.match(markdown, /## X \/ Twitter/);
	});

	it('bounds headers, rejects oversized URLs, and falls through to shorter rows', () => {
		const markdown = renderDigestMarkdownFromPayload({
			run: {
				date: '2026-06-12'.repeat(20),
				topTrend: '@everyone '.repeat(1000),
			},
			signals: [
				{
					sourceType: 'GITHUB',
					title: 'Oversized URL',
					url: `https://example.com/${'x'.repeat(1000)}`,
					rankScore: 100,
				},
				{
					section: 'GitHub',
					title: 'Valid lower-ranked repo',
					url: 'https://github.com/example/valid',
					rankScore: 10,
				},
				{
					sourceType: 'github',
					title: 'Malformed score repo',
					url: 'https://github.com/example/unscored',
					rankScore: '',
				},
			],
		});

		assert.ok(markdown);
		assert.ok(markdown.length <= 4000);
		assert.match(markdown, /## GitHub/);
		assert.match(markdown, /Valid lower-ranked repo/);
		assert.match(markdown, /Malformed score repo/);
		assert.doesNotMatch(markdown, /Oversized URL|score 0/);
	});
});
