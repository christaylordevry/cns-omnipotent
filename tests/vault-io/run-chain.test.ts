import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_VAULT_SOURCE = path.join(__dirname, "../fixtures/minimal-vault");

vi.mock("../../src/agents/research-agent.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/agents/research-agent.js")>(
    "../../src/agents/research-agent.js",
  );
  return { ...actual, runResearchAgent: vi.fn() };
});
vi.mock("../../src/agents/synthesis-agent.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/agents/synthesis-agent.js")>(
    "../../src/agents/synthesis-agent.js",
  );
  return { ...actual, runSynthesisAgent: vi.fn() };
});
vi.mock("../../src/agents/hook-agent.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/agents/hook-agent.js")>(
    "../../src/agents/hook-agent.js",
  );
  return { ...actual, runHookAgent: vi.fn() };
});
vi.mock("../../src/agents/boss-agent.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/agents/boss-agent.js")>(
    "../../src/agents/boss-agent.js",
  );
  return { ...actual, runBossAgent: vi.fn() };
});
vi.mock("../../src/agents/synthesis-adapter-llm.js", () => ({
  createLlmSynthesisAdapter: vi.fn(() => ({ synthesize: vi.fn() })),
}));
vi.mock("../../src/agents/hook-adapter-llm.js", () => ({
  createLlmHookGenerationAdapter: vi.fn(() => ({ generateOrRefine: vi.fn() })),
}));
vi.mock("../../src/agents/boss-adapter-llm.js", () => ({
  createLlmWeaponsCheckAdapter: vi.fn(() => ({ scoreAndRewrite: vi.fn() })),
}));

import { runChain } from "../../src/agents/run-chain.js";
import {
  runResearchAgent,
  type ResearchBrief,
  type ResearchSweepResult,
} from "../../src/agents/research-agent.js";
import {
  runSynthesisAgent,
  type SynthesisAdapter,
  type SynthesisRunResult,
} from "../../src/agents/synthesis-agent.js";
import {
  runHookAgent,
  type HookGenerationAdapter,
  type HookRunResult,
} from "../../src/agents/hook-agent.js";
import {
  runBossAgent,
  type BossRunResult,
  type WeaponsCheckAdapter,
} from "../../src/agents/boss-agent.js";
import { createLlmSynthesisAdapter } from "../../src/agents/synthesis-adapter-llm.js";
import { createLlmHookGenerationAdapter } from "../../src/agents/hook-adapter-llm.js";
import { createLlmWeaponsCheckAdapter } from "../../src/agents/boss-adapter-llm.js";

const brief: ResearchBrief = {
  topic: "AI agents",
  queries: ["q1"],
  depth: "deep",
};

const sweepOk: ResearchSweepResult = {
  brief_topic: "AI agents",
  notes_created: [
    {
      vault_path: "03-Resources/x.md",
      pake_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      source_uri: "https://example.com/x",
      source: "firecrawl",
    },
  ],
  notes_skipped: [],
  perplexity_skipped: true,
  perplexity_answers_filed: 0,
  sweep_timestamp: "2026-04-18T00:00:00.000Z",
};

const sweepEmpty: ResearchSweepResult = {
  brief_topic: "AI agents",
  notes_created: [],
  notes_skipped: [],
  perplexity_skipped: true,
  perplexity_answers_filed: 0,
  sweep_timestamp: "2026-04-18T00:00:00.000Z",
};

const synthesisOk: SynthesisRunResult = {
  status: "ok",
  insight_note: {
    vault_path: "03-Resources/synth.md",
    pake_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  },
  sources_used: ["03-Resources/x.md"],
  sources_read_failed: [],
  synthesis_timestamp: "2026-04-18T00:00:00.000Z",
};

const synthesisSkipped: SynthesisRunResult = {
  status: "skipped",
  reason: "no-source-notes",
  sources_read_failed: [],
  synthesis_timestamp: "2026-04-18T00:00:00.000Z",
};

