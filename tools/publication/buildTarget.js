/** Reject an unreviewed preproduction destination without exposing its contents.
 * @param {unknown} value Revision-bound public configuration.
 * @returns {void}
 */
export function verifyPreproduction(value) {
  const expected = { schemaVersion: 1, environment: "preproduction",
    frontendOrigin: "https://preprod.monkado.fr", apiOrigin: "https://api.preprod.monkado.fr",
    access: "ssh-tunnel", syntheticDataOnly: true, googleEnabled: false, telemetryEnabled: false };
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("PREPRODUCTION_CONFIGURATION_INVALID");
  const configuration = /** @type {Record<string, unknown>} */ (value);
  if (Object.keys(configuration).length !== Object.keys(expected).length ||
    Object.entries(expected).some(([key, expectedValue]) => configuration[key] !== expectedValue)) {
    throw new Error("PREPRODUCTION_CONFIGURATION_INVALID");
  }
}

/** Select build-time constants; ambient API overrides never choose a publication target.
 * @param {string} mode Vite mode.
 * @param {{apiOrigin: string, googleEnabled: boolean}} production Existing production policy.
 * @param {unknown} preproduction Private test environment configuration.
 * @returns {Record<string, string>} Vite replacements, already JSON encoded.
 */
export function buildDefinitions(mode, production, preproduction) {
  if (mode === "preproduction") {
    verifyPreproduction(preproduction);
    return {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://api.preprod.monkado.fr"),
      "import.meta.env.VITE_GOOGLE_AUTH_ENABLED": JSON.stringify("false"),
      "import.meta.env.VITE_PREPRODUCTION": JSON.stringify("true"),
      "import.meta.env.VITE_SENTRY_ENABLED": JSON.stringify("false"),
      "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(""),
      "import.meta.env.VITE_SENTRY_ENVIRONMENT": JSON.stringify(""),
      "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(""),
    };
  }
  return {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(mode === "e2e" ? "http://localhost:7000" : production.apiOrigin),
    "import.meta.env.VITE_GOOGLE_AUTH_ENABLED": JSON.stringify(mode === "e2e" ? "false" : String(production.googleEnabled)),
    "import.meta.env.VITE_PREPRODUCTION": JSON.stringify("false"),
  };
}
