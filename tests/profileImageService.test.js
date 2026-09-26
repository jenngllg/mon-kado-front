import { describe, expect, it, vi } from "vitest";
import { createProfileImageService, readProfilePhoto } from "../src/features/profile/profileImageService.js";
import { ApiError } from "../src/api/apiError.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", imageId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const origin = "http://localhost:7000", url = `${origin}/api/v1/members/${id}/profile/image?imageId=${imageId}`;
const png = () => new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: "application/octet-stream" });
/** @param {unknown} [data] Response. @param {number} [status] Status. @param {string | null} [etag] Version. */
function setup(data = { displayName: "Jenn", profileImageUrl: url }, status = 200, etag = '"new"') {
  const request = vi.fn(async () => ({ data, status, metadata: { etag, correlationId: "reference", location: null, retryAfterSeconds: null } }));
  const service = createProfileImageService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  return { ...service, request, signal: new AbortController().signal };
}
describe("profile image contract", () => {
  it("accepts only the exact member public image URL and no-photo state", () => {
    expect(readProfilePhoto(url, id, origin)).toEqual({ imageUrl: url, imageUnavailable: false });
    expect(Object.isFrozen(readProfilePhoto(url, id, origin))).toBe(true);
    expect(readProfilePhoto(null, id, origin)).toEqual({ imageUrl: null, imageUnavailable: false });
    expect(readProfilePhoto(undefined, id, origin)).toEqual({ imageUrl: null, imageUnavailable: false });
  });
  it.each(["", 12, "javascript:alert(1)", url + "#x", url + "&x=1", url.replace(id, imageId), url.replace(origin, "https://evil.test"),
    url.replace(origin, "http://name:secret@localhost:7000"), url.replace(imageId, "invalid"), " " + url, url.replace("/profile/", "/%70rofile/"), url + "&imageId=" + imageId])("neutralizes malformed source while retaining presence %j", value => {
    expect(readProfilePhoto(value, id, origin)).toEqual({ imageUrl: null, imageUnavailable: true });
  });
  it("uploads exactly one image with neutral filename, browser multipart boundary and account version", async () => {
    const service = setup(); const file = png(); const result = await service.uploadImage(file, { etag: '"old"', signal: service.signal });
    expect(result).toEqual({ displayName: "Jenn", etag: '"new"' }); expect(Object.isFrozen(result)).toBe(true);
    const [path, options] = /** @type {[string, import("../src/api/apiClient.js").ApiRequestOptions]} */ (/** @type {unknown} */ (service.request.mock.calls[0]));
    expect(path).toBe("/api/v1/members/current/profile/image");
    expect(options).toEqual({ method: "PUT", authentication: "required", formData: expect.any(FormData), ifMatch: '"old"', signal: service.signal });
    expect([.../** @type {FormData} */ (options.formData).keys()]).toEqual(["image"]);
    const sent = /** @type {File} */ (options.formData?.get("image")); expect(sent.name).toBe("profile-image"); expect(sent.type).toBe("image/png");
    expect(await sent.arrayBuffer()).toEqual(await file.arrayBuffer()); expect(service.request).toHaveBeenCalledOnce();
  });
  it("accepts unchanged ETag for an identical image", async () => {
    const service = setup(undefined, 200, '"old"'); expect((await service.uploadImage(png(), { etag: '"old"', signal: service.signal })).etag).toBe('"old"');
  });
  it("requires 204 empty and a strong account ETag on deletion", async () => {
    const service = setup(null, 204); expect(await service.removeImage({ etag: '"old"', signal: service.signal })).toBe('"new"');
    expect(service.request).toHaveBeenCalledExactlyOnceWith("/api/v1/members/current/profile/image", { method: "DELETE", authentication: "required", ifMatch: '"old"', expectEmptyResponse: true, signal: service.signal });
  });
  it.each(["", "*", 'W/"a"', "unquoted"])("rejects unusable precondition %s before either mutation", async etag => {
    const service = setup(); await expect(service.uploadImage(png(), { etag, signal: service.signal })).rejects.toMatchObject({ errorCode: "CLIENT_PROFILE_PRECONDITION_INVALID" });
    await expect(service.removeImage({ etag, signal: service.signal })).rejects.toMatchObject({ errorCode: "CLIENT_PROFILE_PRECONDITION_INVALID" }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each([[null,200,'"a"'], [{displayName:"",profileImageUrl:url},200,'"a"'], [{displayName:"Jenn",profileImageUrl:null},200,'"a"'], [{displayName:"Jenn",profileImageUrl:url},201,'"a"'], [{displayName:"Jenn",profileImageUrl:url},200,null]])("rejects invalid upload response", async (data,status,etag) => {
    const service = setup(data, /** @type {number} */ (status), /** @type {string | null} */ (etag));
    await expect(service.uploadImage(png(), { etag: '"old"', signal: service.signal })).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "reference" });
  });
  it.each([[null,200,'"a"'], [{},204,'"a"'], [null,204,null], [null,204,'W/"a"']])("rejects invalid deletion response", async (data,status,etag) => {
    const service = setup(data, /** @type {number} */ (status), /** @type {string | null} */ (etag));
    await expect(service.removeImage({ etag: '"old"', signal: service.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("validates empty and unsupported files before sending", async () => {
    const service = setup(); for (const file of [new Blob(), new Blob(["bad"])]) await expect(service.uploadImage(file, { etag: '"a"', signal: service.signal })).rejects.toThrow();
    expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["network", "timeout", "http"])("propagates %s without retry", async kind => {
    const service = setup(); const error = new ApiError({ kind: /** @type {import("../src/api/apiError.js").ApiErrorKind} */ (kind), statusCode: 412 }); service.request.mockRejectedValue(error);
    await expect(service.removeImage({ etag: '"a"', signal: service.signal })).rejects.toBe(error); expect(service.request).toHaveBeenCalledOnce();
  });
  it("ignores pre-aborted and late responses", async () => {
    const service = setup(null,204), controller = new AbortController(); controller.abort();
    await expect(service.uploadImage(png(), { etag: '"a"', signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    await expect(service.removeImage({ etag: '"a"', signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" }); expect(service.request).not.toHaveBeenCalled();
    const pending = new AbortController(); const work = service.removeImage({ etag: '"a"', signal: pending.signal }); pending.abort(); await expect(work).rejects.toMatchObject({ name: "AbortError" });
  });
});
