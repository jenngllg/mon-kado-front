import { EmailServerValidationMessage, validateEmailAddress } from "../../auth/emailValidation.js";
import { DisplayNameServerMessage, validateDisplayName } from "../../auth/displayNameValidation.js";

/** @typedef {"displayName" | "email" | "password"} RegistrationField */
/** @typedef {Record<RegistrationField, string>} RegistrationValues */

/** Validates user input without changing the password or counting UTF-16 units.
 * @param {RegistrationField} field Field contract.
 * @param {string} value Unmodified input.
 * @returns {string | null} Local French copy, never backend prose.
 */
export function validateRegistrationField(field, value) {
  const trimmed = value.trim();
  if (field === "displayName") return validateDisplayName(value);
  if (field === "email") return validateEmailAddress(value);
  if (!trimmed) return "Indique un mot de passe.";
  const length = [...value].length;
  if (length < 12 || length > 128) return "Le mot de passe doit contenir de 12 à 128 caractères.";
  return null;
}

/** @type {Readonly<Record<RegistrationField, string>>} */
export const RegistrationServerMessages = Object.freeze({
  displayName: DisplayNameServerMessage,
  email: EmailServerValidationMessage,
  password: "Vérifie ton mot de passe : de 12 à 128 caractères.",
});
