import assert from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  evaluateTodayDigestRuns,
  fetchRecentDigestRuns,
  formatTodayLocalDate,
  formatWatchdogLogLine,
  runPushDigestWatchdog,
} from "../scripts/push-digest-watchdog.mjs";
import { writeDigestPushArtifact } from "../scripts/hermes-skill-examples/morning-digest/scripts/write-digest-push-artifact.mjs";

/**
 * @param {unknown} body
 * @param {number} status
 */
function mockFetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe("Story 67-10 push-digest-watchdog", () => {
  it("formatTodayLocalDate uses CRON_TZ civil date (en-CA)", () => {
    const date = formatTodayLocalDate("Australia/Sydney", new Date("2026-06-10T20:00:00.000Z"));
    assert.equal(date, "2026-06-11");
  });

  it("formatTodayLocalDate defaults to Australia/Sydney when env tz absent", () => {
    const date = formatTodayLocalDate(undefined, new Date("2026-06-10T20:00:00.000Z"));
    assert.equal(date, "2026-06-11");
  });

  it("evaluateTodayDigestRuns detects non-failed today row among recent runs", () => {
    const result = evaluateTodayDigestRuns(
      [
        { date: "2026-06-10", status: "published", ranAt: 1 },
        { date: "2026-06-11", status: "published", ranAt: 2 },
      ],
      "2026-06-11",
    );
    assert.equal(result.hasNonFailedToday, true);
  });

  it("evaluateTodayDigestRuns treats failed-only today as recovery candidate", () => {
    const result = evaluateTodayDigestRuns(
      [{ date: "2026-06-11", status: "failed", ranAt: 2 }],
      "2026-06-11",
    );
    assert.equal(result.hasNonFailedToday, false);
    assert.equal(result.todayFailedOnly, true);
  });

  it("skip path: today published row → no push spawn, exit 0", async () => {
    const logLines = [];
    let spawnCalled = false;

    const result = await runPushDigestWatchdog({
      env: {
        HOME: "/tmp/op",
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: async () =>
        mockFetchResponse({
          status: "success",
          value: [{ date: "2026-06-11", status: "published" }],
        }),
      spawnFn: async () => {
        spawnCalled = true;
        return { exitCode: 0 };
      },
      appendFileFn: async (_path, line) => {
        logLines.push(line);
      },
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "skipped-already-pushed");
    assert.equal(result.exitCode, 0);
    assert.equal(spawnCalled, false);
    assert.ok(logLines.some((line) => line.includes("action=skipped-already-pushed")));
  });

  it("recover path: no today row + artifact → push spawn with DIGEST_PUSH_JSON", async () => {
    const artifact = {
      run: { date: "2026-06-11", ranAt: 1749000000000 },
      signals: [{ title: "Signal A", sourceType: "hackernews", section: "HackerNews" }],
    };
    const artifactJson = JSON.stringify(artifact);
    let spawnEnv;
    let spawnArgs;

    const result = await runPushDigestWatchdog({
      env: {
        HOME: "/tmp/op",
        OMNIPOTENT_REPO: "/repo",
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: async () =>
        mockFetchResponse({ status: "success", value: [] }),
      readFileFn: async () => artifactJson,
      spawnFn: async (_cmd, args, opts) => {
        spawnArgs = args;
        spawnEnv = opts.env;
        return { exitCode: 0 };
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "recovered-push");
    assert.equal(result.exitCode, 0);
    assert.ok(Array.isArray(spawnArgs));
    assert.ok(spawnArgs[0]?.endsWith("push-digest-convex.mjs"));
    assert.equal(spawnEnv?.DIGEST_PUSH_JSON, artifactJson);
  });

  it("failed-today triggers recovery when artifact present", async () => {
    const artifact = {
      run: { date: "2026-06-11" },
      signals: [{ title: "Retry", sourceType: "google_trends", section: "Trending Now" }],
    };
    let spawnCalled = false;

    const result = await runPushDigestWatchdog({
      env: {
        HOME: "/tmp/op",
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: async () =>
        mockFetchResponse({
          status: "success",
          value: [{ date: "2026-06-11", status: "failed" }],
        }),
      readFileFn: async () => JSON.stringify(artifact),
      spawnFn: async () => {
        spawnCalled = true;
        return { exitCode: 0 };
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "recovered-push");
    assert.equal(spawnCalled, true);
  });

  it("skipped-no-artifact when Convex empty and file missing", async () => {
    const result = await runPushDigestWatchdog({
      env: {
        HOME: "/tmp/op",
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: async () =>
        mockFetchResponse({ status: "success", value: [] }),
      readFileFn: async () => {
        throw new Error("ENOENT");
      },
      spawnFn: async () => ({ exitCode: 0 }),
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "skipped-no-artifact");
  });

  it("formatWatchdogLogLine omits secrets and payload body", () => {
    const line = formatWatchdogLogLine("recovered-push", { date: "2026-06-11", exit: 0 });
    assert.ok(line.includes("action=recovered-push"));
    assert.ok(!line.includes("CONVEX_DEPLOY_KEY"));
    assert.ok(!line.includes("signals"));
  });

  it("fetchRecentDigestRuns retries before throwing", async () => {
    let calls = 0;
    await assert.rejects(
      fetchRecentDigestRuns(
        async () => {
          calls += 1;
          throw new Error("Convex HTTP 503");
        },
        { convexUrl: "https://example.convex.cloud", convexDeployKey: "test-key" },
        { maxAttempts: 3, retryDelayMs: 0, sleepFn: async () => {} },
      ),
    );
    assert.equal(calls, 3);
  });

  it("query retries exhausted → fall through to recover push when artifact exists", async () => {
    const artifact = {
      run: { date: "2026-06-11" },
      signals: [{ title: "Retry", sourceType: "google_trends", section: "Trending Now" }],
    };
    let fetchCalls = 0;
    let spawnCalled = false;
    const logLines = [];

    const result = await runPushDigestWatchdog({
      env: {
        HOME: "/tmp/op",
        OMNIPOTENT_REPO: "/repo",
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      queryMaxAttempts: 3,
      queryRetryDelayMs: 0,
      sleepFn: async () => {},
      fetchFn: async () => {
        fetchCalls += 1;
        throw new Error("Convex HTTP 503");
      },
      readFileFn: async () => JSON.stringify(artifact),
      spawnFn: async () => {
        spawnCalled = true;
        return { exitCode: 0 };
      },
      appendFileFn: async (_path, line) => {
        logLines.push(line);
      },
      mkdirFn: async () => {},
    });

    assert.equal(fetchCalls, 3);
    assert.equal(result.action, "recovered-push");
    assert.equal(spawnCalled, true);
    assert.ok(logLines.some((line) => line.includes("detail=query-retries-exhausted")));
  });
});

describe("Story 67-10 write-digest-push-artifact", () => {
  it("writes post-scoring payload to operator home digest-push file", async () => {
    const tempHome = await mkdtemp(join(tmpdir(), "digest-artifact-"));
    try {
      const payload = {
        run: { date: "2026-06-11", ranAt: 1749000000000 },
        signals: [{ title: "Test", sourceType: "hackernews" }],
      };

      const result = await writeDigestPushArtifact({
        HOME: tempHome,
        DIGEST_PUSH_JSON: JSON.stringify(payload),
      });

      assert.equal(result.status, "ok");
      const written = await readFile(join(tempHome, ".hermes", "digest-push-2026-06-11.json"), "utf8");
      const parsed = JSON.parse(written);
      assert.equal(parsed.run.date, "2026-06-11");
      assert.equal(parsed.signals.length, 1);
    } finally {
      await rm(tempHome, { recursive: true, force: true });
    }
  });
});
