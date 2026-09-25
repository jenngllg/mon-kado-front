/** Public documents are explicit: never enumerate arbitrary files into a release. */
export const LegalDocuments = Object.freeze(["legal-notice.html", "privacy-policy.html", "terms-of-use.html"]);

/** Checks reviewed public configuration and documents before any release pointer is changed.
 * @param {unknown} value Versioned repository configuration, never environment secrets.
 * @param {readonly string[]} documents Built HTML in LegalDocuments order.
 * @returns {boolean} Whether Google was explicitly enabled in this revision.
 */
export function verifyPublication(value, documents) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw rejected();
  const configuration = /** @type {Record<string, unknown>} */ (value);
  if (Object.keys(configuration).sort().join() !== "apiOrigin,googleEnabled,legalApproved,legalVersion,schemaVersion" ||
    configuration.schemaVersion !== 1 || configuration.apiOrigin !== "https://api.monkado.fr" ||
    typeof configuration.googleEnabled !== "boolean" || configuration.legalApproved !== true ||
    typeof configuration.legalVersion !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(configuration.legalVersion) ||
    !Number.isFinite(Date.parse(configuration.legalVersion)) ||
    new Date(configuration.legalVersion).toISOString().slice(0, 10) !== configuration.legalVersion) throw rejected();
  if (documents.length !== LegalDocuments.length || documents.some(document =>
    !document.includes('<html lang="fr"') || !document.includes("<h1>") ||
    !document.includes('mailto:monkado.app@gmail.com') || !document.includes(String(configuration.legalVersion)) ||
    /data-publication-draft|brouillon|à compléter|LEGAL-\d+/i.test(document))) throw rejected();
  return configuration.googleEnabled;
}

/** Fail without echoing document contents or operator information. */
function rejected() { return new Error("PUBLICATION_REVIEW_REQUIRED"); }
