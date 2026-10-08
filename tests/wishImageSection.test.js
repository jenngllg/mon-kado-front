// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishImageSection } from "../src/features/wishes/wishImageSection.js";
import { disposeComponent } from "../src/components/index.js";
import { barrier } from "./sessionTestHelpers.js";

afterEach(() => { for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view); document.body.replaceChildren(); vi.restoreAllMocks(); });

/** @param {Partial<Parameters<typeof createWishImageSection>[0]>} [options] Test dependencies. */
function setup(options = {}) {
  const onUpload = vi.fn(), onRemove = vi.fn();
  const section = createWishImageSection({ onUpload, onRemove, decode: async () => { throw new Error("Unreadable image"); }, ...options });
  document.body.append(section.element);
  const wish = { id: "wish", wishlistId: "list", name: "Produit", quantity: 1, price: null, note: null, url: null, imageUrl: "https://example.test/image.png", position: "1", entityTag: '"wish"', productUnavailable: false, imageUnavailable: false };
  section.update(wish, false, false);
  const file = /** @type {HTMLInputElement} */ (section.element.querySelector('input[type="file"]'));
  const edit = /** @type {HTMLButtonElement} */ (section.element.querySelector(".wish-image-section__edit"));
  const remove = /** @type {HTMLButtonElement} */ (section.element.querySelector(".wish-image-section__remove"));
  return { section, wish, file, edit, remove, onUpload, onRemove };
}

