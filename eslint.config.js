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
  {
    files: [
      "tests/actionLink.test.js",
      "tests/button.test.js",
      "tests/feedbackComponents.test.js",
      "tests/formField.test.js",
      "tests/notification.test.js",
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
];
