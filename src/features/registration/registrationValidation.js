import { EmailServerValidationMessage, validateEmailAddress } from "../../auth/emailValidation.js";

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
  if (field === "email") return validateEmailAddress(value);
  if (!trimmed) return "Indique un mot de passe.";
  const length = [...value].length;
  if (length < 12 || length > 128) return "Le mot de passe doit contenir de 12 à 128 caractères.";
  return null;
}

/** @type {Readonly<Record<RegistrationField, string>>} */
export const RegistrationServerMessages = Object.freeze({
  displayName: "Vérifie ton nom : 80 caractères maximum, sans caractères de contrôle ou invalides.",
  email: EmailServerValidationMessage,
  password: "Vérifie ton mot de passe : de 12 à 128 caractères.",
});
