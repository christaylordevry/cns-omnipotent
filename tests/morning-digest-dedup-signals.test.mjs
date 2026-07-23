import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  canonicalDomainPath,
  crossTitleEntityMatch,
  dedupeDigestSignals,
  dedupeDigestSignalsSafe,
  jaccardSimilarity,
  mergeClusterSignals,
  normalizeDigestUrl,
  pickClusterWinner,
  rawEngagementProxy,
  runDedupeDigestSignalsCli,
  shouldClusterSignals,
  titleFingerprintJaccard,
  titleFingerprintTokens,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs';

const execFileAsync = promisify(execFile);
const dedupeScript = join(
  dirname(fileURLToPath(import.meta.url)),
  '../scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs',
);

describe('normalizeDigestUrl', () => {
  it('strips utm params, www, query, fragment, and trailing slash', () => {
    assert.equal(
      normalizeDigestUrl('http://www.example.com/path/?utm_source=x&id=1#section'),
      'https://example.com/path',
    );
  });

  it('strips fbclid before query removal', () => {
    assert.equal(
      normalizeDigestUrl('https://example.com/article?fbclid=abc123'),
      'https://example.com/article',
    );
  });

  it('preserves distinct HN item ids after normalization', () => {
    assert.equal(
      normalizeDigestUrl('https://news.ycombinator.com/item?id=111'),
      'https://news.ycombinator.com/item?id=111',
    );
    assert.equal(
      normalizeDigestUrl('http://news.ycombinator.com/item?id=222&utm_source=hn'),
      'https://news.ycombinator.com/item?id=222',
    );
    assert.notEqual(
      normalizeDigestUrl('https://news.ycombinator.com/item?id=111'),
      normalizeDigestUrl('https://news.ycombinator.com/item?id=222'),
    );
  });

  it('preserves distinct YouTube watch v= ids after normalization (Story 90-4 R1)', () => {
    assert.equal(
      normalizeDigestUrl('https://www.youtube.com/watch?v=x3r7coukSKk&utm_source=digest'),
      'https://youtube.com/watch?v=x3r7coukSKk',
    );
    assert.notEqual(
      normalizeDigestUrl('https://youtube.com/watch?v=x3r7coukSKk'),
      normalizeDigestUrl('https://youtube.com/watch?v=aKEQ0wRoRW0'),
    );
  });
});

describe('titleFingerprintJaccard', () => {
  it('returns high similarity for near-identical titles', () => {
    const a = { title: 'OpenAI launches GPT-5 for developers' };
    const b = { title: 'OpenAI Launches GPT-5 for Developers!' };
    assert.ok(titleFingerprintJaccard(a, b) >= 0.85);
  });

  it('returns low similarity for unrelated titles', () => {
    const a = { title: 'Rust memory safety improvements' };
    const b = { title: 'Best pizza recipes in Brooklyn' };
    assert.ok(titleFingerprintJaccard(a, b) < 0.85);
  });
});

describe('rawEngagementProxy and pickClusterWinner', () => {
  it('prefers higher engagement proxy', () => {
    const hn = {
      sourceType: 'hackernews',
      sourceMetadata: { points: 100, commentCount: 20 },
    };
    const news = {
      sourceType: 'newsapi',
      sourceMetadata: { publishedAt: '2026-06-11T08:00:00.000Z' },
    };
    assert.ok(rawEngagementProxy(hn) > rawEngagementProxy(news));
    assert.equal(pickClusterWinner([news, hn]).sourceType, 'hackernews');
  });

  it('breaks engagement tie with source priority', () => {
    const news = {
      sourceType: 'newsapi',
      sourceMetadata: { publishedAt: '2026-06-11T08:00:00.000Z' },
    };
    const rss = {
      sourceType: 'rss',
      sourceMetadata: { publishedAt: '2026-06-11T07:00:00.000Z' },
    };
    assert.equal(pickClusterWinner([rss, news]).sourceType, 'newsapi');
  });

  it('includes comments in engagement proxy sum', () => {
    assert.equal(
      rawEngagementProxy({ sourceMetadata: { comments: 15, commentCount: 10 } }),
      25,
    );
  });
});

