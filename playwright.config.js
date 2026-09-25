import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    browserName: "chromium",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm exec vite build --mode e2e --outDir .e2e-dist && pnpm exec vite preview --outDir .e2e-dist --host localhost --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    env: { VITE_API_BASE_URL: "http://localhost:7000", VITE_GOOGLE_AUTH_ENABLED: "false" },
  },
});
