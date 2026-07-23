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
  "scripts/hermes-skill-examples/morning-digest/scripts/vendor/**",
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
        URLSearchParams: "readonly",
        fetch: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
    },
  },
  // OPS-7: ban listener-only hung abort mocks in tests (mjs + ts).
  // AbortSignal.timeout unrefs its timer — raw addEventListener('abort') never
  // settles and silently cancels the suite. Funnel through abort-mock helper.
  {
    files: ["tests/**/*.mjs", "tests/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='addEventListener'][arguments.0.value='abort']",
          message:
            "AbortSignal.timeout unrefs its timer — a listener-only abort mock never settles and silently cancels the suite. Use the shared abort-mock helper (OPS-6).",
        },
        {
          // Ordinary alternate spelling of the same hung-listener trap (OPS-7 review).
          // Do not chase computed/variable event names — deliberate evasion, out of scope.
          selector: "AssignmentExpression[left.property.name='onabort']",
          message:
            "AbortSignal.timeout unrefs its timer — a listener-only abort mock never settles and silently cancels the suite. Use the shared abort-mock helper (OPS-6).",
        },
      ],
    },
  },
  // OPS-7 allowlist: sole audited abort listener lives in the helper.
  {
    files: ["tests/helpers/abort-mock.mjs"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
