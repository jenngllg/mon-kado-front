import { BrowserClient, defaultStackParser, makeFetchTransport } from "@sentry/browser";
import { ApiError, isAbortError } from "../api/apiError.js";

const Categories = new Set(["browser", "promise", "startup", "network", "timeout", "invalidResponse", "server"]);

/** Reads opt-in public settings without making application startup depend on telemetry.
 * @param {Record<string, unknown>} env Build configuration.
 * @returns {{dsn: string, environment: string, release: string} | null} Strict configuration or disabled.
 */
export function readTelemetryConfiguration(env) {
  if (env.VITE_SENTRY_ENABLED !== "true" || typeof env.VITE_SENTRY_DSN !== "string" ||
    !["preproduction", "production"].includes(String(env.VITE_SENTRY_ENVIRONMENT)) ||
    typeof env.VITE_SENTRY_RELEASE !== "string" || !/^[a-f0-9]{40}$/.test(env.VITE_SENTRY_RELEASE)) return null;
  try {
    const url = new URL(env.VITE_SENTRY_DSN);
    if (url.protocol !== "https:" || !/^o\d+\.ingest(?:\.[a-z]+)?\.sentry\.io$/.test(url.hostname) ||
      !/^[a-f0-9]{32}$/.test(url.username) || url.password || url.port || url.search || url.hash || !/^\/\d+$/.test(url.pathname)) return null;
    return { dsn: url.href, environment: String(env.VITE_SENTRY_ENVIRONMENT), release: env.VITE_SENTRY_RELEASE };
  } catch { return null; }
}

/** Projects an SDK event by allowlist; no exception, URL, user, request or breadcrumb survives.
 * @param {import("@sentry/browser").ErrorEvent} event SDK event.
 * @returns {import("@sentry/browser").ErrorEvent | null} Minimal diagnostic.
 */
export function sanitizeTelemetryEvent(event) {
  if (!Categories.has(event.message ?? "")) return null;
  return { type: undefined, event_id: crypto.randomUUID().replaceAll("-", ""),
    message: event.message, level: "error", platform: "javascript" };
}

/** @typedef {{captureEvent: (event: {message: string}) => unknown, close: (timeout: number) => PromiseLike<boolean>}} ErrorClient */

/** Creates an isolated, bounded reporter, without global SDK instrumentation.
 * @param {Record<string, unknown>} env Build configuration.
 * @param {(options: ConstructorParameters<typeof BrowserClient>[0]) => ErrorClient} [createClient] Test seam.
 */
export function createErrorReporter(env, createClient = options => new BrowserClient(options)) {
  const config = readTelemetryConfiguration(env);
  /** @type {ErrorClient | null} */ let client = null;
  let disposed = false;
  const sent = new Set();
  if (config) {
    try {
      client = createClient({ ...config, integrations: [], stackParser: defaultStackParser,
        transport: makeFetchTransport, transportOptions: { fetchOptions: { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", redirect: "error" } },
        beforeSend: event => {
          const safe = sanitizeTelemetryEvent(event);
          return safe ? { ...safe, environment: config.environment, release: config.release } : null;
        },
        sendClientReports: false, maxBreadcrumbs: 0,
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
          urlQueryParams: false, stackFrameVariables: false, frameContextLines: 0 },
        tracesSampleRate: 0, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
      });
    } catch { /* Reporting must never prevent startup. */ }
  }
  return Object.freeze({
    /** @param {unknown} error Failure, never forwarded. @param {"browser" | "promise" | "startup"} [source] Fixed origin. */
    report(error, source = "browser") {
      if (!client || disposed || isAbortError(error)) return;
      let category = /** @type {string} */ (source);
      if (error instanceof ApiError) {
        if (error.kind === "http" && (error.statusCode ?? 0) < 500) return;
        category = error.kind === "http" ? "server" : error.kind;
      }
      if (!Categories.has(category) || sent.has(category)) return;
      sent.add(category);
      try { client.captureEvent({ message: category }); } catch { /* A collector failure stays invisible to users. */ }
    },
    dispose() {
      if (disposed) return;
      disposed = true; sent.clear();
      const current = client; client = null;
      try { void Promise.resolve(current?.close(0)).catch(() => {}); } catch { /* No shutdown dependency on the collector. */ }
    },
  });
}
