import { CnsError } from "../errors.js";
import { isContractManifestReadmePath, isInboxVaultPath } from "./path-rules.js";
import { pakeStandardFrontmatterSchema } from "./schemas.js";
import type { ZodError } from "zod";

function zodToSchemaInvalidDetails(err: ZodError): Record<string, unknown> {
  return {
    issues: err.issues.map((i) => ({
      path: i.path.length > 0 ? i.path.map(String).join(".") : "(root)",
      message: i.message,
      code: i.code,
    })),
  };
}

/**
 * Validate PAKE Standard frontmatter for a vault-relative path.
 * - Under 00-Inbox at any depth: no-op (path-based exemption).
 * - Paths ending in /_README.md (contract manifests): no-op (Phase 1 skip).
 * - Otherwise: require object-shaped data satisfying PAKE Standard for declared pake_type.
 */
export function validatePakeForVaultPath(vaultRelativePosix: string, frontmatter: unknown): void {
  if (isInboxVaultPath(vaultRelativePosix) || isContractManifestReadmePath(vaultRelativePosix)) {
    return;
  }

  if (frontmatter === null || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    throw new CnsError("SCHEMA_INVALID", "Frontmatter must be a YAML mapping object", {
      issues: [{ path: "(root)", message: "expected object", code: "invalid_type" }],
    });
  }

  const parsed = pakeStandardFrontmatterSchema.safeParse(frontmatter);
  if (!parsed.success) {
    throw new CnsError("SCHEMA_INVALID", "Frontmatter does not satisfy PAKE Standard", zodToSchemaInvalidDetails(parsed.error));
  }
}
