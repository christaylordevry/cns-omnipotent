import { mkdir, mkdtemp, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runChain } from "../../src/agents/run-chain.js";
import type { ResearchBrief, FirecrawlAdapter } from "../../src/agents/research-agent.js";
import type { SynthesisAdapter } from "../../src/agents/synthesis-agent.js";
import type {
  HookGenerationAdapter,
  HookGenerationAdapterOutput,
} from "../../src/agents/hook-agent.js";
import type {
  WeaponsCheckAdapter,
  WeaponsCheckAdapterOutput,
} from "../../src/agents/boss-agent.js";
import {
  DEFAULT_OPERATOR_CONTEXT,
  type OperatorContext,
} from "../../src/agents/operator-context.js";
import type { VaultContextPacket } from "../../src/agents/vault-context-builder.js";

// Story 25.1 AC6: full mocked chain run with `save_sources: false` (default)
// must produce exactly three governed `.md` files (synthesis, hooks, weapons)
// under 03-Resources/ and zero artifacts under 00-Inbox/.

async function makeCleanVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-chain-footprint-"));
  await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
  await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
  await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
  return vaultRoot;
}

async function listMarkdown(vaultRoot: string, rel: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(vaultRoot, rel), { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

const LONG_BODY = "x".repeat(220);

function repeatSentence(sentence: string, count: number): string {
  return Array.from({ length: count }, () => sentence).join(" ");
}

const NO_VAULT_CONTEXT_WARNING =
  "> [!warning] No vault context found — this synthesis is grounded in external research only.";

function validPakeBody(): string {
  const whatWeKnow = [
    "The source set points toward agent orchestration as the practical layer where research becomes action for [[note-a]], [[note-b]], [[note-c]], and [[Operator-Profile]].",
    repeatSentence(
      "The important pattern is that operators do not need a generic summary; they need a connected readout that explains what changed, why it matters, where confidence is uneven, and which vault notes should shape the next move.",
      10,
    ),
  ].join(" ");
  const leverage = [
    "Chris Taylor is operating from Sydney, Australia as a Creative Technologist, which makes the research useful only if it can be turned into a visible asset and a decision in the same session.",
    "Escape Job and Build Agency should both be named because the same intelligence stream can serve employment escape velocity and agency proof at once.",
    repeatSentence(
      "Escape Job benefits when the synthesis clarifies the fastest path to runway, while Build Agency benefits when the same analysis becomes public evidence of taste, systems thinking, and execution quality.",
      8,
    ),
  ].join(" ");

  return [
    "## What We Know",
    whatWeKnow,
    "",
    "> [!note] Signal vs Noise",
    "> Strong sources agree on orchestration, but they differ on how much autonomy is durable.",
    "",
    "| Claim | Agree | Disagree | Implication |",
    "| --- | --- | --- | --- |",
    "| Agents need tools | Multiple sources show tool use | Some sources frame chat as enough | Prioritize workflows, not summaries |",
    "| Planning matters | Architectures emphasize decomposition | Simple tasks may not need it | Match complexity to task size |",
    "| Evaluation is hard | Reliability is repeatedly flagged | Benchmarks stay shallow | Keep decisions reversible |",
    "",
    "## The Gap Map",
    "",
    "| Known | Unknown | Why it matters |",
    "| --- | --- | --- |",
    "| Agents can call tools | Which tools matter first | Tool choice determines operator leverage |",
    "| Research can be filed | Which notes compound | Vault links shape reuse |",
    "| Prompt rules guide output | Which rules fail live | Validation protects quality |",
    "| Decisions can be listed | Which decision blocks action | Open questions should be practical |",
    "",
    "> [!warning] Blind Spots",
    "> The sources still understate cost, latency, failure recovery, and the amount of operator judgment required.",
    "",
    "## Where Chris Has Leverage",
    leverage,
    "",
    "> [!tip] Highest-Leverage Move",
    "> Turn the synthesis into one time-boxed decision memo connected to [[note-a]] and ship it before starting another research sweep.",
    "",
    "## Connected Vault Notes",
    "",
    "| Note | Why relevant | Status |",
    "| --- | --- | --- |",
    "| [[note-a]] | Source evidence | active |",
    "| [[note-b]] | Architecture signal | active |",
    "| [[note-c]] | Comparison point | active |",
    "| [[real-note]] | Fixture-backed note | active |",
    "| [[Operator-Profile]] | Operator constraints | active |",
    "",
    "## Decisions Needed",
    "",
    "### Decision: pick architecture",
    "- **Option A:** ReAct loop",
    "- **Option B:** Planner-executor",
    "- **Downstream consequence:** The choice changes latency, observability, and failure handling.",
    "",
    "### Decision: pick cadence",
    "- **Option A:** Weekly synthesis",
    "- **Option B:** Per-brief synthesis",
    "- **Downstream consequence:** The choice changes workload and compounding cadence.",
    "",
    "### Decision: pick distribution",
    "- **Option A:** Public memo",
    "- **Option B:** Private vault note",
    "- **Downstream consequence:** The choice changes proof creation and feedback speed.",
    "",
    "### Decision: pick validation gate",
    "- **Option A:** Strict PAKE++ validation",
    "- **Option B:** Prompt-only guidance",
    "- **Downstream consequence:** The choice changes rejection rate and output consistency.",
    "",
    "## Open Questions",
    "1. Which source should drive the first operator decision?",
    "2. Which vault note should become the canonical reference?",
    "3. Which next action is blocked by missing evidence?",
    "",
    "## Version / Run Metadata",
    "",
    "| Date | Brief topic | Sources ingested | Queries run |",
    "| --- | --- | --- | --- |",
    "| 2026-04-30 | AI agents | 1 | 1 |",
    "",
    "> [!abstract]",
    "> The synthesis shows that agent orchestration matters most when it becomes an operator decision, not a generic summary.",
    "> The highest-leverage action is to turn the research into one connected decision memo before running another sweep.",
    NO_VAULT_CONTEXT_WARNING,
  ].join("\n");
}

const operator_context: OperatorContext = DEFAULT_OPERATOR_CONTEXT;
const empty_packet: VaultContextPacket = {
  notes: [],
  total_notes: 0,
  token_budget_used: 0,
  retrieval_timestamp: "2026-04-30T00:00:00.000Z",
};

const brief: ResearchBrief = {
  topic: "AI agents",
  queries: ["what is an AI agent"],
  depth: "standard",
};

function makeFirecrawl(): FirecrawlAdapter {
  return {
    async search() {
      return [
        {
          url: "https://example.com/source-1",
          title: "Example Source",
          snippet: `# Example\n\n${LONG_BODY}`,
        },
      ];
    },
    async scrape(url: string) {
      return { markdown: `# Scraped\n\n${LONG_BODY}\n\nFrom ${url}` };
    },
  };
}

function makeSynthesisAdapter(): SynthesisAdapter {
  return {
    async synthesize() {
      return { body: validPakeBody(), summary: "concise summary" };
    },
  };
}

function makeHookAdapter(): HookGenerationAdapter {
  return {
    async generateOrRefine(input): Promise<HookGenerationAdapterOutput> {
      const score = input.iteration >= 3 ? 10 : 5;
      return { hook_text: `Slot ${input.hook_slot} hook draft v${input.iteration}`, score };
    },
  };
}

function makeWeaponsAdapter(): WeaponsCheckAdapter {
  return {
    async scoreAndRewrite(input): Promise<WeaponsCheckAdapterOutput> {
      return {
        revised_hook: `Slot ${input.hook_slot} weapons-final`,
        scores: { novelty: 10, copy_intensity: 10, rationale: "peak" },
      };
    },
  };
}

describe("AC6 — chain footprint with default save_sources (memory-only acquisition)", () => {
  it("writes exactly three governed notes under 03-Resources and zero under 00-Inbox", async () => {
    const vaultRoot = await makeCleanVault();

    const result = await runChain(vaultRoot, brief, {
      research: {
        adapters: { firecrawl: makeFirecrawl() },
      },
      adapters: {
        synthesis: makeSynthesisAdapter(),
        hookGeneration: makeHookAdapter(),
        weaponsCheck: makeWeaponsAdapter(),
      },
      operator_context,
      vault_context_packet: empty_packet,
    });

    expect(result.synthesis.status).toBe("ok");
    expect(result.hooks.status).toBe("ok");
    expect(result.weapons.status).toBe("ok");

    // Acquisition tier stayed in memory
    expect(result.sweep.notes_created.length).toBe(1);
    expect(result.sweep.notes_created[0].vault_path).toMatch(
      /^urn:cns:chain:ephemeral:firecrawl:/,
    );

    // Vault footprint: exactly the three governed outputs
    const governed = await listMarkdown(vaultRoot, "03-Resources");
    expect(governed.length).toBe(3);
    expect(governed.some((n) => n.startsWith("synthesis-"))).toBe(true);
    expect(governed.some((n) => n.startsWith("hooks-"))).toBe(true);
    expect(governed.some((n) => n.startsWith("weapons-check-"))).toBe(true);

    const inbox = await listMarkdown(vaultRoot, "00-Inbox");
    expect(inbox).toEqual([]);
  });

  it("AC7 — explicit save_sources: true persists acquisition-tier SourceNotes too", async () => {
    const vaultRoot = await makeCleanVault();

    const result = await runChain(vaultRoot, brief, {
      research: {
        save_sources: true,
        adapters: { firecrawl: makeFirecrawl() },
      },
      adapters: {
        synthesis: makeSynthesisAdapter(),
        hookGeneration: makeHookAdapter(),
        weaponsCheck: makeWeaponsAdapter(),
      },
      operator_context,
      vault_context_packet: empty_packet,
    });

    expect(result.sweep.notes_created.length).toBe(1);
    // With save_sources: true, vault_path is a real governed path, not a URN.
    expect(result.sweep.notes_created[0].vault_path).toMatch(/^03-Resources\//);

    const governed = await listMarkdown(vaultRoot, "03-Resources");
    // Source + synthesis + hooks + weapons = 4 governed notes
    expect(governed.length).toBe(4);
    const inbox = await listMarkdown(vaultRoot, "00-Inbox");
    expect(inbox).toEqual([]);
  });
});
