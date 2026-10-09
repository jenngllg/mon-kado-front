/** Validates display names using Unicode scalar values, without changing the input.
 * @param {string} value Unmodified input.
 * @returns {string | null} Safe French validation message.
 */
export function validateDisplayName(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Nom d’affichage obligatoire.";
  if ([...value].some(character => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0xd800 && code <= 0xdfff;
  }) || /\p{Cc}/u.test(value)) return DisplayNameServerMessage;
  if ([...trimmed].length > 80) return "Nom d’affichage trop long : 80 caractères maximum.";
  return null;
}

export const DisplayNameServerMessage = "Nom d’affichage invalide.";
