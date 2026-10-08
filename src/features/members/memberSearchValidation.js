import { validateDisplayName } from "../../auth/displayNameValidation.js";

/** Validates the original search text before server normalization.
 * @param {string} value Search input.
 * @returns {string | null} Local French error.
 */
export function validateMemberSearch(value) {
  if (!value.trim()) return "Nom du membre obligatoire.";
  const error = validateDisplayName(value);
  if (error) return error;
  if ([...value.trim().normalize("NFC")].length < 2) return "Le nom recherché doit contenir au moins deux caractères.";
  return null;
}
