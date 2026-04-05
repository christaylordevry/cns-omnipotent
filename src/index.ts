import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadRuntimeConfig } from "./config.js";
import { registerVaultIoTools } from "./register-vault-io-tools.js";

async function main() {
  // Phase 1 stdio: vault root from CNS_VAULT_ROOT only (no vaultRootFromHost).
  const cfg = await loadRuntimeConfig();

  const server = new McpServer({
    name: "cns-vault-io",
    version: "0.0.0",
  });

  registerVaultIoTools(server, cfg);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Vault IO MCP server running. vaultRoot=${cfg.vaultRoot}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
