import { readFile } from "node:fs/promises";
import path from "node:path";
import { CnsError } from "../errors.js";
import { getImplementationRepoRoot } from "../implementation-root.js";
import type { CompiledSecretPattern, SecretPatternsFile } from "./pattern-config.js";
import { secretPatternsFileSchema } from "./pattern-config.js";

const VAULT_OVERRIDE_REL = "_meta/schemas/secret-patterns.json";

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new CnsError("IO_ERROR", `Invalid JSON in secret patterns file: ${filePath}`, {
      path: filePath,
    });
  }
}

function compilePatterns(file: SecretPatternsFile, sourceLabel: string): CompiledSecretPattern[] {
  const out: CompiledSecretPattern[] = [];
  for (const p of file.patterns) {
    try {
      out.push({ id: p.id, regex: new RegExp(p.regex, "m") });
    } catch {
      throw new CnsError("IO_ERROR", `Invalid regex for pattern "${p.id}" in ${sourceLabel}`, {
        patternId: p.id,
      });
    }
  }
  return out;
}

async function loadAndCompile(absPath: string, label: string): Promise<CompiledSecretPattern[]> {
  const data = await readJsonFile(absPath);
  const parsed = secretPatternsFileSchema.safeParse(data);
  if (!parsed.success) {
    throw new CnsError("IO_ERROR", `Malformed secret patterns config: ${absPath}`, {
      path: absPath,
    });
  }
  return compilePatterns(parsed.data, label);
}

/**
 * Baseline patterns from `config/secret-patterns.json` plus optional vault merge.
 * Vault file `{vaultRoot}/_meta/schemas/secret-patterns.json` appends patterns only;
 * baseline entries are always enforced (vault cannot remove them).
 */
export async function loadMergedSecretPatterns(vaultRoot: string): Promise<CompiledSecretPattern[]> {
  const repoRoot = getImplementationRepoRoot();
  const baselinePath = path.join(repoRoot, "config", "secret-patterns.json");
  const baseline = await loadAndCompile(baselinePath, baselinePath);

  const vaultPath = path.join(vaultRoot, ...VAULT_OVERRIDE_REL.split("/"));
  try {
    const extra = await loadAndCompile(vaultPath, vaultPath);
    return [...baseline, ...extra];
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return baseline;
    }
    throw e;
  }
}
