import { test as base, expect } from "@playwright/test";

// Remove providers before disposing their request context. Quiet SSE routes stay
// intentionally pending; waiting for them would hang after all assertions passed.
export const test = base.extend(/** @type {import('@playwright/test').Fixtures<{routeCleanup:void}, {}, import('@playwright/test').PlaywrightTestArgs, import('@playwright/test').PlaywrightWorkerArgs>} */ ({
  routeCleanup: [async ({ context }, use) => {
    await use();
    await context.unrouteAll({ behavior: "ignoreErrors" });
  }, { auto: true }],
}));

export { expect };
