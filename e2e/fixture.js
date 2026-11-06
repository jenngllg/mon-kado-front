import { test as base, expect } from "@playwright/test";

// Drain mock responses before Playwright disposes their request context. This is
// an automatic fixture so teardown runs for every importing test file.
export const test = base.extend(/** @type {import('@playwright/test').Fixtures<{routeCleanup:void}, {}, import('@playwright/test').PlaywrightTestArgs, import('@playwright/test').PlaywrightWorkerArgs>} */ ({
  routeCleanup: [async ({ context }, use) => {
    await use();
    await context.unrouteAll({ behavior: "wait" });
  }, { auto: true }],
}));

export { expect };
