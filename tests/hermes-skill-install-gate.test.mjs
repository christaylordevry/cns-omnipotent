import assert from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  flattenBoundSkills,
  parseChannelSkillBindings,
} from "../scripts/lib/hermes-config-bindings.mjs";
import { PARITY_SKILLS } from "../scripts/lib/hermes-skill-bindings-expected.mjs";
import { runHermesSkillInstallGate } from "../scripts/lib/hermes-skill-install-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const expectedPath = join(root, "scripts/hermes-skill-bindings-expected.json");
const fixturePath = join(root, "tests/fixtures/hermes-channel-skill-bindings.yaml");

describe("Story 54-1 Hermes skill install gate", () => {
  it("parses channel_skill_bindings list form from fixture YAML", () => {
    const fixture = readFileSync(fixturePath, "utf8");
    const parsed = parseChannelSkillBindings(fixture);
    const expected = JSON.parse(readFileSync(expectedPath, "utf8"));

    assert.strictEqual(parsed.length, expected.channel_skill_bindings.length);
    for (let i = 0; i < parsed.length; i++) {
      assert.strictEqual(parsed[i].id, expected.channel_skill_bindings[i].id);
      assert.deepStrictEqual(parsed[i].skills, expected.channel_skill_bindings[i].skills);
    }

    const flat = flattenBoundSkills(parsed).map((x) => x.skill);
    const allExpected = expected.channel_skill_bindings.flatMap((b) => b.skills);
    assert.deepStrictEqual([...new Set(flat)].sort(), [...new Set(allExpected)].sort());
  });

  it("manifest skills have repo mirrors; parity trio has install scripts", () => {
    const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
    const allSkills = expected.channel_skill_bindings.flatMap((b) => b.skills);

    for (const skill of allSkills) {
      const mirror = join(root, "scripts/hermes-skill-examples", skill, "SKILL.md");
      assert.ok(
        readFileSync(mirror, "utf8").length > 0,
        `expected repo mirror SKILL.md for ${skill}`,
      );
    }

    assert.deepStrictEqual([...PARITY_SKILLS].sort(), [...expected.parity_skills].sort());

    for (const skill of expected.parity_skills) {
      const installScript = join(root, `scripts/install-hermes-skill-${skill}.sh`);
      assert.ok(
        readFileSync(installScript, "utf8").includes("hermes-skill-examples"),
        `install script for ${skill}`,
      );
    }
  });

  it("fails when a bound skill directory is missing (temp Hermes home)", () => {
    const tmp = mkdtempSync(join(tmpdir(), "hermes-gate-"));
    const hermesHome = join(tmp, ".hermes");
    const skillsRoot = join(hermesHome, "skills", "cns");
    mkdirSync(skillsRoot, { recursive: true });

    writeFileSync(
      join(hermesHome, "config.yaml"),
      readFileSync(fixturePath, "utf8"),
      "utf8",
    );

    mkdirSync(join(skillsRoot, "triage"), { recursive: true });
    writeFileSync(join(skillsRoot, "triage", "SKILL.md"), "# triage\n", "utf8");

    assert.throws(
      () => runHermesSkillInstallGate({ hermesHome, repoRoot: root }),
      (e) => {
        assert.match(String(e.message), /missing skill/);
        assert.match(String(e.message), /1500733488897462382/);
        return true;
      },
    );
  });

  it("skips when config.yaml is missing", () => {
    const tmp = mkdtempSync(join(tmpdir(), "hermes-gate-skip-"));
    const result = runHermesSkillInstallGate({
      hermesHome: join(tmp, "empty-hermes"),
      repoRoot: root,
    });
    assert.strictEqual(result.skipped, true);
    assert.match(result.message ?? "", /Hermes config not found/);
  });
});
