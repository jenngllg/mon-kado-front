/** Validates an existing credential without imposing the new-password minimum.
 * @param {string} value Untouched password.
 * @returns {string | null} Safe local copy.
 */
export function validateCurrentPassword(value) {
  if (value.trim() === "") return "Renseigne ton mot de passe.";
  if ([...value].length > 128) return "Le mot de passe ne doit pas dépasser 128 caractères.";
  return null;
}

/** Compares local confirmation values without normalization or trimming.
 * @param {string} confirmation Untouched confirmation.
 * @param {string} password Untouched password.
 * @returns {string | null} Safe local copy.
 */
export function validatePasswordConfirmation(confirmation, password) {
  if (confirmation === "") return "Confirme ton mot de passe.";
  if (confirmation !== password) return "Les deux mots de passe doivent être identiques.";
  return null;
}
