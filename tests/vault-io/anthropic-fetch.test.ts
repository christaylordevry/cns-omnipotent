import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "../../src/agents/anthropic-fetch.js";
import { CnsError } from "../../src/errors.js";

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns response immediately on 2xx without sleeping", async () => {
    const ok = new Response("ok", { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithRetry("https://x", { method: "POST" }, {
      adapterLabel: "synthesis",
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on non-429 non-2xx (e.g., 401) without retry", async () => {
    const bad = new Response("denied", { status: 401 });
    const fetchMock = vi.fn().mockResolvedValue(bad);
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithRetry("https://x", { method: "POST" }, {
      adapterLabel: "hook",
    });
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("parses retry_after from JSON body (error.retry_after)", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { retry_after: 42 } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://x", { method: "POST" }, {
      adapterLabel: "synthesis",
    });
    await vi.advanceTimersByTimeAsync(42_000);
    const res = await promise;
    expect(res.status).toBe(200);

    const sleepCall = setTimeoutSpy.mock.calls.find(
      (c) => typeof c[1] === "number" && c[1] >= 5_000,
    );
    expect(sleepCall![1]).toBe(42_000);
  });

  it("falls back to Retry-After header when body has no retry_after", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "slow down" } }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "33",
          },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://x", { method: "POST" }, {
      adapterLabel: "hook",
    });
    await vi.advanceTimersByTimeAsync(33_000);
    const res = await promise;
    expect(res.status).toBe(200);

    const sleepCall = setTimeoutSpy.mock.calls.find(
      (c) => typeof c[1] === "number" && c[1] >= 5_000,
    );
    expect(sleepCall![1]).toBe(33_000);
  });

  it("defaults to 5s when neither body retry_after nor Retry-After header present", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("not json at all", { status: 429 }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://x", { method: "POST" }, {
      adapterLabel: "weapons check",
    });
    await vi.advanceTimersByTimeAsync(5_000);
    const res = await promise;
    expect(res.status).toBe(200);

    const sleepCall = setTimeoutSpy.mock.calls.find(
      (c) => typeof c[1] === "number" && c[1] >= 5_000,
    );
    expect(sleepCall![1]).toBe(5_000);
  });

  it("clamps retry_after below 5s up to 5s", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { retry_after: 1 } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://x", { method: "POST" }, {
      adapterLabel: "synthesis",
    });
    await vi.advanceTimersByTimeAsync(5_000);
    const res = await promise;
    expect(res.status).toBe(200);

    const sleepCall = setTimeoutSpy.mock.calls.find(
      (c) => typeof c[1] === "number",
    );
    expect(sleepCall![1]).toBe(5_000);
  });

  it("clamps retry_after above 120s down to 120s", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { retry_after: 9999 } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://x", { method: "POST" }, {
      adapterLabel: "hook",
    });
    await vi.advanceTimersByTimeAsync(120_000);
    const res = await promise;
    expect(res.status).toBe(200);

    const sleepCall = setTimeoutSpy.mock.calls.find(
      (c) => typeof c[1] === "number",
    );
    expect(sleepCall![1]).toBe(120_000);
  });

  it("throws CnsError('IO_ERROR') with an exact exhausted message after 3 consecutive 429s", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { retry_after: 5 } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry(
      "https://x",
      { method: "POST" },
      {
        adapterLabel: "synthesis",
        exhaustedMessage: "Synthesis API rate limited after 3 attempts",
      },
    ).catch((e) => e);

    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(5_000);

    const err = (await promise) as CnsError;
    expect(err).toBeInstanceOf(CnsError);
    expect(err.code).toBe("IO_ERROR");
    expect(err.message).toBe(
      "Synthesis API rate limited after 3 attempts",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("propagates fetch() exception without retry (network error)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWithRetry("https://x", { method: "POST" }, { adapterLabel: "hook" }),
    ).rejects.toThrow("network down");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
