import {
  ApiError,
  createAbortError,
} from "./apiError.js";
import { CsrfTokenManager } from "./csrfTokenManager.js";

const AuthenticationModes = new Set(["none", "optional", "required"]);
const DefaultTimeoutMilliseconds = 15_000;
const JsonContentType = "application/json";

/**
 * @typedef {import("./generated/openapi.js").components["schemas"]["ErrorResponse"]} ErrorResponse
 */

/**
 * @typedef {import("./generated/openapi.js").components["schemas"]["ValidationError"]} ValidationError
 */

/**
 * @typedef {"none" | "optional" | "required"} AuthenticationMode
 */

/**
 * @typedef {Readonly<{
 *   correlationId: string,
 *   etag: string | null,
 *   location: string | null,
 *   retryAfterSeconds: number | null
 * }>} ApiResponseMetadata
 */

/**
 * @template TData
 * @typedef {Readonly<{
 *   data: TData | null,
 *   status: number,
 *   metadata: ApiResponseMetadata
 * }>} ApiResponse
 */

/**
 * @typedef {{
 *   method?: string,
 *   body?: unknown,
 *   authentication?: AuthenticationMode,
 *   csrf?: boolean,
 *   ifMatch?: string,
 *   shareToken?: string,
 *   signal?: AbortSignal,
 *   timeoutMs?: number
 * }} ApiRequestOptions
 */

/**
 * Central HTTP client for the MonKado API.
 */
export class ApiClient {
  #accessTokenProvider;
  #baseUrl;
  #correlationIdProvider;
  #csrfTokenManager;
  #fetch;
  #onUnauthorized;
  #timeoutMs;

