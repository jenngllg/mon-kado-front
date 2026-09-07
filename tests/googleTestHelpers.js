import { vi } from "vitest";
import { createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { createGoogleService } from "../src/features/google/googleService.js";

export const Flow = "A".repeat(43);
export const StartOptions = { rememberMe: false, returnTo: "/lists" };

/** Controlled anticipated API, real session manager and HTTP client. */
export function googleFixture(hub = createCoordinatorHub()) {
  const transport = createSessionTransport();
  transport.state.refreshStatus = 401;
  const underlying = transport.fetch.getMockImplementation();
  const completion = { status: 200, body: /** @type {unknown} */ (transport.state.token), before: async () => {} };
  const link = { status: 200, body: /** @type {unknown} */ (transport.state.token), before: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    if (String(input).endsWith("/google/completions") || String(input).endsWith("/google/link")) {
      const operation = String(input).endsWith("/google/link") ? link : completion;
      await operation.before();
      return new Response(operation.body === null ? null : JSON.stringify(operation.body), { status: operation.status,
        headers: { "Content-Type": "application/json", "X-Correlation-ID": "google-reference", "Retry-After": "9" } });
    }
    if (!underlying) throw new Error("Missing fixture.");
    return underlying(input, init);
  });
  const coordinator = hub.create();
  const session = createSessionManager({ apiBaseUrl: "https://api.example.test", coordinator, fetchImplementation: transport.fetch });
  /** @type {Map<string, string>} */
  const values = new Map();
  const storage = { getItem: (/** @type {string} */ key) => values.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => { values.set(key, value); },
    removeItem: (/** @type {string} */ key) => { values.delete(key); } };
  const redirect = vi.fn();
  let time = 100_000;
  const dependencies = { session, apiBaseUrl: "https://api.example.test", frontendOrigin: "https://app.example.test", enabled: true,
    storage: () => storage, redirect, now: () => time };
  const google = createGoogleService(dependencies);
  return { ...transport, session, google, coordinator, hub, completion, link, values, storage, redirect, dependencies,
    advance: (/** @type {number} */ milliseconds) => { time += milliseconds; },
    posts: () => transport.fetch.mock.calls.filter(([input]) => String(input).endsWith("/google/completions")),
    linkPosts: () => transport.fetch.mock.calls.filter(([input]) => String(input).endsWith("/google/link")) };
}

/** @param {ReturnType<typeof googleFixture>} fixture Prepared fixture. */
export async function handoff(fixture) {
  await fixture.google.start(StartOptions);
  return fixture.google.consumeReturn(`#flow=${Flow}`);
}

/** @param {ReturnType<typeof googleFixture>} fixture Backend requiring explicit proof. */
export async function requireGoogleLink(fixture) {
  const returned = await handoff(fixture);
  fixture.completion.status = 409;
  fixture.completion.body = { statusCode: 409, errorCode: "GOOGLE_ACCOUNT_LINK_REQUIRED", title: null, message: null, validationErrors: null };
  await fixture.google.complete(returned).catch(() => {});
  const continuation = fixture.google.takeLinkContinuation();
  if (continuation === null) throw new Error("Expected link continuation.");
  return continuation;
}
