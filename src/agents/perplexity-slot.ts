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
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim() ?? "";
  const available = apiKey.length > 0;
  return {
    available,
    async search(query: string): Promise<PerplexityResult> {
      if (!available) {
        throw new CnsError(
          "UNSUPPORTED",
          "Perplexity not configured — PERPLEXITY_API_KEY missing",
        );
      }

      let res: Response;
      try {
        res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [{ role: "user", content: query }],
          }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new CnsError("IO_ERROR", `Perplexity fetch failed: ${msg}`);
      }

      if (!res.ok) {
        throw new CnsError("IO_ERROR", `Perplexity API HTTP ${res.status}`);
      }

      let data: unknown;
      try {
        data = (await res.json()) as unknown;
      } catch {
        throw new CnsError("IO_ERROR", "Perplexity response was not valid JSON");
      }

      const obj = data as {
        choices?: Array<{ message?: { content?: string } }>;
        citations?: string[];
      };

      return {
        answer: obj.choices?.[0]?.message?.content ?? "",
        citations: obj.citations ?? [],
      };
    },
  };
}
