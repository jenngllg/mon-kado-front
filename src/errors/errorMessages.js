import { ApiError } from "../api/apiError.js";

const SafeErrors = new WeakSet();

/**
 * @param {unknown} error Candidate translated error.
 * @returns {error is UserFacingError} Whether this module produced the copy.
 */
export function isUserFacingError(error) {
  return typeof error === "object" && error !== null && SafeErrors.has(error);
}

/** @type {Readonly<Record<string, ErrorMessage>>} */
const CommonMessages = Object.freeze({
  GROUP_NOT_FOUND: { title: "Groupe indisponible", message: "Ce groupe n’existe plus ou tu n’en fais pas partie." },
  GROUP_IMAGE_NOT_FOUND: { title: "Photo indisponible", message: "Cette photo a été retirée ou n’est plus accessible." },
  GROUP_ACCESS_DENIED: { title: "Action réservée à l’organisateur", message: "Seul l’organisateur peut gérer ce groupe et ses invitations." },
  GROUP_VERSION_CONFLICT: { title: "Groupe modifié ailleurs", message: "Vérifie la version enregistrée du groupe avant de recommencer." },
  GROUP_MEMBER_NOT_FOUND: { title: "Membre indisponible", message: "Ce membre ne peut plus être invité ou ne fait plus partie du groupe." },
  GROUP_MEMBER_ALREADY_EXISTS: { title: "Déjà dans le groupe", message: "Cette personne fait déjà partie du groupe." },
  GROUP_INVITATION_NOT_FOUND: { title: "Invitation indisponible", message: "Cette invitation a expiré, a été retirée ou a déjà reçu une réponse." },
  GROUP_INVITATION_ALREADY_EXISTS: { title: "Invitation déjà envoyée", message: "Une invitation est déjà en attente pour cette personne." },
  GROUP_JOIN_LINK_NOT_FOUND: { title: "Accès indisponible", message: "Ce lien ou ce code n’est plus valide. Demande un nouveau code à un membre du groupe." },
  WISHLIST_GROUP_VISIBILITY_VERSION_CONFLICT: { title: "Visibilité modifiée", message: "La visibilité de cette liste a changé. Vérifie les groupes avant d’enregistrer ta sélection." },
  GROUP_JOIN_LINK_ALREADY_EXISTS: { title: "Partage déjà actif", message: "Un lien est déjà disponible pour ce groupe." },
  GROUP_JOIN_LINK_VERSION_CONFLICT: { title: "Partage modifié", message: "Le lien a changé. Ferme cette fenêtre puis rouvre le partage." },
  GROUP_OWNER_CANNOT_LEAVE: { title: "Tu organises ce groupe", message: "Supprime le groupe pour le quitter. Les listes seront conservées." },
  GROUP_LIMIT_REACHED: { title: "Limite de groupes atteinte", message: "Un membre peut rejoindre 50 groupes. Un groupe peut accueillir 100 membres, invitations en attente comprises." },
  GROUP_WISHLIST_ALREADY_EXISTS: { title: "Liste déjà partagée", message: "Cette liste est déjà accessible dans le groupe." },
  GROUP_WISHLIST_NOT_FOUND: { title: "Liste indisponible", message: "Cette liste n’est plus accessible dans ce groupe." },
  GROUP_OWNER_WISHLIST: { title: "C’est ta liste", message: "Ouvre-la depuis Mes listes pour préserver la surprise." },
  MEMBER_HANDLE_ALREADY_USED: {
    title: "Pseudo indisponible",
    message: "Ce pseudo est déjà utilisé avec ton tag. Choisis un autre pseudo.",
  },
  MEMBER_DISPLAY_NAME_TAG_UNAVAILABLE: {
    title: "Pseudo indisponible",
    message: "Choisis un autre pseudo : tous les tags de ce nom sont utilisés.",
  },
  WISHLIST_ARCHIVED: {
    title: "Liste archivée",
    message: "Désarchive la liste pour la modifier.",
  },
  WISHLIST_SUSPENDED: {
    title: "Liste suspendue",
    message: "Consultation uniquement.",
  },
  WISHLIST_VERSION_CONFLICT: {
    title: "Liste modifiée ailleurs",
    message: "Reviens à la liste pour consulter son état actuel avant de recommencer.",
  },
  CLIENT_TWO_FACTOR_MANAGEMENT_REQUIRED: {
    title: "Vérification nécessaire",
    message: "Recommence la vérification de ton authentificateur avant cette opération.",
  },
  CLIENT_TWO_FACTOR_EXPIRED: {
    title: "Vérification expirée",
    message: "Le délai de vérification est dépassé. Recommence la connexion.",
  },
  CLIENT_LOGIN_COMPLETION_REQUIRED: {
    title: "Connexion à recommencer",
    message: "La session n’a pas pu être vérifiée. Connecte-toi à nouveau.",
  },
  CLIENT_LOGOUT_UNCONFIRMED: {
    title: "Déconnexion serveur non confirmée",
    message: "L’accès local est fermé. Réessaie pour terminer la déconnexion auprès du serveur.",
  },
  CLIENT_SESSION_COORDINATION_UNAVAILABLE: {
    title: "Session indisponible",
    message: "La session ne peut pas être sécurisée dans ce navigateur. Vérifie ses autorisations de stockage puis réessaie.",
  },
  CLIENT_SESSION_BUSY: {
    title: "Session occupée dans un autre onglet",
    message: "Patiente un instant puis réessaie.",
  },
  CLIENT_AUTHENTICATION_REQUIRED: {
    title: "Connexion nécessaire",
    message: "Connecte-toi pour continuer.",
  },
  REQUEST_VALIDATION_ERROR: {
    title: "Informations à vérifier",
    message: "Certains champs contiennent une erreur.",
  },
  REQUEST_RATE_LIMIT_EXCEEDED: {
    title: "Trop de tentatives",
    message: "Patiente un moment avant de réessayer.",
  },
  REQUEST_NOT_FOUND: {
    title: "Page introuvable",
    message: "La ressource demandée n’existe pas ou n’est plus disponible.",
  },
  REQUEST_PAYLOAD_TOO_LARGE: {
    title: "Contenu trop volumineux",
    message: "Réduis la taille des informations envoyées puis réessaie.",
  },
  REQUEST_UNSUPPORTED_MEDIA_TYPE: {
    title: "Format non pris en charge",
    message: "Le format des informations envoyées n’est pas accepté.",
  },
  REQUEST_PRECONDITION_REQUIRED: {
    title: "Actualisation nécessaire",
    message: "Actualise les données avant de recommencer.",
  },
  SECURITY_UNAUTHORIZED: {
    title: "Session expirée",
    message: "Reconnecte-toi pour continuer.",
  },
  SECURITY_FORBIDDEN: {
    title: "Accès refusé",
    message: "Tu n’as pas l’autorisation d’effectuer cette action.",
  },
  TECHNICAL_DEPENDENCY_UNAVAILABLE: {
    title: "Service temporairement indisponible",
    message: "Réessaie dans quelques instants.",
  },
  TECHNICAL_SERVICE_UNAVAILABLE: {
    title: "Service temporairement indisponible",
    message: "Réessaie dans quelques instants.",
  },
});

