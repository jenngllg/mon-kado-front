import { afterEach, describe, expect, it } from "vitest";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

/** @type {import("../src/auth/sessionManager.js").SessionManager[]} */
const managers = [];
afterEach(() => { for (const session of managers.splice(0)) session.dispose(); });

/** @param {ReturnType<typeof createCoordinatorHub>} hub Shared metadata.
 * @param {ReturnType<typeof createSessionTransport>} transport Controlled HTTP. */
function create(hub, transport) {
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch });
  managers.push(session);
  return session;
}

describe("authentication lot HTTP contract regressions", () => {
  it.each([201, 202, 206])("rejects refresh status %s even with a valid token payload", async status => {
    // Arrange
    const transport = createSessionTransport();
    transport.state.refreshStatus = status;
    const session = create(createCoordinatorHub(), transport);
    // Act
    const state = await session.start();
    // Assert
    expect(state.status).toBe("unavailable");
    expect(state.user).toBeNull();
    expect(transport.state.refreshCount).toBe(1);
    expect(transport.fetch.mock.calls).toHaveLength(2);
    await expect(session.ensureSession()).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
    expect(JSON.stringify(state)).not.toMatch(/jwt-fixture|csrf-fixture/);
  });

  it.each([200, 202, 205])("keeps logout blocked after unexpected empty success %s", async status => {
    // Arrange
    const hub = createCoordinatorHub();
    const transport = createSessionTransport();
    const session = create(hub, transport);
    await session.start();
    transport.state.logoutStatus = status;
    // Act
    const state = await session.logout();
    const other = create(hub, transport);
    await other.start();
    // Assert
    expect(state).toMatchObject({ status: "anonymous", user: null, logoutPending: true });
    expect(state.issue?.title).toBe("Déconnexion serveur non confirmée");
    expect(hub.getState().logoutPending).toBe(true);
    expect(other.getSnapshot().logoutPending).toBe(true);
    expect(transport.state.refreshCount).toBe(1);
    expect(transport.fetch.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1);
    // An explicit, correctly acknowledged retry alone lifts the block.
    transport.state.logoutStatus = 204;
    expect((await session.logout()).logoutPending).toBe(false);
  });

  it("does not confirm server logout from an unexpected JSON success response", async () => {
    // Arrange
    const hub = createCoordinatorHub();
    const transport = createSessionTransport();
    const session = create(hub, transport);
    await session.start();
    const malformed = Response.json({ private: "must-not-be-exposed" });
    transport.fetch.mockResolvedValueOnce(Response.json({ token: "csrf-fixture" })).mockResolvedValueOnce(malformed);
    // Act
    const state = await session.logout();
    // Assert
    expect(state.logoutPending).toBe(true);
    expect(hub.getState().logoutPending).toBe(true);
    expect(JSON.stringify(state)).not.toContain("must-not-be-exposed");
    expect(transport.fetch.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1);
  });
});
