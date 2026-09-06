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
    files: ["tools/**/*.js", "tests/**/*.js", "vite.config.js"],
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
      "tests/router.test.js",
      "tests/applicationRoutes.test.js",
      "tests/applicationShell.test.js",
      "tests/uiFoundationRegression.test.js",
      "tests/sessionApplication.test.js",
      "tests/registrationView.test.js",
      "tests/emailConfirmationView.test.js",
      "tests/profileView.test.js",
      "tests/loginView.test.js",
      "tests/loginApplication.test.js",
      "tests/passwordRecoveryViews.test.js",
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
];
