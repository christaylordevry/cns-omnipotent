import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const ignores = [
  "dist/**",
  "_bmad/**",
  "_bmad-output/**",
  "node_modules/**",
  "Knowledge-Vault-ACTIVE/**",
  ".ralph/**",
  ".claude/worktrees/**",
  "package-lock.json",
];

export default tseslint.config(
  { ignores },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["tests/**/*.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
    },
  },
);
