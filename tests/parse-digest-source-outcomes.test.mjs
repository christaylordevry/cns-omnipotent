import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	buildSourceOutcomesFromPayload,
	countSourceSignalStats,
	formatYoutubeStageLine,
	mergeSourceOutcomeRows,
	parseSourceOutcomesFromArtifact,
	preservePriorHardOutcomes,
	renderDigestMarkdownFromPayload,
	resolveDigestMarkdownFromPayload,
	resolveSourceKeyFromSectionHeader,
	resolveSourceOutcomes,
	shouldEmitYoutubeStageLine,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs';
import { dedupeDigestSignals } from '../scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs';
import { buildDigestPushPayload } from '../scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs';
import { scoreDigestSignals } from '../scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs';

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

		const reddit = outcomes.find((row) => row.sourceKey === 'reddit');
		assert.equal(reddit?.status, 'fired');
		assert.equal(reddit?.signalCount, undefined);
	});

	it('marks successful empty pinterest and polymarket adapter runs as fired (Story 72-5/72-6 health)', () => {
		const outcomes = buildSourceOutcomesFromPayload({
			run: {},
			signals: [],
			adapterResults: {
				pinterest: { success: true, data: { pins: [] } },
				polymarket: { success: true, data: { markets: [] } },
			},
		});

		const pinterest = outcomes.find((row) => row.sourceKey === 'pinterest');
		const polymarket = outcomes.find((row) => row.sourceKey === 'polymarket');
		assert.equal(pinterest?.status, 'fired');
		assert.equal(pinterest?.signalCount, undefined);
		assert.equal(polymarket?.status, 'fired');
		assert.equal(polymarket?.signalCount, undefined);
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

	it('counts contributingSources appearances in buildSourceOutcomesFromPayload', () => {
		const outcomes = buildSourceOutcomesFromPayload({
			run: {},
			signals: [
				{
					sourceType: 'hackernews',
					title: 'Merged story',
					sourceMetadata: {
						contributingSources: [{ sourceType: 'newsapi' }],
					},
				},
			],
		});

		const newsapi = outcomes.find((row) => row.sourceKey === 'newsapi');
		assert.equal(newsapi?.status, 'fired');
		assert.equal(newsapi?.storedPrimaryCount, 0);
		assert.equal(newsapi?.contributedCount, 1);
		// Legacy signalCount = primaries only — contrib must not inflate it (90-2).
		assert.equal(newsapi?.signalCount, undefined);
		assert.equal(
			outcomes.find((row) => row.sourceKey === 'hackernews')?.signalCount,
			1,
		);
	});

	it('exposes triple counts for prod-shaped youtube over-collapse (Story 90-2)', () => {
		const youtubeVideos = Array.from({ length: 25 }, (_, i) => ({
			title: `Claude prompting tips video ${i}`,
			url: `https://www.youtube.com/watch?v=yt${i}`,
			channelTitle: 'AI Channel',
			publishedAt: '2026-07-22T10:00:00.000Z',
		}));
		const adapterResults = {
			youtube: { success: true, data: { videos: youtubeVideos } },
			twitter: {
				success: true,
				data: {
					posts: [
						{
							title: 'I got some really useful Claude prompting tips',
							url: 'https://x.com/user/status/1',
						},
					],
				},
			},
		};
		// Post-dedupe shape: twitter winner absorbed all 25 youtube as contributors.
		const signals = [
			{
				sourceType: 'twitter',
				title: 'I got some really useful Claude prompting tips',
				url: 'https://x.com/user/status/1',
				sourceMetadata: {
					dedupClusterSize: 33,
					contributingSources: [
						{ sourceType: 'twitter' },
						...youtubeVideos.map((v) => ({
							sourceType: 'youtube',
							url: v.url,
						})),
						{ sourceType: 'rss' },
						{ sourceType: 'bluesky' },
					],
				},
			},
		];

		const outcomes = buildSourceOutcomesFromPayload({
			run: {},
			signals,
			adapterResults,
		});
		const youtube = outcomes.find((row) => row.sourceKey === 'youtube');
		assert.ok(youtube);
		assert.equal(youtube.fetchCount, 25);
		assert.equal(youtube.storedPrimaryCount, 0);
		assert.equal(youtube.contributedCount, 25);
		assert.equal(youtube.signalCount, undefined);
		assert.equal(youtube.status, 'fired');
	});

	it('markdown merge does not hide storedPrimaryCount=0 behind a lone high signalCount (Story 90-2)', () => {
		const merged = mergeSourceOutcomeRows(
			[
				{
					sourceKey: 'youtube',
					status: 'fired',
					fetchCount: 25,
					storedPrimaryCount: 0,
					contributedCount: 25,
					signalCount: undefined,
				},
			],
			[
				{
					sourceKey: 'youtube',
					status: 'fired',
					signalCount: 25,
				},
			],
		);
		const youtube = merged.find((row) => row.sourceKey === 'youtube');
		assert.equal(youtube?.fetchCount, 25);
		assert.equal(youtube?.storedPrimaryCount, 0);
		assert.equal(youtube?.contributedCount, 25);
		assert.equal(youtube?.signalCount, undefined);
	});

	it('formatYoutubeStageLine surfaces the primary→0 cliff (Story 90-2)', () => {
		assert.equal(
			formatYoutubeStageLine({
				collect: 25,
				build: 25,
				dedupePrimary: 0,
				dedupeContrib: 25,
				scorePrimary: 0,
			}),
			'yt-stage collect=25 build=25 dedupe_primary=0 dedupe_contrib=25 score_primary=0',
		);
	});

	it('shouldEmitYoutubeStageLine keys off youtube ∈ adapterResults, including all-zeros (Story 90-2)', () => {
		assert.equal(shouldEmitYoutubeStageLine({ youtube: { success: true, data: { videos: [] } } }), true);
		assert.equal(shouldEmitYoutubeStageLine({ youtube: { error: 'quota-exceeded' } }), true);
		assert.equal(shouldEmitYoutubeStageLine({ twitter: { success: true, data: { posts: [] } } }), false);
		assert.equal(shouldEmitYoutubeStageLine(undefined), false);
		assert.equal(shouldEmitYoutubeStageLine(null), false);
	});

	it('youtube-only healthy videos survive build→dedupe→score as primaries (Story 90-2 sanity)', () => {
		// Distinct youtu.be paths — youtube.com/watch?v=* collapses to the same
		// canonicalDomainPath (/watch) under current dedupe (retune is 90-4).
		const videos = [
			{
				title: 'Rust async runtime redesign deep dive',
				url: 'https://youtu.be/unique0abcde',
				channelTitle: 'Channel',
				publishedAt: '2026-07-22T12:00:00.000Z',
				viewCount: 100,
			},
			{
				title: 'Local bakery wins regional award ceremony',
				url: 'https://youtu.be/unique1fghij',
				channelTitle: 'Channel',
				publishedAt: '2026-07-20T12:00:00.000Z',
				viewCount: 101,
			},
			{
				title: 'Quantum chemistry lab notebook techniques',
				url: 'https://youtu.be/unique2klmno',
				channelTitle: 'Channel',
				publishedAt: '2026-07-18T12:00:00.000Z',
				viewCount: 102,
			},
		];
		const built = buildDigestPushPayload({
			date: '2026-07-22',
			ranAt: Date.parse('2026-07-22T12:00:00.000Z'),
			youtube: { videos },
		});
		assert.equal(built.signals.filter((s) => s.sourceType === 'youtube').length, 3);
		const deduped = dedupeDigestSignals(built.signals);
		assert.equal(deduped.filter((s) => s.sourceType === 'youtube').length, 3);
		const scoreCtx = {
			domainTokens: [],
			personalTokens: [],
			epicNumericTokens: [],
			noveltyHistoryEntries: [],
			runAt: Date.parse('2026-07-22T12:00:00.000Z'),
			watchlistMissing: false,
		};
		const scored = scoreDigestSignals(deduped, scoreCtx);
		assert.equal(scored.filter((s) => s.sourceType === 'youtube').length, 3);
		const stats = countSourceSignalStats(scored, 'youtube');
		assert.equal(stats.storedPrimaryCount, 3);
		assert.equal(stats.contributedCount, 0);
	});

	it('mixed cluster fixture shows fetch>0 / primary=0 / contrib>0 after real dedupe (Story 90-2)', () => {
		const sharedTitle = 'Claude Prompting Tips For Developers Worldwide Guide';
		const publishedAt = '2026-07-22T10:00:00.000Z';
		const youtubeVideos = Array.from({ length: 5 }, (_, i) => ({
			title: sharedTitle,
			url: `https://www.youtube.com/watch?v=cliff${i}`,
			channelTitle: 'YT',
			publishedAt,
			viewCount: 10,
		}));
		const built = buildDigestPushPayload({
			date: '2026-07-22',
			ranAt: Date.parse(publishedAt),
			twitter: {
				posts: [
					{
						title: sharedTitle,
						url: 'https://x.com/user/status/cliff1',
						authorHandle: 'user',
						publishedAt,
						likes: 500,
						reposts: 50,
					},
				],
			},
			youtube: { videos: youtubeVideos },
		});
		const buildYt = built.signals.filter((s) => s.sourceType === 'youtube').length;
		assert.equal(buildYt, 5);
		const deduped = dedupeDigestSignals(built.signals);
		const dedupeStats = countSourceSignalStats(deduped, 'youtube');
		assert.ok(dedupeStats.storedPrimaryCount === 0, 'youtube primaries wiped by twitter winner');
		assert.ok(dedupeStats.contributedCount >= 5, 'youtube appears as contributors');
		const scoreCtx = {
			domainTokens: [],
			personalTokens: [],
			epicNumericTokens: [],
			noveltyHistoryEntries: [],
			runAt: Date.parse(publishedAt),
			watchlistMissing: false,
		};
		const stage = formatYoutubeStageLine({
			collect: 5,
			build: buildYt,
			dedupePrimary: dedupeStats.storedPrimaryCount,
			dedupeContrib: dedupeStats.contributedCount,
			scorePrimary: countSourceSignalStats(scoreDigestSignals(deduped, scoreCtx), 'youtube')
				.storedPrimaryCount,
		});
		assert.match(stage, /yt-stage collect=5 build=5 dedupe_primary=0 dedupe_contrib=\d+ score_primary=0/);

		const outcomes = buildSourceOutcomesFromPayload({
			signals: deduped,
			adapterResults: {
				youtube: { success: true, data: { videos: youtubeVideos } },
			},
		});
		const youtube = outcomes.find((row) => row.sourceKey === 'youtube');
		assert.equal(youtube?.fetchCount, 5);
		assert.equal(youtube?.storedPrimaryCount, 0);
		assert.ok((youtube?.contributedCount ?? 0) >= 5);
	});

	it('mergeSourceOutcomeRows preserves adapter error over markdown fired bullets', () => {
		const merged = mergeSourceOutcomeRows(
			[
				{
					sourceKey: 'twitter',
					status: 'error',
					reason: 'invalid-json',
				},
			],
			[
				{
					sourceKey: 'twitter',
					status: 'fired',
					signalCount: 2,
				},
			],
		);

		assert.deepEqual(merged.find((row) => row.sourceKey === 'twitter'), {
			sourceKey: 'twitter',
			status: 'error',
			reason: 'invalid-json',
			signalCount: 2,
		});
	});

	it('ignores h3 sub-headers when parsing artifact markdown', () => {
		const markdown = [
			'## HackerNews',
			'### Top Stories',
			'- [HN item](<https://news.ycombinator.com/item?id=1>)',
		].join('\n');

		const outcomes = parseSourceOutcomesFromArtifact(markdown);
		assert.deepEqual(outcomes.find((row) => row.sourceKey === 'hackernews'), {
			sourceKey: 'hackernews',
			status: 'fired',
			signalCount: 1,
		});
	});

	it('preservePriorHardOutcomes keeps prior error rows on force-rescore paths', () => {
		const preserved = preservePriorHardOutcomes(
			[
				{
					sourceKey: 'twitter',
					status: 'fired',
					signalCount: 1,
				},
			],
			[
				{
					sourceKey: 'twitter',
					status: 'error',
					reason: 'invalid-json',
				},
			],
		);

		assert.deepEqual(preserved.find((row) => row.sourceKey === 'twitter'), {
			sourceKey: 'twitter',
			status: 'error',
			reason: 'invalid-json',
			signalCount: 1,
		});
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

	it('resolveDigestMarkdownFromPayload appends entityDigestMarkdown when present (Story 73-7)', () => {
		const markdown = resolveDigestMarkdownFromPayload({
			digestMarkdown: '## Morning digest\n- signal',
			entityDigestMarkdown: '## Tracked entities accelerating now\n• **Yann LeCun** (person) — ≈2.5× vs baseline · theme',
		});
		assert.match(markdown, /^## Morning digest/);
		assert.match(markdown, /## Tracked entities accelerating now/);
		assert.match(markdown, /Yann LeCun/);
	});

	it('resolveDigestMarkdownFromPayload unchanged when entityDigestMarkdown absent', () => {
		assert.equal(
			resolveDigestMarkdownFromPayload({ digestMarkdown: '## Morning digest\n- signal' }),
			'## Morning digest\n- signal',
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
