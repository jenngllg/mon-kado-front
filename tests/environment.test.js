import { describe, expect, it } from "vitest";
import {
  createPublicConfiguration,
  PublicConfigurationError,
} from "../src/config/environment.js";

describe("createPublicConfiguration", () => {
  it.each([
    ["http://localhost:7000", "http://localhost:7000"],
    ["https://api.monkado.example/v1/", "https://api.monkado.example/v1"],
  ])("accepts the supported URL %s", (apiBaseUrl, expectedApiBaseUrl) => {
    // Arrange
    const environment = { VITE_API_BASE_URL: apiBaseUrl };

    // Act
    const configuration = createPublicConfiguration(environment);

    // Assert
    expect(configuration).toEqual({ apiBaseUrl: expectedApiBaseUrl });
    expect(Object.isFrozen(configuration)).toBe(true);
  });

  it.each([undefined, null, "", "   "])(
    "rejects a missing API base URL represented by %s",
    (apiBaseUrl) => {
      // Arrange
      const environment = { VITE_API_BASE_URL: apiBaseUrl };

      // Act
      const action = () => createPublicConfiguration(environment);

      // Assert
      expect(action).toThrowError(
        new PublicConfigurationError(
          "Missing required public configuration: VITE_API_BASE_URL.",
        ),
      );
    },
  );

  it("rejects a relative API base URL", () => {
    // Arrange
    const environment = { VITE_API_BASE_URL: "/api" };

    // Act
    const action = () => createPublicConfiguration(environment);

    // Assert
    expect(action).toThrowError(
      new PublicConfigurationError(
        "VITE_API_BASE_URL must be an absolute HTTP or HTTPS URL.",
      ),
    );
  });

  it.each(["ftp://api.monkado.example", "file:///tmp/api"])(
    "rejects the unsupported protocol in %s",
    (apiBaseUrl) => {
      // Arrange
      const environment = { VITE_API_BASE_URL: apiBaseUrl };

      // Act
      const action = () => createPublicConfiguration(environment);

      // Assert
      expect(action).toThrowError(
        new PublicConfigurationError(
          "VITE_API_BASE_URL must use the HTTP or HTTPS protocol.",
        ),
      );
    },
  );
});
