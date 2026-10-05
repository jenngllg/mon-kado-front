import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createFormField } from "../../components/index.js";

/** Computes the source square shared by the circular preview and exported avatar.
 * @param {number} width Source width. @param {number} height Source height.
 * @param {number} zoom Magnification. @param {number} x Horizontal position, 0–100. @param {number} y Vertical position, 0–100.
 */
export function getProfileCrop(width, height, zoom, x, y) {
  const size = Math.min(width, height) / zoom;
  return { size, left: (width - size) * x / 100, top: (height - size) * y / 100 };
}

/** Creates a local-only crop editor; no upload occurs until the parent saves.
 * @param {{url: string, onReady: () => void, onError: () => void}} options Local preview callbacks.
 */
export function createProfilePhotoCrop({ url, onReady, onError }) {
  const element = document.createElement("div"); element.className = "profile-photo-crop flow";
  const viewport = document.createElement("div"); viewport.className = "profile-photo-crop__viewport";
  const image = document.createElement("img"); image.alt = "Aperçu du recadrage de ta photo de profil"; image.draggable = false;
  viewport.append(image);
  const controls = document.createElement("fieldset"); controls.className = "profile-photo-crop__controls flow";
  const legend = document.createElement("legend"); legend.textContent = "Recadrer la photo"; controls.append(legend);
  const zoom = slider("Zoom", 1, 3, 0.01, 1);
  const horizontal = slider("Position horizontale", 0, 100, 1, 50);
  const vertical = slider("Position verticale", 0, 100, 1, 50);
  let ready = false, disposed = false, disabled = false;
  /** @type {{id: number, x: number, y: number, horizontal: number, vertical: number} | null} */
  let drag = null;
  element.append(viewport, controls);
  addComponentEventListener(element, image, "load", () => {
    if (!image.naturalWidth || !image.naturalHeight || disposed) return;
    ready = true; render(); onReady();
  });
  addComponentEventListener(element, image, "error", () => { if (!disposed) onError(); });
  addComponentEventListener(element, viewport, "pointerdown", raw => {
    const event = /** @type {PointerEvent} */ (raw);
    if (disabled || !ready || !event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: Number(horizontal.value), vertical: Number(vertical.value) };
    viewport.setPointerCapture(event.pointerId);
  });
  addComponentEventListener(element, viewport, "pointermove", raw => {
    const event = /** @type {PointerEvent} */ (raw);
    if (!drag || disabled || event.pointerId !== drag.id) return;
    const { size } = crop();
    const scale = viewport.getBoundingClientRect().width / size;
    const move = (/** @type {number} */ start, /** @type {number} */ distance, /** @type {number} */ available) => String(available > 0 ? Math.max(0, Math.min(100, start - distance / scale / available * 100)) : 50);
    horizontal.value = move(drag.horizontal, event.clientX - drag.x, image.naturalWidth - size);
    vertical.value = move(drag.vertical, event.clientY - drag.y, image.naturalHeight - size);
    render();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) addComponentEventListener(element, viewport, type, () => { drag = null; });
  registerComponentCleanup(element, () => { disposed = true; drag = null; image.removeAttribute("src"); });
  image.src = url;
  return {
    element,
    /** @param {boolean} value Parent mutation lock. */
    setDisabled(value) { disabled = value; controls.disabled = value; if (value) drag = null; },
    async exportImage() {
      if (!ready || disposed) throw new Error("Photo not ready");
      const { size, left, top } = crop();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = Math.min(512, Math.max(1, Math.round(size)));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(image, left, top, size, size, 0, 0, canvas.width, canvas.height);
      return new Promise(/** @param {(blob: Blob) => void} resolve */ (resolve, reject) => {
        canvas.toBlob(blob => {
          if (disposed) reject(new DOMException("Cancelled", "AbortError"));
          else if (blob) resolve(blob);
          else reject(new Error("Image export failed"));
        }, "image/png");
      });
    },
  };
  /** @param {string} label Accessible name. @param {number} min Minimum. @param {number} max Maximum. @param {number} step Increment. @param {number} value Initial value. */
  function slider(label, min, max, step, value) {
    const input = document.createElement("input"); input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
    controls.append(createFormField({ label, control: input }));
    addComponentEventListener(element, input, "input", render);
    return input;
  }
  function crop() { return getProfileCrop(image.naturalWidth, image.naturalHeight, Number(zoom.value), Number(horizontal.value), Number(vertical.value)); }
  function render() {
    if (!ready) return;
    const { size, left, top } = crop();
    image.style.width = `${image.naturalWidth / size * 100}%`;
    image.style.height = `${image.naturalHeight / size * 100}%`;
    image.style.left = `${-left / size * 100}%`;
    image.style.top = `${-top / size * 100}%`;
  }
}
