import { isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, createFormField, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Manages the current list's private grants from its owner page, independently of public links.
 * @param {{service:ReturnType<typeof import("./groupsService.js").createGroupsService>,wishlistId:string,signal:AbortSignal,onClose:()=>void}} options Owner scope.
 * @returns {HTMLDialogElement} Append before showing.
 */
export function createWishlistGroupShareDialog({ service, wishlistId, signal, onClose }) {
  const dialog = document.createElement("dialog"); dialog.className = "group-dialog flow";
  const title = document.createElement("h2"); title.textContent = "Partager dans un groupe"; title.id = `wishlist-group-${crypto.randomUUID()}`; dialog.setAttribute("aria-labelledby", title.id);
  const selection = document.createElement("select"); selection.name = "groupId";
  const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Choisir un groupe"; selection.append(placeholder);
  const field = createFormField({ label: "Groupe", control: selection, required: true });
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const feedback = document.createElement("div"); feedback.className = "flow"; feedback.setAttribute("role", "alert");
  const actions = document.createElement("div"); actions.className = "cluster";
  const close = createButton({ label: "Fermer", variant: "secondary", onClick: finish });
  const save = createButton({ label: "Partager", onClick: () => { void mutate(); } });
  actions.append(close, save); dialog.append(title, field, status, feedback, actions);
  const lifetime = new AbortController(), combined = AbortSignal.any([signal, lifetime.signal]);
  let disposed = false, pending = false, reading = true, blocked = false, shared = false;
  /** @type {AbortController|null} */ let currentRead = null;
  addComponentEventListener(dialog, selection, "change", () => { void readGrant(); });
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); finish(); });
  addComponentEventListener(dialog, dialog, "close", finish);
  addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true });
  registerComponentCleanup(dialog, () => { disposed = true; lifetime.abort(); currentRead?.abort(); if (dialog.open) dialog.close(); dialog.remove(); });
  sync(); if (signal.aborted) disposeComponent(dialog); else void loadGroups();
  return dialog;

  function finish() { if (!pending && !disposed) { disposeComponent(dialog); onClose(); } }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); }
  function sync() {
    dialog.setAttribute("aria-busy", String(pending || reading)); close.disabled = pending;
    selection.disabled = pending || reading && !selection.value;
    save.disabled = pending || reading || blocked || !selection.value;
    const label = save.querySelector(".ui-button__label"); if (label) label.textContent = shared ? "Retirer le partage" : "Partager";
  }
  async function loadGroups() {
    reading = true; clearFeedback(); status.textContent = "Chargement des groupes…"; sync();
    try {
      let page = 1;
      do {
        const result = await service.load({ signal: combined, page });
        if (combined.aborted) return;
        for (const group of result.items) { const option = document.createElement("option"); option.value = group.id; option.textContent = group.name; selection.append(option); }
        if (!result.hasNextPage) break;
        page++;
      } while (!combined.aborted);
      status.textContent = selection.options.length === 1 ? "Rejoins ou crée un groupe pour y partager cette liste." : "";
    } catch (error) {
      if (!combined.aborted && !isAbortError(error)) {
        status.textContent = ""; feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }), createButton({ label: "Réessayer", variant: "secondary", onClick: () => { while (selection.options.length > 1) selection.remove(1); void loadGroups(); } }));
      }
    } finally { reading = false; if (!disposed) sync(); }
  }
  async function readGrant() {
    currentRead?.abort(); currentRead = new AbortController();
    const active = AbortSignal.any([combined, currentRead.signal]), groupId = selection.value;
    shared = false; reading = true; blocked = false; clearFeedback(); status.textContent = ""; sync();
    try {
      if (!groupId) return;
      let page = 1;
      do {
        const result = await service.wishlists(groupId, { signal: active, page });
        if (active.aborted) return;
        shared = result.items.some(list => list.id === wishlistId);
        if (shared || !result.hasNextPage) break;
        page++;
      } while (!active.aborted);
      status.textContent = shared ? "Cette liste est partagée avec ce groupe." : "Cette liste n’est pas partagée avec ce groupe.";
    } catch (error) { if (!active.aborted && !isAbortError(error)) fail(error); }
    finally { if (!active.aborted) { reading = false; sync(); } }
  }
  async function mutate() {
    if (pending || reading || blocked || !selection.value || combined.aborted) return;
    pending = true; clearFeedback(); sync();
    try {
      if (shared) await service.unshare(selection.value, wishlistId, { signal: combined });
      else await service.share(selection.value, wishlistId, { signal: combined });
      if (!combined.aborted) { shared = !shared; status.textContent = shared ? "Liste partagée avec le groupe." : "Partage retiré du groupe."; }
    } catch (error) { if (!combined.aborted && !isAbortError(error)) fail(error); }
    finally { pending = false; if (!disposed) sync(); }
  }
  /** @param {unknown} error */
  function fail(error) {
    blocked = true; feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }),
      createButton({ label: "Vérifier le partage", variant: "secondary", onClick: () => { void readGrant(); } }));
  }
}
