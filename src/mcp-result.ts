import path from "node:path";
import { CnsError } from "./errors.js";

/** Placeholder for absolute vault-root substrings removed from MCP JSON (Story 6.4). */
const VAULT_ABS_REDACTED = "[vault-root]";

export type McpJsonSerializeOptions = {
  /** When set, absolute paths under this root are redacted from serialized `message` / `details`. */
  mcpVaultRoot?: string | undefined;
};

function escapeRegExpChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactionPrefixesForVaultRoot(vaultRoot: string): string[] {
  const trimmed = vaultRoot.trim();
  if (trimmed.length === 0) return [];
  const resolved = path.resolve(trimmed);
  const normalized = path.normalize(trimmed);
  return [...new Set([resolved, normalized].filter((p) => p.length > 0))].sort((a, b) => b.length - a.length);
}

function redactPrefixesInString(s: string, prefixes: string[]): string {
  let out = s;
  for (const p of prefixes) {
    out = out.replace(new RegExp(escapeRegExpChars(p), "g"), VAULT_ABS_REDACTED);
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function sanitizeJsonValue(value: unknown, prefixes: string[]): unknown {
  if (typeof value === "string") {
    return redactPrefixesInString(value, prefixes);
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeJsonValue(v, prefixes));
  }
  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      next[k] = sanitizeJsonValue(v, prefixes);
    }
    return next;
  }
  return value;
}

function sanitizeCnsErrorForMcp(err: CnsError, prefixes: string[]): CnsError {
  const message = redactPrefixesInString(err.message, prefixes);
  const details =
    err.details && Object.keys(err.details).length > 0
      ? (sanitizeJsonValue(err.details, prefixes) as Record<string, unknown>)
      : undefined;
  return new CnsError(err.code, message, details);
}

/**
 * MCP CallToolResult for domain errors (stable JSON for agents per architecture).
 * Optional {@link McpJsonSerializeOptions.mcpVaultRoot} strips absolute vault-root prefixes from the payload (AC: no host layout leakage).
 */
export function callToolErrorFromCns(err: CnsError, options?: McpJsonSerializeOptions): {
  content: [{ type: "text"; text: string }];
  isError: true;
} {
  const prefixes = options?.mcpVaultRoot ? redactionPrefixesForVaultRoot(options.mcpVaultRoot) : [];
  const safe = prefixes.length > 0 ? sanitizeCnsErrorForMcp(err, prefixes) : err;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          code: safe.code,
          message: safe.message,
          ...(safe.details && Object.keys(safe.details).length > 0 ? { details: safe.details } : {}),
        }),
      },
    ],
    isError: true,
  };
}

/**
 * MCP tool handler boundary: never rethrow non-CnsError into the SDK.
 * Non-domain throws become IO_ERROR with a generic agent-facing message; raw text
 * lives in `details.debug` only (operators / future surface filters).
 */
const IO_ERROR_PUBLIC_MESSAGE = "An unexpected internal error occurred";

export function handleToolInvocationCatch(
  e: unknown,
  options?: McpJsonSerializeOptions,
): ReturnType<typeof callToolErrorFromCns> {
  if (e instanceof CnsError) {
    return callToolErrorFromCns(e, options);
  }
  const details: Record<string, unknown> =
    e instanceof Error ? { name: e.name } : { kind: typeof e };
  const debugRaw =
    e instanceof Error
      ? e.message.trim()
      : typeof e === "string"
        ? e
        : String(e);
  if (debugRaw !== "") {
    details.debug = debugRaw;
  }
  return callToolErrorFromCns(new CnsError("IO_ERROR", IO_ERROR_PUBLIC_MESSAGE, details), options);
}
