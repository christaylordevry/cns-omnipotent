import { CnsError } from "../errors.js";

export type TokenCounter = (text: string) => Promise<number>;

export type AnthropicTokenCounterOptions = {
  /** OpenAI-compatible or Anthropic base URL, e.g. `http://127.0.0.1:8645/v1`. */
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

type CountTokensResponse = {
  input_tokens?: number;
  error?: { message?: string };
};

/**
 * Count tokens via Anthropic-compatible POST `/v1/messages/count_tokens`.
 * Used by calibration harness only — hot-path recall trim keeps chars/4 estimate.
 */
export async function countTokensViaAnthropicApi(
  text: string,
  options: AnthropicTokenCounterOptions,
): Promise<number> {
  const trimmedBase = options.baseUrl.trim().replace(/\/$/, "");
  const model = options.model.trim();
  if (trimmedBase.length === 0 || model.length === 0) {
    throw new CnsError("SCHEMA_INVALID", "Token counter baseUrl and model are required.");
  }
  const url = `${trimmedBase}/messages/count_tokens`;
  const apiKey = options.apiKey?.trim() || "unused";
  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Math.floor(options.timeoutMs)
      : 30_000;
  const fetchFn = options.fetchFn ?? fetch;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: text }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new CnsError(
      "IO_ERROR",
      controller.signal.aborted
        ? `Token count request timed out after ${timeoutMs}ms.`
        : `Token count request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  let body: CountTokensResponse;
  try {
    body = (await response.json()) as CountTokensResponse;
  } catch {
    throw new CnsError("IO_ERROR", `Token count response was not JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const msg = body.error?.message ?? `HTTP ${response.status}`;
    throw new CnsError("IO_ERROR", `Token count error: ${msg}`);
  }

  const tokens = body.input_tokens;
  if (typeof tokens !== "number" || !Number.isFinite(tokens) || tokens < 0) {
    throw new CnsError("IO_ERROR", "Token count response missing input_tokens.");
  }
  return Math.floor(tokens);
}

export function createAnthropicTokenCounter(options: AnthropicTokenCounterOptions): TokenCounter {
  return (text: string) => countTokensViaAnthropicApi(text, options);
}

export function resolveTokenCounterFromEnv(): TokenCounter | null {
  const baseUrl = process.env.CNS_BRAIN_TOKEN_COUNT_BASE_URL?.trim();
  const model = process.env.CNS_BRAIN_TOKEN_COUNT_MODEL?.trim();
  if (!baseUrl || !model) {
    return null;
  }
  return createAnthropicTokenCounter({
    baseUrl,
    model,
    apiKey: process.env.CNS_BRAIN_TOKEN_COUNT_API_KEY?.trim(),
    timeoutMs: process.env.CNS_BRAIN_TOKEN_COUNT_TIMEOUT_MS
      ? Number(process.env.CNS_BRAIN_TOKEN_COUNT_TIMEOUT_MS)
      : undefined,
  });
}
