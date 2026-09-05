import { describe, expect, it, vi } from "vitest";
import { CsrfTokenManager } from "../src/api/csrfTokenManager.js";

describe("CsrfTokenManager", () => {
  it("caches a loaded token", async () => {
    // Arrange
    const loadToken = vi.fn().mockResolvedValue("csrf-token");
    const manager = new CsrfTokenManager(loadToken);

    // Act
    const firstToken = await manager.getToken();
    const secondToken = await manager.getToken();

    // Assert
    expect(firstToken).toBe("csrf-token");
    expect(secondToken).toBe("csrf-token");
    expect(loadToken).toHaveBeenCalledOnce();
  });

  it("does not store a load invalidated while it is pending", async () => {
    // Arrange
    /** @type {((token: string) => void) | undefined} */
    let resolveFirstLoad;
    const firstLoad = new Promise((resolve) => {
      resolveFirstLoad = resolve;
    });
    const loadToken = vi.fn()
      .mockReturnValueOnce(firstLoad)
      .mockResolvedValueOnce("fresh-token");
    const manager = new CsrfTokenManager(loadToken);

    // Act
    const staleRequest = manager.getToken();
    manager.invalidateToken();
    if (resolveFirstLoad === undefined) {
      throw new Error("The deferred token is not initialized.");
    }

    resolveFirstLoad("stale-token");
    await staleRequest;
    const currentToken = await manager.getToken();

    // Assert
    expect(currentToken).toBe("fresh-token");
    expect(loadToken).toHaveBeenCalledTimes(2);
  });

  it.each(["", "   ", null, undefined])(
    "rejects the invalid loaded token %s",
    async (token) => {
      // Arrange
      const invalidLoader = async () => token;
      const manager = new CsrfTokenManager(
        /** @type {() => Promise<string>} */ (
          /** @type {unknown} */ (invalidLoader)
        ),
      );

      // Act
      const request = manager.getToken();

      // Assert
      await expect(request).rejects.toBeInstanceOf(TypeError);
    },
  );
});
