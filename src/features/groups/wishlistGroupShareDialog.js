import { ApiError, isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Edits one owner's group audience as a local checkbox draft and one versioned command.
 * @param {{service:Pick<ReturnType<typeof import("./groupsService.js").createGroupsService>,"wishlistVisibility"|"setWishlistVisibility">,wishlistId:string,signal:AbortSignal,onClose:()=>void}} options Owner scope.
 * @returns {HTMLDialogElement} Append before showing.
 */
export function createWishlistGroupShareDialog({ service, wishlistId, signal, onClose }) {
  const dialog = document.createElement("dialog"); dialog.className = "group-dialog wishlist-group-visibility flow";
  const title = document.createElement("h2"); title.textContent = "Visibilité dans mes groupes"; title.id = `wishlist-group-${crypto.randomUUID()}`; dialog.setAttribute("aria-labelledby", title.id);
  const help = document.createElement("p");
  const form = document.createElement("form"); form.className = "flow";
  const groups = document.createElement("fieldset"); groups.className = "wishlist-group-visibility__groups flow";
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const feedback = document.createElement("div"); feedback.className = "flow"; feedback.setAttribute("role", "alert");
  const actions = document.createElement("div"); actions.className = "cluster";
  const close = createButton({ label: "Fermer", variant: "secondary", onClick: finish });
  const save = createButton({ label: "Enregistrer", type: "submit" });
  const verify = createButton({ label: "Vérifier la visibilité", variant: "secondary", onClick: () => { void read(true); } }); verify.hidden = true;
  actions.append(close, save); form.append(groups, status, feedback, verify, actions); dialog.append(title, help, form);
  const lifetime = new AbortController(), combined = AbortSignal.any([signal, lifetime.signal]);
  let disposed = false, pending = false, reading = false, blocked = true;
  /** @type {Awaited<ReturnType<typeof service.wishlistVisibility>>|null} */ let base = null;
  const choices = new Map(/** @type {Array<[string,boolean]>} */ ([]));
  addComponentEventListener(dialog, form, "submit", event => { event.preventDefault(); void commit(); });
  addComponentEventListener(dialog, groups, "change", () => sync());
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); finish(); });
  addComponentEventListener(dialog, dialog, "close", finish);
  addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true });
  registerComponentCleanup(dialog, () => { disposed = true; lifetime.abort(); choices.clear(); base = null; if (dialog.open) dialog.close(); dialog.remove(); });
  if (signal.aborted) disposeComponent(dialog); else void read(false);
  return dialog;

  function finish() { if (!pending && !disposed) { disposeComponent(dialog); onClose(); } }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); }
  function collect() { for (const input of groups.querySelectorAll("input")) choices.set(input.value, input.checked); }
  function sync() {
    if (disposed) return;
    collect(); dialog.setAttribute("aria-busy", String(pending || reading)); close.disabled = pending;
    for (const input of groups.querySelectorAll("input")) input.disabled = pending || reading || blocked;
    save.disabled = pending || reading || blocked || !base?.visibility.groups.some(group => choices.get(group.groupId) !== group.isVisible);
    verify.hidden = !blocked || reading; verify.disabled = pending;
  }
  function render() {
    disposeComponent(groups); groups.replaceChildren(); if (!base) return;
    const legend = document.createElement("legend"); legend.textContent = "Groupes autorisés"; groups.append(legend);
    help.textContent = base.visibility.isPublic ? "Cette liste publique est visible par défaut dans tous tes groupes. Le lien public reste accessible à tous." : "Coche les groupes dans lesquels tu veux partager cette liste privée.";
    for (const group of base.visibility.groups) {
      const label = document.createElement("label"); label.className = "wishlist-group-visibility__choice";
      const input = document.createElement("input"); input.type = "checkbox"; input.name = "groups"; input.value = group.groupId; input.checked = choices.get(group.groupId) ?? group.isVisible;
      const name = document.createElement("span"); name.textContent = group.name; label.append(input, name); groups.append(label);
    }
    status.textContent = base.visibility.groups.length ? "" : "Rejoins ou crée un groupe pour y partager cette liste.";
  }
  /** Fresh reads preserve explicit draft choices and never replay a write. @param {boolean} preserve */
  async function read(preserve) {
    if (reading || pending || combined.aborted) return;
    collect(); reading = true; clearFeedback(); status.textContent = "Chargement de la visibilité…"; sync();
    try {
      const result = await service.wishlistVisibility(wishlistId, { signal: combined });
      if (combined.aborted) return;
      const previous = new Map(choices); choices.clear();
      for (const group of result.visibility.groups) choices.set(group.groupId, preserve && previous.has(group.groupId) ? /** @type {boolean} */ (previous.get(group.groupId)) : group.isVisible);
      base = result; blocked = false; render();
    } catch (error) { if (!combined.aborted && !isAbortError(error)) { blocked = true; status.textContent = ""; feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" })); } }
    finally { reading = false; sync(); }
  }
  async function commit() {
    collect();
    if (pending || reading || blocked || !base || combined.aborted || save.disabled) return;
    pending = true; clearFeedback(); sync();
    try {
      await service.setWishlistVisibility(wishlistId, [...choices].map(([groupId,isVisible]) => ({groupId,isVisible})), { etag: base.etag, signal: combined });
      if (!combined.aborted) { pending = false; finish(); }
    } catch (error) {
      if (!combined.aborted && !isAbortError(error)) {
        blocked = true; feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
        if (error instanceof ApiError && error.statusCode === 401) { base = null; choices.clear(); disposeComponent(groups); groups.replaceChildren(); }
      }
    } finally { pending = false; sync(); }
  }
}
