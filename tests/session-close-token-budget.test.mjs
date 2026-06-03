import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { estimateTokens, SECTION8_DRAFT_TOKEN_LIMIT } from "../scripts/session-close/lib/token-estimate.mjs";
import { SECTION8_INPUT_TOKEN_LIMIT } from "../scripts/session-close/prepare-section8-input.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/session-close");
const skillPath = join(skillDir, "SKILL.md");
const section8SynthesisPath = join(skillDir, "references/section8-synthesis.md");
const section8InputFixturePath = join(root, "tests/fixtures/session-close/section8-input-fixture.json");

const LLM_PATH_TOKEN_BUDGET = 5000;

describe("Story 59-1 session-close LLM path token budget", () => {
  it("keeps activation + synthesis inputs within 5k estimated tokens", () => {
    const skillBody = readFileSync(skillPath, "utf8");
    const frontmatterEnd = skillBody.indexOf("---", 3);
    const skillContent = frontmatterEnd >= 0 ? skillBody.slice(frontmatterEnd + 3) : skillBody;
    const synthesis = readFileSync(section8SynthesisPath, "utf8");
    const section8Input = readFileSync(section8InputFixturePath, "utf8");

    const skillTokens = estimateTokens(skillContent.trim());
    const synthesisTokens = estimateTokens(synthesis);
    const inputTokens = estimateTokens(section8Input);
    const draftReserve = SECTION8_DRAFT_TOKEN_LIMIT;
    const total = skillTokens + synthesisTokens + inputTokens + draftReserve;

    assert.ok(skillTokens <= 1200, `SKILL body tokens ${skillTokens} exceed 1200`);
    assert.ok(inputTokens <= SECTION8_INPUT_TOKEN_LIMIT);
    assert.ok(total <= LLM_PATH_TOKEN_BUDGET, `LLM path subset ${total} exceeds ${LLM_PATH_TOKEN_BUDGET}`);
  });
});