/** @type {Readonly<Record<string, ErrorMessage>>} */
const KindMessages = Object.freeze({
  network: {
    title: "Service MonKado injoignable",
    message: "Impossible de joindre le service MonKado. Vérifie ta connexion ou réessaie dans quelques instants.",
  },
  timeout: {
    title: "Le service met trop de temps à répondre",
    message: "Réessaie dans quelques instants.",
  },
  invalidResponse: {
    title: "Réponse inattendue",
    message: "Une erreur technique empêche d’afficher le résultat.",
  },
});

/**
 * @typedef {Readonly<{ title: string, message: string }>} ErrorMessage
 */

/**
 * @typedef {Readonly<{
 *   title: string,
 *   message: string,
 *   validationErrors: ReadonlyArray<import("../api/apiError.js").ApiValidationError>,
 *   correlationId: string | null,
 *   retryAfterSeconds: number | null
 * }>} UserFacingError
 */

/**
 * Converts any failure into safe French copy.
 *
 * @param {unknown} error Failure to present.
 * @param {Readonly<Record<string, ErrorMessage>>} [featureMessages] Feature-specific mappings.
 * @returns {UserFacingError} Safe error for the interface.
 */
export function toUserFacingError(error, featureMessages = {}) {
  if (!(error instanceof ApiError)) {
    return createUserFacingError(
      {
        title: "Une erreur est survenue",
        message: "Réessaie dans quelques instants.",
      },
      [],
      null,
      null,
    );
  }

  const message = getApiErrorMessage(error, featureMessages);
  const correlationId = isTechnicalError(error)
    ? error.correlationId
    : null;

  return createUserFacingError(
    message,
    error.validationErrors,
    correlationId,
    error.retryAfterSeconds,
  );
}