describe('dedupeDigestSignals', () => {
  it('merges HN + NewsAPI + RSS with same normalized URL', () => {
    const url = 'https://tech.example.com/ai-agent-framework?utm_source=hn';
    const signals = [
      {
        section: 'hackernews',
        sourceType: 'hackernews',
        title: 'Show HN: AI Agent Framework',
        url: 'https://www.tech.example.com/ai-agent-framework/',
        sourceMetadata: { points: 142, commentCount: 38 },
      },
      {
        section: 'headlines',
        sourceType: 'newsapi',
        title: 'AI Agent Framework Launches',
        url: `${url}&utm_medium=news`,
        sourceMetadata: { publishedAt: '2026-06-11T08:00:00.000Z' },
      },
      {
        section: 'rss',
        sourceType: 'rss',
        title: 'AI Agent Framework — newsletter pick',
        url: 'http://tech.example.com/ai-agent-framework',
        sourceMetadata: { publishedAt: '2026-06-11T09:00:00.000Z', author: 'Editor' },
      },
    ];

    const result = dedupeDigestSignals(signals);
    assert.equal(result.length, 1);
    const meta = result[0].sourceMetadata;
    assert.equal(meta.dedupClusterSize, 3);
    assert.equal(meta.contributingSources.length, 3);
    assert.equal(result[0].sourceType, 'hackernews');
  });

  it('merges HN redirector with NewsAPI external URL via title Jaccard', () => {
    const signals = [
      {
        section: 'hackernews',
        sourceType: 'hackernews',
        title: 'OpenAI launches GPT-5 for developers worldwide',
        url: 'https://news.ycombinator.com/item?id=48408186',
        sourceMetadata: { points: 200, commentCount: 45 },
      },
      {
        section: 'headlines',
        sourceType: 'newsapi',
        title: 'OpenAI Launches GPT-5 for Developers Worldwide',
        url: 'https://news.example.com/openai-gpt-5-developers',
        sourceMetadata: { publishedAt: '2026-06-11T08:00:00.000Z' },
      },
    ];

    const result = dedupeDigestSignals(signals);
    assert.equal(result.length, 1);
    assert.equal(result[0].sourceMetadata.dedupClusterSize, 2);
  });

  it('does not merge unrelated HN item URLs with different ids', () => {
    const signals = [
      {
        section: 'hackernews',
        sourceType: 'hackernews',
        title: 'Rust async runtime redesign',
        url: 'https://news.ycombinator.com/item?id=111',
        sourceMetadata: { points: 50 },
      },
      {
        section: 'hackernews',
        sourceType: 'hackernews',
        title: 'Local bakery wins award',
        url: 'https://news.ycombinator.com/item?id=222',
        sourceMetadata: { points: 30 },
      },
    ];

    const result = dedupeDigestSignals(signals);
    assert.equal(result.length, 2);
    assert.equal(result[0].sourceMetadata?.contributingSources, undefined);
    assert.equal(result[1].sourceMetadata?.contributingSources, undefined);
  });

  it('leaves unrelated signals unchanged', () => {
    const signals = [
      {
        section: 'hackernews',
        sourceType: 'hackernews',
        title: 'Rust async runtime redesign',
        url: 'https://example.com/rust-async',
        sourceMetadata: { points: 50 },
      },
      {
        section: 'headlines',
        sourceType: 'newsapi',
        title: 'Local bakery wins award',
        url: 'https://example.com/bakery-award',
        sourceMetadata: { publishedAt: '2026-06-11T08:00:00.000Z' },
      },
    ];

    const result = dedupeDigestSignals(signals);
    assert.equal(result.length, 2);
    assert.equal(result[0].sourceMetadata?.contributingSources, undefined);
    assert.equal(result[0].sourceMetadata?.dedupClusterSize, undefined);
    assert.equal(result[1].sourceMetadata?.contributingSources, undefined);
  });

  it('passes singleton through without dedup metadata keys', () => {
    const signals = [
      {
        section: 'rss',
        sourceType: 'rss',
        title: 'Only one story',
        url: 'https://example.com/only-one',
        sourceMetadata: { publishedAt: '2026-06-11T08:00:00.000Z' },
      },
    ];

    const result = dedupeDigestSignals(signals);
    assert.equal(result.length, 1);
    assert.equal(result[0].sourceMetadata?.contributingSources, undefined);
    assert.equal(result[0].sourceMetadata?.dedupClusterSize, undefined);
  });
});

describe('mergeClusterSignals', () => {
  it('preserves winner primary fields and contributor engagement snapshots', () => {
    const cluster = [
      {
        section: 'hackernews',
        sourceType: 'hackernews',
        title: 'Winner title',
        url: 'https://example.com/story',
        sourceMetadata: { points: 100 },
      },
      {
        section: 'headlines',
        sourceType: 'newsapi',
        title: 'Other title',
        url: 'https://example.com/story?utm=1',
        sourceMetadata: { publishedAt: '2026-06-11T08:00:00.000Z' },
      },
    ];

    const merged = mergeClusterSignals(cluster);
    assert.equal(merged.title, 'Winner title');
    assert.equal(merged.sourceType, 'hackernews');
    assert.equal(merged.sourceMetadata.contributingSources.length, 2);
    assert.equal(merged.sourceMetadata.points, 100);
  });
});

