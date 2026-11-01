import { ApiError, isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, createFormField, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createProfileImageSection } from "../profile/profileImageSection.js";

/** Stages the name and cropped photo locally; a photo failure never recreates the group.
 * @param {{parent:HTMLElement,trigger:HTMLButtonElement,service:Pick<ReturnType<typeof import("./groupsService.js").createGroupsService>,"create"|"uploadImage"|"loadOne">,
 * signal:AbortSignal,navigate:(path:string)=>void,onClose:()=>void}} options Scoped creation dependencies.
 */
export function openGroupCreateDialog({ parent, trigger, service, signal, navigate, onClose }) {
  if (signal.aborted || parent.querySelector(".group-create-dialog")) return;
  const dialog = document.createElement("dialog"); dialog.className = "group-dialog group-create-dialog flow";
  const title = document.createElement("h2"); title.textContent = "Créer un groupe"; title.id = `group-create-${crypto.randomUUID()}`; dialog.setAttribute("aria-labelledby", title.id);
  const form = document.createElement("form"); form.className = "flow";
  const name = document.createElement("input"); name.type = "text"; name.name = "name"; name.maxLength = 100; name.required = true;
  const field = createFormField({ label: "Nom du groupe", control: name, required: true });
  const feedback = document.createElement("div"); feedback.setAttribute("role", "alert");
  const lifetime = new AbortController(), combined = AbortSignal.any([signal, lifetime.signal]);
  let disposed = false, pending = false, blocked = false;
  /** @type {{group:import("./groupsService.js").Group,etag:string}|null} */ let created = null;
  const emptyPhoto = Object.freeze({ imageUrl: null, imageUnavailable: false });
  const submit = createButton({ label: "Créer", type: "submit" });
  const editor = createProfileImageSection({ saveAction: submit, cancelLabel: "Retirer la sélection", onRemove: () => editor.clearSelection(), onChange: () => { if (!disposed) sync(); } });
  editor.title.textContent = "Photo du groupe"; editor.title.classList.remove("visually-hidden");
  const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: close });
  const verify = createButton({ label: "Vérifier le groupe", variant: "secondary", onClick: () => { void verifyPhoto(); } }); verify.hidden = true;
  const actions = document.createElement("div"); actions.className = "cluster"; actions.append(cancel, submit);
  form.append(field, editor.element, feedback, verify, actions); dialog.append(title, form);
  addComponentEventListener(dialog, form, "submit", event => { event.preventDefault(); void save(); });
  addComponentEventListener(dialog, name, "input", () => name.setCustomValidity(""));
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); close(); });
  addComponentEventListener(dialog, dialog, "close", close);
  addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true });
  registerComponentCleanup(dialog, () => { disposed = true; lifetime.abort(); created = null; name.value = ""; if (dialog.open) dialog.close(); dialog.remove(); });
  parent.append(dialog); sync(); dialog.showModal(); name.focus();

  function active() { return !disposed && !combined.aborted; }
  function sync() {
    if (!active()) return;
    dialog.setAttribute("aria-busy", String(pending));
    name.disabled = pending || !!created;
    editor.update(emptyPhoto, pending, blocked);
    cancel.disabled = pending;
    submit.disabled = pending || blocked || editor.isPending() || (!!created && !editor.getSelected());
    setLabel(submit, created ? "Enregistrer la photo" : "Créer");
    setLabel(cancel, created ? "Ouvrir le groupe" : "Annuler");
    verify.hidden = !created || !blocked; verify.disabled = pending;
  }
  function close() {
    if (pending || disposed) return;
    const destination = created ? `/groups/${created.group.id}` : null;
    disposeComponent(dialog);
    if (signal.aborted) return;
    if (destination) navigate(destination);
    else { if (trigger.isConnected) trigger.focus(); onClose(); }
  }
  /** Verifies an uncertain upload before allowing another explicit attempt. */
  async function verifyPhoto() {
    if (!active() || pending || !created) return;
    pending = true; sync();
    try {
      const result = await service.loadOne(created.group.id, { signal: combined });
      if (!active()) return;
      if (result.group.id !== created.group.id) throw new ApiError({ kind: "invalidResponse" });
      created = result; blocked = false;
      name.value = result.group.name;
      disposeComponent(feedback); feedback.replaceChildren();
      if (result.group.profileImageUrl) { pending = false; close(); }
    } catch (error) { if (active() && !isAbortError(error)) showError(error); }
    finally { pending = false; sync(); }
  }
  /** @param {unknown} error Expected or transport failure. */
  function showError(error) {
    disposeComponent(feedback); feedback.replaceChildren(createAlert({ ...toUserFacingError(error), variant: "error" }));
    const notice = document.createElement("p");
    notice.textContent = created ? "Le groupe est créé. La photo n’a pas pu être confirmée. Vérifie le groupe avant de réessayer." : "Ferme cette fenêtre pour vérifier l’état du groupe avant de recommencer.";
    if (created || blocked) feedback.append(notice);
  }
  async function save() {
    if (!active() || pending || blocked || editor.isPending()) return;
    if (!created && !name.value.trim()) { name.setCustomValidity("Nom du groupe obligatoire."); name.reportValidity(); return; }
    if (!created && !name.reportValidity()) return;
    pending = true; disposeComponent(feedback); feedback.replaceChildren(); sync();
    try {
      const selected = !!editor.getSelected();
      const file = selected ? await editor.prepareSelectionAsync() : null;
      if (!active() || selected && !file) return;
      if (!created) created = await service.create(name.value, { signal: combined });
      if (!active()) return;
      if (file) created = await service.uploadImage(created.group.id, file, { etag: created.etag, signal: combined });
      if (active()) { pending = false; close(); }
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      blocked = !!created || !(error instanceof ApiError && error.kind === "http" && error.statusCode !== null && [400,403,409].includes(error.statusCode));
      showError(error);
    } finally { pending = false; sync(); }
  }
}

/** @param {HTMLButtonElement} button Existing control. @param {string} text Current action. */
function setLabel(button, text) { const label = button.querySelector(".ui-button__label"); if (label) label.textContent = text; }
