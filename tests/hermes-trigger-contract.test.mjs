import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = (name) => join(repoRoot, "scripts/hermes-skill-examples", name);

/** @type {readonly string[]} */
export const TRIGGER_CONTRACT_SKILLS = [
  "notebook-query",
  "triage",
  "vault-think",
  "investigate-trend",
  "vault-lint",
  "vault-graduate",
  "morning-digest",
  "session-close",
  "run-chain",
];

const MATCH_TRIGGER_HEADING = /^#+\s*.*Match trigger\s*$/m;

function readSkillFile(skill, relativePath) {
  const path = join(skillDir(skill), relativePath);
  assert.ok(existsSync(path), `${skill}: missing ${relativePath}`);
  return readFileSync(path, "utf8");
}

describe("Story 54-4 Hermes trigger-contract (REFERENCE ONLY)", () => {
  for (const skill of TRIGGER_CONTRACT_SKILLS) {
    const taskPromptPath = join(skillDir(skill), "references/task-prompt.md");

    it(`${skill} task-prompt documents REFERENCE ONLY invocation when present`, () => {
      if (!existsSync(taskPromptPath)) {
        assert.equal(skill, "session-close");
        return;
      }
      const body = readFileSync(taskPromptPath, "utf8");
      assert.match(body, /REFERENCE ONLY/i);
      assert.match(body, /Do not re-check/i);
      assert.doesNotMatch(body, MATCH_TRIGGER_HEADING);
    });

    it(`${skill} SKILL.md Trigger / Execution / When to use cites REFERENCE ONLY`, () => {
      const body = readSkillFile(skill, "SKILL.md");
      const head = body.split("\n").slice(0, 120).join("\n");
      assert.match(
        head,
        /invocation already confirmed|REFERENCE ONLY/i,
        `${skill}: SKILL.md first 120 lines must include REFERENCE ONLY invocation language`,
      );
    });
  }

  it("morning-digest trigger-pattern forbids whole-message equality as sole rule (Story 55-1)", () => {
    const body = readFileSync(
      join(skillDir("morning-digest"), "references/trigger-pattern.md"),
      "utf8",
    );
    assert.match(body, /first non-empty line|Canonical manual trigger grammar/i);
    assert.doesNotMatch(
      body,
      /entire message\*\* must match \(case-insensitive\)/i,
    );
    assert.match(body, /case-sensitive/i);
  });

  it("notebook-query task-prompt §0 remains canonical (regression anchor)", () => {
    const body = readFileSync(
      join(skillDir("notebook-query"), "references/task-prompt.md"),
      "utf8",
    );
    assert.match(body, /## 0\) REFERENCE ONLY — invocation already confirmed/);
    assert.match(body, /Proceed directly to §1/);
  });
});
