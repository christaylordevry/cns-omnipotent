/**
 * Shared alias-to-concrete-model resolution utility.
 *
 * Both surface adapters call this function instead of duplicating
 * registry lookup logic. The function is pure — no filesystem
 * reads, no config imports, no side effects.
 */

import type { AliasRegistry } from "../types.js";

export interface AliasResolution {
  readonly ok: true;
  readonly modelId: string;
  readonly provider: string;
}

export interface AliasResolutionError {
  readonly ok: false;
  readonly error: string;
}

export type AliasResolutionResult = AliasResolution | AliasResolutionError;

export function resolveAlias(
  alias: string,
  registry: AliasRegistry,
): AliasResolutionResult {
  if (!Object.prototype.hasOwnProperty.call(registry.aliases, alias)) {
    return {
      ok: false,
      error: `Alias "${alias}" not found in registry (registry_version: ${registry.registry_version})`,
    };
  }

  const entry = registry.aliases[alias];
  if (typeof entry.model_id !== "string" || entry.model_id.trim().length === 0) {
    return {
      ok: false,
      error: `Alias "${alias}" has invalid model_id in registry (registry_version: ${registry.registry_version})`,
    };
  }

  return {
    ok: true,
    modelId: entry.model_id,
    provider: entry.provider,
  };
}