const hooksOk: HookRunResult = {
  status: "ok",
  hook_set_note: {
    vault_path: "03-Resources/hooks.md",
    pake_id: "cccccccc-cccc-4ccc-bccc-cccccccccccc",
  },
  synthesis_insight_path: "03-Resources/synth.md",
  options: [
    { slot: 1, final_hook: "h1", iterations: 3, trace: [{ iteration: 3, score: 10 }] },
    { slot: 2, final_hook: "h2", iterations: 3, trace: [{ iteration: 3, score: 10 }] },
    { slot: 3, final_hook: "h3", iterations: 3, trace: [{ iteration: 3, score: 10 }] },
    { slot: 4, final_hook: "h4", iterations: 3, trace: [{ iteration: 3, score: 10 }] },
  ],
  hook_timestamp: "2026-04-18T00:00:00.000Z",
};

const hooksSkipped: HookRunResult = {
  status: "skipped",
  reason: "synthesis-skipped",
  synthesis_skip_reason: "no-source-notes",
  hook_timestamp: "2026-04-18T00:00:00.000Z",
};

const weaponsOk: BossRunResult = {
  status: "ok",
  weapons_check_note: {
    vault_path: "03-Resources/weapons.md",
    pake_id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
  },
  hook_set_note_path: "03-Resources/hooks.md",
  synthesis_insight_path: "03-Resources/synth.md",
  options: [
    {
      slot: 1,
      final_hook: "h1-final",
      iterations: 1,
      trace: [{ iteration: 1, novelty: 10, copy_intensity: 10, rationale: "peak" }],
    },
    {
      slot: 2,
      final_hook: "h2-final",
      iterations: 1,
      trace: [{ iteration: 1, novelty: 10, copy_intensity: 10, rationale: "peak" }],
    },
    {
      slot: 3,
      final_hook: "h3-final",
      iterations: 1,
      trace: [{ iteration: 1, novelty: 10, copy_intensity: 10, rationale: "peak" }],
    },
    {
      slot: 4,
      final_hook: "h4-final",
      iterations: 1,
      trace: [{ iteration: 1, novelty: 10, copy_intensity: 10, rationale: "peak" }],
    },
  ],
  weapons_timestamp: "2026-04-18T00:00:00.000Z",
};

const weaponsSkipped: BossRunResult = {
  status: "skipped",
  reason: "hook-skipped",
  hook_skip_reason: "synthesis-skipped",
  synthesis_skip_reason: "no-source-notes",
  weapons_timestamp: "2026-04-18T00:00:00.000Z",
};

function injectedAdapters(): {
  synthesis: SynthesisAdapter;
  hookGeneration: HookGenerationAdapter;
  weaponsCheck: WeaponsCheckAdapter;
} {
  return {
    synthesis: { synthesize: vi.fn() },
    hookGeneration: { generateOrRefine: vi.fn() },
    weaponsCheck: { scoreAndRewrite: vi.fn() },
  };
}