describe("wish image selection", () => {
  it("uses shared add, edit and trash icons with distinct local-removal labels", () => {
    // Arrange
    const ui = setup();
    const path = (/** @type {HTMLElement} */ button) => button.querySelector("path")?.getAttribute("d");
    const editPath = path(ui.edit);
    const trashPath = path(ui.remove);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:selection");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    // Act
    ui.section.update({ ...ui.wish, imageUrl: null }, false, false);
    // Assert
    expect(path(ui.edit)).toBe("M12 5v14M5 12h14");
    expect(ui.edit.title).toBe("Ajouter une image");
    expect(ui.remove.classList.contains("icon-action--danger")).toBe(true);
    expect(ui.remove.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    ui.section.setSelected(new Blob(["local"]));
    expect(path(ui.edit)).toBe(editPath);
    expect(ui.edit.title).toBe("Remplacer l’image");
    expect(ui.remove.getAttribute("aria-label")).toBe("Retirer la sélection");
    expect(path(ui.remove)).toBe(trashPath);
    ui.remove.click();
    expect(ui.onRemove).not.toHaveBeenCalled();
    expect(ui.remove.title).toBe("Supprimer l’image");
  });
  it("keeps the saved photo and local selection across editor state updates", () => {
    // Arrange
    const ui = setup();
    const saved = ui.section.element.querySelector("img");
    const blob = new Blob(["validated image"], { type: "image/png" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-draft");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    ui.section.setSelected(blob);
    const preview = ui.section.element.querySelector('img[src="blob:local-draft"]');
    // Act
    ui.section.update(ui.wish, true, false);
    ui.section.update(ui.wish, false, false);
    // Assert
    expect(ui.section.element.querySelector('img[src="https://example.test/image.png"]')).toBe(saved);
    expect(ui.section.element.querySelector('img[src="blob:local-draft"]')).toBe(preview);
    expect(ui.section.getSelected()).toBe(blob);
    expect(ui.onUpload).toHaveBeenCalledExactlyOnceWith(blob);
    expect(ui.onRemove).not.toHaveBeenCalled();
  });
  it("accepts a decoded local selection without a server mutation and clears an empty selection", async () => {
    const decode = vi.fn(async () => {}), ui = setup({ decode });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    ui.section.update({ ...ui.wish, imageUrl: null }, false, false);
    expect(ui.edit.getAttribute("aria-label")).toBe("Ajouter une image"); expect(ui.remove.hidden).toBe(true);
    const transfer = new DataTransfer(); const image = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "image.png", { type: "image/png" }); transfer.items.add(image);
    ui.file.files = transfer.files; ui.file.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(ui.onUpload).toHaveBeenCalledExactlyOnceWith(image));
    expect(decode).toHaveBeenCalledOnce(); expect(ui.section.getSelected()).toBe(image); expect(ui.remove.hidden).toBe(false);
    ui.file.files = new DataTransfer().files; ui.file.dispatchEvent(new Event("change"));
    expect(ui.section.getSelected()).toBeNull(); expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:local");
    ui.section.update(null, false, false); expect(ui.section.element.hidden).toBe(true);
    ui.section.update(ui.wish, false, true); expect(ui.edit.hidden).toBe(true); expect(ui.remove.hidden).toBe(true);
  });
  it.each(["clear", "dispose", "disable", "abort"])("does not upload a decoding selection after %s", async action => {
    const gate = barrier(); const decode = vi.fn(async () => { await gate.promise; if (action === "abort") throw new DOMException("Aborted", "AbortError"); });
    const ui = setup({ decode }); vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pending");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "image.png", { type: "image/png" }));
    ui.file.files = transfer.files; ui.file.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
    expect(ui.edit.disabled).toBe(true); expect(ui.remove.disabled).toBe(true);
    if (action === "clear") ui.section.clearSelection();
    if (action === "dispose") disposeComponent(ui.section.element);
    if (action === "disable") ui.section.update(ui.wish, true, false);
    gate.resolve();
    await vi.waitFor(() => expect(ui.section.element.querySelector('[aria-busy="true"]')).toBeNull());
    expect(ui.onUpload).not.toHaveBeenCalled(); expect(ui.onRemove).not.toHaveBeenCalled();
    if (action === "clear" || action === "dispose") { expect(ui.section.getSelected()).toBeNull(); expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:pending"); }
  });
  it("previews an imported image locally and restores the saved image when discarded", () => {
    const ui = setup(); const blob = new Blob(["validated image"], { type: "image/png" });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:imported");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    ui.section.setSelected(blob);
    expect(ui.section.element.querySelector('img[src="blob:imported"]')).not.toBeNull();
    expect(ui.onUpload).toHaveBeenCalledExactlyOnceWith(blob); expect(create).toHaveBeenCalledExactlyOnceWith(blob);
    ui.remove.click();
    expect(ui.section.getSelected()).toBeNull(); expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:imported");
    expect(ui.section.element.querySelector('img[src="https://example.test/image.png"]')?.parentElement?.hidden).toBe(false);
    expect(ui.onRemove).not.toHaveBeenCalled();
    ui.remove.click(); expect(ui.onRemove).toHaveBeenCalledOnce();
    const picker = vi.spyOn(ui.file, "click"); ui.edit.click(); expect(picker).toHaveBeenCalledOnce();
    ui.section.update(ui.wish, true, false); ui.section.setSelected(blob); expect(ui.section.getSelected()).toBeNull();
    expect(ui.onUpload).toHaveBeenCalledOnce();
  });
  it("reports invalid or unreadable selections without retaining a preview", async () => {
    const ui = setup(); vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:unreadable");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "image.png", { type: "image/png" }));
    ui.file.files = transfer.files; ui.file.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(ui.section.element.querySelector('[role="alert"]')?.textContent).toContain("Cette image ne peut pas être lue"));
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:unreadable"); expect(ui.onUpload).not.toHaveBeenCalled();
    const invalid = new DataTransfer(); invalid.items.add(new File(["not an image"], "image.txt", { type: "text/plain" }));
    ui.file.files = invalid.files; ui.file.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(ui.section.element.querySelector('[role="alert"]')).not.toBeNull());
    expect(ui.section.getSelected()).toBeNull(); expect(ui.section.element.querySelector('img[src^="blob:"]')).toBeNull();
  });
});
