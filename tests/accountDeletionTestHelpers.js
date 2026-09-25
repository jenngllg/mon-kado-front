import { createSessionManager } from "../src/auth/sessionManager.js";
import { createAccountDeletionService } from "../src/features/privacy/accountDeletionService.js";
import { createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

export const DeletionToken = "synthetic-deletion-proof";
/** Isolated HTTP/session integration fixture with no real account or external provider. */
export function accountDeletionFixture(hub = createCoordinatorHub(), coordinator = hub.create()) {
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation();
  const operation = { status: 204, body: /** @type {unknown} */ (null), before: async () => {} };
  transport.fetch.mockImplementation(async (url, init) => {
    if (String(url).endsWith("/deletion-requests/confirm")) {
      await operation.before();
      return new Response(operation.body === null ? null : JSON.stringify(operation.body), {
        status: operation.status, headers: { "Content-Type": "application/json", "X-Correlation-ID": "deletion-fixture" },
      });
    }
    if (String(url).endsWith("/auth/sessions") && init?.method === "POST") return Response.json(transport.state.token);
    if (!original) throw new Error("Missing transport");
    return original(url, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator, fetchImplementation: transport.fetch });
  return { ...transport, operation, hub, coordinator, session, service: createAccountDeletionService(session),
    posts: () => transport.fetch.mock.calls.filter(([url]) => String(url).endsWith("/deletion-requests/confirm")),
  };
}
