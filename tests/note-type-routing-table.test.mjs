import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Story 2.3 note-type routing table (guard)", () => {
  it("enforces routing table + vault_create_note + vault-io WorkflowNote disambiguation", () => {
    const agentsPath = join(root, "specs/cns-vault-contract/AGENTS.md");
    const phaseSpecPath = join(
      root,
      "specs/cns-vault-contract/CNS-Phase-1-Spec.md"
    );
    const vaultIoPath = join(
      root,
      "specs/cns-vault-contract/modules/vault-io.md"
    );

    for (const p of [agentsPath, phaseSpecPath, vaultIoPath]) {
      assert.ok(existsSync(p), `missing ${p}`);
    }

    const agentsBody = readFileSync(agentsPath, "utf8");
    const phaseSpecBody = readFileSync(phaseSpecPath, "utf8");
    const vaultIoBody = readFileSync(vaultIoPath, "utf8");

    const routingRulesIdx = agentsBody.indexOf("### Routing Rules");
    assert.ok(routingRulesIdx !== -1, "missing Routing Rules section");

    const formattingIdx = agentsBody.indexOf("## 3. Formatting Standards");
    assert.ok(formattingIdx !== -1, "missing Formatting Standards section");

    const routingSlice = agentsBody.slice(routingRulesIdx, formattingIdx);

    // Operator-facing routing table coverage (anchored to Routing Rules).
    assert.ok(routingSlice.includes("| SourceNote | 03-Resources/ |"), "missing SourceNote row");
    assert.ok(routingSlice.includes("| InsightNote | 03-Resources/ |"), "missing InsightNote row");
    assert.ok(routingSlice.includes("| SynthesisNote | 03-Resources/ |"), "missing SynthesisNote row");
    assert.ok(routingSlice.includes("| ValidationNote | 03-Resources/ |"), "missing ValidationNote row");
    assert.ok(
      routingSlice.includes("Unstructured captures always go to `00-Inbox/`."),
      "missing Inbox default routing rule"
    );

    // WorkflowNote row includes explicit disambiguation + fallback.
    assert.ok(
      routingSlice.includes("| WorkflowNote | 01-Projects/ (requires project context) or 02-Areas/"),
      "WorkflowNote row missing 'requires project context' wording"
    );
    assert.ok(
      routingSlice.includes("fallback to `02-Areas/`"),
      "WorkflowNote row missing 'fallback to `02-Areas/`' wording"
    );

    // Operator-facing disambiguation subsection exists (and uses the same stable phrases).
    assert.ok(
      routingSlice.includes("Disambiguation for WorkflowNote"),
      "missing 'Disambiguation for WorkflowNote' subsection"
    );
    assert.ok(
      routingSlice.includes("requires project context"),
      "missing 'requires project context' subsection wording"
    );
    assert.ok(
      routingSlice.includes("fallback to `02-Areas/`"),
      "missing 'fallback to `02-Areas/`' subsection wording"
    );

    // Implementer-facing: vault_create_note routing text matches AGENTS decision rule.
    assert.ok(
      phaseSpecBody.includes("#### vault_create_note"),
      "missing vault_create_note section"
    );
    assert.ok(
      phaseSpecBody.includes("WorkflowNote"),
      "vault_create_note missing WorkflowNote routing rule"
    );
    assert.ok(
      phaseSpecBody.includes("requires explicit project context"),
      "vault_create_note missing 'requires explicit project context' wording"
    );
    assert.ok(
      phaseSpecBody.includes("Do not infer project context"),
      "vault_create_note missing 'Do not infer project context' disambiguation rule"
    );
    assert.ok(
      phaseSpecBody.includes("operator or manifest disambiguation"),
      "vault_create_note missing operator/manifest disambiguation requirement"
    );

    // Implementer-facing: vault-io module guidance references the disambiguation rule.
    assert.ok(
      vaultIoBody.includes("WorkflowNote") && vaultIoBody.includes("disambiguation"),
      "vault-io.md missing WorkflowNote disambiguation guidance"
    );
    assert.ok(
      vaultIoBody.includes("`02-Areas/` root") && vaultIoBody.includes("temporary holding"),
      "vault-io.md missing 02-Areas root temporary-holding guidance"
    );
    assert.ok(
      vaultIoBody.includes("Do not infer project context"),
      "vault-io.md missing 'Do not infer project context' disambiguation rule"
    );
    assert.ok(
      vaultIoBody.includes("operator or manifest disambiguation"),
      "vault-io.md missing operator/manifest disambiguation requirement"
    );
  });
});

