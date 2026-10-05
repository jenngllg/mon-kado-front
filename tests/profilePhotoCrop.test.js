// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProfilePhotoCrop, getProfileCrop } from "../src/features/profile/profilePhotoCrop.js";
import { disposeComponent } from "../src/components/index.js";

afterEach(() => { for (const element of document.body.children) if (element instanceof HTMLElement) disposeComponent(element); document.body.replaceChildren(); vi.restoreAllMocks(); });

function setup() {
  const onReady = vi.fn(), onError = vi.fn();
  const editor = createProfilePhotoCrop({ url: "blob:local-photo", onReady, onError });
  document.body.append(editor.element);
  const image = /** @type {HTMLImageElement} */ (editor.element.querySelector("img"));
  Object.defineProperties(image, { naturalWidth: { value: 1200 }, naturalHeight: { value: 800 } });
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(/** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({ drawImage })));
  const blob = new Blob(["cropped"], { type: "image/png" });
  const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(blob));
  return { editor, image, drawImage, blob, encode, onReady, onError };
}

describe("profile photo crop", () => {
  it.each([
    [1200, 800, 1, 50, 50, { size: 800, left: 200, top: 0 }],
    [800, 1200, 1, 50, 100, { size: 800, left: 0, top: 400 }],
    [800, 800, 2, 100, 0, { size: 400, left: 400, top: 0 }],
  ])("computes a bounded square for %s × %s", (width, height, zoom, x, y, expected) => {
    expect(getProfileCrop(width, height, zoom, x, y)).toEqual(expected);
  });
  it("exports precisely the preview framing rather than the original file", async () => {
    const ui = setup(); ui.image.dispatchEvent(new Event("load"));
    const sliders = ui.editor.element.querySelectorAll("input");
    sliders[0].value = "2"; sliders[1].value = "100"; sliders[2].value = "0";
    sliders[0].dispatchEvent(new Event("input"));
    expect(ui.image.style.width).toBe("300%"); expect(ui.image.style.left).toBe("-200%");
    expect(await ui.editor.exportImage()).toBe(ui.blob);
    expect(ui.drawImage).toHaveBeenCalledExactlyOnceWith(ui.image, 800, 0, 400, 400, 0, 0, 400, 400);
    expect(ui.encode.mock.calls[0][1]).toBe("image/png");
    expect(ui.onReady).toHaveBeenCalledOnce();
  });
  it("locks controls and releases local image on cancellation", async () => {
    const ui = setup(); ui.editor.setDisabled(true);
    expect(ui.editor.element.querySelector("fieldset")?.disabled).toBe(true);
    disposeComponent(ui.editor.element); ui.image.dispatchEvent(new Event("load"));
    expect(ui.image.hasAttribute("src")).toBe(false); expect(ui.onReady).not.toHaveBeenCalled();
    await expect(ui.editor.exportImage()).rejects.toThrow("Photo not ready");
  });
  it("rejects an export completing after cancellation", async () => {
    const ui = setup(); ui.image.dispatchEvent(new Event("load"));
    /** @type {BlobCallback | undefined} */ let complete;
    ui.encode.mockImplementation(callback => { complete = callback; });
    const pending = ui.editor.exportImage(); disposeComponent(ui.editor.element); complete?.(ui.blob);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  it("reports unreadable sources and failed canvas exports", async () => {
    const ui = setup(); ui.image.dispatchEvent(new Event("error")); expect(ui.onError).toHaveBeenCalledOnce();
    ui.image.dispatchEvent(new Event("load")); ui.encode.mockImplementation(callback => callback(null));
    await expect(ui.editor.exportImage()).rejects.toThrow("Image export failed");
  });
  it("keeps pointer positioning bounded and ignores locked or unrelated gestures", () => {
    const ui = setup();
    const viewport = /** @type {HTMLElement} */ (ui.editor.element.querySelector(".profile-photo-crop__viewport"));
    const capture = vi.fn();
    viewport.setPointerCapture = capture;
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 240, 240));
    const sliders = ui.editor.element.querySelectorAll("input");
    const down = () => viewport.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, isPrimary: true, button: 0, clientX: 120, clientY: 120 }));
    const move = (/** @type {number} */ x, id = 1) => viewport.dispatchEvent(new PointerEvent("pointermove", { pointerId: id, clientX: x, clientY: 180 }));
    sliders[0].dispatchEvent(new Event("input")); down(); move(0);
    expect(capture).not.toHaveBeenCalled();
    ui.image.dispatchEvent(new Event("load"));
    viewport.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, isPrimary: false }));
    viewport.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, isPrimary: true, button: 2 }));
    expect(capture).not.toHaveBeenCalled();
    down(); move(-1000, 2); expect(sliders[1].value).toBe("50");
    move(-1000); expect(sliders[1].value).toBe("100"); expect(sliders[2].value).toBe("50");
    move(1000); expect(sliders[1].value).toBe("0");
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      down(); viewport.dispatchEvent(new PointerEvent(type)); move(-1000); expect(sliders[1].value).toBe("0");
    }
    ui.editor.setDisabled(true); down(); move(-1000); expect(sliders[1].value).toBe("0");
    ui.editor.setDisabled(false); sliders[0].value = "2"; sliders[0].dispatchEvent(new Event("input")); down(); move(-1000);
    expect(sliders[1].value).toBe("100"); expect(Number(sliders[2].value)).toBeLessThan(50);
    expect(ui.image.style.left).toBe("-200%");
  });
  it("rejects export when the browser cannot allocate a canvas", async () => {
    const ui = setup(); ui.image.dispatchEvent(new Event("load"));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(ui.editor.exportImage()).rejects.toThrow("Canvas unavailable");
  });
});
