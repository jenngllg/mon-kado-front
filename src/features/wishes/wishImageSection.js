import { isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { createWishImage } from "./wishImage.js";
import { decodeWishImage, validateWishImageFile, WishImageValidationError } from "./wishImageValidation.js";

/** Local selection UI; the parent owns mutations and their reference versions.
 * @param {{onUpload: (file: Blob) => void, onRemove: () => void, onRefresh: () => void, decode?: typeof decodeWishImage}} options Owner callbacks.
 */
export function createWishImageSection({ onUpload, onRemove, onRefresh, decode = decodeWishImage }) {
  const element = document.createElement("section"); element.className = "wish-image-section flow";
  const title = document.createElement("h2"); title.textContent = "Image du cadeau"; title.tabIndex = -1;
  const current = document.createElement("div"); current.className = "wish-image-section__media";
  const refresh = createButton({ label: "Actualiser l’image", variant: "secondary", onClick: () => { if (!refresh.disabled) onRefresh(); } });
  const controls = document.createElement("div"); controls.className = "flow";
  const input = document.createElement("input"); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
  const field = createFormField({ control: input, label: "Choisir une image", description: "JPEG, PNG ou WebP non animé, 10 Mio et 40 millions de pixels maximum. L’image s’enregistre séparément des autres informations." });
  const feedback = document.createElement("div"); const preview = document.createElement("div"); preview.className = "wish-image-section__preview flow"; preview.hidden = true;
  const status = document.createElement("p"); status.setAttribute("role", "status");
  let disposed = false, inactive = true, decoding = false, revision = 0;
  /** @type {Blob | null} */ let selected = null;
  /** @type {string | null} */ let objectUrl = null;
  /** @type {import("./wishesService.js").Wish | null} */ let currentWish = null;
  /** @type {AbortController | null} */ let decodingController = null;
  const upload = createButton({ label: "Enregistrer l’image", onClick: () => { if (!inactive && !decoding && selected) onUpload(selected); } });
  const cancel = createButton({ label: "Annuler la sélection", variant: "secondary", onClick: () => { if (!inactive) { clearSelection(); input.focus(); } } });
  const remove = createButton({ label: "Supprimer l’image", variant: "danger", onClick: () => { if (!inactive) onRemove(); } });
  const actions = document.createElement("div"); actions.className = "cluster wishlist-form__actions"; actions.append(upload, cancel, remove);
  controls.append(field, feedback, status, preview, actions); element.append(title, current, refresh, controls);
  addComponentEventListener(element, input, "change", () => { void select(); });
  registerComponentCleanup(element, () => { disposed = true; clearSelection(); currentWish = null; disposeComponent(current); current.replaceChildren(); });
  sync();
  return { element, title, clearSelection, update };

  /** @param {boolean} [resetInput] Keep the new native selection while replacing its previous preview. */
  function clearSelection(resetInput = true) {
    revision++; decodingController?.abort(); decodingController = null; decoding = false; selected = null;
    preview.replaceChildren(); preview.hidden = true;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null; if (resetInput) input.value = ""; setFormFieldValidation(field, null); status.textContent = ""; disposeComponent(feedback); feedback.replaceChildren(); sync();
  }
  /** @param {import("./wishesService.js").Wish | null} wish Current server view. @param {boolean} disabled Parent operation/block. @param {boolean} readOnly Suspended list. */
  function update(wish, disabled, readOnly) {
    inactive = disabled || readOnly || disposed;
    if (wish !== currentWish) { currentWish = wish; disposeComponent(current); current.replaceChildren(); if (wish && !disposed) current.append(createWishImage(wish)); }
    controls.hidden = readOnly || !wish || disposed; element.hidden = !wish || disposed; sync();
  }
  function sync() {
    const hasImage = !!currentWish && (currentWish.imageUrl !== null || currentWish.imageUnavailable);
    input.disabled = inactive || disposed; upload.disabled = inactive || decoding || !selected || disposed;
    upload.textContent = hasImage ? "Remplacer l’image" : "Enregistrer l’image";
    cancel.disabled = inactive || disposed; cancel.hidden = !selected && !decoding && !objectUrl;
    remove.hidden = !hasImage; remove.disabled = inactive || decoding || disposed;
    refresh.hidden = !hasImage; refresh.disabled = inactive || decoding || disposed;
    preview.setAttribute("aria-busy", String(decoding));
  }
  async function select() {
    if (inactive || disposed) return;
    const files = input.files; const file = files?.length === 1 ? files[0] : null;
    clearSelection(false); if (!file) return;
    const expected = revision; decoding = true; decodingController = new AbortController(); const signal = decodingController.signal;
    status.textContent = "Vérification de l’image…"; sync();
    try {
      await validateWishImageFile(file);
      if (disposed || expected !== revision) return;
      objectUrl = URL.createObjectURL(file); const url = objectUrl;
      await decode(url, signal);
      if (disposed || expected !== revision || signal.aborted) return;
      selected = file; const label = document.createElement("p"); label.textContent = "Image sélectionnée — non enregistrée";
      const image = document.createElement("img"); image.alt = "Aperçu de l’image sélectionnée"; image.src = url;
      preview.append(label, image); preview.hidden = false; status.textContent = "Image prête à être enregistrée.";
    } catch (error) {
      if (disposed || expected !== revision || signal.aborted || isAbortError(error)) return;
      clearSelection(); const message = error instanceof WishImageValidationError ? error.message : "Cette image ne peut pas être lue. Choisis un autre fichier.";
      setFormFieldValidation(field, message); feedback.append(createAlert({ title: "Image à vérifier", message: "Vérifie le fichier sélectionné avant de continuer.", variant: "error" })); input.focus();
    } finally { if (!disposed && expected === revision) { decoding = false; sync(); } }
  }
}
