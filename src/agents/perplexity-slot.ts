import { CnsError } from "../errors.js";

export type PerplexityResult = {
  answer: string;
  citations: string[];
};

export type PerplexitySlot = {
  available: boolean;
  search(query: string): Promise<PerplexityResult>;
};

export function createPerplexitySlot(): PerplexitySlot {
  const available = Boolean(process.env.PERPLEXITY_API_KEY);
  return {
    available,
    async search(query: string): Promise<PerplexityResult> {
      const preview = query.slice(0, 40);
      if (!available) {
        throw new CnsError(
          "UNSUPPORTED",
          `Perplexity not configured — PERPLEXITY_API_KEY missing (query: ${preview})`,
        );
      }
      throw new CnsError(
        "UNSUPPORTED",
        `Perplexity MCP call not yet implemented (stub — story 17-1 wires real call; query: ${preview})`,
      );
    },
  };
}
