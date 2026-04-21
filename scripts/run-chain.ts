/**
 * Live test runner for runChain() — wires Research → Synthesis → Hook → Boss
 * with real Firecrawl + Perplexity (Research) and real Anthropic-backed
 * LLM adapters (Synthesis, Hook, Boss).
 *
 * Usage:
 *   CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE" \
 *   FIRECRAWL_API_KEY=... PERPLEXITY_API_KEY=... ANTHROPIC_API_KEY=... \
 *   tsx scripts/run-chain.ts
 */

import { runChain } from "../src/agents/run-chain.js";
import {
  type FirecrawlAdapter,
  type FirecrawlSearchResult,
} from "../src/agents/research-agent.js";
import {
  type PerplexitySlot,
  type PerplexityResult,
} from "../src/agents/perplexity-slot.js";
import { createLlmSynthesisAdapter } from "../src/agents/synthesis-adapter-llm.js";
import { createLlmHookGenerationAdapter } from "../src/agents/hook-adapter-llm.js";
import { createLlmWeaponsCheckAdapter } from "../src/agents/boss-adapter-llm.js";

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
      const data = (await res.json()) as {
        data?: Array<{ url: string; title?: string; description?: string }>;
      };
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
      const data = (await res.json()) as {
        data?: { markdown?: string; metadata?: { title?: string } };
      };
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
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not set");
  if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY not set");
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set");

  console.log("=== Chain Live Test (Research → Synthesis → Hook → Boss) ===");
  console.log(`Vault root: ${vaultRoot}`);
  console.log(`Firecrawl: ✓   Perplexity: ✓   Anthropic: ✓\n`);

  const brief = {
    topic: "Creative Technologist remote roles and how to position for them in 2026",
    queries: [
      "what do companies actually want when they hire a creative technologist",
      "creative technologist remote job market 2026 salary expectations",
      "how to position AI skills for creative director or creative technologist roles reddit",
    ],
    depth: "deep" as const,
  };

  console.log("Brief:", JSON.stringify(brief, null, 2), "\n");
  console.log("Running chain…\n");

  const result = await runChain(vaultRoot, brief, {
    research: {
      surface: "live-test",
      adapters: {
        firecrawl: buildFirecrawlAdapter(firecrawlKey),
        perplexity: buildPerplexitySlot(perplexityKey),
      },
    },
    adapters: {
      synthesis: createLlmSynthesisAdapter(),
      hookGeneration: createLlmHookGenerationAdapter(),
      weaponsCheck: createLlmWeaponsCheckAdapter(),
    },
  });

  console.log("=== sweep: ResearchSweepResult ===");
  console.log(JSON.stringify(result.sweep, null, 2));

  console.log("\n=== synthesis: SynthesisRunResult ===");
  console.log(JSON.stringify(result.synthesis, null, 2));

  console.log("\n=== hooks: HookRunResult ===");
  console.log(JSON.stringify(result.hooks, null, 2));

  console.log("\n=== weapons: BossRunResult (WeaponsCheck) ===");
  console.log(JSON.stringify(result.weapons, null, 2));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
