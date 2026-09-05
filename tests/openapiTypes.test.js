import {
  describe,
  expect,
  it,
} from "vitest";

/**
 * @typedef {import("../src/api/generated/openapi.js").components["schemas"]["ErrorResponse"]} ErrorResponse
 */

/**
 * @typedef {import("../src/api/generated/openapi.js").components["schemas"]["ValidationError"]} ValidationError
 */

/**
 * @typedef {import("../src/api/generated/openapi.js").paths["/api/v1/auth/registrations"]["post"]} RegistrationOperation
 */

describe("generated OpenAPI contracts", () => {
  it("exposes shared error and validation schemas", () => {
    /** @type {ValidationError} */
    const validationError = {
      errorMessage: "The name is required.",
      propertyName: "wishes[2].name",
    };
    /** @type {ErrorResponse} */
    const errorResponse = {
      errorCode: "REQUEST_VALIDATION_ERROR",
      message: null,
      statusCode: 400,
      title: null,
      validationErrors: [validationError],
    };

    expect(errorResponse.validationErrors?.[0]?.propertyName)
      .toBe("wishes[2].name");
  });

  it("exposes request types through generated paths", () => {
    /** @type {RegistrationOperation["requestBody"]["content"]["application/json"]} */
    const request = {
      displayName: "Jenn",
      email: "jenn@example.com",
      password: "a-safe-test-password",
    };

    expect(request.displayName).toBe("Jenn");
  });
});
