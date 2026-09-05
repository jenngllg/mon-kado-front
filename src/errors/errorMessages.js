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
    title: "Connexion impossible",
    message: "Vérifie ta connexion internet puis réessaie.",
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
