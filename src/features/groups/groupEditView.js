import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createBackLink, createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createProfileImageSection } from "../profile/profileImageSection.js";
import { readGroupPhoto } from "./groupPhoto.js";

/** Keeps the group's name and photo draft on one owner-only editor; writes require an explicit save.
 * @param {{service:ReturnType<typeof import("./groupsService.js").createGroupsService>,groupId:string,memberId:string,
 * apiBaseUrl:string,signal:AbortSignal,navigate:(path:string)=>void}} options Authorized operations and view lifetime.
 * @returns {HTMLElement} Routed group editor.
 */
export function createGroupEditView({ service, groupId, memberId, apiBaseUrl, signal, navigate }) {
  const view = node("section", "", "group-edit-view flow");
  const back = createBackLink({ label: "Retour au groupe", href: `/groups/${groupId}`, contextual: false });
  const title = node("h1", "Modifier le groupe"); title.tabIndex = -1;
  const feedback = node("div", "", "flow"); feedback.setAttribute("role", "alert");
  const loading = createLoadingState({ label: "Chargement du groupe…" });
  const form = node("form", "", "group-edit-form flow"); form.hidden = true; form.noValidate = true; form.setAttribute("aria-label", "Modifier le groupe");
  const name = document.createElement("input"); name.type = "text"; name.name = "name"; name.maxLength = 100; name.required = true;
  const field = createFormField({ label: "Nom du groupe", control: name, required: true });
  const lifetime = new AbortController(), combined = AbortSignal.any([signal, lifetime.signal]);
  /** @type {{group:import("./groupsService.js").Group,etag:string}|null} */ let base = null;
  let photo = readGroupPhoto(null, groupId, apiBaseUrl);
  const emptyPhoto = photo;
  let disposed = false, busy = false, blocked = true, terminal = false, removing = false;
  const submit = createButton({ label: "Enregistrer", type: "submit" });
  const editor = createProfileImageSection({ saveAction: submit, onChange: () => { if (active()) { if (editor.getSelected()) removing = false; sync(); } }, onRemove: () => {
    if (!active() || busy || blocked) return;
    removing = true; editor.clearSelection(); clearFeedback(); sync();
  } });
  editor.title.textContent = "Photo du groupe";
  const undo = createButton({ label: "Annuler la suppression de la photo", variant: "secondary", onClick: () => { removing = false; clearFeedback(); sync(); } }); undo.hidden = true;
  const comparison = node("section", "", "group-edit-comparison flow"); comparison.hidden = true;
  const stored = node("p");
  const reset = createButton({ label: "Utiliser la version enregistrée", variant: "secondary", onClick: () => {
    if (!base || busy || blocked || terminal) return;
    name.value = base.group.name; removing = false; editor.clearSelection(); comparison.hidden = true; clearFeedback(); sync();
  } }); comparison.append(stored, reset);
  const cancel = createActionLink({ label: "Annuler", href: `/groups/${groupId}` }); cancel.classList.add("ui-button", "ui-button--secondary");
  const actions = node("div", "", "cluster"); actions.append(cancel, submit);
  const verify = createButton({ label: "Vérifier le groupe", variant: "secondary", onClick: () => { void read(true); } }); verify.hidden = true;
  form.append(editor.element, undo, field, comparison, actions);
  view.append(back, title, feedback, loading, verify, form);
  addComponentEventListener(view, name, "input", () => { name.setCustomValidity(""); if (!blocked) clearFeedback(); sync(); });
  addComponentEventListener(view, form, "submit", event => { event.preventDefault(); void save(); });
  addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); base = null; name.value = ""; photo = emptyPhoto; removing = false; });
  if (signal.aborted) disposeComponent(view); else void read(false);
  return view;

  function active() { return !disposed && !combined.aborted; }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); }
  function changed() { return !!base && (name.value.trim() !== base.group.name || !!editor.getSelected() || removing); }
  function sync() {
    if (!active()) return;
    view.setAttribute("aria-busy", String(busy)); loading.hidden = !busy;
    form.hidden = !base || terminal;
    name.disabled = busy || terminal;
    editor.update(removing ? emptyPhoto : photo, busy || terminal, blocked, groupId);
    undo.hidden = !removing; undo.disabled = busy || blocked;
    submit.disabled = busy || blocked || terminal || !changed() || editor.isPending();
    reset.disabled = busy || blocked;
    verify.disabled = busy; verify.hidden = !blocked || terminal || busy;
    verify.textContent = base ? "Vérifier le groupe" : "Réessayer";
    for (const link of [back, cancel]) {
      if (busy) { link.removeAttribute("href"); link.setAttribute("aria-disabled", "true"); link.tabIndex = -1; }
      else { link.href = `/groups/${groupId}`; link.removeAttribute("aria-disabled"); link.removeAttribute("tabindex"); }
    }
  }
  /** @param {unknown} error */
  function fail(error) {
    clearFeedback(); feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
    terminal = error instanceof ApiError && error.kind === "http" && [401, 403, 404].includes(error.statusCode ?? 0);
    if (terminal) { base = null; editor.clearSelection(); removing = false; name.value = ""; comparison.hidden = true; }
  }
  /** @param {{group:import("./groupsService.js").Group,etag:string}} result */
  function accept(result) {
    if (result.group.id !== groupId) throw new ApiError({ kind: "invalidResponse" });
    if (result.group.ownerId !== memberId) throw new ApiError({ kind: "http", statusCode: 403, errorCode: "GROUP_ACCESS_DENIED" });
    base = result; photo = readGroupPhoto(result.group.profileImageUrl, groupId, apiBaseUrl);
  }
  /** Fresh reads preserve drafts; they never replay a failed command. @param {boolean} preserve */
  async function read(preserve) {
    if (!active() || busy) return;
    const hadBase = base !== null;
    busy = true; clearFeedback(); sync();
    try {
      const result = await service.loadOne(groupId, { signal: combined });
      if (!active()) return;
      accept(result); blocked = false; terminal = false;
      if (!preserve || !hadBase) name.value = result.group.name;
      if (removing && result.group.profileImageUrl === null) removing = false;
      if (preserve && hadBase) { stored.textContent = `Nom enregistré : ${result.group.name}`; comparison.hidden = false; }
      document.title = `Modifier ${result.group.name} · MonKado`;
    } catch (error) { if (active() && !isAbortError(error)) { blocked = true; fail(error); } }
    finally { busy = false; sync(); }
  }
  async function save() {
    if (!active() || !base || busy || blocked || terminal || editor.isPending() || !changed()) return;
    const nextName = name.value.trim();
    name.setCustomValidity(nextName ? "" : "Nom du groupe obligatoire.");
    if (!name.reportValidity()) return;
    busy = true; clearFeedback(); sync();
    let nameSaved = false;
    try {
      const selected = !!editor.getSelected();
      const file = selected ? await editor.prepareSelectionAsync() : null;
      if (!active() || selected && !file) return;
      if (nextName !== base.group.name) {
        const result = await service.rename(groupId, nextName, { etag: base.etag, signal: combined });
        if (!active()) return;
        accept(result); name.value = result.group.name; nameSaved = true;
      }
      if (removing && base.group.profileImageUrl !== null) {
        const etag = await service.removeImage(groupId, { etag: base.etag, signal: combined });
        if (!active()) return;
        accept({ group: { ...base.group, profileImageUrl: null }, etag });
      } else if (file) {
        const result = await service.uploadImage(groupId, file, { etag: base.etag, signal: combined });
        if (!active()) return;
        accept(result);
      }
      if (active()) { removing = false; editor.clearSelection(); navigate(`/groups/${groupId}`); }
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      blocked = !(error instanceof ApiError && error.kind === "http" && [400, 409, 413, 415, 422].includes(error.statusCode ?? 0));
      fail(error);
      if (!terminal && nameSaved) feedback.append(node("p", "Le nom est enregistré. La photo n’a pas pu être enregistrée."));
      if (!terminal && blocked) feedback.append(node("p", "Vérifie les informations enregistrées avant de recommencer. Ton brouillon est conservé."));
    } finally { busy = false; sync(); }
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag @param {string} [text] @param {string} [className] @returns {HTMLElementTagNameMap[T]} */
function node(tag, text = "", className = "") { const element = document.createElement(tag); element.textContent = text; element.className = className; return element; }
