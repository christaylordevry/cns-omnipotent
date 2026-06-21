import assert from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
import { resolveDayOutcomeFilePath } from "../scripts/lib/digest-run-outcome.mjs";
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

  it("evaluateTodayDigestRuns does not treat started as terminal success (Story 71-1)", () => {
    const result = evaluateTodayDigestRuns(
      [{ date: "2026-06-11", status: "started", ranAt: 2 }],
      "2026-06-11",
    );
    assert.equal(result.hasNonFailedToday, false);
    assert.equal(result.todayConvexStatus, "started");
  });

  it("started Convex row defers to full pipeline instead of skipped-already-pushed", async () => {
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
          value: [{ date: "2026-06-11", status: "started" }],
        }),
      readFileFn: async () => {
        throw new Error("ENOENT");
      },
      spawnFn: async () => {
        spawnCalled = true;
        return { exitCode: 0 };
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "skipped-no-artifact");
    assert.equal(spawnCalled, false);
  });

  it("terminal log completion-backfill-push early-exits even when Convex row is started", async () => {
    const logContent = [
      "2026-06-11T00:00:00.000Z action=started date=2026-06-11 exit=0",
      "2026-06-11T01:00:00.000Z action=completion-backfill-push date=2026-06-11 exit=0",
    ].join("\n");
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
          value: [{ date: "2026-06-11", status: "started" }],
        }),
      readFileFn: async (path) => {
        if (String(path).endsWith("push-digest-watchdog.log")) {
          return logContent;
        }
        throw new Error("ENOENT");
      },
      spawnFn: async () => {
        spawnCalled = true;
        return { exitCode: 0 };
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "skipped-already-pushed");
    assert.equal(spawnCalled, false);
  });

  it("mutation push failure defers to full pipeline instead of artifact-only recovery", async () => {
    const artifact = {
      run: { date: "2026-06-11" },
      signals: [{ title: "Retry", sourceType: "google_trends", section: "Trending Now" }],
    };
    const logContent = [
      `2026-06-11T01:00:00.000Z action=completion-convex-push-failed date=2026-06-11 exit=0 detail=${JSON.stringify({ error: "Convex HTTP 500", signalsWritten: 0 })}`,
    ].join("\n");
    let spawnCalled = false;

    const result = await runPushDigestWatchdog({
      env: {
        HOME: "/tmp/op",
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: async () =>
        mockFetchResponse({ status: "success", value: [] }),
      readFileFn: async (path) => {
        if (String(path).endsWith("push-digest-watchdog.log")) {
          return logContent;
        }
        return JSON.stringify(artifact);
      },
      spawnFn: async () => {
        spawnCalled = true;
        return { exitCode: 0 };
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "skipped-no-artifact");
    assert.equal(spawnCalled, false);
  });

  it("missing-convex-env push failure defers push-only repair to orchestrator", async () => {
    const artifact = {
      run: { date: "2026-06-11" },
      signals: [{ title: "Retry", sourceType: "google_trends", section: "Trending Now" }],
    };
    const logContent = [
      `2026-06-11T01:00:00.000Z action=completion-convex-push-failed date=2026-06-11 exit=0 detail=${JSON.stringify({ error: "missing-convex-env", signalsWritten: 0 })}`,
    ].join("\n");
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
          value: [{ date: "2026-06-11", status: "started" }],
        }),
      readFileFn: async (path) => {
        if (String(path).endsWith("push-digest-watchdog.log")) {
          return logContent;
        }
        return JSON.stringify(artifact);
      },
      spawnFn: async () => {
        spawnCalled = true;
        return { exitCode: 0 };
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "deferred-push-only-artifact");
    assert.equal(spawnCalled, false);
  });

  it("AC2 litmus: Convex published + discord.ok false → deferred-discord-only-repair", async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), "watchdog-litmus-"));
    const outcomePath = resolveDayOutcomeFilePath(operatorHome, "2026-06-11");
    await mkdir(join(operatorHome, ".hermes", "digest-outcomes"), { recursive: true });
    await writeFile(
      outcomePath,
      JSON.stringify({
        date: "2026-06-11",
        convex: { ok: true },
        discord: { ok: false },
        inProgress: null,
      }),
    );

    let spawnCalled = false;
    const result = await runPushDigestWatchdog({
      env: {
        HOME: operatorHome,
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
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "deferred-discord-only-repair");
    assert.notEqual(result.action, "skipped-already-pushed");
    assert.equal(spawnCalled, false);
    await rm(operatorHome, { recursive: true, force: true });
  });

  it("AC2 case A: Convex published + discord.ok true → skipped-already-pushed", async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), "watchdog-case-a-"));
    const outcomePath = resolveDayOutcomeFilePath(operatorHome, "2026-06-11");
    await mkdir(join(operatorHome, ".hermes", "digest-outcomes"), { recursive: true });
    await writeFile(
      outcomePath,
      JSON.stringify({
        date: "2026-06-11",
        convex: { ok: true },
        discord: { ok: true },
        inProgress: null,
      }),
    );

    const result = await runPushDigestWatchdog({
      env: {
        HOME: operatorHome,
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: async () =>
        mockFetchResponse({
          status: "success",
          value: [{ date: "2026-06-11", status: "published" }],
        }),
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "skipped-already-pushed");
    await rm(operatorHome, { recursive: true, force: true });
  });

  it("skip path: today published row without day record → terminal-success skip", async () => {
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

  it("bucket 4 retries on next window while discord.ok false, stops after success", async () => {
    const operatorHome = await mkdtemp(join(tmpdir(), "watchdog-retry-"));
    const outcomePath = resolveDayOutcomeFilePath(operatorHome, "2026-06-11");
    await mkdir(join(operatorHome, ".hermes", "digest-outcomes"), { recursive: true });

    const dayRecord = {
      date: "2026-06-11",
      convex: { ok: true },
      discord: { ok: false },
      inProgress: null,
    };

    const fetchPublished = async () =>
      mockFetchResponse({
        status: "success",
        value: [{ date: "2026-06-11", status: "published" }],
      });

    const first = await runPushDigestWatchdog({
      env: {
        HOME: operatorHome,
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: fetchPublished,
      readFileFn: async (path) => {
        if (String(path) === outcomePath) {
          return JSON.stringify(dayRecord);
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });
    assert.equal(first.action, "deferred-discord-only-repair");

    const second = await runPushDigestWatchdog({
      env: {
        HOME: operatorHome,
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: fetchPublished,
      readFileFn: async (path) => {
        if (String(path) === outcomePath) {
          return JSON.stringify(dayRecord);
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });
    assert.equal(second.action, "deferred-discord-only-repair");

    dayRecord.discord.ok = true;
    const third = await runPushDigestWatchdog({
      env: {
        HOME: operatorHome,
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: fetchPublished,
      readFileFn: async (path) => {
        if (String(path) === outcomePath) {
          return JSON.stringify(dayRecord);
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });
    assert.equal(third.action, "skipped-already-pushed");
    await rm(operatorHome, { recursive: true, force: true });
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
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            ok: true,
            runId: 'digestRuns:recovered',
            signalsWritten: 1,
            error: null,
            pushedPayload: {
              run: { digestRunId: 'digestRuns:recovered', ...artifact.run },
              signals: [
                {
                  ...artifact.signals[0],
                  digestRunId: 'digestRuns:recovered',
                  digestSignalId: 'digestSignals:recovered',
                },
              ],
            },
          }),
        };
      },
      appendFileFn: async () => {},
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "recovered-push");
    assert.equal(result.exitCode, 0);
    assert.ok(Array.isArray(spawnArgs));
    assert.ok(spawnArgs[0]?.endsWith("push-digest-convex.mjs"));
    assert.equal(spawnEnv?.DIGEST_PUSH_JSON, artifactJson);
    assert.equal(result.pushResult?.runId, 'digestRuns:recovered');
    assert.equal(
      result.pushResult?.pushedPayload?.signals?.[0]?.digestSignalId,
      'digestSignals:recovered',
    );
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

  it("non-zero push spawn exit logs recovered-push-failed", async () => {
    const artifact = {
      run: { date: "2026-06-11" },
      signals: [{ title: "Retry", sourceType: "google_trends", section: "Trending Now" }],
    };
    /** @type {string[]} */
    const loggedActions = [];

    const result = await runPushDigestWatchdog({
      env: {
        HOME: "/tmp/op",
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "test-key",
      },
      todayDate: "2026-06-11",
      fetchFn: async () =>
        mockFetchResponse({ status: "success", value: [] }),
      readFileFn: async () => JSON.stringify(artifact),
      spawnFn: async () => ({ exitCode: 1 }),
      appendFileFn: async (_path, line) => {
        loggedActions.push(String(line));
      },
      mkdirFn: async () => {},
    });

    assert.equal(result.action, "recovered-push-failed");
    assert.ok(loggedActions.some((line) => line.includes("action=recovered-push-failed")));
    assert.ok(loggedActions.some((line) => line.includes("exit=1")));
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
