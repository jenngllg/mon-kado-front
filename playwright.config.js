import { defineConfig } from "@playwright/test";

const port = Number(process.env.MONKADO_E2E_PORT || 5173);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    browserName: "chromium",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm exec vite build --mode e2e --outDir .e2e-dist && pnpm exec vite preview --outDir .e2e-dist --host localhost --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    env: { VITE_API_BASE_URL: "http://localhost:7000", VITE_GOOGLE_AUTH_ENABLED: "false" },
  },
});
