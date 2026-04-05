import { readFile } from "node:fs/promises";
import { CnsError } from "../errors.js";
import { resolveVaultPath } from "../paths.js";
import { getRealVaultRoot, resolveReadTargetCanonical } from "../read-boundary.js";

/**
 * Read a note file by vault-relative path. Lexical boundary via `resolveVaultPath`, then canonical (`realpath`) before read.
 */
export async function vaultReadFile(vaultRoot: string, userPath: string): Promise<string> {
  const absolute = resolveVaultPath(vaultRoot, userPath);
  const realRoot = await getRealVaultRoot(vaultRoot);
  const canonical = await resolveReadTargetCanonical(realRoot, absolute, {
    path: userPath,
    notFoundMessage: `No file at vault path: ${userPath}`,
  });

  try {
    return await readFile(canonical, "utf8");
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      throw new CnsError("NOT_FOUND", `No file at vault path: ${userPath}`, { path: userPath });
    }
    if (code === "EISDIR") {
      throw new CnsError("IO_ERROR", `Path is a directory, not a file: ${userPath}`, { path: userPath });
    }
    throw new CnsError("IO_ERROR", `Failed to read file: ${userPath}`, { path: userPath });
  }
}