describe('shouldClusterSignals helpers', () => {
  it('matches canonical domain + path across hosts with same path', () => {
    assert.equal(
      canonicalDomainPath('https://www.example.com/blog/post'),
      'example.com/blog/post',
    );
  });

  it('embeds youtube v= in canonicalDomainPath so distinct watches stay distinct (Story 90-4 R1)', () => {
    const a = canonicalDomainPath('https://www.youtube.com/watch?v=x3r7coukSKk');
    const b = canonicalDomainPath('https://youtube.com/watch?v=aKEQ0wRoRW0');
    assert.equal(a, 'youtube.com/watch?v=x3r7coukSKk');
    assert.equal(b, 'youtube.com/watch?v=aKEQ0wRoRW0');
    assert.notEqual(a, b);
    // AC: must fail if only normalizeDigestUrl is fixed but canon still returns youtube.com/watch
    assert.notEqual(a, 'youtube.com/watch');
    assert.ok(a.includes('v=x3r7coukSKk'));
  });

  it('yields 25 distinct canon keys for 25 distinct youtube watch URLs (Story 90-4 R1)', () => {
    const urls = Array.from(
      { length: 25 },
      (_, i) => `https://www.youtube.com/watch?v=videoId${String(i).padStart(2, '0')}xx`,
    );
    const canons = urls.map((url) => canonicalDomainPath(url));
    assert.equal(new Set(canons).size, 25);
    assert.ok(canons.every((key) => key.startsWith('youtube.com/watch?v=')));
  });

  it('detects cross-title entity match within 24h when proportion ≥ 0.5 (Story 90-4 R2)', () => {
    const a = {
      title: 'OpenAI GPT-5 Release Event',
      sourceMetadata: { publishedAt: '2026-06-11T08:00:00.000Z' },
    };
    const b = {
      title: 'OpenAI GPT-5 Developer Preview',
      sourceMetadata: { publishedAt: '2026-06-11T20:00:00.000Z' },
    };
    assert.equal(crossTitleEntityMatch(a, b), true);
    assert.equal(shouldClusterSignals(a, b), true);
  });

  it('rejects entity match when shared≥2 but proportion < 0.5 (Story 90-4 R2)', () => {
    const a = {
      title: 'Claude Prompting Tips Fable Code Agents Workflow Context Windows Memory',
      sourceMetadata: { publishedAt: '2026-07-22T10:00:00.000Z' },
    };
    const b = {
      title: 'Claude Prompting Tips Local Bakery Wins Award Ceremony Today',
      sourceMetadata: { publishedAt: '2026-07-22T11:00:00.000Z' },
    };
    // shared: claude, prompting, tips (=3) but min noun set is large → proportion < 0.5
    assert.equal(crossTitleEntityMatch(a, b), false);
  });
});

describe('CLI contract', () => {
  it('reads DIGEST_SIGNALS_JSON and writes deduped stdout', async () => {
    const input = [
      {
        section: 'hackernews',
        sourceType: 'hackernews',
        title: 'Same Story Here',
        url: 'https://example.com/same',
        sourceMetadata: { points: 10 },
      },
      {
        section: 'rss',
        sourceType: 'rss',
        title: 'Same Story Here!',
        url: 'https://example.com/same/',
        sourceMetadata: { publishedAt: '2026-06-11T08:00:00.000Z' },
      },
    ];

    const { stdout } = await execFileAsync('node', [dedupeScript], {
      env: { ...process.env, DIGEST_SIGNALS_JSON: JSON.stringify(input) },
    });
    const parsed = JSON.parse(stdout.trim());
    assert.equal(parsed.length, 1);
  });

  it('passthrough on invalid JSON env via safe helper', async () => {
    const result = await runDedupeDigestSignalsCli({
      DIGEST_SIGNALS_JSON: 'not-json',
    });
    assert.deepEqual(result, []);
  });

  it('dedupeDigestSignalsSafe returns input on catastrophic failure', () => {
    const signals = [{ section: 'rss', sourceType: 'rss', title: 'Keep me' }];
    const result = dedupeDigestSignalsSafe(signals);
    assert.equal(result.length, 1);
  });
});

describe('jaccard and fingerprint utilities', () => {
  it('computes jaccard on token sets', () => {
    assert.equal(jaccardSimilarity(['a', 'b'], ['b', 'c']), 1 / 3);
  });

  it('strips punctuation before tokenizing fingerprint', () => {
    const tokens = titleFingerprintTokens('Hello, World! — Test');
    assert.ok(tokens.includes('hello'));
    assert.ok(tokens.includes('world'));
  });
});

