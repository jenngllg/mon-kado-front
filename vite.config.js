import { defineConfig } from "vitest/config";

export default defineConfig({
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
      },
    },
  },
});
