import { validateEmailAddress } from "../../auth/emailValidation.js";
import { validateCurrentPassword } from "../../auth/passwordValidation.js";

/** @typedef {"email" | "password"} LoginField */
/** @typedef {{email: string, password: string, rememberMe: boolean}} LoginValues */

/** Validates existing credentials without applying the new-password policy.
 * @param {LoginField} name Field name.
 * @param {string} value Untouched input.
 * @returns {string | null} Local French error.
 */
export function validateLoginField(name, value) {
  if (name === "email") return validateEmailAddress(value);
  return validateCurrentPassword(value);
}

export const LoginServerMessages = Object.freeze({
  email: "Vérifie ton adresse e-mail.",
  password: "Vérifie ton mot de passe.",
});

export const LoginErrorMessages = Object.freeze({
  ACCOUNT_INVALID_CREDENTIALS: {
    title: "Connexion impossible",
    message: "Adresse e-mail ou mot de passe incorrect.",
  },
  ACCOUNT_EMAIL_NOT_CONFIRMED: {
    title: "Adresse e-mail à confirmer",
    message: "Confirme ton adresse e-mail avant de te connecter à MonKado.",
  },
});
