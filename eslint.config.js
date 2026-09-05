import eslint from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["coverage/", "dist/"],
  },
  eslint.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      sourceType: "module",
    },
  },
  {
    files: ["tests/**/*.js", "vite.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "module",
    },
  },
];
