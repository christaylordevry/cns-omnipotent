import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alertStaleNotebooks,
  buildStaleAlertMessage,
  checkStaleNotebooks,
  resolveStaleThreshold,
} from "../scripts/session-close/lib/notebook-stale-alert.mjs";

const MS_PER_DAY = 86_400_000;
const NOW_MS = Date.parse("2026-05-30T00:00:00Z");

function daysAgo(days) {
  return new Date(NOW_MS - days * MS_PER_DAY).toISOString();
}

function makeEntry(overrides = {}) {
  return {
    id: "notebook-1",
    title: "Watched Notebook",
    watch: true,
    domain: "general",
    last_updated: daysAgo(8),
    ...overrides,
  };
}

function makeFetchStub(status = 200, statusText = String(status)) {
  const calls = [];
  let active = 0;
  let maxActive = 0;

  const fetchFn = async (url, init) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    calls.push({
      url,
      method: init?.method,
      headers: init?.headers,
      body: JSON.parse(init?.body ?? "{}"),
    });
    await Promise.resolve();
    active -= 1;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
    };
  };

  return {
    fetchFn,
    calls,
    get maxActive() {
      return maxActive;
    },
  };
}

async function withIsolatedEnv(overrides, fn) {
  const saved = {};
  const keys = Object.keys(overrides);
  for (const key of keys) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }

  try {
    await fn();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

async function captureStderr(fn) {
  const originalWrite = process.stderr.write;
  let output = "";
  process.stderr.write = (chunk, encoding, cb) => {
    output += String(chunk);
    if (typeof cb === "function") {
      cb();
    }
    return true;
  };

  try {
    await fn();
    return output;
  } finally {
    process.stderr.write = originalWrite;
  }
}

describe("resolveStaleThreshold", () => {
  it("defaults to 7 when NOTEBOOK_STALE_DAYS is absent", () => {
    assert.equal(resolveStaleThreshold({}), 7);
  });

  it("uses a positive integer NOTEBOOK_STALE_DAYS value", () => {
    assert.equal(resolveStaleThreshold({ NOTEBOOK_STALE_DAYS: "14" }), 14);
  });

  for (const value of ["0", "-1", "abc", "14abc"]) {
    it(`falls back to 7 for ${value}`, () => {
      assert.equal(resolveStaleThreshold({ NOTEBOOK_STALE_DAYS: value }), 7);
    });
  }
});

describe("checkStaleNotebooks", () => {
  it("includes stale watch-true entries and excludes fresh, watch-false, null, future, and invalid timestamps", () => {
    const stale = makeEntry({ id: "stale", last_updated: daysAgo(10) });
    const entries = [
      makeEntry({ id: "fresh", last_updated: daysAgo(1) }),
      stale,
      makeEntry({ id: "unwatched", watch: false, last_updated: daysAgo(10) }),
      makeEntry({ id: "null-date", last_updated: null }),
      makeEntry({ id: "future", last_updated: new Date(NOW_MS + MS_PER_DAY).toISOString() }),
      makeEntry({ id: "invalid", last_updated: "not-a-date" }),
      makeEntry({ id: "non-iso", last_updated: "May 20, 2026" }),
    ];

    assert.deepEqual(checkStaleNotebooks(entries, 7, NOW_MS), [
      { entry: stale, daysStale: 10 },
    ]);
  });

  it("respects a custom staleDays threshold and includes entries exactly at the threshold", () => {
    const exact = makeEntry({ id: "exact", last_updated: daysAgo(3) });
    const tooFresh = makeEntry({ id: "too-fresh", last_updated: daysAgo(2) });

    assert.deepEqual(checkStaleNotebooks([exact, tooFresh], 3, NOW_MS), [
      { entry: exact, daysStale: 3 },
    ]);
  });
});

describe("buildStaleAlertMessage", () => {
  it("formats a 1-day stale alert exactly", () => {
    assert.equal(
      buildStaleAlertMessage(makeEntry({ title: "Title", last_updated: daysAgo(1) }), NOW_MS),
      "⚠️ Notebook stale: **Title** — last updated 1 days ago",
    );
  });

  it("formats a 7-day stale alert exactly", () => {
    assert.equal(
      buildStaleAlertMessage(makeEntry({ title: "Title", last_updated: daysAgo(7) }), NOW_MS),
      "⚠️ Notebook stale: **Title** — last updated 7 days ago",
    );
  });
});

describe("alertStaleNotebooks", () => {
  it("skips Discord posts when stale notebooks exist but Discord is not configured", async () => {
    await withIsolatedEnv(
      {
        HERMES_DISCORD_TOKEN: undefined,
        DISCORD_BOT_TOKEN: undefined,
        CNS_DISCORD_HERMES_CHANNEL_ID: undefined,
      },
      async () => {
        const { fetchFn, calls } = makeFetchStub();
        const stderr = await captureStderr(async () => {
          await alertStaleNotebooks([makeEntry()], {
            env: process.env,
            fetchFn,
            nowMs: NOW_MS,
          });
        });

        assert.equal(calls.length, 0);
        assert.equal(
          stderr,
          "[stale-alerts] Discord not configured — skipping alert posts\n",
        );
      },
    );
  });

  it("does not warn or post when there are no stale notebooks", async () => {
    const { fetchFn, calls } = makeFetchStub();
    const stderr = await captureStderr(async () => {
      await alertStaleNotebooks([makeEntry({ last_updated: daysAgo(1) })], {
        env: {
          HERMES_DISCORD_TOKEN: "token",
          CNS_DISCORD_HERMES_CHANNEL_ID: "channel",
        },
        fetchFn,
        nowMs: NOW_MS,
      });
    });

    assert.equal(calls.length, 0);
    assert.equal(stderr, "");
  });

  it("posts the expected content per stale notebook sequentially", async () => {
    const stub = makeFetchStub();
    const entries = [
      makeEntry({ id: "a", title: "Alpha", last_updated: daysAgo(8) }),
      makeEntry({ id: "b", title: "Beta", last_updated: daysAgo(9) }),
    ];

    await alertStaleNotebooks(entries, {
      env: {
        DISCORD_BOT_TOKEN: "fallback-token",
        CNS_DISCORD_HERMES_CHANNEL_ID: "channel-123",
      },
      fetchFn: stub.fetchFn,
      nowMs: NOW_MS,
    });

    assert.equal(stub.calls.length, 2);
    assert.equal(stub.maxActive, 1);
    assert.deepEqual(
      stub.calls.map((call) => call.body.content),
      [
        "⚠️ Notebook stale: **Alpha** — last updated 8 days ago",
        "⚠️ Notebook stale: **Beta** — last updated 9 days ago",
      ],
    );
    assert.deepEqual(
      stub.calls.map((call) => call.url),
      [
        "https://discord.com/api/v10/channels/channel-123/messages",
        "https://discord.com/api/v10/channels/channel-123/messages",
      ],
    );
    assert.deepEqual(stub.calls[0].headers, {
      Authorization: "Bot fallback-token",
      "Content-Type": "application/json",
    });
    assert.equal(stub.calls[0].method, "POST");
  });

  it("prefers HERMES_DISCORD_TOKEN over DISCORD_BOT_TOKEN", async () => {
    const stub = makeFetchStub();

    await alertStaleNotebooks([makeEntry()], {
      env: {
        HERMES_DISCORD_TOKEN: "primary-token",
        DISCORD_BOT_TOKEN: "fallback-token",
        CNS_DISCORD_HERMES_CHANNEL_ID: "channel-123",
      },
      fetchFn: stub.fetchFn,
      nowMs: NOW_MS,
    });

    assert.equal(stub.calls[0].headers.Authorization, "Bot primary-token");
  });

  it("trims Discord token and channel values before posting", async () => {
    const stub = makeFetchStub();

    await alertStaleNotebooks([makeEntry()], {
      env: {
        HERMES_DISCORD_TOKEN: " primary-token \n",
        CNS_DISCORD_HERMES_CHANNEL_ID: " channel-123 \n",
      },
      fetchFn: stub.fetchFn,
      nowMs: NOW_MS,
    });

    assert.equal(stub.calls[0].headers.Authorization, "Bot primary-token");
    assert.equal(
      stub.calls[0].url,
      "https://discord.com/api/v10/channels/channel-123/messages",
    );
  });

  it("logs failed HTTP responses to stderr and resolves without changing exitCode", async () => {
    const stub = makeFetchStub(400, "Bad Request");
    const priorExitCode = process.exitCode;

    const stderr = await captureStderr(async () => {
      await alertStaleNotebooks([makeEntry()], {
        env: {
          HERMES_DISCORD_TOKEN: "token",
          CNS_DISCORD_HERMES_CHANNEL_ID: "channel-123",
        },
        fetchFn: stub.fetchFn,
        nowMs: NOW_MS,
      });
    });

    assert.equal(process.exitCode, priorExitCode);
    assert.equal(stderr, "[stale-alerts] Discord post failed: 400 Bad Request\n");
  });

  it("aborts a stalled Discord request and resolves", async () => {
    let receivedSignal;
    const fetchFn = (_url, init) =>
      new Promise((_resolve, reject) => {
        receivedSignal = init?.signal;
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });

    const stderr = await captureStderr(async () => {
      await alertStaleNotebooks([makeEntry()], {
        env: {
          HERMES_DISCORD_TOKEN: "token",
          CNS_DISCORD_HERMES_CHANNEL_ID: "channel-123",
        },
        fetchFn,
        nowMs: NOW_MS,
        postTimeoutMs: 1,
      });
    });

    assert.equal(receivedSignal?.aborted, true);
    assert.equal(stderr, "[stale-alerts] Discord post error: aborted\n");
  });
});
