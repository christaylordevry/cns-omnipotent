import { resolveRoutingDecision } from "../src/routing/decision-engine.js";
import { applyGeminiCliAdapter } from "../src/routing/adapters/gemini-cli.js";
import policy from "../config/model-routing/policy.defaults.json" assert { type: "json" };
import registry from "../config/model-routing/model-alias-registry.json" assert { type: "json" };
import reasonCodes from "../config/model-routing/reason-codes.json" assert { type: "json" };

const context = {
  surface: "gemini-cli" as const,
  taskCategory: "analysis" as const,
  operatorOverride: false,
};

async function main() {
  const result = resolveRoutingDecision(
    context,
    policy,
    registry,
    reasonCodes.reason_codes,
  );

  if (!result.ok) {
    console.log("Routing failed:", result.error);
    process.exitCode = 1;
    return;
  }

  console.log("Decision:", result.decision);

  const vaultRoot =
    process.env.CNS_VAULT_ROOT ??
    "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE";

  const adapterResult = await applyGeminiCliAdapter(
    result.decision,
    registry,
    `${process.env.HOME}/.gemini/settings.json`,
    policy,
    reasonCodes.reason_codes,
    undefined,
    vaultRoot,
  );

  console.log("Adapter result:", adapterResult);
  if (!adapterResult.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

