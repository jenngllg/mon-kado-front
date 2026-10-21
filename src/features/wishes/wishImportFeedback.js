import { createActionLink, createAlert } from "../../components/index.js";
import { safeHttpUrl } from "./wishValidation.js";

const AmazonShortHosts = new Set(["amzn.eu", "amzn.to", "a.co"]);

/** Explains empty imports once and keeps partial suggestions distinguishable from failure.
 * @param {import("./wishImportService.js").WishSuggestions} suggestions Validated, editable data.
 * @returns {HTMLElement | null} Accessible feedback without automatic merchant navigation.
 */
export function createWishImportFeedback(suggestions) {
  const hasInformation = !!(suggestions.name || suggestions.price || suggestions.image);
  if (hasInformation && !suggestions.warnings.length) return null;
  const url = safeHttpUrl(suggestions.url);
  const shortLink = url !== null && AmazonShortHosts.has(url.hostname);
  const message = hasInformation ? [...new Set(suggestions.warnings)].join(" ") : shortLink
    ? "Ouvre le lien dans ton navigateur, puis colle l’adresse complète de la fiche produit. Tu peux aussi compléter le souhait manuellement."
    : "Aucune information n’a pu être récupérée depuis ce lien. Tu peux compléter le souhait manuellement.";
  const alert = createAlert({ variant: "warning", title: hasInformation ? "Suggestions à vérifier" : "Informations indisponibles", message });
  if (!hasInformation && url && url.port === "") {
    const open = createActionLink({ label: "Ouvrir le lien", href: url.href });
    open.target = "_blank"; open.rel = "noopener noreferrer"; open.referrerPolicy = "no-referrer";
    alert.querySelector(".ui-alert__content")?.append(open);
  }
  return alert;
}
