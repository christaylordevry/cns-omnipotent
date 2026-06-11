import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  postDigestToDiscord,
  splitDiscordMessages,
} from '../scripts/hermes-skill-examples/morning-digest/scripts/post-digest-discord.mjs';

function makeFetchStub(responses = [{ status: 200, body: { id: 'msg-1' } }]) {
  /** @type {Array<{ url: string; method?: string; headers?: Record<string, string>; body: { content: string } }>} */
  const calls = [];
  let index = 0;

  const fetchFn = async (url, init) => {
    const response = responses[index] ?? responses[responses.length - 1];
    index += 1;
    calls.push({
      url,
      method: init?.method,
      headers: /** @type {Record<string, string> | undefined} */ (init?.headers),
      body: JSON.parse(init?.body ?? '{}'),
    });
    await Promise.resolve();
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: String(response.status),
      json: async () => response.body ?? {},
    };
  };

  return { fetchFn, calls };
}

async function captureStderr(fn) {
  const originalWrite = process.stderr.write;
  let output = '';
  process.stderr.write = (chunk, encoding, cb) => {
    output += String(chunk);
    if (typeof cb === 'function') {
      cb();
    }
    return true;
  };

  try {
    return { result: await fn(), output };
  } finally {
    process.stderr.write = originalWrite;
  }
}

describe('post-digest-discord', () => {
  it('splitDiscordMessages keeps short content in one chunk', () => {
    const chunks = splitDiscordMessages('Hello\n\nWorld');
    assert.deepEqual(chunks, ['Hello\n\nWorld']);
  });

  it('splitDiscordMessages splits on double-newline boundaries above 2000 chars', () => {
    const paraA = 'A'.repeat(1200);
    const paraB = 'B'.repeat(1200);
    const markdown = `${paraA}\n\n${paraB}`;
    const chunks = splitDiscordMessages(markdown);

    assert.equal(chunks.length, 2);
    assert.equal(chunks[0], paraA);
    assert.equal(chunks[1], paraB);
    assert.ok(chunks.every((chunk) => chunk.length <= 2000));
  });

  it('splitDiscordMessages never splits mid-word for long paragraphs', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    assert.ok(words.length > 2000);
    const chunks = splitDiscordMessages(words);

    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 2000);
      assert.doesNotMatch(chunk, /word\d+[a-z]/i);
    }
    assert.equal(chunks.join(' '), words);
  });

  it('postDigestToDiscord returns ok:false when HERMES_DISCORD_TOKEN is missing', async () => {
    const { result, output } = await captureStderr(async () =>
      postDigestToDiscord(
        { digestMarkdown: '# Morning Digest\n\nSignal one.' },
        { CNS_DISCORD_HERMES_CHANNEL_ID: '1500733488897462382' },
      ),
    );

    assert.equal(result.ok, false);
    assert.deepEqual(result.messageIds, []);
    assert.match(result.error ?? '', /HERMES_DISCORD_TOKEN missing/);
    assert.match(output, /HERMES_DISCORD_TOKEN missing/);
  });

  it('postDigestToDiscord posts markdown to Discord REST API', async () => {
    const { fetchFn, calls } = makeFetchStub([
      { status: 200, body: { id: 'msg-abc' } },
    ]);

    const result = await postDigestToDiscord(
      { digestMarkdown: '# Morning Digest\n\n- Signal one' },
      {
        HERMES_DISCORD_TOKEN: 'test-token',
        CNS_DISCORD_HERMES_CHANNEL_ID: '1500733488897462382',
      },
      { fetchFn },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.messageIds, ['msg-abc']);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'https://discord.com/api/v10/channels/1500733488897462382/messages',
    );
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body.content, '# Morning Digest\n\n- Signal one');
    assert.deepEqual(calls[0].body.allowed_mentions, { parse: [] });
    assert.equal(calls[0].headers?.Authorization, 'Bot test-token');
  });

  it('postDigestToDiscord posts sequential messages when content exceeds 2000 chars', async () => {
    const paraA = 'Alpha '.repeat(300).trim();
    const paraB = 'Beta '.repeat(300).trim();
    const markdown = `${paraA}\n\n${paraB}`;
    assert.ok(markdown.length > 2000);

    const { fetchFn, calls } = makeFetchStub([
      { status: 200, body: { id: 'msg-1' } },
      { status: 200, body: { id: 'msg-2' } },
    ]);

    const result = await postDigestToDiscord(
      { digestMarkdown: markdown },
      { HERMES_DISCORD_TOKEN: 'test-token' },
      { fetchFn },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.messageIds, ['msg-1', 'msg-2']);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body.content, paraA);
    assert.equal(calls[1].body.content, paraB);
  });

  it('postDigestToDiscord renders Node payloads into at most two messages', async () => {
    const signals = Array.from({ length: 90 }, (_, index) => ({
      sourceType: ['github', 'newsapi', 'rss'][index % 3],
      title: `Signal ${index} ${'ranked digest title '.repeat(10)}`,
      url: `https://example.com/signals/${index}?detail=${'x'.repeat(60)}`,
      rankScore: 90 - index,
    }));
    const { fetchFn, calls } = makeFetchStub([
      { status: 200, body: { id: 'msg-1' } },
      { status: 200, body: { id: 'msg-2' } },
    ]);

    const result = await postDigestToDiscord(
      {
        run: { date: '2026-06-12', topTrend: 'AI agents' },
        signals,
      },
      { HERMES_DISCORD_TOKEN: 'test-token' },
      { fetchFn },
    );

    assert.equal(result.ok, true);
    assert.ok(calls.length >= 1 && calls.length <= 2);
    assert.match(calls[0].body.content, /# Morning Digest: 2026-06-12/);
    assert.match(calls.map((call) => call.body.content).join('\n'), /## GitHub/);
    assert.ok(calls.every((call) => call.body.content.length <= 2000));
  });
});
