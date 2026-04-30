import { CnsError } from "../errors.js";
import {
  buildPerplexityMcpAdapter,
  commandAvailable,
} from "../adapters/perplexity-mcp-adapter.js";

export type PerplexityResult = {
  answer: string;
  citations: string[];
};

export type PerplexitySlot = {
  available: boolean;
  search(query: string): Promise<PerplexityResult>;
};

function parseJsonStringArray(raw: string | undefined): { value?: string[]; error?: string } {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return {};
  if (!trimmed.startsWith("[")) {
    return { error: "must be a JSON array of strings (e.g. [\"-y\",\"perplexity-mcp\"])." };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      return { error: "must be a JSON array of strings." };
    }
    return { value: parsed };
  } catch {
    return { error: "must be valid JSON (array of strings)." };
  }
}

function containsWhitespace(value: string): boolean {
  return /\s/.test(value);
}

export function createPerplexitySlot(): PerplexitySlot {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim() ?? "";
  const command = process.env.PERPLEXITY_MCP_COMMAND?.trim() || "npx";
  const argsParsed = parseJsonStringArray(process.env.PERPLEXITY_MCP_ARGS);
  const args = argsParsed.value ?? ["-y", "perplexity-mcp"];
  const toolName = process.env.PERPLEXITY_MCP_TOOL?.trim() || "search";
  const timeoutMsRaw = process.env.PERPLEXITY_MCP_TIMEOUT_MS?.trim();
  const timeoutMs =
    timeoutMsRaw !== undefined && timeoutMsRaw.length > 0 && Number.isFinite(Number(timeoutMsRaw))
      ? Math.max(1000, Number(timeoutMsRaw))
      : 20_000;

  const commandOk = command.length > 0 && !containsWhitespace(command) && commandAvailable(command);
  const argsOk = argsParsed.error === undefined;
  const available = apiKey.length > 0 && commandOk && argsOk;

  const adapter = buildPerplexityMcpAdapter({ command, args, toolName, timeoutMs });
  return {
    available,
    async search(query: string): Promise<PerplexityResult> {
      if (!available) {
        if (apiKey.length === 0) {
          throw new CnsError(
            "UNSUPPORTED",
            "Perplexity not configured — PERPLEXITY_API_KEY missing",
          );
        }
        if (!argsOk) {
          throw new CnsError(
            "UNSUPPORTED",
            `Perplexity MCP not configured — PERPLEXITY_MCP_ARGS ${argsParsed.error}`,
          );
        }
        if (containsWhitespace(command)) {
          throw new CnsError(
            "UNSUPPORTED",
            "Perplexity MCP not configured — PERPLEXITY_MCP_COMMAND must be a single executable name (no spaces). Use PERPLEXITY_MCP_ARGS for flags.",
          );
        }
        throw new CnsError(
          "UNSUPPORTED",
          `Perplexity MCP not configured — command not found on PATH: ${command}`,
        );
      }
      try {
        return await adapter.search(query);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new CnsError("IO_ERROR", `Perplexity MCP failed: ${msg}`);
      }
    },
  };
}
