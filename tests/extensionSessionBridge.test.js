// @vitest-environment happy-dom
/* global document */
import { afterEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ load: vi.fn(), create: vi.fn(), uploadImage: vi.fn(), request: vi.fn(), snapshot: vi.fn(), recipients: vi.fn(), suggestionLists: vi.fn(), createSuggestion: vi.fn(), suggestionImage: vi.fn() }));
vi.mock("../src/features/wishlists/wishlistsService.js", () => ({ createWishlistsService: () => ({ load: calls.load }) }));
vi.mock("../src/features/wishes/wishesService.js", () => ({ createWishesService: () => ({ create: calls.create, uploadImage: calls.uploadImage }) }));
vi.mock("../src/features/extension/extensionSuggestions.js", () => ({ createExtensionSuggestions: () => ({ recipients: calls.recipients, lists: calls.suggestionLists, create: calls.createSuggestion, image: calls.suggestionImage }) }));
import { installExtensionSessionBridge } from "../src/features/extension/extensionSessionBridge.js";
import { ApiError } from "../src/api/apiError.js";
import {registerSuggestionDraft,suggestionDraftDestination} from "../src/features/extension/suggestionDraft.js";
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
  /** @type {{status:string,user?:{id:string}}} */
  const identity = { status: "authenticated", user: { id } };
  const ensureSession = vi.fn(async () => identity);
  calls.snapshot.mockReturnValue(identity);
  dispose = installExtensionSessionBridge(/** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ ensureSession, getSnapshot: calls.snapshot, request: calls.request })), "http://localhost:7000");
  return ensureSession;
}
it("returns only available lists through the authenticated session", async () => {
  setup(); calls.load.mockResolvedValue([{ id, name: "Ma liste", isArchived: false, isSuspended: false }, { id: "other", name: "Archivée", isArchived: true }]);
  expect(await send("lists")).toEqual({ lists: [{ id, name: "Ma liste" }] });
  expect(calls.create).not.toHaveBeenCalled();
});
it("offers the open private editor and fills it without creating an owned wish",async()=>{
  setup();calls.load.mockResolvedValue([]);const apply=vi.fn(()=>true),stop=registerSuggestionDraft({label:"Idée surprise pour Léa",apply});
  try {
    const target=suggestionDraftDestination();expect(await send("lists")).toEqual({lists:[target]});
    expect(await send("create",{listId:target?.id,name:"Livre",price:"12",url:"https://shop.example/product"})).toEqual({success:true,draft:true});
    expect(apply).toHaveBeenCalledOnce();expect(calls.create).not.toHaveBeenCalled();expect(calls.uploadImage).not.toHaveBeenCalled();
    stop();expect(await send("create",{listId:target?.id,name:"Livre",price:"12",url:"https://shop.example/product"})).toEqual({error:"invalid"});
  }finally{stop();}
});
it("retrieves only the selected image with the connected session", async () => {
  setup(); calls.request.mockResolvedValue({ status: 200, data: { contentType: "image/webp", contentBase64: "QUJD" } });
  expect(await send("image", { listId: id, url: "https://images.example/product.png" })).toEqual({ image: "data:image/webp;base64,QUJD" });
  expect(calls.request).toHaveBeenCalledWith(`/api/v1/wishlists/${id}/wish-images/resolve`, expect.objectContaining({ method: "POST", authentication: "required", csrf: true, body: { url: "https://images.example/product.png" } }));
  expect(calls.create).not.toHaveBeenCalled();
});
it("reports that the site relay is present without accessing the session", async () => {
  const ensure = setup(); expect(await send("probe")).toEqual({ ready: true, supportsVariants: true, supportsFavorites: true, supportsGroupSuggestions: true, supportsQuantities: true });
  expect(ensure).not.toHaveBeenCalled(); expect(calls.load).not.toHaveBeenCalled();
});
it("accepts serialized messages across browser extension boundaries", async () => {
  setup();
  const response = new Promise(resolve => {
    document.addEventListener("monkado-extension-response", event => resolve(JSON.parse(/** @type {CustomEvent<string>} */ (event).detail)), { once: true });
  });
  document.dispatchEvent(new CustomEvent("monkado-extension-request", { detail: JSON.stringify({ id, action: "probe" }) }));
  expect(await response).toEqual({ id, result: { ready: true, supportsVariants: true, supportsFavorites: true, supportsGroupSuggestions: true, supportsQuantities: true } });
});
it("creates only on an explicit command using the captured fields", async () => {
  setup(); calls.create.mockResolvedValue({ wish: { id }, etag: '"1"' });
  const value = { listId: id, name: "Boîte", price: "2,99", color: "Vert sauge", size: "M", url: "https://shop.example/item", image: "", isFavorite: true };
  expect(await send("create", value)).toEqual({ success: true });
  expect(calls.create).toHaveBeenCalledOnce();
  expect(calls.create).toHaveBeenCalledWith(id, expect.objectContaining({ name: "Boîte", price: "2,99", color: "Vert sauge", size: "M", url: value.url, isFavorite: true }), { signal: expect.anything(), addedViaExtension: true });
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
  for (const value of [null, {}, { listId: id, name: "Box", price: "" }, { listId: id, name: "Box", price: "", url: "https://shop.example", color: 12 }, { listId:id,name:"Box",price:"",url:"https://shop.example",isFavorite:1 }]) {
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

it("routes group discovery and explicit suggestion commands through the current identity", async () => {
  setup();
  calls.recipients.mockResolvedValue([{ id: "person", name: "Léa#1234" }]);
  calls.suggestionLists.mockResolvedValue([{ id: "destination", name: "Noël", groupName: "Famille" }]);
  calls.createSuggestion.mockResolvedValue({ success: true, imageSaved: true });
  calls.suggestionImage.mockResolvedValue({ image: "data:image/webp;base64,QUJD" });
  expect(await send("suggestionRecipients")).toEqual({ recipients: [{ id: "person", name: "Léa#1234" }] });
  expect(await send("suggestionLists", { recipientId: "person" })).toEqual({ lists: [{ id: "destination", name: "Noël", groupName: "Famille" }] });
  const value = { listId: "destination", name: "Livre", price: "12", url: "https://shop.example/item" };
  expect(await send("createSuggestion", value)).toEqual({ success: true, imageSaved: true });
  expect(await send("suggestionImage", value)).toEqual({ image: "data:image/webp;base64,QUJD" });
  expect(calls.recipients).toHaveBeenCalledWith(id, expect.any(AbortSignal));
  expect(calls.suggestionLists).toHaveBeenCalledWith(id, "person", expect.any(AbortSignal));
  expect(calls.createSuggestion).toHaveBeenCalledWith(id, value, expect.any(AbortSignal));
  expect(calls.suggestionImage).toHaveBeenCalledWith(id, value, expect.any(AbortSignal));
  expect(calls.create).not.toHaveBeenCalled();
});

it.each([null, undefined, "invalid"])("rejects malformed suggestion commands before transport: %s", async value => {
  setup();
  for (const action of ["createSuggestion", "suggestionImage"]) expect(await send(action, value)).toEqual({ error: "invalid" });
  expect(calls.createSuggestion).not.toHaveBeenCalled(); expect(calls.suggestionImage).not.toHaveBeenCalled();
});

it.each([{ status: "anonymous" }, { status: "authenticated", user: { id: "another-member" } }])("withholds group results when the signed-in identity changes", async current => {
  setup(); calls.recipients.mockResolvedValue([{ id: "private-person", name: "Private" }]);
  calls.snapshot.mockReturnValue(current);
  expect(await send("suggestionRecipients")).toEqual({ error: "login" });
});

it("forwards an absent recipient only to the validating suggestion client", async () => {
  setup(); calls.suggestionLists.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 }));
  expect(await send("suggestionLists")).toEqual({ error: "rejected" });
  expect(calls.suggestionLists).toHaveBeenCalledWith(id, undefined, expect.any(AbortSignal));
});


it.each([undefined, "1", "4", "100"])("forwards the requested personal quantity with a legacy default: %s", async quantity => {
  setup(); calls.create.mockResolvedValue({ wish: { id }, etag: '"1"' });
  expect(await send("create", { listId: id, name: "Livre", price: "", url: "", quantity })).toEqual({ success: true });
  expect(calls.create).toHaveBeenCalledExactlyOnceWith(id, expect.objectContaining({ quantity: quantity ?? "1" }), expect.anything());
});

it.each([null, 3, true, {}])("rejects a malformed personal quantity before writing: %s", async quantity => {
  setup();
  expect(await send("create", { listId: id, name: "Livre", price: "", url: "", quantity })).toEqual({ error: "invalid" });
  expect(calls.create).not.toHaveBeenCalled();
});
