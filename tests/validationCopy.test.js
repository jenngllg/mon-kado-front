import { describe, expect, it } from "vitest";
import { validateEmailAddress, EmailServerValidationMessage } from "../src/auth/emailValidation.js";
import { validateDisplayName, DisplayNameServerMessage } from "../src/auth/displayNameValidation.js";
import { validateCurrentPassword, validatePasswordConfirmation } from "../src/auth/passwordValidation.js";
import { validateNewPassword, NewPasswordServerMessage } from "../src/auth/newPasswordValidation.js";
import { validateWishlistField, WishlistServerMessages } from "../src/features/wishlists/wishlistValidation.js";
import { validateWishField, WishServerMessages, WishPayloadTooLarge } from "../src/features/wishes/wishValidation.js";
import { validateMemberSearch } from "../src/features/members/memberSearchValidation.js";
import { validateReservationQuantity, ReservationQuantityMessage } from "../src/features/sharing/reservationValidation.js";

describe("non-imperative field-validation copy", () => {
  it.each([
    [() => validateEmailAddress("invalid"), EmailServerValidationMessage],
    [() => validateDisplayName("name\u0000"), DisplayNameServerMessage],
    [() => validateWishlistField("name", "name\nline"), WishlistServerMessages.name],
    [() => validateWishlistField("message", "message\u0000"), WishlistServerMessages.message],
    [() => validateWishField("name", "name\nline"), WishServerMessages.name],
    [() => validateWishField("note", "note\u0000"), WishServerMessages.note],
  ])("reuses the server field copy for the same invalid input (%#)", (validate, expected) => {
    // Arrange / Act
    const message = /** @type {() => string | null} */ (validate)();
    // Assert
    expect(message).toBe(expected);
  });
  it.each([
    [() => validateEmailAddress("a".repeat(255)), "Adresse e-mail trop longue : 254 caractères maximum."],
    [() => validateDisplayName("🎁".repeat(81)), "Nom d’affichage trop long : 80 caractères maximum."],
    [() => validateWishlistField("name", "a".repeat(101)), "Nom de la liste trop long : 100 caractères maximum."],
    [() => validateWishlistField("message", "a".repeat(501)), "Message trop long : 500 caractères maximum."],
    [() => validateWishField("name", "a".repeat(101)), "Nom du souhait trop long : 100 caractères maximum."],
    [() => validateWishField("note", "a".repeat(501)), "Note trop longue : 500 caractères maximum."],
    [() => validateCurrentPassword("a".repeat(129)), "Mot de passe trop long : 128 caractères maximum."],
    [() => validateNewPassword("short"), "Mot de passe invalide : de 12 à 128 caractères."],
  ])("retains a precise message for a known limit violation (%#)", (validate, expected) => {
    // Arrange / Act
    const message = /** @type {() => string | null} */ (validate)();
    // Assert
    expect(message).toBe(expected);
  });
  it.each([
    [() => validateEmailAddress(""), "Adresse e-mail invalide."],
    [() => validateEmailAddress("invalid"), "Adresse e-mail invalide."],
    [() => validateDisplayName(""), "Nom d’affichage obligatoire."],
    [() => validateCurrentPassword(""), "Mot de passe obligatoire."],
    [() => validateNewPassword(""), "Mot de passe obligatoire."],
    [() => validatePasswordConfirmation("", "secret"), "Confirmation du mot de passe obligatoire."],
    [() => validateWishlistField("name", ""), "Nom de la liste obligatoire."],
    [() => validateWishField("name", ""), "Nom du souhait obligatoire."],
    [() => validateMemberSearch(""), "Nom du membre obligatoire."],
    [() => validateReservationQuantity("0", 2), ReservationQuantityMessage],
  ])("describes the input problem without an instruction (%#)", (validate, expected) => {
    // Arrange / Act
    const message = /** @type {() => string | null} */ (validate)();
    // Assert
    expect(message).toBe(expected);
  });
  it.each([
    EmailServerValidationMessage, DisplayNameServerMessage, NewPasswordServerMessage,
    ...Object.values(WishlistServerMessages), ...Object.values(WishServerMessages),
    ReservationQuantityMessage, WishPayloadTooLarge,
  ])("keeps server field translations descriptive: %s", message => {
    // Assert
    expect(message).not.toMatch(/\b(?:Indique|Renseigne|Confirme|Vérifie|Donne|Choisis|Saisis|Raccourcis)\b/u);
  });
});
