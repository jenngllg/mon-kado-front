import { describe, expect, it, vi } from "vitest";
import { BrowserClient } from "@sentry/browser";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { createErrorReporter, readTelemetryConfiguration, sanitizeTelemetryEvent } from "../src/observability/errorReporter.js";

const config = { VITE_SENTRY_ENABLED: "true", VITE_SENTRY_DSN: `https://${"a".repeat(32)}@o123.ingest.de.sentry.io/456`,
  VITE_SENTRY_ENVIRONMENT: "preproduction", VITE_SENTRY_RELEASE: "b".repeat(40) };

describe("private frontend error reporting", () => {
  it("serializes only safe diagnostics through the real SDK transport", async () => {
    // Arrange
    const send = vi.fn().mockResolvedValue({ statusCode: 200 });
    /** @type {BrowserClient | undefined} */ let client;
    const reporter = createErrorReporter(config, options => {
      client = new BrowserClient({ ...options, transport: () => ({ send, flush: () => Promise.resolve(true) }) });
      return client;
    });
    // Act
    reporter.report(new Error("private@example.test password URL#share-secret"));
    await client?.flush(1000);
    // Assert
    expect(send).toHaveBeenCalledTimes(1);
    const envelope = send.mock.calls[0]?.[0];
    expect(envelope[1][0][1]).toEqual({ event_id: expect.stringMatching(/^[a-f0-9]{32}$/), message: "browser", level: "error", platform: "javascript",
      environment: "preproduction", release: "b".repeat(40), type: undefined,
      sdk: { integrations: [], name: "sentry.javascript.browser", version: "11.0.0",
        packages: [{ name: "npm:@sentry/browser", version: "11.0.0" }], settings: { infer_ip: "never" } } });
    expect(envelope[0].event_id).toBe(envelope[1][0][1].event_id);
    expect(JSON.stringify(envelope)).not.toMatch(/private@example|password|share-secret|localhost|request|breadcrumbs|user|transaction/);
    reporter.dispose();
  });
  it("constructs and closes the real isolated SDK without sending an event", () => {
    // Arrange / Act
    const reporter = createErrorReporter(config);
    // Assert
    expect(() => reporter.dispose()).not.toThrow();
  });
  it.each([{}, { ...config, VITE_SENTRY_ENABLED: "false" }, { ...config, VITE_SENTRY_RELEASE: "secret" },
    { ...config, VITE_SENTRY_ENVIRONMENT: "personal-name" }, { ...config, VITE_SENTRY_DSN: "invalid" },
    { ...config, VITE_SENTRY_DSN: config.VITE_SENTRY_DSN + "?secret=yes" },
    { ...config, VITE_SENTRY_DSN: config.VITE_SENTRY_DSN.replace("https:", "http:") },
    { ...config, VITE_SENTRY_DSN: config.VITE_SENTRY_DSN.replace("sentry.io", "attacker.test") },
  ])("fails closed without instantiating a client %#", env => {
    // Arrange
    const factory = vi.fn();
    // Act
    const reporter = createErrorReporter(env, factory); reporter.report(new Error("private")); reporter.dispose();
    // Assert
    expect(factory).not.toHaveBeenCalled(); expect(readTelemetryConfiguration(env)).toBeNull();
  });

  it("sends only fixed categories once per page, without raw errors", () => {
    // Arrange
    const client = { captureEvent: vi.fn(), close: vi.fn().mockResolvedValue(true) };
    const reporter = createErrorReporter(config, () => client);
    // Act
    reporter.report(new Error("private name, URL#secret and password"));
    reporter.report(new Error("another secret"));
    reporter.report(createAbortError()); reporter.report(new ApiError({ kind: "http", statusCode: 409 }));
    reporter.report(new ApiError({ kind: "network", correlationId: "private" }));
    reporter.report(new ApiError({ kind: "http", statusCode: 500 }));
    reporter.report(new Error("private"), "promise");
    reporter.dispose(); reporter.dispose(); reporter.report(new Error("late"), "startup");
    // Assert
    expect(client.captureEvent.mock.calls).toEqual([[{ message: "browser" }], [{ message: "network" }], [{ message: "server" }], [{ message: "promise" }]]);
    expect(client.close).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("strips SDK enrichment by allowlist and disables automatic instrumentation", async () => {
    // Arrange
    const factory = vi.fn(/** @param {ConstructorParameters<typeof import("@sentry/browser").BrowserClient>[0]} options */ options => {
      void options; return { captureEvent: vi.fn(), close: vi.fn().mockResolvedValue(true) };
    });
    // Act
    createErrorReporter(config, factory);
    const options = factory.mock.calls[0]?.[0];
    if (!options?.beforeSend) throw new Error("Missing sanitized client configuration");
    // Assert
    expect(options).toMatchObject({ integrations: [], maxBreadcrumbs: 0, sendClientReports: false, tracesSampleRate: 0,
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
      transportOptions: { fetchOptions: { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" } } });
    const dirty = { type: undefined, message: "browser", user: { email: "secret@example.test" }, request: { url: "https://private/#token" },
      extra: { password: "secret" }, breadcrumbs: [{ message: "private" }], exception: { values: [{ value: "private" }] } };
    expect(await options.beforeSend(dirty, {})).toEqual({ type: undefined, event_id: expect.stringMatching(/^[a-f0-9]{32}$/), message: "browser", level: "error", platform: "javascript", environment: "preproduction", release: "b".repeat(40) });
    expect(await options.beforeSend({ type: undefined, message: "raw secret" }, {})).toBeNull();
    expect(sanitizeTelemetryEvent({ type: undefined })).toBeNull();
  });

  it("isolates collector failures", () => {
    // Arrange
    const failing = () => { throw new Error("collector private failure"); };
    // Act / Assert
    expect(() => createErrorReporter(config, failing).report(new Error())).not.toThrow();
    const reporter = createErrorReporter(config, () => ({ captureEvent: failing, close: failing }));
    expect(() => reporter.report(new Error())).not.toThrow(); expect(() => reporter.dispose()).not.toThrow();
    createErrorReporter(config, () => ({ captureEvent: vi.fn(), close: () => Promise.reject(new Error()) })).dispose();
  });
});
