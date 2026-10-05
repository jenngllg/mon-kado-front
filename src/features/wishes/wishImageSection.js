import { isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { createWishImage } from "./wishImage.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { decodeWishImage, validateWishImageFile, WishImageValidationError } from "./wishImageValidation.js";

/** Local selection UI; the parent owns mutations and their reference versions.
 * @param {{onUpload: (file: Blob) => void, onRemove: () => void, decode?: typeof decodeWishImage}} options Owner callbacks.
 */
export function createWishImageSection({ onUpload, onRemove, decode = decodeWishImage }) {
  const element = document.createElement("section"); element.className = "wish-image-section wish-image-section--editor flow";
  const title = document.createElement("h2"); title.textContent = "Image du souhait"; title.tabIndex = -1; title.className = "visually-hidden";
  const current = document.createElement("div"); current.className = "wish-image-section__media";
  const savedImage = document.createElement("div");
  const controls = document.createElement("div"); controls.className = "flow";
  const input = document.createElement("input"); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
  const field = createFormField({ control: input, label: "Choisir une image" });
  field.classList.add("visually-hidden"); input.tabIndex = -1;
  const feedback = document.createElement("div"); const preview = document.createElement("div"); preview.className = "wish-image-section__preview flow"; preview.hidden = true;
  const status = document.createElement("p"); status.setAttribute("role", "status"); status.className = "visually-hidden";
  let disposed = false, inactive = true, decoding = false, revision = 0;
  /** @type {Blob | null} */ let selected = null;
  /** @type {string | null} */ let objectUrl = null;
  /** @type {import("./wishesService.js").Wish | null} */ let currentWish = null;
  /** @type {AbortController | null} */ let decodingController = null;
  const edit = createButton({ label: "Remplacer l’image", variant: "secondary", onClick: () => { if (!inactive && !decoding) input.click(); } });
  edit.setAttribute("aria-label", "Remplacer l’image"); applyActionIcon(edit, "edit", "Remplacer l’image"); edit.classList.add("wish-image-section__edit");
  const remove = createButton({ label: "Supprimer l’image", variant: "secondary", onClick: () => {
    if (inactive || decoding) return;
    if (selected) { clearSelection(); edit.focus(); } else onRemove();
  } });
  remove.classList.add("wish-image-section__remove"); remove.setAttribute("aria-label", "Supprimer l’image"); remove.title = "Supprimer l’image"; remove.textContent = "×";
  current.append(savedImage, preview, edit, remove);
  controls.append(field, feedback, status); element.append(title, current, controls);
  addComponentEventListener(element, input, "change", () => { void select(); });
  registerComponentCleanup(element, () => { disposed = true; clearSelection(); currentWish = null; disposeComponent(current); current.replaceChildren(); });
  sync();
  return { element, title, clearSelection, update, getSelected: () => selected, setSelected };

  /** @param {Blob} file Validated and decoded imported image. */
  function setSelected(file) {
    if (disposed || inactive) return;
    clearSelection(); selected = file; objectUrl = URL.createObjectURL(file);
    const image = document.createElement("img"); image.alt = "Aperçu de l’image sélectionnée"; image.src = objectUrl;
    preview.append(image); preview.hidden = false; sync(); onUpload(file);
  }

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
    if (wish !== currentWish) { currentWish = wish; disposeComponent(savedImage); savedImage.replaceChildren(); if (wish && !disposed) savedImage.append(createWishImage(wish)); }
    controls.hidden = readOnly || !wish || disposed; element.hidden = !wish || disposed; sync();
  }
  function sync() {
    const hasImage = !!currentWish && (currentWish.imageUrl !== null || currentWish.imageUnavailable);
    input.disabled = inactive || decoding || disposed; edit.disabled = inactive || decoding || disposed;
    edit.hidden = controls.hidden; edit.setAttribute("aria-label", hasImage ? "Remplacer l’image" : "Ajouter une image"); edit.title = hasImage ? "Remplacer l’image" : "Ajouter une image";
    current.classList.toggle("wish-image-section__media--empty", !hasImage && !selected);
    remove.hidden = (!hasImage && !selected) || controls.hidden; remove.disabled = inactive || decoding || disposed;

    preview.setAttribute("aria-busy", String(decoding));
    savedImage.hidden = !!selected;
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
      selected = file;
      const image = document.createElement("img"); image.alt = "Aperçu de l’image sélectionnée"; image.src = url;
      preview.append(image); preview.hidden = false; status.textContent = "";
    } catch (error) {
      if (disposed || expected !== revision || signal.aborted || isAbortError(error)) return;
      clearSelection(); const message = error instanceof WishImageValidationError ? error.message : "Cette image ne peut pas être lue. Choisis un autre fichier.";
      setFormFieldValidation(field, message); feedback.append(createAlert({ title: "Image à vérifier", message, variant: "error" })); edit.focus();
    } finally { if (!disposed && expected === revision) { decoding = false; sync(); } }
    if (!disposed && expected === revision && !inactive && selected) onUpload(selected);
  }
}
