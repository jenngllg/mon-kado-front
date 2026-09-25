import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";

const originalArguments = process.argv;
const originalExitCode = process.exitCode;
afterEach(() => {
  process.argv = originalArguments;
  process.exitCode = originalExitCode;
  vi.doUnmock("node:fs");
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("publication command entrypoint", () => {
  it.each([true, false])("exits safely when approval is %s", async legalApproved => {
    // Arrange
    vi.resetModules();
    process.argv = [process.execPath, fileURLToPath(new URL("./checkPublication.js", import.meta.url))];
    const read = vi.fn((path, encoding) => { expect(encoding).toBe("utf8"); return path === "publication.json" ? JSON.stringify({
      schemaVersion: 1, apiOrigin: "https://api.monkado.fr", googleEnabled: true, legalApproved, legalVersion: "2026-09-25",
    }) : '<html lang="fr"><h1>Approved fixture</h1><a href="mailto:monkado.app@gmail.com">Contact</a><p>2026-09-25</p></html>'; });
    vi.doMock("node:fs", () => ({ readFileSync: read }));
    const print = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    // Act
    await import("./checkPublication.js");
    // Assert
    expect(process.exitCode).toBe(legalApproved ? 0 : 1);
    expect(print).toHaveBeenCalledExactlyOnceWith(legalApproved ? "googleEnabled=true\n" : "PUBLICATION_REVIEW_REQUIRED\n");
    expect(read.mock.calls.every(([, encoding]) => encoding === "utf8")).toBe(true);
  });

  it("has no side effects when imported without a command argument", async () => {
    // Arrange
    vi.resetModules(); process.argv = [process.execPath];
    const read = vi.fn(); vi.doMock("node:fs", () => ({ readFileSync: read }));
    // Act
    await import("./checkPublication.js");
    // Assert
    expect(read).not.toHaveBeenCalled(); expect(process.exitCode).toBe(originalExitCode);
  });
});
