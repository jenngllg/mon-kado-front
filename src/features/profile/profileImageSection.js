import { isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { decodeWishImage, validateWishImageFile, WishImageValidationError } from "../wishes/wishImageValidation.js";

/** Owns only the local file and rendered sources; the profile owns versions and mutations.
 * @param {{onUpload: (file: Blob) => void, onRemove: () => void, onRefresh: () => void, decode?: typeof decodeWishImage}} options Actions.
 */
export function createProfileImageSection({ onUpload, onRemove, onRefresh, decode = decodeWishImage }) {
  const element = node("section", ""); element.className = "wish-image-section flow";
  const title = node("h2", "Photo de profil"); title.tabIndex = -1;
  const current = node("div", ""); current.className = "wish-image-section__media";
  const input = node("input", ""); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
  const field = createFormField({ control: input, label: "Choisir une photo", description: "JPEG, PNG ou WebP non animé. 10 Mio et 40 millions de pixels maximum. La photo s’enregistre séparément du nom." });
  const status = node("p", ""); status.setAttribute("role", "status");
  const preview = node("div", ""); preview.className = "wish-image-section__preview flow"; preview.hidden = true;
  let disposed = false, inactive = true, decoding = false, revision = 0;
  /** @type {Blob | null} */ let selected = null;
  /** @type {string | null} */ let objectUrl = null;
  /** @type {AbortController | null} */ let decoder = null;
  /** @type {import("./profileImageService.js").ProfilePhoto | null} */ let photo = null;
  const upload = createButton({ label: "Enregistrer la photo", onClick: () => { if (!upload.disabled && selected) onUpload(selected); } });
  const cancel = createButton({ label: "Annuler la sélection", variant: "secondary", onClick: () => { if (!cancel.disabled) { clearSelection(); input.focus(); } } });
  const remove = createButton({ label: "Supprimer la photo", variant: "danger", onClick: () => { if (!remove.disabled) onRemove(); } });
  const refresh = createButton({ label: "Actualiser le profil", variant: "secondary", onClick: () => { if (!refresh.disabled) onRefresh(); } });
  const actions = node("div", ""); actions.className = "cluster"; actions.append(upload, cancel, remove, refresh);
  element.append(title, node("p", "Ta photo de profil est publique. Choisis une image que tu acceptes de montrer aux autres."), current, field, status, preview, actions);
  addComponentEventListener(element, input, "change", () => { void select(); });
  registerComponentCleanup(element, () => { disposed = true; clearSelection(); photo = null; disposeComponent(current); current.replaceChildren(); });
  sync();
  return { element, title, clearSelection, update, focusRemove: () => { (remove.hidden ? title : remove).focus(); } };

  /** @param {boolean} [reset] Clear the native control except when beginning its newest selection. */
  function clearSelection(reset = true) {
    revision++; decoder?.abort(); decoder = null; decoding = false; selected = null;
    const image = preview.querySelector("img"); image?.removeAttribute("src"); preview.replaceChildren(); preview.hidden = true;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null; if (reset) input.value = ""; setFormFieldValidation(field, null); status.textContent = ""; sync();
  }
  /** @param {import("./profileImageService.js").ProfilePhoto | null} value Safe source. @param {boolean} disabled Parent lock. @param {boolean} blocked Explicit recovery required. */
  function update(value, disabled, blocked) {
    inactive = disabled || blocked || disposed;
    if (value !== photo) {
      photo = value; disposeComponent(current); current.replaceChildren();
      if (value && !disposed) {
        const fallback = node("p", value.imageUnavailable ? "Photo indisponible" : "Sans photo"); current.append(fallback);
        if (value.imageUrl) {
          const image = node("img", ""); image.alt = "Ta photo de profil"; image.width = 256; image.height = 256; image.referrerPolicy = "no-referrer";
          image.style.maxWidth = "100%"; image.style.height = "auto"; fallback.hidden = true;
          addComponentEventListener(current, image, "error", () => { image.removeAttribute("src"); image.remove(); fallback.textContent = "Photo indisponible"; fallback.hidden = false; }, { once: true });
          registerComponentCleanup(current, () => image.removeAttribute("src")); image.src = value.imageUrl; current.append(image);
        }
      }
    }
    element.hidden = !photo || disposed; sync(); refresh.disabled = disabled || disposed || !photo;
  }
  function sync() {
    const hasPhoto = !!photo && (!!photo.imageUrl || photo.imageUnavailable);
    input.disabled = inactive || disposed; upload.disabled = inactive || decoding || !selected || disposed;
    upload.textContent = hasPhoto ? "Remplacer la photo" : "Enregistrer la photo";
    cancel.hidden = !selected && !decoding && !objectUrl; cancel.disabled = inactive || disposed;
    remove.hidden = !hasPhoto; remove.disabled = inactive || decoding || disposed;
    preview.setAttribute("aria-busy", String(decoding));
  }
  async function select() {
    if (inactive || disposed) return;
    const file = input.files?.length === 1 ? input.files[0] : null;
    clearSelection(false); if (!file) return;
    const expected = revision; decoding = true; decoder = new AbortController(); const signal = decoder.signal;
    status.textContent = "Vérification de la photo…"; sync();
    try {
      await validateWishImageFile(file);
      if (disposed || expected !== revision) return;
      objectUrl = URL.createObjectURL(file); const url = objectUrl;
      await decode(url, signal);
      if (disposed || expected !== revision || signal.aborted) return;
      selected = file;
      const image = node("img", ""); image.alt = "Aperçu de la photo sélectionnée"; image.src = url; image.width = 256; image.height = 256;
      image.style.maxWidth = "100%"; image.style.height = "auto";
      preview.append(node("p", "Photo sélectionnée — non enregistrée"), image); preview.hidden = false; status.textContent = "Photo prête à être enregistrée";
    } catch (error) {
      if (disposed || expected !== revision || isAbortError(error)) return;
      clearSelection(); setFormFieldValidation(field, error instanceof WishImageValidationError ? error.message : "Cette photo ne peut pas être lue."); input.focus();
    } finally { if (!disposed && expected === revision) { decoding = false; sync(); } }
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Native tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Element. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
