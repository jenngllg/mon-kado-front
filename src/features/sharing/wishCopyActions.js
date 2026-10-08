import { ApiError, isAbortError } from "../../api/apiError.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createFormField, createLoadingState, disposeComponent, setButtonLoading } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** @typedef {{loadLists: import("../wishlists/wishlistsService.js").LoadWishlists,
 * copy: (wishlistId: string, wishId: string, options: {signal: AbortSignal}) => Promise<import("../wishes/wishesService.js").CreatedWish>}} WishCopyOperations */

/** Owns one eligible-list read per shared screen and the common explicit-copy dialog.
 * @param {WishCopyOperations & {signal: AbortSignal, onUnavailable: () => void, onBusy?: (busy: boolean) => void}} options Private operations.
 */
export function createWishCopyActions({ loadLists, copy, signal, onUnavailable, onBusy = () => {} }) {
  const host = document.createElement("div");
  const notice = document.createElement("p"); notice.setAttribute("role", "status"); notice.hidden = true; host.append(notice);
  const lifetime = new AbortController();
  /** @type {Set<HTMLButtonElement>} */ const buttons = new Set();
  /** @type {HTMLDialogElement | null} */ let dialog = null;
  let eligible = false, disposed = false, blocked = false;
  registerComponentCleanup(host, () => {
    disposed = true; lifetime.abort(); if (dialog) disposeComponent(dialog); dialog = null;
    for (const button of buttons) { button.hidden = true; button.disabled = true; }
    buttons.clear(); disposeComponent(notice); notice.replaceChildren(); notice.hidden = true;
  });
  addComponentEventListener(host, signal, "abort", () => disposeComponent(host), { once: true });
  if (signal.aborted) disposeComponent(host);
  if (!disposed) void readEligibility();
  return { element: host, button, setBlocked };

  /** @param {boolean} value Whether another command blocks this action. */
  function setBlocked(value) { blocked = value; sync(); }
  function sync() { for (const item of buttons) { item.hidden = !eligible || disposed; item.disabled = blocked || !!dialog || disposed; } }
  async function readEligibility() {
    try {
      const lists = await loadLists({ signal: lifetime.signal });
      if (disposed) return;
      eligible = lists.some(item => !item.isArchived && !item.isSuspended); sync();
    } catch { if (!disposed) { eligible = false; sync(); } }
  }
  /** @param {string} wishId Source. @param {boolean} [compact] Gallery icon. @returns {HTMLButtonElement} Initially hidden action. */
  function button(wishId, compact = false) {
    const control = createButton({ label: "Ajouter à mes listes", variant: "secondary", onClick: () => open(wishId, control) });
    if (compact) { applyActionIcon(control, "copy", "Ajouter à mes listes"); control.classList.add("wish-gallery__copy"); }
    buttons.add(control);
    registerComponentCleanup(control, () => buttons.delete(control));
    sync();
    return control;
  }
  /** @param {string} wishId Source. @param {HTMLButtonElement} trigger Focus return. */
  function open(wishId, trigger) {
    if (disposed || blocked || !eligible || dialog) return;
    disposeComponent(notice); notice.replaceChildren(); notice.hidden = true;
    const modal = document.createElement("dialog"); modal.className = "wish-copy-dialog";
    dialog = modal; sync(); onBusy(true);
    const title = document.createElement("h2"); title.textContent = "Ajouter à mes listes"; title.tabIndex = -1;
    title.id = `wish-copy-${crypto.randomUUID()}`; modal.setAttribute("aria-labelledby", title.id);
    const content = document.createElement("div"); content.className = "flow";
    const feedback = document.createElement("div"); feedback.setAttribute("role", "status");
    const select = document.createElement("select"); select.required = true;
    const field = createFormField({ label: "Liste", control: select, required: true }); field.hidden = true;
    const form = document.createElement("form"); form.className = "flow";
    const actions = document.createElement("div"); actions.className = "cluster";
    const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: finish });
    const submit = createButton({ label: "Ajouter", type: "submit" }); submit.disabled = true;
    actions.append(cancel, submit); form.append(field, feedback, actions); content.append(title, form); modal.append(content);
    const request = new AbortController();
    const requestSignal = AbortSignal.any([lifetime.signal, request.signal]);
    let saving = false, uncertain = false, closed = false;
    /** @type {ReadonlyArray<import("../wishlists/wishlistsService.js").Wishlist>} */ let targets = [];
    registerComponentCleanup(modal, () => {
      closed = true; request.abort(); targets = []; if (modal.open) modal.close(); modal.remove();
      if (dialog === modal) dialog = null;
    });
    addComponentEventListener(modal, modal, "cancel", event => { event.preventDefault(); finish(); });
    addComponentEventListener(modal, modal, "close", finish);
    addComponentEventListener(modal, select, "change", () => { submit.disabled = saving || uncertain || !select.value; });
    addComponentEventListener(modal, form, "submit", event => { event.preventDefault(); void save(); });
    host.append(modal); modal.showModal(); title.focus(); void read();

    function finish() {
      if (saving || closed) return;
      disposeComponent(modal); sync(); onBusy(false);
      if (!disposed && trigger.isConnected && !trigger.hidden) trigger.focus();
    }
    function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); }
    async function read() {
      feedback.append(createLoadingState({ label: "Chargement de tes listes…" }));
      try {
        targets = (await loadLists({ signal: requestSignal })).filter(item => !item.isArchived && !item.isSuspended);
        if (disposed || closed || requestSignal.aborted) return;
        clearFeedback(); eligible = targets.length > 0; sync();
        if (!eligible) { feedback.textContent = "Aucune liste disponible."; cancel.textContent = "Fermer"; submit.hidden = true; return; }
        const placeholder = document.createElement("option"); placeholder.textContent = "Choisir une liste"; placeholder.value = ""; select.append(placeholder);
        for (const target of targets) {
          const option = document.createElement("option"); option.textContent = target.name; option.value = target.id; select.append(option);
        }
        if (targets.length === 1) select.value = targets[0].id;
        field.hidden = false; submit.disabled = !select.value;
      } catch (error) {
        if (disposed || closed || isAbortError(error)) return;
        clearFeedback(); feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
      }
    }
    async function save() {
      const selected = targets.find(item => item.id === select.value);
      if (disposed || closed || saving || uncertain || !selected) return;
      saving = true; select.disabled = true; cancel.disabled = true; submit.disabled = true;
      modal.setAttribute("aria-busy", "true"); setButtonLoading(submit, true); clearFeedback();
      try {
        await copy(selected.id, wishId, { signal: requestSignal });
        if (disposed || closed || requestSignal.aborted) return;
        notice.append(document.createTextNode("Souhait ajouté. "), createActionLink({ label: "Voir ma liste", href: `/lists/${selected.id}` }));
        notice.hidden = false;
        saving = false; finish();
      } catch (error) {
        if (disposed || closed || isAbortError(error)) return;
        uncertain = !(error instanceof ApiError) || error.kind !== "http" || error.statusCode === null || error.statusCode >= 500;
        clearFeedback();
        if (error instanceof ApiError && (error.errorCode === "SHARED_WISH_NOT_FOUND" || error.errorCode === "SHARED_WISHLIST_NOT_FOUND")) {
          saving = false; finish(); onUnavailable(); return;
        }
        feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
        if (uncertain) {
          const warning = document.createElement("p"); warning.textContent = "L’ajout ne peut pas être confirmé. Consulte ta liste avant de réessayer.";
          feedback.append(warning, createActionLink({ label: "Consulter ma liste", href: `/lists/${selected.id}` }));
        }
        // A failed destination may have been archived, deleted or suspended since opening.
        targets = targets.filter(item => item.id !== selected.id);
        submit.disabled = true; submit.hidden = true; cancel.textContent = "Fermer";
      } finally {
        if (!disposed && !closed) {
          saving = false; cancel.disabled = false; modal.setAttribute("aria-busy", "false"); setButtonLoading(submit, false); submit.disabled = true;
        }
      }
    }
  }
}
