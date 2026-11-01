import { isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, disposeComponent } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { createImagePlaceholder } from "../../components/imagePlaceholder.js";
import { decodeWishImage, validateWishImageFile, WishImageValidationError } from "./wishImageValidation.js";

/** Selects and validates a local image before the wish is created.
 * @param {{onBusy: () => void}} options Parent control synchronization.
 */
export function createWishImagePicker({ onBusy }) {
  const imagePanel = document.createElement("aside"); imagePanel.className = "wish-import__image-panel"; imagePanel.setAttribute("aria-label", "Image du souhait");
  const messages = document.createElement("div"); messages.className = "wish-import__messages flow";
  const frame = document.createElement("div"); frame.className = "wish-image-section__media wish-image-section__media--empty";
  const empty = createImagePlaceholder("Aucune image"); empty.classList.add("wish-import__image-empty");
  const host = document.createElement("div"); host.className = "wish-image-section__preview flow";
  const input = document.createElement("input"); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp"; input.hidden = true;
  const choose = createButton({ label: "Ajouter une image", variant: "secondary", onClick: () => { if (!disabled && !loading) input.click(); } });
  choose.classList.add("wish-image-section__edit");
  const remove = createButton({ label: "Retirer la sélection", variant: "secondary", onClick: () => { if (!disabled && !loading) { discard(); sync(); choose.focus(); } } });
  applyActionIcon(remove, "delete", "Retirer la sélection"); remove.classList.add("wish-image-section__remove", "icon-action--danger");
  frame.append(empty, host, choose, remove); imagePanel.append(frame, input);
  let disabled = true, loading = false, disposed = false;
  /** @type {Blob | null} */ let selected = null;
  /** @type {string | null} */ let objectUrl = null;
  const controller = new AbortController();
  addComponentEventListener(imagePanel, input, "change", () => { void select(); });
  registerComponentCleanup(imagePanel, () => { disposed = true; controller.abort(); discard(); disposeComponent(messages); });
  sync();
  return { imagePanel, messages, isBusy: () => loading, getImage: () => selected, clear: discard,
    update: (/** @type {boolean} */ value) => { disabled = value; sync(); } };

  function discard() { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null; selected = null; host.replaceChildren(); }
  function sync() {
    input.disabled = choose.disabled = remove.disabled = disabled || loading || disposed;
    remove.hidden = host.hidden = !selected; empty.hidden = !!selected;
    const label = selected ? "Remplacer l’image" : "Ajouter une image";
    choose.setAttribute("aria-label", label); applyActionIcon(choose, selected ? "edit" : "add", label);
    frame.classList.toggle("wish-image-section__media--empty", !selected);
  }
  async function select() {
    const file = input.files?.[0]; if (!file || disabled || loading || disposed) return;
    loading = true; sync(); onBusy(); let localUrl = null;
    try {
      await validateWishImageFile(file);
      if (disposed) return;
      localUrl = URL.createObjectURL(file); await decodeWishImage(localUrl, controller.signal);
      if (disposed) return;
      discard(); selected = file; objectUrl = localUrl; localUrl = null;
      const image = document.createElement("img"); image.alt = "Image du souhait"; image.src = objectUrl; host.append(image);
      disposeComponent(messages); messages.replaceChildren();
    } catch (error) {
      if (!disposed && !isAbortError(error)) { disposeComponent(messages); messages.replaceChildren(createAlert({ title: "Image à vérifier", message: error instanceof WishImageValidationError ? error.message : "Cette image ne peut pas être lue.", variant: "error" })); }
    } finally {
      if (localUrl) URL.revokeObjectURL(localUrl);
      if (!disposed) { loading = false; input.value = ""; sync(); onBusy(); }
    }
  }
}
