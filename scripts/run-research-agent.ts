/**
 * Live test runner for runResearchAgent() using real Firecrawl and Perplexity APIs.
 * Apify is skipped — no APIFY_TOKEN found in env.
 *
 * Usage:
 *   CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE" \
 *   tsx scripts/run-research-agent.ts
 */

import {
  runResearchAgent,
  type FirecrawlAdapter,
  type FirecrawlSearchResult,
} from "../src/agents/research-agent.js";
import { type PerplexitySlot, type PerplexityResult } from "../src/agents/perplexity-slot.js";

// ---------------------------------------------------------------------------
// Firecrawl adapter — calls api.firecrawl.dev v1
// ---------------------------------------------------------------------------

function buildFirecrawlAdapter(apiKey: string): FirecrawlAdapter {
  return {
    async search(query: string, opts: { limit: number }): Promise<FirecrawlSearchResult[]> {
      const res = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query, limit: opts.limit }),
      });
      if (!res.ok) throw new Error(`Firecrawl search HTTP ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { data?: Array<{ url: string; title?: string; description?: string }> };
      return (data.data ?? []).map((item) => ({
        url: item.url,
        title: item.title,
        snippet: item.description,
      }));
    },

    async scrape(url: string): Promise<{ markdown: string; title?: string }> {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ url, formats: ["markdown"] }),
      });
      if (!res.ok) throw new Error(`Firecrawl scrape HTTP ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { data?: { markdown?: string; metadata?: { title?: string } } };
      return {
        markdown: data.data?.markdown ?? "",
        title: data.data?.metadata?.title,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Perplexity slot — calls api.perplexity.ai sonar model
// ---------------------------------------------------------------------------

function buildPerplexitySlot(apiKey: string): PerplexitySlot {
  return {
    available: true,
    async search(query: string): Promise<PerplexityResult> {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: query }],
        }),
      });
      if (!res.ok) throw new Error(`Perplexity HTTP ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        citations?: string[];
      };
      return {
        answer: data.choices?.[0]?.message?.content ?? "",
        citations: data.citations ?? [],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const vaultRoot =
    process.env.CNS_VAULT_ROOT ??
    "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE";

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not set");
  if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY not set");

  console.log("=== Research Agent Live Test ===");
  console.log(`Vault root: ${vaultRoot}`);
  console.log(`Firecrawl: ✓   Perplexity: ✓   Apify: skipped (no token)\n`);

  const brief = {
    topic: "Creative Technologist remote roles and how to position for them in 2026",
    queries: [
      "what do companies actually want when they hire a creative technologist",
      "creative technologist remote job market 2026 salary expectations",
      "how to position AI skills for creative director or creative technologist roles reddit",
    ],
    depth: "standard" as const,
  };

  console.log("Brief:", JSON.stringify(brief, null, 2), "\n");
  console.log("Running sweep…\n");

  const result = await runResearchAgent(vaultRoot, brief, {
    surface: "live-test",
    adapters: {
      firecrawl: buildFirecrawlAdapter(firecrawlKey),
      perplexity: buildPerplexitySlot(perplexityKey),
    },
  });

  console.log("=== ResearchSweepResult ===");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n=== Notes Created ===");
  if (result.notes_created.length === 0) {
    console.log("  (none)");
  } else {
    for (const note of result.notes_created) {
      console.log(`  [${note.source}] ${note.vault_path}`);
      if (note.source_uri) console.log(`         └─ ${note.source_uri}`);
    }
  }

  console.log("\n=== Notes Skipped ===");
  if (result.notes_skipped.length === 0) {
    console.log("  (none)");
  } else {
    for (const skip of result.notes_skipped) {
      console.log(`  [${skip.reason}] ${skip.source_uri}`);
    }
  }

  console.log(`\nPerplexity answers filed : ${result.perplexity_answers_filed}`);
  console.log(`Perplexity skipped       : ${result.perplexity_skipped}`);
  console.log(`Sweep timestamp          : ${result.sweep_timestamp}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
