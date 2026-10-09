import { describe, expect, it, vi } from "vitest";
import { createProfileService } from "../src/features/profile/profileService.js";
import { validateDisplayName } from "../src/auth/displayNameValidation.js";
import { validateRegistrationField } from "../src/features/registration/registrationValidation.js";
import { ApiError } from "../src/api/apiError.js";
import { isStrongEntityTag } from "../src/api/entityTag.js";

const signal = new AbortController().signal;
const snapshot = Object.freeze({ status: /** @type {const} */ ("authenticated"),
  user: { id: "member", displayName: "Jenn", email: "jenn@example.test", roles: ["member"], isVisibleInMemberSearch: false },
  etag: '"0000002a"', issue: null, logoutPending: false });
/** @param {unknown} [data] Response data.
 * @param {number} [status] HTTP status.
 * @param {string | null} [etag] Entity tag.
 */
function response(data = { displayName: "Jenn", isVisibleInMemberSearch: false }, status = 200, etag = '"0000002b"') {
  return { data, status, metadata: { etag, correlationId: "support-fixture", location: null, retryAfterSeconds: null } };
}
function setup() {
  const request = vi.fn(async () => response());
  const refreshIdentity = vi.fn(async () => snapshot);
  const service = createProfileService({
    request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request), refreshIdentity,
  });
  return { ...service, request, refreshIdentity };
}

describe("profile service and shared validation", () => {
  it.each([false, true])("sends and adopts the boolean visibility %s", async visible => {
    // Arrange
    const { save, request } = setup();
    request.mockResolvedValue(response({ displayName: "Jenn", isVisibleInMemberSearch: visible }));
    // Act
    const result = await save(" Jenn ", { etag: '"a"', signal, isVisibleInMemberSearch: visible });
    // Assert
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/members/current/profile", {
      method: "PUT", body: { displayName: "Jenn", isVisibleInMemberSearch: visible }, authentication: "required", ifMatch: '"a"', signal,
    });
    expect(result.isVisibleInMemberSearch).toBe(visible);
  });
  it.each([undefined, null, "true", 1, false])("rejects malformed or inconsistent saved visibility %s", async visible => {
    // Arrange
    const { save, request } = setup();
    request.mockResolvedValue(response({ displayName: "Jenn", isVisibleInMemberSearch: visible }));
    // Act / Assert
    await expect(save("Jenn", { etag: '"a"', signal, isVisibleInMemberSearch: true })).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(request).toHaveBeenCalledOnce();
  });
  it("rejects nonboolean outgoing visibility before writing", async () => {
    const { save, request } = setup();
    await expect(save("Jenn", { etag: '"a"', signal, isVisibleInMemberSearch: /** @type {boolean} */ (/** @type {unknown} */ ("true")) })).rejects.toBeInstanceOf(TypeError);
    expect(request).not.toHaveBeenCalled();
  });
  it("projects the versioned current-member photo only for the configured API", async () => {
    const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
    const profileImageUrl = `http://localhost:7000/api/v1/members/${id}/profile/image?imageId=019c52dd-56c1-7cc6-8a95-243f3a032e05`;
    const refreshIdentity = vi.fn(async () => ({ ...snapshot, user: { ...snapshot.user, id, profileImageUrl } }));
    const request = vi.fn();
    const service = createProfileService({refreshIdentity,request},{apiBaseUrl:"http://localhost:7000"});
    const result = await service.load({signal});
    expect(result.photo).toEqual({imageUrl:profileImageUrl,imageUnavailable:false}); expect(Object.isFrozen(result.photo)).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
  it("loads the safe identity through the session boundary", async () => {
    // Arrange
    const { load, request, refreshIdentity } = setup();
    // Act
    const result = await load({ signal });
    // Assert
    expect(result).toEqual({ displayName: "Jenn", email: "jenn@example.test", etag: '"0000002a"', isVisibleInMemberSearch: false });
    expect(Object.isFrozen(result)).toBe(true);
    expect(refreshIdentity).toHaveBeenCalledExactlyOnceWith({ signal });
    expect(request).not.toHaveBeenCalled();
  });
  it("sends only the trimmed name, exact precondition and caller signal with required JWT", async () => {
    // Arrange
    const { save, request } = setup();
    // Act
    const result = await save(" Jenn ", { etag: '"0000002a"', signal });
    // Assert
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/members/current/profile", {
      method: "PUT", body: { displayName: "Jenn" }, authentication: "required", ifMatch: '"0000002a"', signal,
    });
    expect(result).toEqual({ displayName: "Jenn", etag: '"0000002b"', isVisibleInMemberSearch: false });
  });
  it.each([null, "", "*", 'W/"0000002a"', '""', '"a", "b"', '"bad\nvalue"'])("rejects unsafe entity tag %s", async etag => {
    // Arrange
    const { save, request } = setup();
    // Act / Assert
    expect(isStrongEntityTag(etag)).toBe(false);
    await expect(save("Jenn", { etag: /** @type {string} */ (etag), signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    response(null), response([], 200), response({}), response({ displayName: 1 }),
    response({ displayName: "\ud800" }), response({ displayName: "a".repeat(81) }),
    response({ displayName: "Jenn" }, 202), response({ displayName: "Jenn" }, 200, null),
    response({ displayName: "Jenn" }, 200, 'W/"a"'),
  ])("rejects an invalid update envelope without retaining its data", async envelope => {
    // Arrange
    const { save, request } = setup(); request.mockResolvedValue(envelope);
    // Act / Assert
    await expect(save("Jenn", { etag: '"a"', signal })).rejects.toMatchObject({
      kind: "invalidResponse", correlationId: "support-fixture",
    });
    expect(request).toHaveBeenCalledOnce();
  });
  it.each([400, 401, 412, 428, 429, 500, 503])("does not retry HTTP %s", async statusCode => {
    // Arrange
    const { save, request } = setup(); const failure = new ApiError({ kind: "http", statusCode });
    request.mockRejectedValue(failure);
    // Act / Assert
    await expect(save("Jenn", { etag: '"a"', signal })).rejects.toBe(failure);
    expect(request).toHaveBeenCalledOnce();
  });
  it.each([
    ["", false], ["  ", false], [" Jenn ", true], ["😀".repeat(80), true], ["😀".repeat(81), false],
    ["é".repeat(80), true], ["e\u0301".repeat(40), true], ["e\u0301".repeat(41), false],
    ["a\ud800", false], ["a\udfff", false], ["a\n", false], ["a\u007f", false],
    ["<b>Jenn</b>", true],
  ])("keeps registration and profile Unicode validation identical for %s", (value, valid) => {
    // Arrange
    const text = String(value);
    // Act
    const result = validateDisplayName(text);
    // Assert
    expect(result === null).toBe(valid);
    expect(validateRegistrationField("displayName", text)).toBe(result);
  });
});
