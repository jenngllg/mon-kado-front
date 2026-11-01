/** Validates a new password without changing its Unicode characters or spaces.
 * @param {string} value Original password.
 * @returns {string | null} Safe French validation message.
 */
export function validateNewPassword(value) {
  if (!value.trim()) return "Mot de passe obligatoire.";
  const length = [...value].length;
  if (length < 12 || length > 128) return "Mot de passe invalide : de 12 à 128 caractères.";
  return null;
}

export const NewPasswordServerMessage = "Mot de passe invalide.";