describe("runChain orchestrator (wiring only)", () => {
  let vaultRoot: string;

  beforeEach(async () => {
    vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-chain-"));
    await cp(FIXTURE_VAULT_SOURCE, vaultRoot, { recursive: true, errorOnExist: true });
    vi.mocked(runResearchAgent).mockReset();
    vi.mocked(runSynthesisAgent).mockReset();
    vi.mocked(runHookAgent).mockReset();
    vi.mocked(runBossAgent).mockReset();
    vi.mocked(createLlmSynthesisAdapter).mockClear();
    vi.mocked(createLlmHookGenerationAdapter).mockClear();
    vi.mocked(createLlmWeaponsCheckAdapter).mockClear();
  });

  afterEach(async () => {
    await rm(vaultRoot, { recursive: true, force: true });
  });

  it("AC1: exports runChain and ChainRunResult shape with exactly sweep/synthesis/hooks/weapons", async () => {
    vi.mocked(runResearchAgent).mockResolvedValue(sweepOk);
    vi.mocked(runSynthesisAgent).mockResolvedValue(synthesisOk);
    vi.mocked(runHookAgent).mockResolvedValue(hooksOk);
    vi.mocked(runBossAgent).mockResolvedValue(weaponsOk);

    const result = await runChain(vaultRoot, brief, { adapters: injectedAdapters() });

    expect(Object.keys(result).sort()).toEqual(
      ["hooks", "sweep", "synthesis", "weapons"].sort(),
    );
  });

  it("AC2 happy path: all four agents succeed and results thread in order", async () => {
    vi.mocked(runResearchAgent).mockResolvedValue(sweepOk);
    vi.mocked(runSynthesisAgent).mockResolvedValue(synthesisOk);
    vi.mocked(runHookAgent).mockResolvedValue(hooksOk);
    vi.mocked(runBossAgent).mockResolvedValue(weaponsOk);

    const adapters = injectedAdapters();
    const result = await runChain(vaultRoot, brief, { adapters });

    expect(result.sweep).toBe(sweepOk);
    expect(result.synthesis).toBe(synthesisOk);
    expect(result.hooks).toBe(hooksOk);
    expect(result.weapons).toBe(weaponsOk);
    expect(result.synthesis.status).toBe("ok");
    expect(result.hooks.status).toBe("ok");
    expect(result.weapons.status).toBe("ok");

    expect(vi.mocked(runResearchAgent)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runResearchAgent)).toHaveBeenCalledWith(vaultRoot, brief, undefined);

    expect(vi.mocked(runSynthesisAgent)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runSynthesisAgent)).toHaveBeenCalledWith(vaultRoot, sweepOk, {
      adapters: { synthesis: adapters.synthesis },
    });

    expect(vi.mocked(runHookAgent)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runHookAgent)).toHaveBeenCalledWith(vaultRoot, synthesisOk, {
      adapters: { hookGeneration: adapters.hookGeneration },
    });

    expect(vi.mocked(runBossAgent)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runBossAgent)).toHaveBeenCalledWith(vaultRoot, hooksOk, {
      adapters: { weaponsCheck: adapters.weaponsCheck },
    });
  });

  it("AC4 skipped propagation: does not short-circuit when synthesis is skipped", async () => {
    vi.mocked(runResearchAgent).mockResolvedValue(sweepEmpty);
    vi.mocked(runSynthesisAgent).mockResolvedValue(synthesisSkipped);
    vi.mocked(runHookAgent).mockResolvedValue(hooksSkipped);
    vi.mocked(runBossAgent).mockResolvedValue(weaponsSkipped);

    const result = await runChain(vaultRoot, brief, { adapters: injectedAdapters() });

    expect(result.synthesis.status).toBe("skipped");
    expect(result.hooks.status).toBe("skipped");
    expect(result.weapons.status).toBe("skipped");

    // Downstream agents still called with upstream results — no short-circuit.
    expect(vi.mocked(runSynthesisAgent)).toHaveBeenCalledWith(
      vaultRoot,
      sweepEmpty,
      expect.any(Object),
    );
    expect(vi.mocked(runHookAgent)).toHaveBeenCalledWith(
      vaultRoot,
      synthesisSkipped,
      expect.any(Object),
    );
    expect(vi.mocked(runBossAgent)).toHaveBeenCalledWith(
      vaultRoot,
      hooksSkipped,
      expect.any(Object),
    );
  });

  it("AC3 adapter defaults: LLM factories invoked when opts.adapters is not passed", async () => {
    vi.mocked(runResearchAgent).mockResolvedValue(sweepOk);
    vi.mocked(runSynthesisAgent).mockResolvedValue(synthesisOk);
    vi.mocked(runHookAgent).mockResolvedValue(hooksOk);
    vi.mocked(runBossAgent).mockResolvedValue(weaponsOk);

    await runChain(vaultRoot, brief);

    expect(vi.mocked(createLlmSynthesisAdapter)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createLlmHookGenerationAdapter)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createLlmWeaponsCheckAdapter)).toHaveBeenCalledTimes(1);
  });

  it("AC3 adapter defaults: LLM factories NOT invoked when opts.adapters is provided", async () => {
    vi.mocked(runResearchAgent).mockResolvedValue(sweepOk);
    vi.mocked(runSynthesisAgent).mockResolvedValue(synthesisOk);
    vi.mocked(runHookAgent).mockResolvedValue(hooksOk);
    vi.mocked(runBossAgent).mockResolvedValue(weaponsOk);

    await runChain(vaultRoot, brief, { adapters: injectedAdapters() });

    expect(vi.mocked(createLlmSynthesisAdapter)).not.toHaveBeenCalled();
    expect(vi.mocked(createLlmHookGenerationAdapter)).not.toHaveBeenCalled();
    expect(vi.mocked(createLlmWeaponsCheckAdapter)).not.toHaveBeenCalled();
  });
});
