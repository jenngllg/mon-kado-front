import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["NotificationPreferencesResponse"]} NotificationPreferences */
/** @typedef {Readonly<{settings: NotificationPreferences, etag: string}>} PreferenceSnapshot */

export const NotificationPreferenceOptions = Object.freeze([
  { key: "wishesAdded", label: "Nouveaux souhaits", detail: "(dans les listes que tu suis)" },
  { key: "groupJoined", label: "Nouveaux membres dans mes groupes" },
  { key: "groupInvitation", label: "Invitations à un groupe" },
  { key: "occasionReminder", label: "Rappels d’évènements (J-7 et J-1)" },
  { key: "sharingReminder", label: "Rappels de partage de mes listes" },
  { key: "groupWishlistShared", label: "Listes partagées dans mes groupes" },
  { key: "reservationUnavailable", label: "Souhaits réservés devenus indisponibles" },
  { key: "wishReserved", label: "Réservations de mes souhaits", detail: "(uniquement hors du mode surprise)" },
  { key: "suggestionAdded", label: "Nouvelles idées surprises dans mes groupes" },
]);

/** @param {Pick<import("../../auth/sessionManager.js").SessionManager,"request">} session Authenticated transport. */
export function createNotificationPreferencesService(session) {
  const path = "/api/v1/members/current/notification-preferences";
  /** @param {import("../../api/apiClient.js").ApiResponse<unknown>} response Server state. @returns {PreferenceSnapshot} Validated immutable state. */
  function read(response) {
    const settings = response.data;
    if (response.status !== 200 || !isNotificationPreferences(settings) || !isStrongEntityTag(response.metadata.etag)) {
      throw new ApiError({kind:"invalidResponse",statusCode:response.status,correlationId:response.metadata.correlationId});
    }
    return Object.freeze({settings:Object.freeze({...settings}),etag:response.metadata.etag});
  }
  return {
    /** @param {AbortSignal} signal View lifetime. */
    async load(signal) { return read(await session.request(path,{authentication:"required",signal})); },
    /** @param {NotificationPreferences} settings Complete local choices. @param {string} etag Latest settings version. @param {AbortSignal} signal View lifetime. */
    async save(settings, etag, signal) {
      if (!isNotificationPreferences(settings) || !isStrongEntityTag(etag)) throw new TypeError("Invalid notification preferences.");
      const saved = read(await session.request(path,{method:"PUT",authentication:"required",csrf:true,ifMatch:etag,body:{...settings},signal}));
      if (!equalNotificationPreferences(saved.settings,settings)) throw new ApiError({kind:"invalidResponse",statusCode:200});
      return saved;
    },
  };
}

/** @param {unknown} value @returns {value is NotificationPreferences} Whether every supported type has an explicit boolean choice. */
export function isNotificationPreferences(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === NotificationPreferenceOptions.length &&
    NotificationPreferenceOptions.every(({key}) => typeof /** @type {Record<string,unknown>} */(value)[key] === "boolean");
}

/** @param {NotificationPreferences} left @param {NotificationPreferences} right */
export function equalNotificationPreferences(left,right) {
  return NotificationPreferenceOptions.every(({key})=>left[/** @type {keyof NotificationPreferences} */(key)]===right[/** @type {keyof NotificationPreferences} */(key)]);
}
