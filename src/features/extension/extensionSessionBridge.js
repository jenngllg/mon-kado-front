import { createWishlistsService } from "../wishlists/wishlistsService.js";
import { createWishesService } from "../wishes/wishesService.js";
import { ApiError } from "../../api/apiError.js";

/** Restricts extension operations to this tab's existing authenticated session.
 * @param {import("../../auth/sessionManager.js").SessionManager} session Existing session.
 * @param {string} apiBaseUrl API origin.
 * @returns {() => void} Listener cleanup.
 */
export function installExtensionSessionBridge(session, apiBaseUrl) {
  const lists = createWishlistsService(session);
  const wishes = createWishesService(session, { apiBaseUrl });
  const lifetime = new AbortController();
  /** @param {Event} event Request relayed by the extension. */
  async function receive(event) {
    if (!(event instanceof CustomEvent)) return;
    const serialized = typeof event.detail === "string";
    let request = event.detail;
    if (serialized) {
      if (request.length > 3000000) return;
      try { request = JSON.parse(request); } catch { return; }
    }
    if (!request || typeof request.id !== "string" || !/^[a-f0-9-]{36}$/i.test(request.id) || !["probe", "lists", "image", "create"].includes(request.action)) return;
    const reply = (/** @type {unknown} */ result) => {
      const response = { id: request.id, result };
      document.dispatchEvent(new CustomEvent("monkado-extension-response", { detail: serialized ? JSON.stringify(response) : response }));
    };
    if (request.action === "probe") { reply({ ready: true, supportsVariants: true }); return; }
    try {
      const state = await session.ensureSession({ signal: lifetime.signal });
      if (state.status !== "authenticated") { reply({ error: "login" }); return; }
      if (request.action === "lists") {
        const items = await lists.load({ signal: lifetime.signal });
        reply({ lists: items.filter(item => !item.isArchived && !item.isSuspended).map(item => ({ id: item.id, name: item.name })) });
        return;
      }
      const value = request.value;
      if (request.action === "image") {
        if (!value || typeof value.listId !== "string" || !/^[a-f0-9-]{36}$/i.test(value.listId) || typeof value.url !== "string" || value.url.length > 2048) { reply({ error: "invalid" }); return; }
        const response = await session.request(`/api/v1/wishlists/${value.listId}/wish-images/resolve`, { method: "POST", authentication: "required", csrf: true, body: { url: value.url }, signal: lifetime.signal });
        const image = /** @type {{contentType?: unknown, contentBase64?: unknown} | null} */ (response.data);
        if (response.status !== 200 || image?.contentType !== "image/webp" || typeof image.contentBase64 !== "string" || !/^[A-Za-z0-9+/=]+$/.test(image.contentBase64) || image.contentBase64.length > 2799977) { reply({ error: "image" }); return; }
        reply({ image: `data:image/webp;base64,${image.contentBase64}` }); return;
      }
      if (!value || typeof value.listId !== "string" || typeof value.name !== "string" || typeof value.price !== "string" || typeof value.url !== "string") { reply({ error: "invalid" }); return; }
      if ((value.color !== undefined && typeof value.color !== "string") || (value.size !== undefined && typeof value.size !== "string")) { reply({ error: "invalid" }); return; }
      const created = await wishes.create(value.listId, { name: value.name, price: value.price, color: value.color ?? "", size: value.size ?? "", url: value.url, note: "", quantity: "1", isFavorite: false, isSurprise: false, acceptsSecondHand: false }, { signal: lifetime.signal });
      if (typeof value.image === "string" && /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(value.image) && value.image.length <= 2800000) {
        try {
          const bytes = Uint8Array.from(atob(value.image.split(",")[1]), char => char.charCodeAt(0));
          await wishes.uploadImage(value.listId, created.wish.id, new Blob([bytes], { type: "image/webp" }), { etag: created.etag, signal: lifetime.signal });
        } catch { reply({ error: "image" }); return; }
      }
      reply({ success: true });
    } catch (error) {
      reply({ error: error instanceof ApiError && error.kind === "http" && error.statusCode !== null && error.statusCode < 500 ? "rejected" : "uncertain" });
    }
  }
  document.addEventListener("monkado-extension-request", receive);
  return () => { lifetime.abort(); document.removeEventListener("monkado-extension-request", receive); };
}
