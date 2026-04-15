/**
 * Version compatibility guard for policy/registry version pairs.
 *
 * Pure function: receives version strings, returns a result type.
 * No imports from config/ or node:fs.
 */

export type VersionCompatibilityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string; readonly policyVersion: string; readonly registryVersion: string };

function parseMajor(version: string): number | undefined {
  const dotIndex = version.indexOf(".");
  if (dotIndex === -1) return undefined;
  const major = parseInt(version.slice(0, dotIndex), 10);
  return Number.isNaN(major) ? undefined : major;
}

/**
 * Validates that policy and registry versions are compatible.
 *
 * Compatibility rule: major versions must match. Minor/patch
 * mismatches are allowed but produce a console.warn.
 * Non-semver strings (no dot separator) pass only if identical.
 */
export function validateVersionCompatibility(
  policyVersion: string,
  registryVersion: string,
): VersionCompatibilityResult {
  const policyMajor = parseMajor(policyVersion);
  const registryMajor = parseMajor(registryVersion);

  if (policyMajor === undefined || registryMajor === undefined) {
    if (policyVersion === registryVersion) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `Non-semver version strings do not match: policy="${policyVersion}", registry="${registryVersion}"`,
      policyVersion,
      registryVersion,
    };
  }

  if (policyMajor !== registryMajor) {
    return {
      ok: false,
      reason: `Major version mismatch: policy=${policyMajor} (${policyVersion}), registry=${registryMajor} (${registryVersion})`,
      policyVersion,
      registryVersion,
    };
  }

  if (policyVersion !== registryVersion) {
    console.warn(
      `[cns-routing] Minor/patch version mismatch (non-fatal): policy="${policyVersion}", registry="${registryVersion}"`,
    );
  }

  return { ok: true };
}
