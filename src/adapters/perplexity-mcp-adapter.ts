import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { PerplexityResult } from "../agents/perplexity-slot.js";

export type PerplexityMcpAdapterOptions = {
  command?: string;
  args?: string[];
  toolName?: string;
  timeoutMs?: number;
};

type ToolCallResult = Awaited<ReturnType<Client["callTool"]>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(t);
        resolve(value);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
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

function parseJsonIfPossible(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function parsePerplexityToolResult(result: ToolCallResult): PerplexityResult {
  const structured =
    "structuredContent" in result && isRecord(result.structuredContent)
      ? result.structuredContent
      : undefined;
  const toolResult =
    "toolResult" in result && isRecord(result.toolResult) ? result.toolResult : undefined;
  const payload = structured ?? toolResult;

  const payloadAnswer =
    typeof payload?.answer === "string"
      ? payload.answer
      : typeof payload?.content === "string"
        ? payload.content
        : undefined;

  const citations =
    Array.isArray(payload?.citations) ? asStringArray(payload?.citations) : [];

  const fallbackText = textFromContentBlocks(result);
  const candidateText = (payloadAnswer ?? fallbackText ?? "").trim();
  const jsonCandidate = parseJsonIfPossible(candidateText);
  if (isRecord(jsonCandidate)) {
    const answer = typeof jsonCandidate.answer === "string" ? jsonCandidate.answer : "";
    const jsonCitations = asStringArray(jsonCandidate.citations);
    return {
      answer,
      citations: jsonCitations.length > 0 ? jsonCitations : citations,
    };
  }

  return { answer: candidateText, citations };
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function commandAvailable(command: string): boolean {
  const trimmed = command.trim();
  if (trimmed.length === 0) return false;
  const result = spawnSync(
    "sh",
    ["-lc", `command -v -- ${shellSingleQuote(trimmed)} >/dev/null 2>&1`],
    { stdio: "ignore" },
  );
  return result.status === 0;
}

export type PerplexityMcpAdapter = {
  search(query: string): Promise<PerplexityResult>;
};

export function buildPerplexityMcpAdapter(
  options: PerplexityMcpAdapterOptions = {},
): PerplexityMcpAdapter {
  const command = options.command ?? "npx";
  const args = options.args ?? ["-y", "perplexity-mcp"];
  const toolName = options.toolName ?? "search";
  const timeoutMs = options.timeoutMs ?? 20_000;

  return {
    async search(query: string): Promise<PerplexityResult> {
      const transport = new StdioClientTransport({
        command,
        args,
        stderr: "pipe",
      });
      const client = new Client({ name: "cns-perplexity-adapter", version: "0.0.0" });
      try {
        await withTimeout(client.connect(transport), timeoutMs, "Perplexity MCP connect");
        const result = await withTimeout(
          client.callTool({
          name: toolName,
          arguments: { query },
          }),
          timeoutMs,
          "Perplexity MCP callTool",
        );

        if ("isError" in result && result.isError === true) {
          const summary = compactFailure(textFromContentBlocks(result) ?? "tool returned error");
          throw new Error(summary);
        }

        return parsePerplexityToolResult(result);
      } catch (err) {
        const summary = compactFailure(errorMessage(err));
        throw new Error(summary, { cause: err });
      } finally {
        await withTimeout(client.close().catch(() => undefined), timeoutMs, "Perplexity MCP close")
          .catch(() => undefined);
      }
    },
  };
}

