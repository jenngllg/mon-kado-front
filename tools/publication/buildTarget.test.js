import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDefinitions, verifyPreproduction } from "./buildTarget.js";

const privateTarget = JSON.parse(readFileSync(new URL("../../preproduction.json", import.meta.url), "utf8"));
const production = { apiOrigin: "https://api.monkado.fr", googleEnabled: true };

describe("isolated build target", () => {
  it("accepts only the reviewed private configuration", () => {
    expect(() => verifyPreproduction(privateTarget)).not.toThrow();
  });
  it.each([null, [], "private-canary", {}, { ...privateTarget, extra: true },
    ...Object.keys(privateTarget).map(key => ({ ...privateTarget, [key]: "private-canary" }))])(
    "rejects a changed target without leaking its contents", value => {
      expect(() => verifyPreproduction(value)).toThrow(/^PREPRODUCTION_CONFIGURATION_INVALID$/);
    });
  it("pins the API and disables Google and all telemetry settings", () => {
    expect(buildDefinitions("preproduction", production, privateTarget)).toEqual({
      "import.meta.env.VITE_API_BASE_URL": '"https://api.preprod.monkado.fr"',
      "import.meta.env.VITE_GOOGLE_AUTH_ENABLED": '"false"',
      "import.meta.env.VITE_PREPRODUCTION": '"true"',
      "import.meta.env.VITE_SENTRY_ENABLED": '"false"',
      "import.meta.env.VITE_SENTRY_DSN": '""',
      "import.meta.env.VITE_SENTRY_ENVIRONMENT": '""',
      "import.meta.env.VITE_SENTRY_RELEASE": '""',
    });
  });
  it("fails the private build before using an invalid configuration", () => {
    expect(() => buildDefinitions("preproduction", production, null)).toThrow("PREPRODUCTION_CONFIGURATION_INVALID");
  });
  it("preserves production and local E2E routing without a private banner", () => {
    const live = buildDefinitions("production", production, null);
    expect(live["import.meta.env.VITE_API_BASE_URL"]).toBe('"https://api.monkado.fr"');
    expect(live["import.meta.env.VITE_GOOGLE_AUTH_ENABLED"]).toBe('"true"');
    expect(live["import.meta.env.VITE_PREPRODUCTION"]).toBe('"false"');
    expect(live).not.toHaveProperty("import.meta.env.VITE_SENTRY_ENABLED");
    const simulated = buildDefinitions("e2e", production, null);
    expect(simulated["import.meta.env.VITE_API_BASE_URL"]).toBe('"http://localhost:7000"');
    expect(simulated["import.meta.env.VITE_GOOGLE_AUTH_ENABLED"]).toBe('"false"');
    expect(simulated["import.meta.env.VITE_PREPRODUCTION"]).toBe('"false"');
  });
});
