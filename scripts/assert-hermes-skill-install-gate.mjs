#!/usr/bin/env node
/**
 * Story 54-1: Hermes skill install gate — bound skills exist on disk + NotebookLM trio parity.
 */
import { runHermesSkillInstallGate } from "./lib/hermes-skill-install-gate.mjs";

try {
  const result = runHermesSkillInstallGate();
  if (result.skipped && result.message) {
    console.log(result.message);
  }
  process.exit(0);
} catch (e) {
  const err = /** @type {Error} */ (e);
  console.error("Hermes skill install gate FAILED:");
  console.error(err.message);
  process.exit(1);
}
