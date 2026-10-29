// @vitest-environment happy-dom
/* global document */
import { afterEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ load: vi.fn(), create: vi.fn(), uploadImage: vi.fn() }));
vi.mock("../src/features/wishlists/wishlistsService.js", () => ({ createWishlistsService: () => ({ load: calls.load }) }));
vi.mock("../src/features/wishes/wishesService.js", () => ({ createWishesService: () => ({ create: calls.create, uploadImage: calls.uploadImage }) }));
import { installExtensionSessionBridge } from "../src/features/extension/extensionSessionBridge.js";
import { ApiError } from "../src/api/apiError.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {(() => void) | undefined} */ let dispose;
afterEach(() => { dispose?.(); vi.resetAllMocks(); });
/** @param {string} action @param {unknown} [value] */
function send(action, value) {
  return new Promise(resolve => {
    document.addEventListener("monkado-extension-response", event => resolve(/** @type {CustomEvent} */ (event).detail.result), { once: true });
    document.dispatchEvent(new CustomEvent("monkado-extension-request", { detail: { id, action, value } }));
  });
}
function setup() {
  const ensureSession = vi.fn(async () => ({ status: "authenticated" }));
  dispose = installExtensionSessionBridge(/** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ ensureSession })), "http://localhost:7000");
  return ensureSession;
}
it("returns only available lists through the authenticated session", async () => {
  setup(); calls.load.mockResolvedValue([{ id, name: "Ma liste", isArchived: false, isSuspended: false }, { id: "other", name: "Archivée", isArchived: true }]);
  expect(await send("lists")).toEqual({ lists: [{ id, name: "Ma liste" }] });
  expect(calls.create).not.toHaveBeenCalled();
});
it("reports that the site relay is present without accessing the session", async () => {
  const ensure = setup(); expect(await send("probe")).toEqual({ ready: true });
  expect(ensure).not.toHaveBeenCalled(); expect(calls.load).not.toHaveBeenCalled();
});
it("creates only on an explicit command using the captured fields", async () => {
  setup(); calls.create.mockResolvedValue({ wish: { id }, etag: '"1"' });
  const value = { listId: id, name: "Boîte", price: "2,99", url: "https://shop.example/item", image: "" };
  expect(await send("create", value)).toEqual({ success: true });
  expect(calls.create).toHaveBeenCalledOnce();
  expect(calls.create).toHaveBeenCalledWith(id, expect.objectContaining({ name: "Boîte", price: "2,99", url: value.url }), { signal: expect.anything() });
  expect(calls.uploadImage).not.toHaveBeenCalled();
});
it("returns a separate result if image upload fails after creation", async () => {
  setup(); calls.create.mockResolvedValue({ wish: { id }, etag: '"1"' }); calls.uploadImage.mockRejectedValue(new Error("unavailable"));
  expect(await send("create", { listId: id, name: "Boîte", price: "", url: "https://shop.example/item", image: "data:image/webp;base64,QUJD" })).toEqual({ error: "image" });
  expect(calls.create).toHaveBeenCalledOnce(); expect(calls.uploadImage).toHaveBeenCalledOnce();
});
it("requires a connected MonKado session before loading lists or creating", async () => {
  const ensure = setup(); ensure.mockResolvedValue({ status: "anonymous" });
  expect(await send("lists")).toEqual({ error: "login" });
  expect(await send("create", { listId: id, name: "Boîte", price: "", url: "https://shop.example/item" })).toEqual({ error: "login" });
  expect(calls.load).not.toHaveBeenCalled(); expect(calls.create).not.toHaveBeenCalled();
});
it("rejects malformed creation requests without writing", async () => {
  setup();
  for (const value of [null, {}, { listId: id, name: "Box", price: "" }]) {
    expect(await send("create", value)).toEqual({ error: "invalid" });
  }
  expect(calls.create).not.toHaveBeenCalled();
});
it("uploads a captured image after successfully creating the wish", async () => {
  setup(); calls.create.mockResolvedValue({ wish: { id }, etag: '"1"' }); calls.uploadImage.mockResolvedValue({});
  expect(await send("create", { listId: id, name: "Boîte", price: "", url: "https://shop.example/item", image: "data:image/webp;base64,QUJD" })).toEqual({ success: true });
  expect(calls.uploadImage).toHaveBeenCalledWith(id, id, expect.any(Blob), { etag: '"1"', signal: expect.anything() });
});
it("distinguishes a rejected write from an uncertain network failure", async () => {
  setup();
  const value = { listId: id, name: "Boîte", price: "", url: "https://shop.example/item" };
  calls.create.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 403 })).mockRejectedValueOnce(new ApiError({ kind: "network" }));
  expect(await send("create", value)).toEqual({ error: "rejected" });
  expect(await send("create", value)).toEqual({ error: "uncertain" });
  expect(calls.create).toHaveBeenCalledTimes(2);
});
