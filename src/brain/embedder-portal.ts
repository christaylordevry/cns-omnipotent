import { CnsError } from "../errors.js";
import type { Embedder, EmbedderMetadata } from "./embedder.js";

export const PORTAL_EMBEDDER_PROVIDER_ID = "portal" as const;

export type PortalEmbedderOptions = {
  /** OpenAI-compatible base URL, e.g. `http://127.0.0.1:8645/v1` (Hermes subscription proxy). */
  baseUrl: string;
  /** Portal/OpenRouter-style embedding model id. */
  modelId: string;
  /** Bearer token; proxy accepts any value when JWT is attached upstream. */
  apiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

type OpenAiEmbeddingsResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

/**
 * Production embedder (Story 79-2): POST `/v1/embeddings` via Hermes Portal subscription proxy.
 * OpenAI-compatible request/response shape per Hermes subscription-proxy allowed paths.
 */
export class PortalEmbedder implements Embedder {
  readonly metadata: EmbedderMetadata;

  private readonly embeddingsUrl: string;
  private readonly modelId: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: PortalEmbedderOptions) {
    const trimmedBase = options.baseUrl.trim().replace(/\/$/, "");
    const trimmedModel = options.modelId.trim();
    if (trimmedBase.length === 0) {
      throw new CnsError("SCHEMA_INVALID", "Portal embedder baseUrl must be non-empty.");
    }
    if (trimmedModel.length === 0) {
      throw new CnsError("SCHEMA_INVALID", "Portal embedder modelId must be non-empty.");
    }
    this.embeddingsUrl = `${trimmedBase}/embeddings`;
    this.modelId = trimmedModel;
    this.apiKey = options.apiKey?.trim() || "unused";
    this.timeoutMs =
      typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
        ? Math.floor(options.timeoutMs)
        : 30_000;
    this.fetchFn = options.fetchFn ?? fetch;
    this.metadata = { providerId: PORTAL_EMBEDDER_PROVIDER_ID, modelId: trimmedModel };
  }

  async embed(noteTextForEmbedding: string): Promise<number[]> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      response = await this.fetchFn(this.embeddingsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: noteTextForEmbedding,
          model: this.modelId,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new CnsError(
        "IO_ERROR",
        controller.signal.aborted
          ? `Portal embeddings request timed out after ${this.timeoutMs}ms.`
          : `Portal embeddings request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    let body: OpenAiEmbeddingsResponse;
    try {
      body = (await response.json()) as OpenAiEmbeddingsResponse;
    } catch {
      throw new CnsError("IO_ERROR", `Portal embeddings response was not JSON (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      const msg = body.error?.message ?? `HTTP ${response.status}`;
      throw new CnsError("IO_ERROR", `Portal embeddings error: ${msg}`);
    }

    const embedding = body.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new CnsError("IO_ERROR", "Portal embeddings response missing data[0].embedding.");
    }
    if (!embedding.every((v) => typeof v === "number" && Number.isFinite(v))) {
      throw new CnsError("IO_ERROR", "Portal embeddings response contained non-numeric vector values.");
    }
    return embedding;
  }
}