describe('Story 90-4 fixture regression (2026-07-22 reconstructed)', () => {
  it('R1+R2: 25 distinct yt canons, ≥18 yt primaries, legit clusters still collapse', async () => {
    const { readFile } = await import('node:fs/promises');
    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../_bmad-output/implementation-artifacts/90-4-reconstructed-pre-dedupe-2026-07-22.json',
    );
    const signals = JSON.parse(await readFile(fixturePath, 'utf8'));
    assert.equal(signals.filter((s) => s.sourceType === 'youtube').length, 25);

    const ytCanons = signals
      .filter((s) => s.sourceType === 'youtube')
      .map((s) => canonicalDomainPath(String(s.url ?? '')));
    assert.equal(new Set(ytCanons).size, 25, 'R1: prod 25→1 must become 25 distinct canon keys');

    const deduped = dedupeDigestSignals(signals);
    const ytPrimaries = deduped.filter((s) => s.sourceType === 'youtube').length;
    assert.ok(ytPrimaries >= 18, `expected ≥18 youtube primaries, got ${ytPrimaries}`);

    const anth = deduped.find((s) =>
      /anthropic|Which company has best AI model/i.test(String(s.title ?? '')),
    );
    assert.ok(anth, 'anthropic/best-AI-model cluster winner missing');
    assert.equal(anth.sourceMetadata?.dedupClusterSize, 5, 'polymarket anthropic family must stay collapsed');

    const btc = deduped.find((s) => /Bitcoin ETF/i.test(String(s.title ?? '')));
    assert.ok(btc, 'Bitcoin ETF cluster winner missing');
    assert.equal(btc.sourceMetadata?.dedupClusterSize, 3, 'Bitcoin ETF family must stay collapsed');

    const importAi = deduped.find((s) => /Import AI 465/i.test(String(s.title ?? '')));
    assert.ok(importAi, 'Import AI 465 cluster winner missing');
    assert.equal(importAi.sourceMetadata?.dedupClusterSize, 2, 'Import AI 465 near-dup must stay collapsed');
  });

  it('R2 reconstructed+inject keeps ≥50% reddit primaries (AC: reddit)', async () => {
    const { readFile } = await import('node:fs/promises');
    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../_bmad-output/implementation-artifacts/90-4-reconstructed-pre-dedupe-2026-07-22.json',
    );
    const reconstructed = JSON.parse(await readFile(fixturePath, 'utf8'));
    const publishedAt = '2026-07-22T12:00:00.000Z';

    // Diversified inject on reconstructed corpus (not a fragile full-SSOT snapshot).
    // Titles are distinct so same-source Jaccard/entity does not self-wipe the inject;
    // R4 heavy-absorb line is primary < 50% fetch — AC locks the complementary floor.
    const injectTitles = [
      'Homelab Rack Cable Management Checklist',
      'Pottery Wheel Centering Drill Routine',
      'Sailboat Standing Rigging Inspection',
      'Beekeeping Spring Expansion Notes',
      'Trail Running Shoe Rotation Log',
      'Espresso Dialing Temperature Ladder',
      'Reef Aquarium Alkalinity Stability',
      'Vinyl Record Pressing Warpage Fixes',
      'Dovetail Joint Layout Practice Board',
      'Lunar Sketch Observing Session Log',
      'Sourdough Starter Hydration Schedule',
      'Climbing Knot Efficiency Practice',
      'Darkroom Print Dodging Notes',
      'Kayak Hull Repair Fiberglass Patch',
      'Mycology Grain Spawn Colonization',
    ];
    const inject = injectTitles.map((title, i) => ({
      section: 'reddit',
      sourceType: 'reddit',
      title,
      url: `https://www.reddit.com/r/LocalLLaMA/comments/r904inj${i}/`,
      sourceMetadata: { publishedAt, upvotes: 50 + i },
    }));

    const twitterMega = reconstructed.find(
      (s) =>
        s.sourceType === 'twitter' && /Claude prompting tips/i.test(String(s.title ?? '')),
    );
    assert.ok(twitterMega, 'reconstructed fixture must include Claude prompting tips twitter');
    const threat = {
      section: 'reddit',
      sourceType: 'reddit',
      title: 'Local Bakery Wins Award Claude Prompting Tips Homelab',
      url: 'https://www.reddit.com/r/LocalLLaMA/comments/r904threat/',
      sourceMetadata: { publishedAt, upvotes: 11 },
    };
    assert.equal(
      crossTitleEntityMatch(twitterMega, threat),
      false,
      'proportion gate must block sparse noun overlap into the twitter mega title',
    );

    const allInject = [...inject, threat];
    const injectUrls = new Set(allInject.map((s) => s.url));
    const deduped = dedupeDigestSignals([...reconstructed, ...allInject]);
    const redditPrimaries = deduped.filter((s) => injectUrls.has(s.url)).length;
    const minKeep = Math.ceil(0.5 * allInject.length);
    assert.ok(
      redditPrimaries >= minKeep,
      `reddit inject primaries ${redditPrimaries} must be ≥50% of injected (${minKeep}/${allInject.length})`,
    );
  });
});
