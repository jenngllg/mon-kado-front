import { describe, expect, it } from "vitest";
import { validateRegistrationConfirmation, validateRegistrationField } from "../src/features/registration/registrationValidation.js";

describe("registration validation", () => {
  it.each([" 1234567890 ", "🔑".repeat(12), "🔑".repeat(128), "e\u0301".repeat(12)])("accepts an identical confirmation without changing Unicode or spaces", password => {
    // Arrange / Act / Assert
    expect(validateRegistrationConfirmation(password, password)).toBeNull();
  });
  it("requires the confirmation explicitly", () => {
    // Arrange / Act / Assert
    expect(validateRegistrationConfirmation("", "password fixture")).toBe("Confirme ton mot de passe.");
  });
  it.each([
    ["password fixture", " password fixture "],
    ["é".repeat(12), "e\u0301".repeat(12)],
    ["🔑".repeat(12), "🔑".repeat(13)],
    ["Password fixture", "password fixture"],
    [" ", "password fixture"],
  ])("rejects unequal raw values, including canonically equivalent Unicode", (confirmation, password) => {
    // Arrange / Act / Assert
    expect(validateRegistrationConfirmation(confirmation, password)).toBe("Les deux mots de passe doivent être identiques.");
  });
  it.each(["Léa", "  Léa  ", "🎁".repeat(80), "e\u0301", "<b>Léa</b>"])("accepts the display name %s", value => {
    // Arrange / Act / Assert
    expect(validateRegistrationField("displayName", value)).toBeNull();
  });
  it.each(["", "   ", "🎁".repeat(81), "Léa\n", "\tLéa", "Léa\u007f", "Léa\ud800", "\udfff"])("rejects invalid display names (%s)", value => {
    // Arrange / Act / Assert
    expect(validateRegistrationField("displayName", value)).not.toBeNull();
  });
  it.each(["lea@example.fr", "  lea@example.fr  ", "é@exemple.fr", '"lea famille"@example.fr', "lea@localhost", `${"a".repeat(242)}@example.fr`, `${"🎁".repeat(243)}@example.fr`])("accepts an email candidate without replicating the server parser (%s)", value => {
    // Arrange / Act / Assert
    expect(validateRegistrationField("email", value)).toBeNull();
  });
  it.each(["", "  ", "not-an-email", "@example.fr", "lea@", "lea@@example.fr", "lea@example.fr extra", "Léa <lea@example.fr>", `${"🎁".repeat(244)}@example.fr`])("rejects an obvious email error (%s)", value => {
    // Arrange / Act / Assert
    expect(validateRegistrationField("email", value)).not.toBeNull();
  });
  it.each(["a".repeat(12), "🎁".repeat(12), "🎁".repeat(128), " 1234567890 ", "une longue phrase de passe", "a".repeat(128)])("accepts password length without composition rules (%s)", value => {
    // Arrange / Act / Assert
    expect(validateRegistrationField("password", value)).toBeNull();
  });
  it.each(["", " ".repeat(12), "🎁".repeat(11), "a".repeat(11), "🎁".repeat(129)])("rejects an empty or out-of-range password (%s)", value => {
    // Arrange / Act / Assert
    expect(validateRegistrationField("password", value)).not.toBeNull();
  });
});
