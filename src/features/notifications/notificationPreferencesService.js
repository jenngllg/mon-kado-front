import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["NotificationPreferencesResponse"]} NotificationPreferences */
/** @typedef {Readonly<{settings: NotificationPreferences, etag: string}>} PreferenceSnapshot */

export const NotificationPreferenceOptions = Object.freeze([
  { key: "wishesAdded", label: "Nouveaux souhaits", detail: "Dans les listes que tu suis." },
  { key: "groupJoined", label: "Nouveaux membres dans mes groupes", detail: "" },
  { key: "groupInvitation", label: "Invitations à un groupe", detail: "" },
  { key: "occasionReminder", label: "Rappels d’événements", detail: "Sept jours et un jour avant la date." },
  { key: "sharingReminder", label: "Rappels de partage de mes listes", detail: "" },
  { key: "groupWishlistShared", label: "Listes partagées dans mes groupes", detail: "" },
  { key: "reservationUnavailable", label: "Souhaits réservés devenus indisponibles", detail: "" },
  { key: "wishReserved", label: "Réservations de mes souhaits", detail: "Uniquement hors du mode surprise." },
  { key: "suggestionAdded", label: "Nouvelles idées surprises dans mes groupes", detail: "" },
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
