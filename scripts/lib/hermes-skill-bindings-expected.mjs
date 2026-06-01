import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "..", "hermes-skill-bindings-expected.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

/** @type {readonly string[]} */
export const PARITY_SKILLS = Object.freeze([...manifest.parity_skills]);

export const EXPECTED_CHANNEL_SKILL_BINDINGS = manifest.channel_skill_bindings;
