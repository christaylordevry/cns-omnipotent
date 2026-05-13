import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { registerVaultIoTools } from "../../src/register-vault-io-tools.js";
import {
  DEFAULT_DISAMBIGUATION_POLL_MS,
  DEFAULT_DISAMBIGUATION_TIMEOUT_MS,
  formatDisambiguationDiscordMessage,
  parseOperatorChoice,
  selectEarliestHumanChoice,
  vaultRequestDisambiguation,
  vaultRequestDisambiguationInputSchema,
} from "../../src/tools/vault-request-disambiguation.js";

describe("vaultRequestDisambiguationInputSchema", () => {
  it("accepts two candidates", () => {
    const r = vaultRequestDisambiguationInputSchema.safeParse({
      question: "Where?",
      candidates: ["01-Projects/X", "02-Areas/Y"],
    });
    expect(r.success).toBe(true);
  });

  it("accepts three candidates with optional context", () => {
    const r = vaultRequestDisambiguationInputSchema.safeParse({
      question: "Which note?",
      candidates: ["a.md", "b.md", "c.md"],
      context: "User said 'the spec file'.",
    });
    expect(r.success).toBe(true);
  });

  it("rejects fewer than two candidates", () => {
    const r = vaultRequestDisambiguationInputSchema.safeParse({
      question: "Only one",
      candidates: ["only"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects more than three candidates", () => {
    const r = vaultRequestDisambiguationInputSchema.safeParse({
      question: "Too many",
      candidates: ["a", "b", "c", "d"],
    });
    expect(r.success).toBe(false);
  });
});

describe("formatDisambiguationDiscordMessage", () => {
  it("formats two candidates with reply hint for 1 or 2", () => {
    const text = formatDisambiguationDiscordMessage({
      question: "Pick folder",
      candidates: ["Projects", "Areas"],
    });
    expect(text).toContain("❓ Disambiguation needed:");
    expect(text).toContain("Pick folder");
    expect(text).toContain("1. Projects");
    expect(text).toContain("2. Areas");
    expect(text).toContain("Reply with 1 or 2.");
    expect(text).not.toContain("3.");
  });

  it("formats three candidates with reply hint for 1, 2, or 3", () => {
    const text = formatDisambiguationDiscordMessage({
      question: "Which?",
      candidates: ["A", "B", "C"],
    });
    expect(text).toContain("3. C");
    expect(text).toContain("Reply with 1, 2, or 3.");
  });

  it("includes context block when provided", () => {
    const text = formatDisambiguationDiscordMessage({
      question: "Route?",
      candidates: ["X", "Y"],
      context: "PAKE type unclear.",
    });
    expect(text).toContain("PAKE type unclear.");
  });
});

describe("parseOperatorChoice", () => {
  it("parses exact digit", () => {
    expect(parseOperatorChoice("2", 3)).toBe(1);
    expect(parseOperatorChoice("3", 3)).toBe(2);
  });

  it("respects candidateCount for two-option polls", () => {
    expect(parseOperatorChoice("2", 2)).toBe(1);
    expect(parseOperatorChoice("3", 2)).toBe(null);
  });
});

describe("selectEarliestHumanChoice", () => {
  it("returns earliest valid human choice after anchor", () => {
    const idx = selectEarliestHumanChoice(
      [
        { id: "12", content: "noise", author: { id: "u1", bot: false } },
        { id: "15", content: "2", author: { id: "u2", bot: false } },
        { id: "20", content: "3", author: { id: "u3", bot: false } },
      ],
      "bot",
      3,
      "10",
    );
    expect(idx).toBe(1);
  });

  it("skips bots and the posting bot", () => {
    const idx = selectEarliestHumanChoice(
      [
        { id: "12", content: "1", author: { id: "bot", bot: true } },
        { id: "13", content: "2", author: { id: "human", bot: false } },
      ],
      "bot",
      2,
      "10",
    );
    expect(idx).toBe(1);
  });
});

describe("vaultRequestDisambiguation (mocked Discord)", () => {
  it("returns operator choice when a human replies", async () => {
    const postJson = { id: "100", content: "x", author: { id: "bot-id", bot: true } };
    let pollCalls = 0;
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof url === "string" ? url : url.toString();
      const method = init?.method ?? "GET";
      if (method === "POST") {
        return new Response(JSON.stringify(postJson), { status: 200 });
      }
      if (method === "GET" && u.includes("/messages")) {
        pollCalls += 1;
        if (pollCalls === 1) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(
          JSON.stringify([{ id: "101", content: " 2 ", author: { id: "op", bot: false } }]),
          { status: 200 },
        );
      }
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    let now = 0;
    const out = await vaultRequestDisambiguation(
      { question: "Q?", candidates: ["A", "B"] },
      { botToken: "t", channelId: "c" },
      {
        fetchImpl,
        nowMs: () => now,
        sleep: async (ms) => {
          now += ms;
        },
        pollIntervalMs: 100,
        timeoutMs: 10_000,
        apiBase: "https://example.test/api/v10",
      },
    );
    expect(out).toEqual({ choice: "B", choice_index: 1 });
  });

  it("returns timeout after deadline with no valid reply", async () => {
    const postJson = { id: "100", content: "x", author: { id: "bot-id", bot: true } };
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "POST") {
        return new Response(JSON.stringify(postJson), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;

    let now = 0;
    const out = await vaultRequestDisambiguation(
      { question: "Q?", candidates: ["A", "B"] },
      { botToken: "t", channelId: "c" },
      {
        fetchImpl,
        nowMs: () => now,
        sleep: async (ms) => {
          now += ms;
        },
        pollIntervalMs: DEFAULT_DISAMBIGUATION_POLL_MS,
        timeoutMs: DEFAULT_DISAMBIGUATION_TIMEOUT_MS,
        apiBase: "https://example.test/api/v10",
      },
    );
    expect(out).toEqual({ timeout: true });
  });
});

describe("vault_request_disambiguation MCP handler", () => {
  it("returns IO_ERROR JSON when Discord env is missing", async () => {
    const server = new McpServer({ name: "cns-disamb", version: "0.0.0" });
    const { vault_request_disambiguation } = registerVaultIoTools(server, {
      vaultRoot: "/tmp/vault",
    });
    const res = await vault_request_disambiguation.handler(
      {
        question: "Q",
        candidates: ["a", "b"],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    );
    expect(res).toBeDefined();
    expect(res.isError).toBe(true);
    const body = JSON.parse(res.content[0].text as string);
    expect(body.code).toBe("IO_ERROR");
    expect(body.message).toMatch(/not configured/i);
  });
});