  /**
   * @param {{
   *   baseUrl: string,
   *   fetchImplementation?: typeof fetch,
   *   accessTokenProvider?: () => string | null,
   *   onUnauthorized?: (error: ApiError) => void,
   *   correlationIdProvider?: () => string,
   *   timeoutMs?: number
   * }} options Client dependencies and defaults.
   */
  constructor({
    baseUrl,
    fetchImplementation = globalThis.fetch.bind(globalThis),
    accessTokenProvider = () => null,
    onUnauthorized = () => {},
    correlationIdProvider = createCorrelationId,
    timeoutMs = DefaultTimeoutMilliseconds,
  }) {
    this.#baseUrl = normalizeBaseUrl(baseUrl);
    this.#fetch = fetchImplementation;
    this.#accessTokenProvider = accessTokenProvider;
    this.#onUnauthorized = onUnauthorized;
    this.#correlationIdProvider = correlationIdProvider;
    this.#timeoutMs = validateTimeout(timeoutMs);
    this.#csrfTokenManager = new CsrfTokenManager(() =>
      this.#loadCsrfToken(),
    );
  }

  /**
   * Sends one request to the configured API.
   *
   * @template TData
   * @param {string} path Root-relative API path, with an optional query string.
   * @param {ApiRequestOptions} [options] Request options.
   * @returns {Promise<ApiResponse<TData>>} Normalized API response.
   */
  async request(path, options = {}) {
    const url = createApiUrl(this.#baseUrl, path);
    const method = (options.method ?? "GET").toUpperCase();
    const authentication = options.authentication ?? "none";
    const timeoutMs = validateTimeout(options.timeoutMs ?? this.#timeoutMs);
    validateAuthenticationMode(authentication);
    throwIfCallerAborted(options.signal);

    const accessToken = this.#resolveAccessToken(authentication);
    const normalizedOptions = {
      ...options,
      authentication,
      method,
      timeoutMs,
    };

    return this.#sendRequest(
      url,
      normalizedOptions,
      accessToken,
      true,
    );
  }

  /**
   * Invalidates the in-memory CSRF token.
   */
  invalidateCsrfToken() {
    this.#csrfTokenManager.invalidateToken();
  }

  /**
   * Fetches and stores a fresh CSRF token.
   *
   * @returns {Promise<void>} Completion signal.
   */
  async refreshCsrfToken() {
    await this.#csrfTokenManager.refreshToken();
  }

  /**
   * @template TData
   * @param {URL} url Validated request URL.
   * @param {ApiRequestOptions & { method: string, timeoutMs: number }} options Request options.
   * @param {string | null} accessToken Access token selected for this request.
   * @param {boolean} allowCsrfRetry Whether one CSRF recovery attempt remains.
   * @returns {Promise<ApiResponse<TData>>} Normalized response.
   */
  async #sendRequest(
    url,
    options,
    accessToken,
    allowCsrfRetry,
  ) {
    throwIfCallerAborted(options.signal);
    const csrfToken = options.csrf
      ? await waitForWithAbort(
        this.#csrfTokenManager.getToken(),
        options.signal,
      )
      : null;
    throwIfCallerAborted(options.signal);

    const correlationId = this.#correlationIdProvider();
    const headers = createRequestHeaders({
      correlationId,
      accessToken,
      csrfToken,
      ifMatch: options.ifMatch,
      shareToken: options.shareToken,
      hasBody: options.body !== undefined,
    });
    let requestBody;

    try {
      requestBody = options.body === undefined ? undefined : JSON.stringify(options.body);
    } catch {
      throw new TypeError("The API request body cannot be serialized as JSON.");
    }
    const { response, metadata, decodedResponse } = await this.#fetchWithTimeout(
      url,
      {
        method: options.method,
        headers,
        body: requestBody,
        credentials: "include",
      },
      options.signal,
      options.timeoutMs,
      correlationId,
      (response, metadata) => {
        if (response.status === 401 && accessToken !== null) {
          this.#notifyUnauthorized(new ApiError({
            kind: "http",
            statusCode: 401,
            correlationId: metadata.correlationId,
            retryAfterSeconds: metadata.retryAfterSeconds,
          }));
        }
      },
    );

    if (response.ok) {
      if (!decodedResponse.isValid) {
        throw new ApiError({
          kind: "invalidResponse",
          statusCode: response.status,
          correlationId: metadata.correlationId,
        });
      }

      return Object.freeze({
        data: /** @type {TData | null} */ (decodedResponse.data),
        status: response.status,
        metadata,
      });
    }

    const errorResponse = parseErrorResponse(
      decodedResponse.data,
      response.status,
    );

    if (
      options.csrf &&
      allowCsrfRetry &&
      response.status === 400 &&
      errorResponse === null
    ) {
      await waitForWithAbort(this.#csrfTokenManager.refreshToken(), options.signal);

      return this.#sendRequest(
        url,
        options,
        accessToken,
        false,
      );
    }

    const apiError = new ApiError({
      kind: "http",
      statusCode: response.status,
      errorCode: errorResponse?.errorCode ?? null,
      validationErrors: errorResponse?.validationErrors ?? [],
      correlationId: metadata.correlationId,
      retryAfterSeconds: metadata.retryAfterSeconds,
    });

    throw apiError;
  }

  /**
   * @returns {Promise<string>} Fresh CSRF request token.
   */
  async #loadCsrfToken() {
    const url = createApiUrl(this.#baseUrl, "/security/csrf-token");
    const correlationId = this.#correlationIdProvider();
    const { response, metadata, decodedResponse } = await this.#fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: createRequestHeaders({ correlationId }),
        credentials: "include",
      },
      undefined,
      this.#timeoutMs,
      correlationId,
    );

    if (!response.ok) {
      const errorResponse = parseErrorResponse(
        decodedResponse.data,
        response.status,
      );

      throw new ApiError({
        kind: "http",
        statusCode: response.status,
        errorCode: errorResponse?.errorCode ?? null,
        validationErrors: errorResponse?.validationErrors ?? [],
        correlationId: metadata.correlationId,
        retryAfterSeconds: metadata.retryAfterSeconds,
      });
    }

    if (
      !decodedResponse.isValid ||
      !isRecord(decodedResponse.data) ||
      typeof decodedResponse.data.token !== "string" ||
      decodedResponse.data.token.trim().length === 0
    ) {
      throw new ApiError({
        kind: "invalidResponse",
        statusCode: response.status,
        correlationId: metadata.correlationId,
      });
    }

    return decodedResponse.data.token;
  }

  /**
   * @param {URL} url Request URL.
   * @param {RequestInit} request Request initialization.
   * @param {AbortSignal | undefined} callerSignal Caller cancellation signal.
   * @param {number} timeoutMs Timeout in milliseconds.
   * @param {string} correlationId Request correlation identifier.
   * @param {(response: Response, metadata: ApiResponseMetadata) => void} [onHeaders] Receives headers before body consumption.
   * @returns {Promise<{response: Response, metadata: ApiResponseMetadata, decodedResponse: {data: unknown, isValid: boolean}}>} Response read within the deadline.
   */
  async #fetchWithTimeout(
    url,
    request,
    callerSignal,
    timeoutMs,
    correlationId,
    onHeaders = () => {},
  ) {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const abortFromCaller = () => controller.abort();
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      throwIfCallerAborted(callerSignal);
      const response = await waitForWithAbort(this.#fetch(url, {
        ...request,
        // Custom CSRF/share headers must never follow a redirect to another origin.
        redirect: "error",
        signal: controller.signal,
      }), controller.signal);
      const metadata = createResponseMetadata(response, correlationId);
      correlationId = metadata.correlationId;
      onHeaders(response, metadata);
      const decodedResponse = await waitForWithAbort(
        decodeResponse(response),
        controller.signal,
      );

      return { response, metadata, decodedResponse };
    } catch {
      if (callerSignal?.aborted) {
        throw createAbortError();
      }

      if (timedOut) {
        throw new ApiError({
          kind: "timeout",
          correlationId,
        });
      }

      throw new ApiError({
        kind: "network",
        correlationId,
      });
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  /**
   * @param {AuthenticationMode} authentication Authentication mode.
   * @returns {string | null} Token to send, if any.
   */
  #resolveAccessToken(authentication) {
    if (authentication === "none") {
      return null;
    }

    const token = this.#accessTokenProvider();
    const normalizedToken = typeof token === "string" && token.trim().length > 0
      ? token
      : null;

    if (authentication === "required" && normalizedToken === null) {
      throw new ApiError({
        kind: "http",
        statusCode: 401,
        errorCode: "CLIENT_AUTHENTICATION_REQUIRED",
      });
    }

    return normalizedToken;
  }

  /**
   * @param {ApiError} apiError Unauthorized response.
   */
  #notifyUnauthorized(apiError) {
    try {
      this.#onUnauthorized(apiError);
    } catch {
      // The session hook must never replace the original API failure.
    }
  }
}

