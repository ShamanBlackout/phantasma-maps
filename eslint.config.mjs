import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["build/**", "coverage/**"] },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { ignoreRestSiblings: true }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["src/**/*.test.{js,jsx}", "src/setupTests.js"],
    languageOptions: { globals: { ...globals.vitest, ...globals.node } },
  },
  {
    files: ["scripts/**/*.js", "sammy.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
    rules: js.configs.recommended.rules,
  },
  {
    files: ["*.mjs"],
    languageOptions: { globals: globals.node },
    rules: js.configs.recommended.rules,
  },
];
