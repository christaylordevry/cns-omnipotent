/**
 * Claude Code surface adapter — translates a routing DecisionRecord
 * into Claude Code's settings format.
 *
 * **Target:** `.claude/settings.json` (project-level) or
 * `~/.claude/settings.json` (user-level).
 *
 * Claude Code reads its model selection from the top-level `"model"`
 * key in settings.json. The value can be a model alias (e.g., "opus",
 * "sonnet") or a full model name (e.g., "claude-opus-4-6"). The
 * adapter writes the resolved `model_id` from the alias registry as
 * the `"model"` value.
 *
 * **Why the `"model"` key (not `env.ANTHROPIC_MODEL`):**
 * Claude Code's settings.json supports a first-class `"model"` field
 * that is loaded on startup. While the `ANTHROPIC_MODEL` environment
 * variable also works, the `"model"` key in settings.json is the
 * canonical persistent configuration method documented by Anthropic.
 * The `env` block in settings.json is reserved for provider-specific
 * config (e.g., Bedrock ARNs), not for model selection.
 *
 * **Precedence (lowest → highest):** settings.json `"model"` →
 * `ANTHROPIC_MODEL` env var → `--model` CLI flag → `/model` command.
 * The adapter writes at the lowest-priority persistent level so that
 * operators can still override per-session via env var or CLI flag.
 *
 * The adapter merges into the existing settings object so that
 * non-model Claude Code config keys (permissions, env, etc.) are
 * preserved.
 *
 * This module contains no routing logic — it is a translator only.
 */

import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createAuditingCallback } from "../audit-log.js";
import { orchestrateFallback } from "../fallback-orchestrator.js";
import type {
  AdapterResult,
  AliasRegistry,
  DecisionRecord,
  OnFallbackCallback,
  RoutingPolicy,
} from "../types.js";
import { resolveAlias } from "./resolve-alias.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function atomicWriteClaudeCodeConfig(
  configPath: string,
  modelId: string,
): Promise<AdapterResult> {
  // Local helper is intentional: each surface uses a different on-disk JSON shape.
  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {
        ok: false,
        error: "Failed to parse existing config: existing config must be a JSON object",
        surface: "claude-code",
      };
    }

    existing = parsed;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Failed to parse existing config: ${msg}`, surface: "claude-code" };
    }
  }

  existing["model"] = modelId;

  const tmpPath = configPath + ".tmp";
  try {
    await writeFile(tmpPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
    await rename(tmpPath, configPath);
  } catch (err: unknown) {
    try { await unlink(tmpPath); } catch { /* best-effort cleanup */ }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Atomic write failed: ${msg}`, surface: "claude-code" };
  }

  return { ok: true, writtenPath: configPath, modelResolved: modelId };
}

export async function applyClaudeCodeAdapter(
  decision: DecisionRecord,
  registry: AliasRegistry,
  configPath: string,
  policy?: RoutingPolicy,
  reasonCodes?: readonly string[],
  onFallback?: OnFallbackCallback,
  vaultRoot?: string,
): Promise<AdapterResult> {
  const resolution = resolveAlias(decision.selected_model_alias, registry);
  if (!resolution.ok) {
    return { ok: false, error: resolution.error, surface: "claude-code" };
  }

  const result = await atomicWriteClaudeCodeConfig(configPath, resolution.modelId);
  if (result.ok) return result;

  if (policy !== undefined && reasonCodes !== undefined) {
    const callback = vaultRoot
      ? createAuditingCallback(
          vaultRoot,
          {
            surface: decision.surface,
            taskCategory: decision.taskCategory,
            operatorOverride: decision.operator_override,
          },
          onFallback,
        )
      : onFallback;
    const fallback = orchestrateFallback(decision, registry, policy, reasonCodes, result.error);
    callback?.(fallback);

    if (fallback.ok) {
      const fbResolution = resolveAlias(fallback.decision.selected_model_alias, registry);
      if (!fbResolution.ok) {
        return { ok: false, error: fbResolution.error, surface: "claude-code" };
      }
      return atomicWriteClaudeCodeConfig(configPath, fbResolution.modelId);
    }

    return { ok: false, error: fallback.error.message, surface: "claude-code" };
  }

  return result;
}
