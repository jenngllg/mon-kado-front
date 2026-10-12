import { DisplayNameServerMessage, validateDisplayName } from "../../auth/displayNameValidation.js";

/** Validates the original search text before server normalization.
 * @param {string} value Search input.
 * @returns {string | null} Local French error.
 */
export function validateMemberSearch(value) {
  if (!value.trim()) return "Nom du membre obligatoire.";
  if (/\p{Cc}/u.test(value)) return DisplayNameServerMessage;
  const handle = value.trim().match(/^(.+)#([0-9]{4})$/u);
  const name = handle ? handle[1] : value;
  const error = validateDisplayName(name);
  if (error) return error;
  if (!handle && [...name.trim().normalize("NFC")].length < 2) return "Le nom recherché doit contenir au moins deux caractères.";
  return null;
}