/**
 * @param {ApiError} error API failure.
 * @param {Readonly<Record<string, ErrorMessage>>} featureMessages Feature mappings.
 * @returns {ErrorMessage} Selected message.
 */
function getApiErrorMessage(error, featureMessages) {
  if (error.errorCode !== null && Object.hasOwn(featureMessages, error.errorCode)) {
    return featureMessages[error.errorCode];
  }

  if (error.errorCode !== null && Object.hasOwn(CommonMessages, error.errorCode)) {
    return CommonMessages[error.errorCode];
  }

  if (error.kind !== "http") {
    return KindMessages[error.kind];
  }

  return getHttpStatusMessage(error.statusCode);
}

/**
 * @param {number | null} statusCode HTTP status.
 * @returns {ErrorMessage} Generic status message.
 */
function getHttpStatusMessage(statusCode) {
  if (statusCode === 401) {
    return CommonMessages.SECURITY_UNAUTHORIZED;
  }

  if (statusCode === 403) {
    return CommonMessages.SECURITY_FORBIDDEN;
  }

  if (statusCode === 404) {
    return CommonMessages.REQUEST_NOT_FOUND;
  }

  if (statusCode === 409) {
    return {
      title: "Action impossible",
      message: "Les données ont changé. Actualise la page puis réessaie.",
    };
  }

  if (statusCode === 412 || statusCode === 428) {
    return CommonMessages.REQUEST_PRECONDITION_REQUIRED;
  }

  if (statusCode === 429) {
    return CommonMessages.REQUEST_RATE_LIMIT_EXCEEDED;
  }

  if (statusCode !== null && statusCode >= 500) {
    return CommonMessages.TECHNICAL_SERVICE_UNAVAILABLE;
  }

  return {
    title: "Action impossible",
    message: "Vérifie les informations puis réessaie.",
  };
}

/**
 * @param {ApiError} error API failure.
 * @returns {boolean} Whether a support reference should be shown.
 */
function isTechnicalError(error) {
  return error.kind !== "http" ||
    (error.statusCode !== null && error.statusCode >= 500);
}

/**
 * @param {ErrorMessage} message Selected copy.
 * @param {ReadonlyArray<import("../api/apiError.js").ApiValidationError>} validationErrors Field errors.
 * @param {string | null} correlationId Support reference.
 * @param {number | null} retryAfterSeconds Retry delay.
 * @returns {UserFacingError} Frozen user-facing error.
 */
function createUserFacingError(
  message,
  validationErrors,
  correlationId,
  retryAfterSeconds,
) {
  const result = Object.freeze({
    title: message.title,
    message: message.message,
    validationErrors,
    correlationId,
    retryAfterSeconds,
  });
  SafeErrors.add(result);

  return result;
}
