import { describe, expect, it, vi } from "vitest";
import { withResourcePageTitle } from "../src/app/resourcePageTitle.js";

describe("withResourcePageTitle", () => {
  it.each(["Anniversaire de Léa", "Vélo <bleu> & accessoires"])("uses the resource name %s and preserves the read contract", async name => {
    // Arrange
    const controller = new AbortController();
    const result = { name };
    const load = vi.fn().mockResolvedValue(result);
    const setTitle = vi.fn();
    const context = { signal: controller.signal, setTitle };
    const read = withResourcePageTitle(load, context, value => value.name);
    const options = { signal: controller.signal };
    // Act
    const actual = await read("id", options);
    // Assert
    expect(actual).toBe(result);
    expect(load).toHaveBeenCalledExactlyOnceWith("id", options);
    expect(setTitle).toHaveBeenCalledExactlyOnceWith(`${name} · MonKado`);
  });

  it("ignores reads completed after leaving the page", async () => {
    // Arrange
    const controller = new AbortController();
    const setTitle = vi.fn();
    const context = { signal: controller.signal, setTitle };
    const read = withResourcePageTitle(async () => ({ name: "Old list" }), context, value => value.name);
    // Act
    const pending = read();
    controller.abort();
    await pending;
    // Assert
    expect(setTitle).not.toHaveBeenCalled();
  });
});
