import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const BRAIN_RECALL_POLICY_SCHEMA_VERSION = 1 as const;

export const RECALL_CHANNEL_KEYS = ["voice_pane", "standard_text", "yapped_text"] as const;
export type RecallChannel = (typeof RECALL_CHANNEL_KEYS)[number];

const channelPolicySchema = z.object({
  max_top_k_fetch: z.number().int().positive().max(50),
  min_score_threshold: z.number().min(0).max(1),
  max_injection_tokens: z.number().int().positive(),
  max_chunks: z.number().int().positive().max(20),
  quality_weighting: z.boolean().optional(),
});

const brainRecallPolicySchema = z.object({
  schema_version: z.literal(BRAIN_RECALL_POLICY_SCHEMA_VERSION),
  policy_version: z.string().min(1),
  policy_notes: z.string().optional(),
  inject_blocked_paths: z.array(z.string().min(1)),
  channels: z.object({
    voice_pane: channelPolicySchema,
    standard_text: channelPolicySchema,
    yapped_text: channelPolicySchema,
  }),
  yapped_text_min_chars: z.number().int().positive(),
  index: z
    .object({
      incremental_cron_minutes: z.number().int().positive().optional(),
      stale_penalty_factor: z.number().min(0).max(1).optional(),
      max_staleness_minutes: z.number().int().positive().optional(),
      /** Blend strength α for quality weighting; 0 = off, 1 = full product penalty (Story 79-7). */
      quality_weight_strength: z.number().min(0).max(1).optional(),
    })
    .optional(),
  prefetch: z
    .object({
      timeout_seconds: z.number().positive().optional(),
      voice_pane_timeout_seconds: z.number().positive().optional(),
    })
    .optional(),
  embedder_warm_keep: z
    .object({
      enabled: z.boolean(),
      ping_interval_minutes: z.number().int().positive().optional(),
      warm_on_dashboard_start: z.boolean().optional(),
    })
    .optional(),
  shadow_mode: z.boolean(),
});

export type RecallChannelPolicy = z.infer<typeof channelPolicySchema>;
export type BrainRecallPolicy = z.infer<typeof brainRecallPolicySchema>;

export type BrainRecallPolicyParseResult =
  | { ok: true; value: BrainRecallPolicy }
  | { ok: false; message: string };

/** Default repo-relative path (Story 79-3). */
export const BRAIN_RECALL_POLICY_REPO_REL = "config/brain-recall-policy.json";

export function parseBrainRecallPolicy(jsonText: string): BrainRecallPolicyParseResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { ok: false, message: "Input is not valid JSON." };
  }
  const parsed = brainRecallPolicySchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const at = first?.path.length ? ` at "${first.path.join(".")}"` : "";
    return { ok: false, message: `Invalid recall policy shape${at} (${first?.code ?? "schema"}).` };
  }
  const { voice_pane, standard_text, yapped_text } = parsed.data.channels;
  if (
    !(
      voice_pane.max_injection_tokens < standard_text.max_injection_tokens &&
      standard_text.max_injection_tokens < yapped_text.max_injection_tokens
    )
  ) {
    return {
      ok: false,
      message:
        "Channel max_injection_tokens must satisfy voice_pane < standard_text < yapped_text (NFR-RECALL-1).",
    };
  }
  return { ok: true, value: parsed.data };
}

export async function loadBrainRecallPolicyFromFile(absPath: string): Promise<BrainRecallPolicy> {
  const text = await readFile(absPath, "utf8");
  const parsed = parseBrainRecallPolicy(text);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

export async function loadBrainRecallPolicyFromRepo(repoRoot: string): Promise<BrainRecallPolicy> {
  return loadBrainRecallPolicyFromFile(path.join(repoRoot, BRAIN_RECALL_POLICY_REPO_REL));
}

export function channelPolicyFor(policy: BrainRecallPolicy, channel: RecallChannel): RecallChannelPolicy {
  return policy.channels[channel];
}
