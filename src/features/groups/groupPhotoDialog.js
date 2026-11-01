import { ApiError, isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createProfileImageSection } from "../profile/profileImageSection.js";
import { readGroupPhoto } from "./groupPhoto.js";

/** Edits a local crop; saving is explicit and an uncertain write must be verified, never replayed.
 * @param {{parent:HTMLElement,trigger:HTMLButtonElement,service:ReturnType<typeof import("./groupsService.js").createGroupsService>,
 * group:import("./groupsService.js").Group,etag:string,apiBaseUrl:string,signal:AbortSignal,onSaved:()=>Promise<void>}} options
 */
export function openGroupPhotoDialog({ parent, trigger, service, group, etag, apiBaseUrl, signal, onSaved }) {
  const dialog = document.createElement("dialog"); dialog.className = "group-dialog group-photo-dialog flow";
  const heading = document.createElement("h2"); heading.textContent = "Photo du groupe"; heading.id = `group-photo-${crypto.randomUUID()}`;
  dialog.setAttribute("aria-labelledby", heading.id);
  const feedback = document.createElement("div"); feedback.setAttribute("role", "alert");
  const actions = document.createElement("div"); actions.className = "cluster";
  const lifetime = new AbortController(), combined = AbortSignal.any([signal, lifetime.signal]);
  let pending = false, blocked = false, disposed = false;
  const photo = readGroupPhoto(group.profileImageUrl, group.id, apiBaseUrl);
  const save = createButton({ label: "Enregistrer", onClick: () => { void commit(false); } });
  const editor = createProfileImageSection({ saveAction: save, onChange: () => { if (!pending) { disposeComponent(feedback); feedback.replaceChildren(); } sync(); }, onRemove: () => { void commit(true); } });
  const closeButton = createButton({ label: "Fermer", variant: "secondary", onClick: close });
  actions.append(closeButton, save); dialog.append(heading, editor.element, feedback, actions);
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); close(); });
  addComponentEventListener(dialog, dialog, "close", close);
  addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true });
  registerComponentCleanup(dialog, () => { disposed = true; lifetime.abort(); disposeComponent(editor.element); disposeComponent(feedback); if (dialog.open) dialog.close(); dialog.remove(); });
  if (signal.aborted) { disposeComponent(dialog); return; }
  parent.append(dialog); sync(); dialog.showModal(); closeButton.focus();
  function sync() {
    if (disposed) return;
    editor.update(photo, pending, blocked, group.id);
    save.disabled = pending || blocked || !editor.getSelected() || editor.isPending();
    closeButton.disabled = pending;
    dialog.setAttribute("aria-busy", String(pending));
  }
  function close() {
    if (pending || disposed) return;
    disposeComponent(dialog); if (trigger.isConnected) trigger.focus();
    if (blocked && !signal.aborted) void onSaved();
  }
  /** @param {boolean} remove */
  async function commit(remove) {
    if (pending || blocked || disposed || combined.aborted || editor.isPending() || (!remove && !editor.getSelected())) return;
    pending = true; disposeComponent(feedback); feedback.replaceChildren(); sync();
    try {
      if (remove) await service.removeImage(group.id, { etag, signal: combined });
      else {
        const file = await editor.prepareSelectionAsync();
        if (!file || combined.aborted) return;
        await service.uploadImage(group.id, file, { etag, signal: combined });
      }
      if (combined.aborted) return;
      pending = false; close(); await onSaved();
    } catch (error) {
      if (combined.aborted || isAbortError(error)) return;
      feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
      blocked = !(error instanceof ApiError && error.kind === "http" && error.statusCode !== null && [400, 413, 415, 422].includes(error.statusCode));
      if (blocked) {
        const message = document.createElement("p"); message.textContent = "Ferme cette fenêtre pour vérifier la photo enregistrée avant de recommencer."; feedback.append(message);
      }
    } finally { pending = false; sync(); }
  }
}
