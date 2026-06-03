import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildSection8Input,
  enforceSection8InputBudget,
  SECTION8_INPUT_TOKEN_LIMIT,
} from "../scripts/session-close/prepare-section8-input.mjs";
import { estimateTokens } from "../scripts/session-close/lib/token-estimate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = join(root, "tests/fixtures/session-close/section8-input-fixture.json");

describe("Story 59-1 section8-input artifact", () => {
  it("buildSection8Input keeps only synthesis fields", () => {
    const pack = {
      generated_at: "2026-06-03T00:00:00.000Z",
      mode: "dry-run",
      repo_root: "/repo",
      vault_root: "/vault",
      agents: {
        version: "1.37.0",
        section8_excerpt: "### Project Status\n- epic-59: in-progress",
        changelog_anchor_row: "| 2026-06-03 | 1.37.0 | fixture |",
      },
      sprint: {
        active_epics: [{ epic: "59", status: "in-progress", stories: ["59-1-session-close-context-reduction"] }],
        project_status_line: "Epic 59 token reduction in progress.",
      },
      recent_stories: [
        { key: "59-1-session-close-context-reduction", bullet: "Slim section8-input and SKILL router." },
        { key: "58-1-migrate-vault-export-drive-doc-sync", bullet: "Drive-backed export sync shipped." },
        { key: "48-5-session-close-slim-skill-package-and-tests", bullet: "Slim skill package baseline." },
        { key: "extra-story-should-drop", bullet: "must not appear" },
      ],
      deterministic: { export_path: "/repo/scripts/output/vault-export-for-notebooklm.md" },
      notebooklm_targets: [{ notebook_id: "00000000-0000-4000-8000-000000000001", title: "T" }],
      token_budget: { pack_tokens: 900, pack_limit: 3500 },
    };

    const input = buildSection8Input(pack);
    assert.equal(input.mode, "dry-run");
    assert.deepEqual(Object.keys(input).sort(), [
      "agents",
      "generated_at",
      "mode",
      "recent_stories",
      "sprint",
      "token_budget",
    ]);
    assert.equal(input.recent_stories.length, 3);
    assert.ok(!input.recent_stories.some((row) => row.key === "extra-story-should-drop"));
    assert.equal(input.agents.version, "1.37.0");
    assert.ok(!("notebooklm_targets" in input));
    assert.ok(!("deterministic" in input));
  });

  it("fixture section8-input stays within token cap", () => {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    const capped = enforceSection8InputBudget(fixture);
    assert.ok(capped.token_budget.input_tokens <= SECTION8_INPUT_TOKEN_LIMIT);
    assert.ok(estimateTokens(JSON.stringify(capped)) <= SECTION8_INPUT_TOKEN_LIMIT);
  });
});
