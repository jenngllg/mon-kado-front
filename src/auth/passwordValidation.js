/** Validates an existing credential without imposing the new-password minimum.
 * @param {string} value Untouched password.
 * @returns {string | null} Safe local copy.
 */
export function validateCurrentPassword(value) {
  if (value.trim() === "") return "Mot de passe obligatoire.";
  if ([...value].length > 128) return "Mot de passe trop long : 128 caractères maximum.";
  return null;
}

/** Compares local confirmation values without normalization or trimming.
 * @param {string} confirmation Untouched confirmation.
 * @param {string} password Untouched password.
 * @returns {string | null} Safe local copy.
 */
export function validatePasswordConfirmation(confirmation, password) {
  if (confirmation === "") return "Confirmation du mot de passe obligatoire.";
  if (confirmation !== password) return "Les deux mots de passe doivent être identiques.";
  return null;
}
