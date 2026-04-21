import { afterEach, describe, expect, it, vi } from "vitest";
import { createPerplexitySlot } from "../../src/agents/perplexity-slot.js";
import { CnsError } from "../../src/errors.js";

function getRequestBody(fetchMock: ReturnType<typeof vi.fn>): {
  model: string;
  messages: Array<{ role: string; content: string }>;
} {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string) as {
    model: string;
    messages: Array<{ role: string; content: string }>;
  };
}

describe("createPerplexitySlot", () => {
  const originalApiKey = process.env.PERPLEXITY_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.PERPLEXITY_API_KEY;
    else process.env.PERPLEXITY_API_KEY = originalApiKey;
  });

  it("available: false when PERPLEXITY_API_KEY not set", () => {
    delete process.env.PERPLEXITY_API_KEY;
    const slot = createPerplexitySlot();
    expect(slot.available).toBe(false);
  });

  it("available: true when PERPLEXITY_API_KEY is set", () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    const slot = createPerplexitySlot();
    expect(slot.available).toBe(true);
  });

  it("search() when available is false throws UNSUPPORTED with exact message", async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const slot = createPerplexitySlot();
    await expect(slot.search("hello")).rejects.toMatchObject({
      name: "CnsError",
      code: "UNSUPPORTED",
      message: "Perplexity not configured — PERPLEXITY_API_KEY missing",
    });
  });

  it("happy path: returns answer + citations and calls correct URL/method/headers/body", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "an answer" } }],
          citations: ["https://example.com/a", "https://example.com/b"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const slot = createPerplexitySlot();
    const result = await slot.search("what is perplexity?");

    expect(result).toEqual({
      answer: "an answer",
      citations: ["https://example.com/a", "https://example.com/b"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.perplexity.ai/chat/completions");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-api-key-xxxx");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = getRequestBody(fetchMock);
    expect(body.model).toBe("sonar");
    expect(body.messages).toEqual([{ role: "user", content: "what is perplexity?" }]);
  });

  it("non-2xx response throws IO_ERROR with status in message", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "bad key" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const slot = createPerplexitySlot();
    const err = await slot.search("hello").catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    expect((err as CnsError).message).toBe("Perplexity API HTTP 401");
  });

  it("fetch rejects throws IO_ERROR", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const slot = createPerplexitySlot();
    const err = await slot.search("hello").catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    expect((err as CnsError).message).toBe("Perplexity fetch failed: network down");
  });

  it("response not valid JSON throws IO_ERROR with exact message", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const slot = createPerplexitySlot();
    const err = await slot.search("hello").catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    expect((err as CnsError).message).toBe(
      "Perplexity response was not valid JSON",
    );
  });
});

