import { defineConfig } from "vitest/config";
import publication from "./publication.json" with { type: "json" };

export default defineConfig(({ command, mode }) => ({
  define: command === "build" ? {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(mode === "e2e" ? "http://localhost:7000" : publication.apiOrigin),
    "import.meta.env.VITE_GOOGLE_AUTH_ENABLED": JSON.stringify(mode === "e2e" ? "false" : String(publication.googleEnabled)),
  } : {},
  build: {
    rollupOptions: {
      input: ["index.html", "legal-notice.html", "privacy-policy.html", "terms-of-use.html"],
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ["tests/**/*.test.js", "tools/**/*.test.js"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.js", "tools/**/*.js"],
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 97.7,
        statements: 94.28,
        functions: 94.45,
        branches: 89.76,
        "src/auth/sessionAsync.js": { 100: true },
        "src/router/pathMatcher.js": { 100: true },
        "src/api/archiveResponse.js": { 100: true },
        "src/api/utcTimestamp.js": { 100: true },
        "src/auth/twoFactorContract.js": { 100: true },
        "src/components/legalLinks.js": { 100: true },
        "src/features/privacy/*.js": { 100: true },
        "src/features/twoFactor/*.js": { 100: true },
        "tools/publication/*.js": { 100: true },
      },
    },
  },
}));
