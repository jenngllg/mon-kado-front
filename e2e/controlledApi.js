import { expect } from "@playwright/test";

export const listId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
export const shareId = "019c52dd-56c1-7cc6-8a95-243f3a032e06";
export const wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e10";
export const secret = "A".repeat(43);
export const sharedPath = `/shared-wishlists/${shareId}`;

/** Test-only transport: no API request may reach a real backend.
 * @param {import('@playwright/test').BrowserContext} context
 */
export async function controlledApi(context) {
  const state = { authenticated: false, joins: 0, reservations: 0, reads: 0, revoked: false, listExists: true, listWrites: 0, listVersion: 1, reservedQuantity: 0, reservationVersion: 1, wishExists: true, wishWrites: 0, wishVersion: 1 };
  const wishlist = { id: listId, name: "Anniversaire — test navigateur", occasion: "birthday", eventDate: "2027-12-20", message: "Liste de test", isSuspended: false };
  const wish = { id: wishId, wishlistId: listId, name: "Une théière", note: "Une note\nsur deux lignes.", url: "https://example.test/produit", price: 25, quantity: 3, position: 1, entityTag: '"wish-1"', imageUrl: null, reservedQuantity: 0, availableQuantity: 3, currentParticipantReservedQuantity: 0 };
  /** @type {string[]} */
  const unexpected = [];
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === "http://localhost:5173") return route.continue();
    if (url.origin !== "http://localhost:7000") {
      unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort();
    }
    const path = url.pathname;
    const method = request.method();
    const headers = { "Access-Control-Allow-Origin": "http://localhost:5173", "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag,X-Correlation-ID", "Content-Type": "application/json" };
    /** @param {number} status @param {unknown} data @param {string} [etag] */
    const send = (status, data, etag) => route.fulfill({ status, headers: { ...headers, ...(etag ? { ETag: etag } : {}) }, body: status === 204 ? "" : JSON.stringify(data) });
    /** @param {number} status @param {string | null} code */
    const error = (status, code) => send(status, { statusCode: status, errorCode: code, title: null, message: null, validationErrors: null });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization,X-CSRF-TOKEN,X-Correlation-ID,X-MonKado-Share-Token,If-Match" } });
    if (path === "/security/csrf-token") return send(200, { token: "csrf-test-only" });
    if (path === "/api/v1/auth/sessions" && method === "POST") {
      state.authenticated = true;
      return send(200, { accessToken: "access-test-only", expiresIn: 900, tokenType: "Bearer" });
    }
    if (path === "/api/v1/auth/sessions/refresh") return state.authenticated ? send(200, { accessToken: "access-test-only", expiresIn: 900, tokenType: "Bearer" }) : error(401, null);
    if (path === "/api/v1/auth/sessions/current" && method === "DELETE") {
      state.authenticated = false;
      return send(204, null);
    }
    if (path === "/api/v1/auth/sessions/current") return send(200, { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", displayName: "Camille test", email: "test@example.test", roles: ["member"] }, '"identity"');
    if (path === "/api/v1/wishlists" && method === "GET") return send(200, state.listExists ? [wishlist] : []);
    if (path === "/api/v1/wishlists" && method === "POST") {
      expect(request.headers().authorization).toBe("Bearer access-test-only");
      expect(Object.keys(request.postDataJSON()).sort()).toEqual(["eventDate", "message", "name", "occasion"]);
      Object.assign(wishlist, request.postDataJSON());
      state.listExists = true;
      state.listWrites++;
      return send(201, wishlist, `"list-${state.listVersion}"`);
    }
    if (path === `/api/v1/wishlists/${listId}`) {
      if (!state.listExists) return error(404, "WISHLIST_NOT_FOUND");
      if (method === "GET") return send(200, wishlist, `"list-${state.listVersion}"`);
      if (["PUT", "DELETE"].includes(method)) {
        state.listWrites++;
        expect(request.headers().authorization).toBe("Bearer access-test-only");
        if (request.headers()["if-match"] !== `"list-${state.listVersion}"`) return error(412, "WISHLIST_VERSION_CONFLICT");
        if (method === "DELETE") { state.listExists = false; return send(204, null); }
        Object.assign(wishlist, request.postDataJSON());
        state.listVersion++;
        return send(200, wishlist, `"list-${state.listVersion}"`);
      }
    }
    if (path === `/api/v1/wishlists/${listId}/wishes`) {
      if (method === "GET") return send(200, { wishes: state.wishExists ? [wish] : [] }, '"collection-1"');
      if (method === "POST") {
        expect(Object.keys(request.postDataJSON()).sort()).toEqual(["name", "note", "price", "quantity", "url"]);
        expect(request.headers()["if-match"]).toBeUndefined();
        Object.assign(wish, request.postDataJSON());
        state.wishExists = true; state.wishWrites++;
        return send(201, wish, `"wish-${state.wishVersion}"`);
      }
    }
    if (path === `/api/v1/wishlists/${listId}/wishes/${wishId}`) {
      if (!state.wishExists) return error(404, "WISH_NOT_FOUND");
      if (method === "GET") return send(200, wish, `"wish-${state.wishVersion}"`);
      if (["PUT", "DELETE"].includes(method)) {
        state.wishWrites++;
        expect(request.headers()["if-match"]).toBe(`"wish-${state.wishVersion}"`);
        if (method === "DELETE") { state.wishExists = false; return send(204, null); }
        Object.assign(wish, request.postDataJSON());
        state.wishVersion++; wish.entityTag = `"wish-${state.wishVersion}"`;
        return send(200, wish, wish.entityTag);
      }
    }
    if (path === `/api/v1/wishlists/${listId}/share-link` && method === "GET") return error(404, "WISHLIST_SHARE_LINK_NOT_FOUND");
    if (path.startsWith(`/api/v1/shared-wishlists/${shareId}`)) {
      expect(request.headers()["x-monkado-share-token"]).toBe(secret);
      expect(request.url()).not.toContain(secret);
      if (state.revoked) return error(404, "SHARED_WISHLIST_NOT_FOUND");
      if (path === `/api/v1/shared-wishlists/${shareId}/participants/current` && method === "GET") return error(404, "WISHLIST_PARTICIPANT_NOT_FOUND");
      if (path === `/api/v1/shared-wishlists/${shareId}/wishes/${wishId}/reservations/current` && ["GET", "PUT", "DELETE"].includes(method)) {
        const reservation = () => ({ id: "019c52dd-56c1-7cc6-8a95-243f3a032e20", wishId, quantity: state.reservedQuantity });
        const etag = () => `"reservation-${state.reservationVersion}"`;
        if (method === "GET") return state.reservedQuantity ? send(200, reservation(), etag()) : error(404, "GIFT_RESERVATION_NOT_FOUND");
        state.reservations++;
        expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
        if (state.reservedQuantity && request.headers()["if-match"] !== etag()) return error(412, "GIFT_RESERVATION_VERSION_CONFLICT");
        if (method === "DELETE") { state.reservedQuantity = 0; state.reservationVersion++; return send(204, null); }
        if (method === "PUT") {
          const created = state.reservedQuantity === 0;
          expect(Object.keys(request.postDataJSON())).toEqual(["quantity"]);
          if (created) expect(request.headers()["if-match"]).toBeUndefined();
          state.reservedQuantity = request.postDataJSON().quantity;
          state.reservationVersion++;
          return send(created ? 201 : 200, reservation(), etag());
        }
      }
      if (method === "POST" && path === `/api/v1/shared-wishlists/${shareId}/participants`) {
        state.joins++;
        return error(503, null);
      }
      if (method === "GET" && [ `/api/v1/shared-wishlists/${shareId}`, `/api/v1/shared-wishlists/${shareId}/wishes/${wishId}` ].includes(path)) {
        state.reads++;
        const currentWish = { ...wish, reservedQuantity: state.reservedQuantity, availableQuantity: wish.quantity - state.reservedQuantity, currentParticipantReservedQuantity: state.reservedQuantity };
        return send(200, path.endsWith(`/wishes/${wishId}`) ? currentWish : { ...wishlist, ownerDisplayName: "Alex test", wishes: [currentWish] });
      }
    }
    unexpected.push(`${method} ${path}`);
    return error(500, null);
  });
  return { state, unexpected };
}
