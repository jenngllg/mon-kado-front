import { EmailServerValidationMessage, validateEmailAddress } from "../../auth/emailValidation.js";
import { DisplayNameServerMessage, validateDisplayName } from "../../auth/displayNameValidation.js";
import { NewPasswordServerMessage, validateNewPassword } from "../../auth/newPasswordValidation.js";

/** @typedef {"displayName" | "email" | "password"} RegistrationField */
/** @typedef {Record<RegistrationField, string>} RegistrationValues */

/** Validates user input without changing the password or counting UTF-16 units.
 * @param {RegistrationField} field Field contract.
 * @param {string} value Unmodified input.
 * @returns {string | null} Local French copy, never backend prose.
 */
export function validateRegistrationField(field, value) {
  if (field === "displayName") return validateDisplayName(value);
  if (field === "email") return validateEmailAddress(value);
  return validateNewPassword(value);
}

/** @type {Readonly<Record<RegistrationField, string>>} */
export const RegistrationServerMessages = Object.freeze({
  displayName: DisplayNameServerMessage,
  email: EmailServerValidationMessage,
  password: NewPasswordServerMessage,
});
