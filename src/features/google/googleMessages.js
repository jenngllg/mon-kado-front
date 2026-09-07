/** @type {Readonly<Record<string, import("../../errors/errorMessages.js").ErrorMessage>>} */
export const GoogleMessages = Object.freeze({
  CLIENT_GOOGLE_UNAVAILABLE: { title: "Connexion Google indisponible", message: "La connexion avec Google n’est pas activée dans cet environnement. Tu peux utiliser ton adresse e-mail." },
  CLIENT_GOOGLE_CANCELLED: { title: "Connexion avec Google annulée", message: "Tu peux recommencer ou utiliser ton adresse e-mail." },
  CLIENT_GOOGLE_SUPERSEDED: { title: "Connexion à recommencer", message: "La session a changé pendant ton absence. Cette tentative Google a été abandonnée." },
  GOOGLE_AUTHENTICATION_FAILED: { title: "Connexion à recommencer", message: "La connexion avec Google n’a pas pu aboutir. Recommence la connexion." },
  GOOGLE_ACCOUNT_LINK_REQUIRED: { title: "Vérification nécessaire", message: "La liaison avec ton compte MonKado nécessite une vérification complémentaire." },
  GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED: { title: "Vérification nécessaire", message: "Une vérification complémentaire est nécessaire pour continuer avec Google." },
});
