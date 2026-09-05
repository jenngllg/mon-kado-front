// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  createFormField,
  createValidationMessage,
  setFormFieldValidation,
} from "../src/components/index.js";

describe("createFormField", () => {
  it.each([
    "input",
    "textarea",
    "select",
  ])("wraps a native %s control", (tagName) => {
    // Arrange
    const control = /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ (
      document.createElement(tagName)
    );

    // Act
    const field = createFormField({
      label: "Nom",
      control,
      required: true,
    });
    const label = field.querySelector("label");

    // Assert
    expect(field).toBeInstanceOf(HTMLDivElement);
    expect(control.id).not.toBe("");
    expect(label?.htmlFor).toBe(control.id);
    expect(label?.textContent).toContain("Nom");
    expect(label?.textContent).toContain("obligatoire");
    expect(control.required).toBe(true);
  });

  it("links help and validation while preserving existing descriptions", () => {
    // Arrange
    const control = document.createElement("input");
    control.id = "wishlist-name";
    control.setAttribute("aria-describedby", "external-help");

    // Act
    const field = createFormField({
      label: "Nom de la liste",
      control,
      description: "Choisis un nom facile à reconnaître.",
      validationMessage: "Le nom est obligatoire.",
    });
    const validation = /** @type {HTMLParagraphElement | null} */ (
      field.querySelector(".validation-message")
    );

    // Assert
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(control.getAttribute("aria-describedby")).toBe(
      "external-help wishlist-name-description wishlist-name-validation",
    );
    expect(validation?.textContent).toBe("Le nom est obligatoire.");
    expect(validation?.hidden).toBe(false);

    // Act
    setFormFieldValidation(field, null);

    // Assert
    expect(control.hasAttribute("aria-invalid")).toBe(false);
    expect(control.getAttribute("aria-describedby")).toBe(
      "external-help wishlist-name-description",
    );
    expect(validation?.hidden).toBe(true);
  });

  it("applies the disabled state to the native control", () => {
    // Arrange
    const control = document.createElement("select");

    // Act
    const field = createFormField({
      label: "Occasion",
      control,
      disabled: true,
    });

    // Assert
    expect(control.disabled).toBe(true);
    expect(field.classList.contains("form-field--disabled")).toBe(true);
  });
});

describe("createValidationMessage", () => {
  it("keeps markup-looking content as text", () => {
    // Arrange
    const message = "<img src=x onerror=alert(1)>";

    // Act
    const validation = createValidationMessage({
      id: "field-error",
      message,
    });

    // Assert
    expect(validation.id).toBe("field-error");
    expect(validation.getAttribute("aria-live")).toBe("polite");
    expect(validation.textContent).toBe(message);
    expect(validation.querySelector("img")).toBeNull();
  });
});
