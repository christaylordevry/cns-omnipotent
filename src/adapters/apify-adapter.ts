/**
 * Apify rag-web-browser adapter — calls the api.apify.com `apify~rag-web-browser`
 * actor synchronously and returns dataset items shaped for the Research Agent.
 *
 * Extracted from `scripts/run-chain.ts` so the live wiring path matches the
 * `ApifyAdapter` contract in `src/agents/research-agent.ts` (Story 20.1).
 */

import type { ApifyAdapter, ApifyRagResult } from "../agents/research-agent.js";

async function summarizeApifyFailure(res: Response): Promise<string> {
  const text = await res.text();
  const compactBody = text.trim().slice(0, 220);
  return compactBody.length > 0
    ? `Apify rag-web-browser HTTP ${res.status}: ${compactBody}`
    : `Apify rag-web-browser HTTP ${res.status}`;
}

export function buildApifyAdapter(
  apiToken: string,
  recordServiceError: (error: string) => void,
): ApifyAdapter {
  return {
    async ragWebBrowser(
      query: string,
      opts: { limit: number },
    ): Promise<ApifyRagResult[]> {
      const res = await fetch(
        `https://api.apify.com/v2/acts/apify~rag-web-browser/run-sync-get-dataset-items?token=${apiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, maxResults: opts.limit }),
        },
      );
      if (!res.ok) {
        const summary = await summarizeApifyFailure(res);
        recordServiceError(summary);
        throw new Error(summary);
      }
      const data = (await res.json()) as Array<{
        url?: string;
        metadata?: { title?: string };
        text?: string;
        markdown?: string;
      }>;
      return data.map((item) => ({
        url: item.url,
        title: item.metadata?.title,
        text: item.markdown ?? item.text ?? "",
      }));
    },
  };
}
