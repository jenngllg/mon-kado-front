/** @typedef {"displayName" | "email" | "password"} RegistrationField */
/** @typedef {Record<RegistrationField, string>} RegistrationValues */

/** Validates user input without changing the password or counting UTF-16 units.
 * @param {RegistrationField} field Field contract.
 * @param {string} value Unmodified input.
 * @returns {string | null} Local French copy, never backend prose.
 */
export function validateRegistrationField(field, value) {
  const trimmed = value.trim();
  if (field === "displayName") {
    if (!trimmed) return "Indique ton nom d’affichage.";
    if ([...value].some(character => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0xd800 && code <= 0xdfff;
    }) || /\p{Cc}/u.test(value)) return "Le nom ne doit pas contenir de caractères de contrôle ou invalides.";
    if ([...trimmed].length > 80) return "Le nom doit contenir au maximum 80 caractères.";
    return null;
  }
  if (field === "email") {
    if (!trimmed) return "Indique ton adresse e-mail.";
    if ([...trimmed].length > 254) return "L’adresse e-mail doit contenir au maximum 254 caractères.";
    const separator = trimmed.lastIndexOf("@");
    const local = trimmed.slice(0, separator);
    const domain = trimmed.slice(separator + 1);
    // Leave uncommon mailbox formats to the server's authoritative parser.
    const quoted = local.startsWith('"') && local.endsWith('"');
    if (separator <= 0 || !domain || /[\s@<>]/u.test(domain) || /[<>\p{Cc}]/u.test(local) ||
      (!quoted && /[\s@]/u.test(local))) return "Vérifie le format de ton adresse e-mail.";
    return null;
  }
  if (!trimmed) return "Indique un mot de passe.";
  const length = [...value].length;
  if (length < 12 || length > 128) return "Le mot de passe doit contenir de 12 à 128 caractères.";
  return null;
}

/** @type {Readonly<Record<RegistrationField, string>>} */
export const RegistrationServerMessages = Object.freeze({
  displayName: "Vérifie ton nom : 80 caractères maximum, sans caractères de contrôle ou invalides.",
  email: "Vérifie le format de ton adresse e-mail (254 caractères maximum).",
  password: "Vérifie ton mot de passe : de 12 à 128 caractères.",
});
