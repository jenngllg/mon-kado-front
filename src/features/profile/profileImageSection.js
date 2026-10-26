import { isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { decodeWishImage, validateWishImageFile, WishImageValidationError } from "../wishes/wishImageValidation.js";
import { createMemberAvatar } from "../../components/memberAvatar.js";
import { createProfilePhotoCrop } from "./profilePhotoCrop.js";
import { applyActionIcon } from "../../components/actionIcon.js";

/** Owns only the local file and rendered sources; the profile owns versions and mutations.
 * @param {{onChange: () => void, onRemove: () => void, saveAction: HTMLButtonElement, decode?: typeof decodeWishImage}} options Actions.
 */
export function createProfileImageSection({ onChange, onRemove, saveAction, decode = decodeWishImage }) {
  const element = node("section", ""); element.className = "wish-image-section profile-image-section flow";
  const title = node("h2", "Photo de profil"); title.tabIndex = -1;
  title.className = "visually-hidden";
  const current = node("div", ""); current.className = "wish-image-section__media";
  const media = node("div", ""); media.className = "profile-image-section__frame wish-image-section__media";
  const body = node("div", ""); body.className = "profile-image-section__body";
  const input = node("input", ""); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
  const field = createFormField({ control: input, label: "Choisir une photo", description: "JPEG, PNG ou WebP non animé · 10 Mio maximum · 40 millions de pixels maximum." });
  field.classList.add("visually-hidden"); input.tabIndex = -1;
  const status = node("p", ""); status.setAttribute("role", "status");
  const preview = node("div", ""); preview.className = "wish-image-section__preview flow"; preview.hidden = true;
  let disposed = false, inactive = true, decoding = false, revision = 0;
  /** @type {Blob | null} */ let selected = null;
  /** @type {string | null} */ let objectUrl = null;
  /** @type {AbortController | null} */ let decoder = null;
  /** @type {import("./profileImageService.js").ProfilePhoto | null} */ let photo = null;
  let identity = "";
  /** @type {ReturnType<typeof createProfilePhotoCrop> | null} */ let cropper = null;
  let encoding = false;
  const edit = createButton({ label: "Remplacer la photo", variant: "secondary", onClick: () => { if (!inactive && !encoding && !decoding) input.click(); } });
  edit.setAttribute("aria-label", "Remplacer la photo"); applyActionIcon(edit, "edit", "Remplacer la photo"); edit.classList.add("wish-image-section__edit");
  const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: () => { if (!cancel.disabled) { clearSelection(); edit.focus(); } } });
  const remove = createButton({ label: "Supprimer la photo", variant: "secondary", onClick: () => { if (!remove.disabled) onRemove(); } });
  applyActionIcon(remove, "delete", "Supprimer la photo"); remove.classList.add("wish-image-section__remove", "icon-action--danger");
  const actions = node("div", ""); actions.className = "profile-image-section__actions cluster"; actions.append(cancel, saveAction);
  media.append(current, edit, remove);
  body.append(media, actions);
  element.append(title, body, field, status, preview);
  addComponentEventListener(element, input, "change", () => { void select(); });
  registerComponentCleanup(element, () => { disposed = true; clearSelection(); photo = null; identity = ""; disposeComponent(current); current.replaceChildren(); });
  sync();
  return { element, title, clearSelection, update, prepareSelectionAsync, getSelected: () => selected,
    isPending: () => decoding || encoding || (!!objectUrl && !selected), focusRemove: () => { (remove.hidden ? title : remove).focus(); } };

  /** @param {boolean} [reset] Clear the native control except when beginning its newest selection. */
  function clearSelection(reset = true) {
    revision++; decoder?.abort(); decoder = null; decoding = false; encoding = false; selected = null;
    body.append(actions);
    disposeComponent(preview); cropper = null;
    const image = preview.querySelector("img"); image?.removeAttribute("src"); preview.replaceChildren(); preview.hidden = true;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null; if (reset) input.value = ""; setFormFieldValidation(field, null); status.textContent = ""; sync(); onChange();
  }
  /** @param {import("./profileImageService.js").ProfilePhoto | null} value Safe source. @param {boolean} disabled Parent lock. @param {boolean} blocked Explicit recovery required. @param {string} [memberId] Canonical identity. */
  function update(value, disabled, blocked, memberId = "") {
    inactive = disabled || blocked || disposed;
    if (value !== photo || memberId !== identity) {
      photo = value; identity = memberId; disposeComponent(current); current.replaceChildren();
      if (value && !disposed) {
        const fallback = node("p", value.imageUnavailable ? "Photo indisponible" : "Sans photo"); current.append(fallback);
        fallback.hidden = !!value.imageUrl;
        current.prepend(createMemberAvatar({ memberId, imageUrl: value.imageUrl, size: 256,
          onError: () => { fallback.textContent = "Photo indisponible"; fallback.hidden = false; } }));
      }
    }
    element.hidden = !photo || disposed; sync();
  }
  function sync() {
    const hasPhoto = !!photo && (!!photo.imageUrl || photo.imageUnavailable);
    input.disabled = inactive || encoding || disposed;
    edit.disabled = inactive || decoding || encoding || disposed;
    const editLabel = hasPhoto ? "Remplacer la photo" : "Ajouter une photo";
    edit.setAttribute("aria-label", editLabel); applyActionIcon(edit, hasPhoto ? "edit" : "add", editLabel);
    media.classList.toggle("wish-image-section__media--empty", !hasPhoto);
    cancel.hidden = !selected && !decoding && !objectUrl; cancel.disabled = inactive || disposed;
    remove.hidden = !hasPhoto; remove.disabled = inactive || decoding || encoding || disposed;
    body.hidden = !!cropper;
    cropper?.setDisabled(inactive || encoding || disposed);
    preview.setAttribute("aria-busy", String(decoding || encoding));
  }
  /** Exports the latest local framing only when the profile's single save action is submitted.
   * @returns {Promise<Blob | null>} Cropped photo, or null when cancelled or invalid.
   */
  async function prepareSelectionAsync() {
    if (!selected || encoding || !cropper || disposed) return null;
    const expected = revision;
    encoding = true; sync();
    try {
      const file = await cropper.exportImage();
      if (!disposed && expected === revision) return file;
    } catch (error) {
      if (!disposed && expected === revision && !isAbortError(error)) {
        status.textContent = "La photo n’a pas pu être recadrée.";
        setFormFieldValidation(field, status.textContent);
      }
    } finally { if (!disposed && expected === revision) { encoding = false; sync(); } }
    return null;
  }
  async function select() {
    if (inactive || disposed) return;
    const file = input.files?.length === 1 ? input.files[0] : null;
    clearSelection(false); if (!file) return;
    const expected = revision; decoding = true; decoder = new AbortController(); const signal = decoder.signal;
    status.textContent = "Vérification de la photo…"; sync(); onChange();
    try {
      await validateWishImageFile(file);
      if (disposed || expected !== revision) return;
      objectUrl = URL.createObjectURL(file); const url = objectUrl;
      await decode(url, signal);
      if (disposed || expected !== revision || signal.aborted) return;
      cropper = createProfilePhotoCrop({ url, onReady: () => {
        if (disposed || expected !== revision) return;
        selected = file; status.textContent = ""; sync(); onChange();
      }, onError: () => {
        if (disposed || expected !== revision) return;
        clearSelection(); status.textContent = "Cette photo ne peut pas être lue."; setFormFieldValidation(field, status.textContent); edit.focus();
      } });
      cropper.controls.append(actions);
      preview.append(cropper.element); preview.hidden = false; sync();
    } catch (error) {
      if (disposed || expected !== revision || isAbortError(error)) return;
      clearSelection(); status.textContent = error instanceof WishImageValidationError ? error.message : "Cette photo ne peut pas être lue."; setFormFieldValidation(field, status.textContent); edit.focus();
    } finally { if (!disposed && expected === revision) { decoding = false; sync(); onChange(); } }
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Native tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Element. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
