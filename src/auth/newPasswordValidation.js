/** Validates a new password without changing its Unicode characters or spaces.
 * @param {string} value Original password.
 * @returns {string | null} Safe French validation message.
 */
export function validateNewPassword(value) {
  if (!value.trim()) return "Indique un mot de passe.";
  const length = [...value].length;
  if (length < 12 || length > 128) return "Le mot de passe doit contenir de 12 à 128 caractères.";
  return null;
}

export const NewPasswordServerMessage = "Vérifie ton mot de passe : de 12 à 128 caractères.";
