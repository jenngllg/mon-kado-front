import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createAccountDeletionService, readAccountDeletionLink } from "../src/features/privacy/accountDeletionService.js";
import { accountDeletionFixture, DeletionToken } from "./accountDeletionTestHelpers.js";
import { barrier, createCoordinatorHub, untilSession } from "./sessionTestHelpers.js";

/** @type {ReturnType<typeof accountDeletionFixture>[]} */ const fixtures = [];
function setup(hub = createCoordinatorHub(), coordinator = hub.create()) { const f = accountDeletionFixture(hub, coordinator); fixtures.push(f); return f; }
afterEach(() => fixtures.splice(0).forEach(f => f.session.dispose()));
const options = () => ({ signal: new AbortController().signal });

describe("deletion link boundary", () => {
  it.each([`#token=${DeletionToken}`, `token=${DeletionToken}`])("reads a consumed proof without decoding its contents", fragment => {
    // Arrange / Act / Assert
    expect(readAccountDeletionLink(fragment)).toBe(DeletionToken);
  });
  it.each(["", "#", "#token=", "#unexpected=a", "#token=a&token=b", "#token=a&other=b", "#token=%00", "#token=<script>", "#token=" + "a".repeat(2049)])("rejects malformed or ambiguous proofs", fragment => {
    // Arrange / Act / Assert
    expect(readAccountDeletionLink(fragment)).toBeNull();
  });
});

describe("coordinated account deletion", () => {
  it("sends exactly the token with the authenticated Bearer and closes all tabs only after 204", async () => {
    // Arrange
    const hub = createCoordinatorHub(), first = setup(hub), other = setup(hub);
    await Promise.all([first.session.start(), other.session.start()]); const observer = vi.fn(); first.session.subscribe(observer);
    // Act
    expect(await first.service.confirm(DeletionToken, options())).toEqual({ sessionIssue: null });
    await untilSession(other.session, state => state.status === "anonymous");
    // Assert
    const request = first.posts()[0][1]; const headers = new Headers(request?.headers);
    expect(request?.method).toBe("POST"); expect(request?.credentials).toBe("include");
    expect(JSON.parse(String(request?.body))).toEqual({ token: DeletionToken });
    expect(headers.get("Authorization")).toBe("Bearer jwt-fixture-1"); expect(headers.has("X-CSRF-TOKEN")).toBe(false);
    expect(first.session.getSnapshot().status).toBe("anonymous"); expect(first.posts()).toHaveLength(1);
    expect(observer.mock.calls.filter(([state]) => state.endReason === "accountDeleted")).toHaveLength(1);
    expect(JSON.stringify([observer.mock.calls, hub.messages, hub.getState()])).not.toContain(DeletionToken);
  });
  it.each([200, 202])("rejects unexpected success %s without closing the account session", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.operation.status = status;
    // Act / Assert
    await expect(f.service.confirm(DeletionToken, options())).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
    expect(f.session.getSnapshot().status).toBe("authenticated");
  });
  it("rejects a fabricated non-empty 204 and clears the submitted in-memory envelope", async () => {
    // Arrange
    let body;
    const service = createAccountDeletionService({ deleteAccount: async action => {
      await action({ request: async (_path, request) => { body = request?.body; return /** @type {never} */ ({ status: 204, data: {}, metadata: { correlationId: "safe" } }); } });
      return { sessionIssue: null };
    } });
    // Act / Assert
    await expect(service.confirm(DeletionToken, options())).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(body).toEqual({ token: "" });
  });
  it.each([400, 403, 429, 503])("never retries rejected deletion %s or announces success", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.operation.status = status;
    f.operation.body = { statusCode: status, title: null, message: null, errorCode: null, validationErrors: null };
    // Act / Assert
    await expect(f.service.confirm(DeletionToken, options())).rejects.toMatchObject({ statusCode: status });
    expect(f.posts()).toHaveLength(1); expect(f.session.getSnapshot().endReason).toBeUndefined();
  });
  it("does not confuse a concurrent password change with a successful deletion", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const entered = barrier(), release = barrier();
    f.operation.before = async () => { entered.resolve(); await release.promise; };
    const deleting = f.service.confirm(DeletionToken, options()); await entered.promise;
    const passwordChange = vi.fn(async () => /** @type {never} */ ({}));
    // Act / Assert
    await expect(f.session.changePassword(passwordChange)).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_BUSY" });
    expect(passwordChange).not.toHaveBeenCalled(); release.resolve(); await deleting;
  });
  it("keeps ownership of a submitted deletion after its view is cancelled", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const entered = barrier(), release = barrier();
    f.operation.before = async () => { entered.resolve(); await release.promise; };
    const controller = new AbortController(); const work = f.service.confirm(DeletionToken, { signal: controller.signal }).catch(error => error);
    await entered.promise;
    // Act
    controller.abort(); expect(await work).toMatchObject({ name: "AbortError" });
    const closed = untilSession(f.session, state => state.status === "anonymous"); release.resolve(); await closed;
    // Assert
    expect(f.posts()).toHaveLength(1); expect(f.posts()[0][1]?.signal?.aborted).toBe(false);
  });
  it("recovers failed cross-tab synchronization without sending another deletion", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const original = f.coordinator.change;
    f.coordinator.change = async () => { throw new ApiError({ kind: "network" }); };
    // Act
    const result = await f.service.confirm(DeletionToken, options());
    // Assert
    expect(result.sessionIssue).not.toBeNull(); expect(f.session.getSnapshot().user).toBeNull();
    // Act
    f.coordinator.change = original;
    expect(await f.service.confirm(DeletionToken, options())).toEqual({ sessionIssue: null });
    // Assert
    expect(f.posts()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("anonymous");
  });
  it("rejects a queued deletion superseded by another account", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const release = barrier(); const other = f.hub.create();
    const held = f.coordinator.exclusive(() => release.promise);
    const work = f.service.confirm(DeletionToken, options()).catch(error => error);
    // Act
    await other.change(false, "established"); release.resolve(); await held;
    // Assert
    expect(await work).toMatchObject({ name: "AbortError" }); expect(f.posts()).toHaveLength(0); other.dispose();
  });
});
