/**
 * Scrapling MCP adapter. Starts a local `scrapling mcp` stdio server and calls
 * the StealthyFetcher-backed `stealthy_fetch` tool for Research Agent sweeps.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ScraplingAdapter, ScraplingFetchResult } from "../agents/research-agent.js";

type ScraplingAdapterOptions = {
  args?: string[];
  extractionType?: "markdown" | "html" | "text";
  mainContentOnly?: boolean;
  solveCloudflare?: boolean;
  timeoutMs?: number;
  toolName?: string;
};

type ScraplingResponse = {
  status?: number;
  content?: string;
  url?: string;
  title?: string;
};

type ToolCallResult = Awaited<ReturnType<Client["callTool"]>>;

const DEFAULT_ARGS = ["mcp"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactFailure(message: string): string {
  let out = message;
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  out = out.replace(
    /\b(FIRECRAWL_API_KEY|APIFY_API_TOKEN|PERPLEXITY_API_KEY|ANTHROPIC_API_KEY)\s*[:=]\s*["']?[^"',\s)]+/gi,
    "$1=[REDACTED]",
  );
  out = out.replace(/\bsk-ant-[A-Za-z0-9_-]+/g, "[REDACTED_ANTHROPIC_KEY]");
  out = out.replace(/\bpplx-[A-Za-z0-9_-]+/g, "[REDACTED_PERPLEXITY_KEY]");
  out = out.replace(/\bfc-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_FIRECRAWL_KEY]");
  out = out.replace(
    /([?&](?:api_?key|key|token|auth|authorization|access_token|client_secret)=)[^&\s]+/gi,
    "$1[REDACTED]",
  );
  return out.trim().slice(0, 220);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function textFromContentBlocks(result: ToolCallResult): string | undefined {
  if (!("content" in result) || !Array.isArray(result.content)) return undefined;
  const parts: string[] = [];
  for (const block of result.content) {
    if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
    if (isRecord(block) && block.type === "resource" && isRecord(block.resource)) {
      const text = block.resource.text;
      if (typeof text === "string") parts.push(text);
    }
  }
  const joined = parts.join("\n\n").trim();
  return joined.length > 0 ? joined : undefined;
}

function parseScraplingResponse(result: ToolCallResult, fallbackUrl: string): ScraplingResponse {
  const structured =
    "structuredContent" in result && isRecord(result.structuredContent)
      ? result.structuredContent
      : undefined;
  const toolResult =
    "toolResult" in result && isRecord(result.toolResult) ? result.toolResult : undefined;
  const payload = structured ?? toolResult;

  const status = typeof payload?.status === "number" ? payload.status : undefined;
  const content =
    typeof payload?.content === "string" ? payload.content : textFromContentBlocks(result);
  const url = typeof payload?.url === "string" && payload.url.trim().length > 0
    ? payload.url
    : fallbackUrl;
  const title = typeof payload?.title === "string" ? payload.title : undefined;
  return { status, content, url, title };
}

export function buildScraplingAdapter(
  command: string,
  recordServiceError: (error: string) => void,
  options: ScraplingAdapterOptions = {},
): ScraplingAdapter {
  const args = options.args ?? DEFAULT_ARGS;
  const toolName = options.toolName ?? "stealthy_fetch";
  const extractionType = options.extractionType ?? "markdown";
  const mainContentOnly = options.mainContentOnly ?? true;
  const solveCloudflare = options.solveCloudflare ?? true;
  const timeoutMs = options.timeoutMs ?? 30_000;

  return {
    async stealthyFetch(
      query: string,
      opts: { limit: number },
    ): Promise<ScraplingFetchResult[]> {
      if (opts.limit <= 0) return [];

      const transport = new StdioClientTransport({
        command,
        args,
        stderr: "pipe",
      });
      const client = new Client({ name: "cns-scrapling-adapter", version: "0.0.0" });

      try {
        await client.connect(transport);
        const result = await client.callTool({
          name: toolName,
          arguments: {
            url: query,
            extraction_type: extractionType,
            main_content_only: mainContentOnly,
            headless: true,
            solve_cloudflare: solveCloudflare,
            timeout: timeoutMs,
          },
        });

        if ("isError" in result && result.isError === true) {
          const summary = compactFailure(textFromContentBlocks(result) ?? "tool returned error");
          throw new Error(`Scrapling ${toolName} failed: ${summary}`);
        }

        const parsed = parseScraplingResponse(result, query);
        if (parsed.status !== undefined && parsed.status >= 400) {
          throw new Error(`Scrapling ${toolName} HTTP ${parsed.status}`);
        }

        return [
          {
            url: parsed.url,
            title: parsed.title,
            text: parsed.content ?? "",
          },
        ];
      } catch (err) {
        const summary = compactFailure(`Scrapling ${toolName} failed: ${errorMessage(err)}`);
        recordServiceError(summary);
        throw new Error(summary, { cause: err });
      } finally {
        await client.close().catch(() => undefined);
      }
    },
  };
}
