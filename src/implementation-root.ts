import { fileURLToPath } from "node:url";

/** Omnipotent.md repo root (versioned `config/` lives here). */
export function getImplementationRepoRoot(): string {
  return fileURLToPath(new URL("..", import.meta.url));
}
