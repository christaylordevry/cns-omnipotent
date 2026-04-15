import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/vault-io/**/*.test.ts",
      "tests/verification/**/*.test.ts",
      "tests/brain/**/*.test.ts",
      "tests/model-routing/**/*.test.ts",
    ],
  },
});