/**
 * Creates a configured MonKado API client.
 *
 * @param {ConstructorParameters<typeof ApiClient>[0]} options Client options.
 * @returns {ApiClient} Configured API client.
 */
export function createApiClient(options) {
  return new ApiClient(options);
}

/**
 * @param {string} baseUrl Configured API base URL.
 * @returns {string} Normalized base URL.
 */
function normalizeBaseUrl(baseUrl) {
  let parsedBaseUrl;

  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new TypeError("The API base URL must be an absolute HTTP or HTTPS URL.");
  }

  if (
    !new Set(["http:", "https:"]).has(parsedBaseUrl.protocol) ||
    parsedBaseUrl.username || parsedBaseUrl.password
  ) {
    throw new TypeError("The API base URL must use HTTP or HTTPS without credentials.");
  }

  return parsedBaseUrl.href.replace(/\/$/, "");
}

/**
 * @param {string} baseUrl Normalized API base URL.
 * @param {string} path Requested API path.
 * @returns {URL} Validated API URL.
 */
function createApiUrl(baseUrl, path) {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    throw new TypeError("API requests require a root-relative path.");
  }

  const url = new URL(path, baseUrl);
  const configuredUrl = new URL(baseUrl);

  if (url.origin !== configuredUrl.origin || url.hash.length > 0) {
    throw new TypeError("API requests cannot target another origin or contain a fragment.");
  }

  return url;
}

/**
 * @param {AuthenticationMode} authentication Authentication mode.
 */
function validateAuthenticationMode(authentication) {
  if (!AuthenticationModes.has(authentication)) {
    throw new TypeError(`Unsupported authentication mode: ${authentication}.`);
  }
}

/**
 * @param {number} timeoutMs Timeout value.
 * @returns {number} Validated timeout.
 */
function validateTimeout(timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("The API timeout must be a positive number.");
  }

  return timeoutMs;
}

/**
 * @param {AbortSignal | undefined} signal Optional caller signal.
 */
function throwIfCallerAborted(signal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

/**
 * Waits for shared work while preserving independent caller cancellation.
 *
 * @template T
 * @param {Promise<T>} promise Shared operation.
 * @param {AbortSignal | undefined} signal Optional caller signal.
 * @returns {Promise<T>} Shared result or caller abort.
 */
function waitForWithAbort(promise, signal) {
  if (signal === undefined) {
    return promise;
  }

  throwIfCallerAborted(signal);

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      signal.removeEventListener("abort", handleAbort);
      reject(createAbortError());
    };
    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      },
    );
  });
}

/**
 * @param {{
 *   correlationId: string,
 *   accessToken?: string | null,
 *   csrfToken?: string | null,
 *   ifMatch?: string,
 *   shareToken?: string,
 *   hasBody?: boolean
 * }} values Header values.
 * @returns {Headers} Request headers.
 */
