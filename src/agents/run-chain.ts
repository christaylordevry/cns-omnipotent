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
import {
  DEFAULT_OPERATOR_CONTEXT,
  type OperatorContext,
} from "./operator-context.js";
import {
  buildVaultContextPacket,
  type VaultContextPacket,
} from "./vault-context-builder.js";

export type ChainRunAdapters = {
  synthesis?: SynthesisAdapter | undefined;
  hookGeneration?: HookGenerationAdapter | undefined;
  weaponsCheck?: WeaponsCheckAdapter | undefined;
};

export type ChainRunOptions = {
  research?: ResearchAgentOptions | undefined;
  adapters?: ChainRunAdapters | undefined;
  operator_context?: OperatorContext | undefined;
  vault_context_packet?: VaultContextPacket | undefined;
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

  const operator_context = opts.operator_context ?? DEFAULT_OPERATOR_CONTEXT;
  const vault_context_packet =
    opts.vault_context_packet ??
    (await buildVaultContextPacket(vaultRoot, brief.topic, brief.queries));

  const synthesis = await runSynthesisAgent(vaultRoot, sweep, {
    adapters: {
      synthesis: opts.adapters?.synthesis ?? createLlmSynthesisAdapter(),
    },
    queries: brief.queries,
    operator_context,
    vault_context_packet,
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
