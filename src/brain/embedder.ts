import { createHash } from "node:crypto";

export type EmbedderMetadata = {
  providerId: string;
  modelId: string;
};

/**
 * Pluggable embedder (Story 12.4). Production adapters may use `fetch`; tests use {@link StubEmbedder}.
 */
export type Embedder = {
  readonly metadata: EmbedderMetadata;
  embed(noteTextForEmbedding: string): Promise<number[]>;
};

/** Deterministic offline stub: 8 floats derived from SHA-256 of UTF-8 input. */
export class StubEmbedder implements Embedder {
  readonly metadata: EmbedderMetadata = { providerId: "stub", modelId: "stub-v1" };

  async embed(noteTextForEmbedding: string): Promise<number[]> {
    const h = createHash("sha256").update(noteTextForEmbedding, "utf8").digest();
    const out: number[] = [];
    for (let i = 0; i < 8; i++) {
      out.push(h[i]! / 255);
    }
    return out;
  }
}
