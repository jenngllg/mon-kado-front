const ApiBaseUrlVariable = "VITE_API_BASE_URL";
const AllowedProtocols = new Set(["http:", "https:"]);

/**
 * Error raised when the public frontend configuration is invalid.
 */
export class PublicConfigurationError extends Error {
  /**
   * @param {string} message Safe error message suitable for display.
   */
  constructor(message) {
    super(message);
    this.name = "PublicConfigurationError";
  }
}

/**
 * Reads and validates the public frontend configuration.
 *
 * @param {Record<string, unknown>} environment Vite public environment values.
 * @returns {Readonly<{ apiBaseUrl: string }>} Validated public configuration.
 * @throws {PublicConfigurationError} When the API base URL is missing or invalid.
 */
export function createPublicConfiguration(environment) {
  const rawApiBaseUrl = environment[ApiBaseUrlVariable];

  if (typeof rawApiBaseUrl !== "string" || rawApiBaseUrl.trim().length === 0) {
    throw new PublicConfigurationError(
      `Missing required public configuration: ${ApiBaseUrlVariable}.`,
    );
  }

  let parsedApiBaseUrl;

  try {
    parsedApiBaseUrl = new URL(rawApiBaseUrl);
  } catch {
    throw new PublicConfigurationError(
      `${ApiBaseUrlVariable} must be an absolute HTTP or HTTPS URL.`,
    );
  }

  if (!AllowedProtocols.has(parsedApiBaseUrl.protocol)) {
    throw new PublicConfigurationError(
      `${ApiBaseUrlVariable} must use the HTTP or HTTPS protocol.`,
    );
  }

  return Object.freeze({
    apiBaseUrl: parsedApiBaseUrl.href.replace(/\/$/, ""),
  });
}
