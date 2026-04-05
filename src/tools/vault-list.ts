import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { CnsError } from "../errors.js";
import { PAKE_TYPE_VALUES, type PakeType } from "../pake/schemas.js";
import { getRealVaultRoot, resolveReadTargetCanonical } from "../read-boundary.js";
import { resolveVaultPath } from "../paths.js";

export type { PakeType };

export type VaultListEntry = {
  name: string;
  vaultPath: string;
  type: "file" | "directory";
  modified: string;
  pake_type?: string;
  status?: string;
};

export type VaultListOptions = {
  /** Vault-relative directory path (use `.` for root). */
  userPath: string;
  recursive?: boolean;
  filter_by_type?: PakeType;
  filter_by_status?: string;
};

export type VaultListResult = {
  path: string;
  entries: VaultListEntry[];
};

function toPosixVaultPath(...segments: string[]): string {
  const joined = path.posix.join(...segments.filter(Boolean));
  return joined.replace(/^\.\//, "") || ".";
}

function parseFrontmatterSummary(raw: string): { pake_type?: string; status?: string } {
  try {
    const { data } = matter(raw);
    if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }
    const rec = data as Record<string, unknown>;
    const pt = rec.pake_type;
    const st = rec.status;
    return {
      ...(typeof pt === "string" ? { pake_type: pt } : {}),
      ...(typeof st === "string" ? { status: st } : {}),
    };
  } catch {
    return {};
  }
}

async function buildEntry(
  realVaultRoot: string,
  dirAbsolute: string,
  dirVaultPath: string,
  name: string,
  readFrontmatter: boolean,
): Promise<VaultListEntry> {
  const childLexical = path.join(dirAbsolute, name);
  const vaultPath = toPosixVaultPath(dirVaultPath === "." ? "" : dirVaultPath, name);
  const displayVaultPath = vaultPath === "" ? name : vaultPath;
  const canonical = await resolveReadTargetCanonical(realVaultRoot, childLexical, {
    path: displayVaultPath,
    notFoundMessage: `No entry at vault path: ${displayVaultPath}`,
  });
  const st = await stat(canonical);
  const modified = st.mtime.toISOString();
  const type = st.isDirectory() ? "directory" : "file";

  const entry: VaultListEntry = {
    name,
    vaultPath: vaultPath === "" ? name : vaultPath,
    type,
    modified,
  };

  if (readFrontmatter && type === "file" && name.endsWith(".md")) {
    try {
      const raw = await readFile(canonical, "utf8");
      Object.assign(entry, parseFrontmatterSummary(raw));
    } catch {
      // omit frontmatter fields on read failure
    }
  }

  return entry;
}

async function listOneLevel(
  realVaultRoot: string,
  dirAbsolute: string,
  dirVaultPath: string,
  needFrontmatter: boolean,
): Promise<VaultListEntry[]> {
  let names: string[];
  try {
    names = await readdir(dirAbsolute);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      throw new CnsError("NOT_FOUND", `No directory at vault path: ${dirVaultPath}`, { path: dirVaultPath });
    }
    throw new CnsError("IO_ERROR", `Failed to read directory: ${dirVaultPath}`, { path: dirVaultPath });
  }

  names.sort((a, b) => a.localeCompare(b));
  const entries: VaultListEntry[] = [];
  for (const name of names) {
    entries.push(await buildEntry(realVaultRoot, dirAbsolute, dirVaultPath, name, needFrontmatter));
  }
  return entries;
}

function matchesFilters(
  entry: VaultListEntry,
  filterType: PakeType | undefined,
  filterStatus: string | undefined,
): boolean {
  if (entry.type === "directory") return true;
  if (!filterType && !filterStatus) return true;
  if (!entry.name.endsWith(".md")) return false;
  if (filterType && entry.pake_type !== filterType) return false;
  if (filterStatus && entry.status !== filterStatus) return false;
  return true;
}

/**
 * List a vault directory with metadata. Enforces vault boundary.
 */
export async function vaultListDirectory(vaultRoot: string, options: VaultListOptions): Promise<VaultListResult> {
  const { userPath, recursive = false, filter_by_type, filter_by_status } = options;
  const normalizedUser = userPath.trim() === "" ? "." : userPath;
  const dirLexical = resolveVaultPath(vaultRoot, normalizedUser);
  const realRoot = await getRealVaultRoot(vaultRoot);
  const displayPath = normalizedUser.replace(/\\/g, "/") || ".";
  const dirCanonical = await resolveReadTargetCanonical(realRoot, dirLexical, {
    path: displayPath,
    notFoundMessage: `No directory at vault path: ${normalizedUser}`,
  });

  let st: Awaited<ReturnType<typeof stat>>;
  try {
    st = await stat(dirCanonical);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      throw new CnsError("NOT_FOUND", `No directory at vault path: ${normalizedUser}`, { path: normalizedUser });
    }
    throw new CnsError("IO_ERROR", `Failed to stat path: ${normalizedUser}`, { path: normalizedUser });
  }

  if (!st.isDirectory()) {
    throw new CnsError("IO_ERROR", `Path is not a directory: ${normalizedUser}`, { path: normalizedUser });
  }

  const needFrontmatter = Boolean(filter_by_type || filter_by_status);

  let flat: VaultListEntry[] = [];

  if (!recursive) {
    flat = await listOneLevel(realRoot, dirCanonical, displayPath, needFrontmatter);
  } else {
    const queue: Array<{ abs: string; vault: string }> = [{ abs: dirCanonical, vault: displayPath }];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const { abs, vault } = queue.shift()!;
      if (seen.has(abs)) continue;
      seen.add(abs);

      const level = await listOneLevel(realRoot, abs, vault, needFrontmatter);
      for (const ent of level) {
        flat.push(ent);
        if (ent.type === "directory") {
          const childLexical = path.join(abs, ent.name);
          const childVault = ent.vaultPath;
          const childCanonical = await resolveReadTargetCanonical(realRoot, childLexical, {
            path: childVault,
            notFoundMessage: `No directory at vault path: ${childVault}`,
          });
          if (!seen.has(childCanonical)) {
            queue.push({ abs: childCanonical, vault: childVault });
          }
        }
      }
    }
    flat.sort((a, b) => a.vaultPath.localeCompare(b.vaultPath));
  }

  if (filter_by_type || filter_by_status) {
    flat = flat.filter((e) => matchesFilters(e, filter_by_type, filter_by_status));
  }

  return { path: displayPath, entries: flat };
}

export const VAULT_LIST_PAKE_TYPES = PAKE_TYPE_VALUES;
