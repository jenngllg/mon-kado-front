import { validateDisplayName } from "../../auth/displayNameValidation.js";

/** Validates the original search text before server normalization.
 * @param {string} value Search input.
 * @returns {string | null} Local French error.
 */
export function validateMemberSearch(value) {
  if (!value.trim()) return "Indique le nom du membre à rechercher.";
  const error = validateDisplayName(value);
  if (error) return error;
  if ([...value.trim().normalize("NFC")].length < 2) return "Saisis au moins deux caractères du nom du membre.";
  return null;
}
