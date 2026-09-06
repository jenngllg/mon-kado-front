/** Validates display names using Unicode scalar values, without changing the input.
 * @param {string} value Unmodified input.
 * @returns {string | null} Safe French validation message.
 */
export function validateDisplayName(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Indique ton nom d’affichage.";
  if ([...value].some(character => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0xd800 && code <= 0xdfff;
  }) || /\p{Cc}/u.test(value)) return "Le nom ne doit pas contenir de caractères de contrôle ou invalides.";
  if ([...trimmed].length > 80) return "Le nom doit contenir au maximum 80 caractères.";
  return null;
}

export const DisplayNameServerMessage = "Vérifie ton nom : 80 caractères maximum, sans caractères de contrôle ou invalides.";
