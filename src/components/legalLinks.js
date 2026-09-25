/** Native document links must not be intercepted by the application session/router.
 * @returns {HTMLElement} Accessible public-document navigation.
 */
export function createLegalLinks() {
  const navigation = document.createElement("nav");
  navigation.className = "cluster";
  navigation.setAttribute("aria-label", "Informations légales");
  for (const [path, label] of [["legal-notice", "Mentions légales"], ["privacy-policy", "Confidentialité"], ["terms-of-use", "Conditions d’utilisation"]]) {
    const link = document.createElement("a");
    link.href = "/" + path;
    link.textContent = label;
    link.dataset.nativeNavigation = "true";
    navigation.append(link);
  }
  return navigation;
}

/** Inform without inventing consent or mandatory acceptance.
 * @param {string} [message] Collection-specific explanation, never user-supplied HTML.
 * @returns {HTMLElement} Collection-point notice.
 */
export function createPrivacyNotice(message = "Consulte les informations sur l’utilisation de tes données et tes droits avant de continuer.") {
  const notice = document.createElement("aside");
  notice.className = "flow";
  const text = document.createElement("p");
  text.textContent = message;
  notice.append(text, createLegalLinks());
  return notice;
}
