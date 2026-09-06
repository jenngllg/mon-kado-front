import { vi } from "vitest";
import { createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { createLoginService } from "../src/features/login/loginService.js";

/** Controlled HTTP responses; real manager, service and API client. */
export function loginFixture(hub = createCoordinatorHub()) {
  const transport = createSessionTransport();
  transport.state.refreshStatus = 401;
  const underlying = transport.fetch.getMockImplementation();
  const loginState = {
    status: 200,
    body: /** @type {unknown} */ (transport.state.token),
    identityEtag: /** @type {string | null} */ ('"identity-1"'),
    beforeLogin: async () => {},
  };
  transport.fetch.mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/auth/sessions" && init?.method === "POST") {
      await loginState.beforeLogin();
      return new Response(loginState.body === null ? null : JSON.stringify(loginState.body), {
        status: loginState.status, headers: { "Content-Type": "application/json", "X-Correlation-ID": "login-fixture", "Retry-After": "8" },
      });
    }
    if (!underlying) throw new Error("Missing fixture transport.");
    const result = await underlying(input, init);
    if (path.endsWith("/current") && init?.method === "GET") {
      if (loginState.identityEtag === null) result.headers.delete("ETag");
      else result.headers.set("ETag", loginState.identityEtag);
    }
    return result;
  });
  let time = 1_000_000;
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(),
    fetchImplementation: transport.fetch, now: () => time });
  const login = vi.fn(createLoginService(session));
  return { session, login, hub, ...transport, loginState,
    advance: (/** @type {number} */ milliseconds) => { time += milliseconds; },
    posts: () => transport.fetch.mock.calls.filter(([input, options]) => new URL(String(input)).pathname === "/api/v1/auth/sessions" && options?.method === "POST"),
  };
}

export const LoginValues = Object.freeze({ email: "  fixture@example.test  ", password: " short 🔑 ", rememberMe: false });
