import {
  runResearchAgent,
  type ResearchAgentOptions,
  type ResearchBrief,
  type ResearchSweepResult,
} from "./research-agent.js";
import {
  runSynthesisAgent,
  type SynthesisAdapter,
  type SynthesisRunResult,
} from "./synthesis-agent.js";
import {
  runHookAgent,
  type HookGenerationAdapter,
  type HookRunResult,
} from "./hook-agent.js";
import {
  runBossAgent,
  type BossRunResult,
  type WeaponsCheckAdapter,
} from "./boss-agent.js";
import { createLlmSynthesisAdapter } from "./synthesis-adapter-llm.js";
import { createLlmHookGenerationAdapter } from "./hook-adapter-llm.js";
import { createLlmWeaponsCheckAdapter } from "./boss-adapter-llm.js";

export type ChainRunAdapters = {
  synthesis?: SynthesisAdapter | undefined;
  hookGeneration?: HookGenerationAdapter | undefined;
  weaponsCheck?: WeaponsCheckAdapter | undefined;
};

export type ChainRunOptions = {
  research?: ResearchAgentOptions | undefined;
  adapters?: ChainRunAdapters | undefined;
};

export type ChainRunResult = {
  sweep: ResearchSweepResult;
  synthesis: SynthesisRunResult;
  hooks: HookRunResult;
  weapons: BossRunResult;
};

export async function runChain(
  vaultRoot: string,
  brief: ResearchBrief,
  opts: ChainRunOptions = {},
): Promise<ChainRunResult> {
  const sweep = await runResearchAgent(vaultRoot, brief, opts.research);

  const synthesis = await runSynthesisAgent(vaultRoot, sweep, {
    adapters: {
      synthesis: opts.adapters?.synthesis ?? createLlmSynthesisAdapter(),
    },
  });

  const hooks = await runHookAgent(vaultRoot, synthesis, {
    adapters: {
      hookGeneration:
        opts.adapters?.hookGeneration ?? createLlmHookGenerationAdapter(),
    },
  });

  const weapons = await runBossAgent(vaultRoot, hooks, {
    adapters: {
      weaponsCheck:
        opts.adapters?.weaponsCheck ?? createLlmWeaponsCheckAdapter(),
    },
  });

  return { sweep, synthesis, hooks, weapons };
}
