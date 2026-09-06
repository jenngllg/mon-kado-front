export const EmailServerValidationMessage = "Vérifie le format de ton adresse e-mail (254 caractères maximum).";

/** Performs the shared, deliberately permissive client-side email checks.
 * @param {string} value Raw input.
 * @returns {string | null} French validation copy.
 */
export function validateEmailAddress(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Indique ton adresse e-mail.";
  if ([...trimmed].length > 254) return "L’adresse e-mail doit contenir au maximum 254 caractères.";
  const separator = trimmed.lastIndexOf("@");
  const local = trimmed.slice(0, separator);
  const domain = trimmed.slice(separator + 1);
  // Leave uncommon mailbox formats to the server's authoritative parser.
  const quoted = local.startsWith('"') && local.endsWith('"');
  if (separator <= 0 || !domain || /[\s@<>]/u.test(domain) || /[<>\p{Cc}]/u.test(local) ||
    (!quoted && /[\s@]/u.test(local))) return "Vérifie le format de ton adresse e-mail.";
  return null;
}
