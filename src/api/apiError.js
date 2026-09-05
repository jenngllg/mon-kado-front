/**
 * @typedef {"http" | "network" | "timeout" | "invalidResponse"} ApiErrorKind
 */

/**
 * @typedef {import("./generated/openapi.js").components["schemas"]["ValidationError"]} ApiValidationError
 */

/**
 * Represents a safe, normalized API failure.
 */
export class ApiError extends Error {
  /**
   * @param {{
   *   kind: ApiErrorKind,
   *   statusCode?: number | null,
   *   errorCode?: string | null,
   *   validationErrors?: ReadonlyArray<ApiValidationError>,
   *   correlationId?: string | null,
   *   retryAfterSeconds?: number | null
   * }} details Normalized failure details.
   */
  constructor({
    kind,
    statusCode = null,
    errorCode = null,
    validationErrors = [],
    correlationId = null,
    retryAfterSeconds = null,
  }) {
    super(createSafeErrorMessage(kind, statusCode));
    this.name = "ApiError";
    this.kind = kind;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.validationErrors = Object.freeze(
      validationErrors.map((validationError) =>
        Object.freeze({ ...validationError }),
      ),
    );
    this.correlationId = correlationId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Identifies an abort explicitly requested by the caller.
 *
 * @param {unknown} error Potential abort error.
 * @returns {boolean} Whether the value represents an abort.
 */
export function isAbortError(error) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  );
}

/**
 * Creates an abort error without retaining a caller-provided reason.
 *
 * @returns {DOMException} Standard abort error.
 */
export function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

/**
 * @param {ApiErrorKind} kind Error category.
 * @param {number | null} statusCode HTTP status when available.
 * @returns {string} Safe diagnostic message.
 */
function createSafeErrorMessage(kind, statusCode) {
  if (kind === "http") {
    return statusCode === null
      ? "The API request failed."
      : `The API request failed with status ${statusCode}.`;
  }

  if (kind === "network") {
    return "The API could not be reached.";
  }

  if (kind === "timeout") {
    return "The API request timed out.";
  }

  return "The API returned an invalid response.";
}
