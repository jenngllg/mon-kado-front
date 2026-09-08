import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isWishlistId } from "./wishlistValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishlistShareLinkResponse"]} WishlistShareLinkResponse */
/** @typedef {Readonly<Pick<WishlistShareLinkResponse, "id" | "shareUrl"> & {etag: string}>} WishlistShareLink */
/** @typedef {(wishlistId: string, options: {signal: AbortSignal}) => Promise<WishlistShareLink | null>} LoadWishlistShare */
/** @typedef {(wishlistId: string, options: {signal: AbortSignal}) => Promise<WishlistShareLink>} CreateWishlistShare */

/** Creates owner share operations without persisting their bearer links.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Session transport.
 * @param {{frontendOrigin: string}} options Trusted frontend origin.
 * @returns {{load: LoadWishlistShare, create: CreateWishlistShare}} Share operations.
 */
export function createWishlistShareService(session, { frontendOrigin }) {
  let origin;
  try { origin = new URL(frontendOrigin); }
  catch { throw new ApiError({ kind: "invalidResponse" }); }
  if (!/^https?:$/.test(origin.protocol) || origin.origin !== frontendOrigin) throw new ApiError({ kind: "invalidResponse" });
  return {
    load: async (id, options) => {
      try { return await request(id, "GET", 200, options.signal); }
      catch (error) {
        if (error instanceof ApiError && error.statusCode === 404 && error.errorCode === "WISHLIST_SHARE_LINK_NOT_FOUND") return null;
        throw error;
      }
    },
    create: (id, options) => request(id, "POST", 201, options.signal),
  };

  /** @param {string} id List ID. @param {string} method HTTP method. @param {number} status Expected status.
   * @param {AbortSignal} signal Cancellation. @returns {Promise<WishlistShareLink>} Validated private link.
   */
  async function request(id, method, status, signal) {
    if (!isWishlistId(id)) throw new ApiError({ kind: "invalidResponse" });
    const response = await session.request(`/api/v1/wishlists/${id}/share-link`, { method, authentication: "required", signal });
    const data = response.data;
    if (response.status !== status || !data || typeof data !== "object" || !("id" in data) || !isWishlistId(data.id) ||
      !("shareUrl" in data) || typeof data.shareUrl !== "string" || !isStrongEntityTag(response.metadata.etag)) throw invalid();
    // The backend emits this exact URL shape; reject browser URL repair and hidden credentials/query parameters.
    const prefix = `${frontendOrigin}/shared-wishlists/${data.id}#`;
    if (!data.shareUrl.startsWith(prefix) || !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(data.shareUrl.slice(prefix.length))) throw invalid();
    return Object.freeze({ id: data.id, shareUrl: data.shareUrl, etag: response.metadata.etag });
    function invalid() { return new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId }); }
  }
}
