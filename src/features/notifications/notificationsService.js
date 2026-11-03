import { ApiError } from "../../api/apiError.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["NotificationResponse"]} Notification */
const kinds = new Set(["wishesAdded", "groupJoined", "groupInvitation", "occasionReminder", "sharingReminder", "groupWishlistShared", "reservationUnavailable", "wishReserved", "suggestionAdded"]);

/** @param {Pick<import("../../auth/sessionManager.js").SessionManager,"request">} session Authenticated transport. */
export function createNotificationsService(session) {
  /** @param {string} path Endpoint. @param {AbortSignal} signal Lifetime. */
  async function command(path, signal) {
    const result = await session.request(path, { method: "POST", authentication: "required", csrf: true, expectEmptyResponse: true, signal });
    if (result.status !== 204) throw invalid();
  }
  return {
    /** @param {AbortSignal} signal Lifetime. @param {number} [page] Page number. */
    async load(signal, page = 1) {
      const result = await session.request(`/api/v1/notifications?page=${page}&pageSize=20`, { authentication: "required", signal });
      const value = /** @type {{items?:unknown[],totalCount?:number,totalPages?:number,currentPage?:number,pageSize?:number}|null} */ (result.data);
      if (result.status !== 200 || !value || !Array.isArray(value.items) || value.currentPage !== page || value.pageSize !== 20 ||
        !Number.isSafeInteger(value.totalCount) || Number(value.totalCount) < 0 || value.totalPages !== Math.ceil(Number(value.totalCount) / 20) ||
        value.items.length !== Math.min(20, Math.max(0, Number(value.totalCount) - (page - 1) * 20)) || !value.items.every(isNotification)) throw invalid();
      return { items: /** @type {Notification[]} */ (value.items), totalPages: Number(value.totalPages) };
    },
    /** @param {string|null} id Target, or all visible notifications. @param {AbortSignal} signal Lifetime. */
    read: (id, signal) => command(id ? `/api/v1/notifications/${identifier(id)}/read` : "/api/v1/notifications/read", signal),
    /** @param {string} id Owned sharing reminder. @param {AbortSignal} signal Lifetime. */
    dismiss: (id, signal) => command(`/api/v1/notifications/${identifier(id)}/dismiss`, signal),
    /** @param {string} id Follow notification. @param {AbortSignal} signal Lifetime. */
    async destination(id, signal) {
      const result = await session.request(`/api/v1/notifications/${identifier(id)}/destination`, { authentication: "required", signal });
      const value = /** @type {{href?:unknown}|null} */ (result.data);
      if (result.status !== 200 || typeof value?.href !== "string") throw invalid();
      return value.href;
    },
  };
}

/** @param {unknown} value @returns {value is Notification} */
function isNotification(value) {
  if (!value || typeof value !== "object") return false;
  const n = /** @type {Notification} */ (value);
  return isWishlistId(n.id) && kinds.has(n.kind) && typeof n.href === "string" && /^\/(?:lists|groups|reservations|followed-lists)(?:[/?][^#]*)?$/.test(n.href) &&
    !n.href.startsWith("//") && !/[\\\s]/.test(n.href) && Number.isSafeInteger(n.quantity) && n.quantity > 0 &&
    (n.daysRemaining === null || Number.isInteger(n.daysRemaining)) &&
    [n.actorDisplayName, n.wishlistName, n.groupName, n.wishName].every(v => v === null || typeof v === "string") &&
    typeof n.createdAt === "string" && Number.isFinite(Date.parse(n.createdAt)) && (n.readAt === null || typeof n.readAt === "string" && Number.isFinite(Date.parse(n.readAt)));
}
/** @param {string} id Member-private notification. */
function identifier(id) { if (!isWishlistId(id)) throw new TypeError("Invalid notification identifier"); return id; }
function invalid() { return new ApiError({ kind: "invalidResponse" }); }

/** @param {Notification} n Server-authorized notification. */
export function notificationLabel(n) {
  const actor = n.actorDisplayName ?? "Un proche";
  switch (n.kind) {
    case "wishesAdded": return `${actor} a ajouté ${n.quantity === 1 ? "un souhait" : `${n.quantity} souhaits`} à la liste « ${n.wishlistName} ».`;
    case "groupJoined": return `${actor} a rejoint le groupe « ${n.groupName} ».`;
    case "groupInvitation": return `${actor} t’invite dans le groupe « ${n.groupName} ».`;
    case "occasionReminder": return `« ${n.wishlistName} » de ${actor} : plus que ${n.daysRemaining} ${n.daysRemaining === 1 ? "jour" : "jours"} !`;
    case "sharingReminder": return `Pense à partager ta liste « ${n.wishlistName} » !`;
    case "groupWishlistShared": return `${actor} a partagé la liste « ${n.wishlistName} » dans « ${n.groupName} ».`;
    case "reservationUnavailable": return `Le souhait « ${n.wishName} » que tu avais réservé n’est plus disponible.`;
    case "wishReserved": return `${actor} a réservé « ${n.wishName} » sur ta liste « ${n.wishlistName} ».`;
    case "suggestionAdded": return `${actor} a proposé une idée surprise pour « ${n.wishlistName} » dans « ${n.groupName} ».`;
    default: return "Nouvelle notification";
  }
}