function createRequestHeaders({
  correlationId,
  accessToken = null,
  csrfToken = null,
  ifMatch,
  shareToken,
  hasBody = false,
}) {
  // Headers validation errors may echo their values, including credentials.
  const values = [correlationId, accessToken, csrfToken, ifMatch, shareToken];

  if (values.some(value => value != null && [...value].some(character =>
    (character.charCodeAt(0) < 32 && character !== "\t") || character.charCodeAt(0) > 255))) {
    throw new TypeError("An API request header is invalid.");
  }

  const headers = new Headers({
    Accept: JsonContentType,
    "X-Correlation-ID": correlationId,
  });

  if (hasBody) {
    headers.set("Content-Type", JsonContentType);
  }

  if (accessToken !== null) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (csrfToken !== null) {
    headers.set("X-CSRF-TOKEN", csrfToken);
  }

  setOptionalHeader(headers, "If-Match", ifMatch);
  setOptionalHeader(headers, "X-MonKado-Share-Token", shareToken);

  return headers;
}

/**
 * @param {Headers} headers Request headers.
 * @param {string} name Header name.
 * @param {string | undefined} value Optional value.
 */
function setOptionalHeader(headers, name, value) {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} cannot be empty.`);
  }

  headers.set(name, value);
}

/**
 * @param {Response} response Fetch response.
 * @returns {Promise<{ data: unknown, isValid: boolean }>} Decoded response body.
 */
async function decodeResponse(response) {
  if (response.status === 204 || response.status === 205) {
    return { data: null, isValid: true };
  }

  const responseText = await response.text();

  if (responseText.length === 0) {
    return { data: null, isValid: true };
  }

  const contentType = response.headers.get("Content-Type") ?? "";

  if (!isJsonContentType(contentType)) {
    return { data: null, isValid: false };
  }

  try {
    return { data: JSON.parse(responseText), isValid: true };
  } catch {
    return { data: null, isValid: false };
  }
}

/**
 * @param {string} contentType Response content type.
 * @returns {boolean} Whether the response is JSON.
 */
function isJsonContentType(contentType) {
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();

  return mediaType === JsonContentType || mediaType.endsWith("+json");
}

/**
 * @param {Response} response Fetch response.
 * @param {string} requestCorrelationId Correlation ID sent by the client.
 * @returns {ApiResponseMetadata} Normalized response metadata.
 */
function createResponseMetadata(response, requestCorrelationId) {
  return Object.freeze({
    correlationId:
      response.headers.get("X-Correlation-ID") ?? requestCorrelationId,
    etag: response.headers.get("ETag"),
    location: response.headers.get("Location"),
    retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
  });
}

/**
 * @param {string | null} value Retry-After header.
 * @returns {number | null} Delay in whole seconds.
 */
function parseRetryAfter(value) {
  if (value === null) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isInteger(seconds) && seconds >= 0) {
    return seconds;
  }

  const retryAt = Date.parse(value);

  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000));
}

/**
 * @param {unknown} value Parsed response body.
 * @param {number} responseStatus Actual HTTP status.
 * @returns {{ errorCode: string | null, validationErrors: import("./apiError.js").ApiValidationError[] } | null} Parsed error response.
 */
function parseErrorResponse(value, responseStatus) {
  if (!isErrorResponse(value, responseStatus)) {
    return null;
  }

  return {
    errorCode: value.errorCode,
    validationErrors: value.validationErrors === null
      ? []
      : value.validationErrors.map((validationError) => ({
        propertyName: validationError.propertyName,
        errorMessage: validationError.errorMessage,
      })),
  };
}

/**
 * @param {unknown} value Potential structured API error.
 * @param {number} responseStatus Actual HTTP status.
 * @returns {value is ErrorResponse} Whether the error matches the generated contract.
 */
function isErrorResponse(value, responseStatus) {
  return isRecord(value) &&
    value.statusCode === responseStatus &&
    isNullableString(value.title) &&
    isNullableString(value.message) &&
    isNullableString(value.errorCode) &&
    isValidationErrorCollection(value.validationErrors);
}

/**
 * @param {unknown} value Potential record.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value Potential nullable string.
 * @returns {value is string | null} Whether the value is nullable text.
 */
function isNullableString(value) {
  return value === null || typeof value === "string";
}

/**
 * @param {unknown} value Potential validation errors.
 * @returns {value is ValidationError[] | null} Whether the value has the expected shape.
 */
function isValidationErrorCollection(value) {
  return value === null || (
    Array.isArray(value) &&
    value.every((validationError) =>
      isRecord(validationError) &&
      isNullableString(validationError.propertyName) &&
      isNullableString(validationError.errorMessage),
    )
  );
}

/**
 * @returns {string} New request correlation identifier.
 */
function createCorrelationId() {
  return globalThis.crypto.randomUUID();
}
