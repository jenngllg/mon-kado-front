import { defineConfig } from "@playwright/test";

const project = process.env.MONKADO_NATIVE_PROJECT ?? "all";
const evidence = `${project}${process.env.MONKADO_NATIVE_CASE ? `/${process.env.MONKADO_NATIVE_CASE}` : ""}`;

export default defineConfig({
  testDir: "./e2e-native",
  outputDir: `./.native-e2e-results/${evidence}`,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60000,
  projects: [
    { name: "admin-mobile", testMatch: "adminAccounts.spec.js", use: { viewport: { width: 390, height: 1000 }, isMobile: true, hasTouch: true } },
    { name: "admin-desktop", testMatch: "adminAccounts.spec.js", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "push-mobile", testMatch: ["mobilePush.spec.js","pushClosed.spec.js","installedPushInvitation.spec.js"], use: { viewport: {width:390,height:1000}, isMobile:true, hasTouch:true } },
    { name: "push-desktop", testMatch: ["mobilePush.spec.js","pushClosed.spec.js","installedPushInvitation.spec.js"], use: { viewport: {width:1440,height:1000} } },
    { name: "mobile", testMatch: "journeys.spec.js", use: { viewport: { width: 390, height: 1000 }, isMobile: true, hasTouch: true } },
    { name: "desktop", testMatch: "journeys.spec.js", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "regression-mobile", testMatch: "siteRegression.spec.js", use: { viewport: { width: 390, height: 1000 }, isMobile: true, hasTouch: true } },
    { name: "regression-desktop", testMatch: "siteRegression.spec.js", use: { viewport: { width: 1440, height: 1000 } } },
    ...["authentication", "security", "wishes", "collaboration", "privacy", "moderation", "access"].flatMap(area => [
      { name: `${area}-mobile`, testMatch: `${area}Regression.spec.js`, use: { viewport: { width: 390, height: 1000 }, isMobile: true, hasTouch: true } },
      { name: `${area}-desktop`, testMatch: `${area}Regression.spec.js`, use: { viewport: { width: 1440, height: 1000 } } },
    ]),
  ],
  reporter: [["list"], ["html", { open: "never", outputFolder: `native-playwright-report/${evidence}` }]],
  use: { baseURL: "http://localhost:5296", browserName: "chromium", serviceWorkers: "block", timezoneId: "UTC",
    permissions: ["clipboard-read", "clipboard-write"], trace: "off", screenshot: "only-on-failure" },
  webServer: { command: "node node_modules/vite/bin/vite.js --host localhost --port 5296 --strictPort",
    url: "http://localhost:5296", reuseExistingServer: false,
    env: { VITE_API_BASE_URL: "http://localhost:7006", VITE_GOOGLE_AUTH_ENABLED: "false" } },
});
