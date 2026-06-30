/**
 * Story 82-5 — Resolve node/npx/tsx without relying on ambient PATH.
 * Mirrors plugin.py _resolve_node_bin + prefetch tsx runner selection.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";

function expandHome(p) {
  return p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
}

function whichOnPath(cmd) {
  try {
    return execFileSync("which", [cmd], {
      encoding: "utf8",
      env: process.env,
    }).trim();
  } catch {
    return "";
  }
}

function compareNodeVersions(a, b) {
  const parse = (v) => v.replace(/^v/, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

/** @returns {string} Absolute path to node binary (or "node" last resort). */
export function resolveNodeExecutable() {
  for (const key of ["CNS_NODE_BIN", "NODE_BIN"]) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const candidate = resolve(expandHome(raw));
    if (existsSync(candidate)) {
      return candidate;
    }
    const found = whichOnPath(raw);
    if (found) {
      return found;
    }
  }

  const nvmRoot = join(homedir(), ".nvm", "versions", "node");
  if (existsSync(nvmRoot)) {
    const versions = readdirSync(nvmRoot)
      .filter((v) => existsSync(join(nvmRoot, v, "bin", "node")))
      .sort(compareNodeVersions);
    if (versions.length > 0) {
      return resolve(join(nvmRoot, versions[versions.length - 1], "bin", "node"));
    }
  }

  const found = whichOnPath("node");
  return found || "node";
}

/**
 * @param {{ repoRoot: string, cliEntry: string, argv: string[] }} params
 * @returns {{ cmd: string, args: string[] }}
 */
export function resolveTsxRunner(params) {
  const nodeBin = resolveNodeExecutable();
  const nodeBinDir = isAbsolute(nodeBin) ? dirname(nodeBin) : "";
  const tailArgs = [...params.argv];

  const localTsx = join(params.repoRoot, "node_modules", ".bin", "tsx");
  if (existsSync(localTsx)) {
    return { cmd: nodeBin, args: [localTsx, params.cliEntry, ...tailArgs], nodeBinDir };
  }

  const tsxCli = join(params.repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  if (existsSync(tsxCli)) {
    return { cmd: nodeBin, args: [tsxCli, params.cliEntry, ...tailArgs], nodeBinDir };
  }

  if (nodeBinDir) {
    const npxPath = join(nodeBinDir, "npx");
    if (existsSync(npxPath)) {
      return { cmd: npxPath, args: ["tsx", params.cliEntry, ...tailArgs], nodeBinDir };
    }
  }

  if (nodeBinDir) {
    const globalTsx = join(nodeBinDir, "tsx");
    if (existsSync(globalTsx)) {
      return { cmd: globalTsx, args: [params.cliEntry, ...tailArgs], nodeBinDir };
    }
  }

  return { cmd: "npx", args: ["tsx", params.cliEntry, ...tailArgs], nodeBinDir };
}

export function pathWithNodeBin(currentPath, nodeBinDir) {
  if (!nodeBinDir) return currentPath ?? "";
  const parts = (currentPath ?? "").split(delimiter).filter(Boolean);
  if (parts.includes(nodeBinDir)) return currentPath ?? "";
  return [nodeBinDir, ...parts].join(delimiter);
}
