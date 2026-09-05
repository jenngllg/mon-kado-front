import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { toUserFacingError } from "../src/errors/errorMessages.js";

describe("toUserFacingError", () => {
  it("maps a common error code without exposing backend copy", () => {
    // Arrange
    const error = new ApiError({
      kind: "http",
      statusCode: 400,
      errorCode: "REQUEST_VALIDATION_ERROR",
      validationErrors: [
        {
          propertyName: "address.postalCode",
          errorMessage: "Backend validation message",
        },
      ],
    });

    // Act
    const userError = toUserFacingError(error);

    // Assert
    expect(userError.title).toBe("Informations à vérifier");
    expect(userError.message).toBe("Certains champs contiennent une erreur.");
    expect(userError.message).not.toContain("Backend");
    expect(userError.validationErrors[0].propertyName).toBe(
      "address.postalCode",
    );
  });

  it("prefers a feature-specific error mapping", () => {
    // Arrange
    const error = new ApiError({
      kind: "http",
      statusCode: 409,
      errorCode: "WISHLIST_NAME_ALREADY_EXISTS",
    });

    // Act
    const userError = toUserFacingError(error, {
      WISHLIST_NAME_ALREADY_EXISTS: {
        title: "Nom déjà utilisé",
        message: "Choisis un autre nom pour ta liste.",
      },
    });

    // Assert
    expect(userError).toMatchObject({
      title: "Nom déjà utilisé",
      message: "Choisis un autre nom pour ta liste.",
    });
  });

  it.each([
    ["network", "Connexion impossible"],
    ["timeout", "Le service met trop de temps à répondre"],
    ["invalidResponse", "Réponse inattendue"],
  ])("maps the %s error kind", (kind, expectedTitle) => {
    // Arrange
    const error = new ApiError({
      kind: /** @type {"network" | "timeout" | "invalidResponse"} */ (kind),
      correlationId: "technical-reference",
    });

    // Act
    const userError = toUserFacingError(error);

    // Assert
    expect(userError.title).toBe(expectedTitle);
    expect(userError.correlationId).toBe("technical-reference");
  });

  it("shows a technical correlation reference only for server errors", () => {
    // Arrange
    const clientError = new ApiError({
      kind: "http",
      statusCode: 404,
      correlationId: "client-reference",
    });
    const serverError = new ApiError({
      kind: "http",
      statusCode: 503,
      correlationId: "server-reference",
    });

    // Act
    const clientUserError = toUserFacingError(clientError);
    const serverUserError = toUserFacingError(serverError);

    // Assert
    expect(clientUserError.correlationId).toBeNull();
    expect(serverUserError.correlationId).toBe("server-reference");
  });

  it("uses safe generic copy for an unexpected error", () => {
    // Arrange
    const error = new Error("Sensitive implementation detail");

    // Act
    const userError = toUserFacingError(error);

    // Assert
    expect(userError.message).toBe("Réessaie dans quelques instants.");
    expect(userError.message).not.toContain("Sensitive");
  });
});
