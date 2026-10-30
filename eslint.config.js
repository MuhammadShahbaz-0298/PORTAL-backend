// Shared lint rules. Keep them small and obvious so new files do not need tuning.
const js = require("@eslint/js");
const globals = require("globals");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
  {
    ignores: ["node_modules/**", "uploads/**", "coverage/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-console": ["warn", { allow: ["error", "warn", "info"] }],
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "warn",
    },
  },
  prettierConfig,
];
