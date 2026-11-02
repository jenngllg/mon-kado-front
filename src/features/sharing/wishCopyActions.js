import { ApiError, isAbortError } from "../../api/apiError.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** @typedef {{loadLists: import("../wishlists/wishlistsService.js").LoadWishlists,
 * copy: (wishlistId: string, wishId: string, options: {signal: AbortSignal}) => Promise<import("../wishes/wishesService.js").CreatedWish>}} WishCopyOperations */

/** Owns one eligible-list read per screen and the common explicit-copy dialog.
 * @param {WishCopyOperations & {signal: AbortSignal, onUnavailable: () => void, onBusy?: (busy: boolean) => void, excludeWishlistId?: string, actionLabel?: string, returnFocus?: () => HTMLElement | null}} options Private operations.
 */
export function createWishCopyActions({ loadLists, copy, signal, onUnavailable, onBusy = () => {}, excludeWishlistId, actionLabel = "Je le veux aussi !", returnFocus }) {
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
      eligible = lists.some(isEligible); sync();
    } catch { if (!disposed) { eligible = false; sync(); } }
  }
  /** @param {string} wishId Source. @param {boolean} [compact] Gallery icon. @returns {HTMLButtonElement} Initially hidden action. */
  function button(wishId, compact = false) {
    const control = createButton({ label: actionLabel, variant: "secondary", onClick: () => open(wishId, control) });
    if (compact) { applyActionIcon(control, "copy", "Je le veux aussi !"); control.classList.add("wish-gallery__copy"); }
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
    const title = document.createElement("h2"); title.textContent = actionLabel; title.tabIndex = -1;
    title.id = `wish-copy-${crypto.randomUUID()}`; modal.setAttribute("aria-labelledby", title.id);
    const content = document.createElement("div"); content.className = "flow";
    const feedback = document.createElement("div"); feedback.setAttribute("role", "status");
    const field = document.createElement("fieldset"); field.className = "wish-copy-choices flow"; field.hidden = true;
    const legend = document.createElement("legend"); legend.textContent = "Dans quelles listes ?"; field.append(legend);
    const form = document.createElement("form"); form.className = "flow";
    const actions = document.createElement("div"); actions.className = "cluster";
    const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: finish });
    const submit = createButton({ label: "Ajouter", type: "submit" }); submit.disabled = true;
    actions.append(cancel, submit); form.append(field, feedback, actions); content.append(title, form); modal.append(content);
    const request = new AbortController();
    const requestSignal = AbortSignal.any([lifetime.signal, request.signal]);
    let saving = false, uncertain = false, closed = false, failed = false;
    /** @type {ReadonlyArray<import("../wishlists/wishlistsService.js").Wishlist>} */ let targets = [];
    registerComponentCleanup(modal, () => {
      closed = true; request.abort(); targets = []; if (modal.open) modal.close(); modal.remove();
      if (dialog === modal) dialog = null;
    });
    addComponentEventListener(modal, modal, "cancel", event => { event.preventDefault(); finish(); });
    addComponentEventListener(modal, modal, "close", finish);
    addComponentEventListener(modal, field, "change", () => { submit.disabled = saving || failed || !field.querySelector("input:checked"); });
    addComponentEventListener(modal, form, "submit", event => { event.preventDefault(); void save(); });
    host.append(modal); modal.showModal(); title.focus(); void read();

    function finish() {
      if (saving || closed) return;
      disposeComponent(modal); sync(); onBusy(false);
      const target = returnFocus?.() ?? trigger;
      if (!disposed && target.isConnected && !target.hidden) target.focus();
    }
    function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); }
    async function read() {
      feedback.append(createLoadingState({ label: "Chargement de tes listes…" }));
      try {
        targets = (await loadLists({ signal: requestSignal })).filter(isEligible);
        if (disposed || closed || requestSignal.aborted) return;
        clearFeedback(); eligible = targets.length > 0; sync();
        if (!eligible) { feedback.textContent = "Aucune liste disponible."; cancel.textContent = "Fermer"; submit.hidden = true; return; }
        for (const target of targets) {
          const label = document.createElement("label"); label.className = "wish-copy-choice";
          const input = document.createElement("input"); input.type = "checkbox"; input.name = "lists"; input.value = target.id; input.checked = targets.length === 1;
          const name = document.createElement("span"); name.textContent = target.name;
          label.append(input, name); field.append(label);
        }
        field.hidden = false; submit.disabled = !field.querySelector("input:checked");
      } catch (error) {
        if (disposed || closed || isAbortError(error)) return;
        clearFeedback(); feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
      }
    }
    async function save() {
      const checked = new Set([...field.querySelectorAll("input")].filter(input => input.checked).map(input => input.value));
      const selected = targets.filter(item => checked.has(item.id));
      if (disposed || closed || saving || failed || !selected.length) return;
      saving = true; field.disabled = true; cancel.disabled = true; submit.disabled = true;
      modal.setAttribute("aria-busy", "true"); setButtonLoading(submit, true); clearFeedback();
      /** @type {typeof targets[number][]} */ const completed = [];
      let current = selected[0];
      try {
        for (const target of selected) {
          if (disposed || closed || requestSignal.aborted) return;
          current = target;
          await copy(target.id, wishId, { signal: requestSignal });
          if (disposed || closed || requestSignal.aborted) return;
          completed.push(target);
        }
        notice.append(document.createTextNode(completed.length === 1 ? "Souhait ajouté. " : `Souhait ajouté à ${completed.length} listes. `));
        for (const target of completed) notice.append(createActionLink({ label: completed.length === 1 ? "Voir ma liste" : target.name, href: `/lists/${target.id}` }), document.createTextNode(" "));
        notice.hidden = false;
        saving = false; finish();
      } catch (error) {
        if (disposed || closed || isAbortError(error)) return;
        failed = true;
        uncertain = !(error instanceof ApiError) || error.kind !== "http" || error.statusCode === null || error.statusCode >= 500;
        clearFeedback();
        if (completed.length) {
          const message = `Ajout confirmé dans : ${completed.map(item => item.name).join(", ")}.`;
          notice.textContent = message; notice.hidden = false;
          const confirmed = document.createElement("p"); confirmed.textContent = message; feedback.append(confirmed);
        }
        if (error instanceof ApiError && (error.errorCode === "SHARED_WISH_NOT_FOUND" || error.errorCode === "SHARED_WISHLIST_NOT_FOUND" || error.errorCode === "GROUP_WISHLIST_NOT_FOUND")) {
          saving = false; finish(); onUnavailable(); return;
        }
        feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
        if (uncertain) {
          const warning = document.createElement("p"); warning.textContent = `L’ajout ne peut pas être confirmé dans « ${current.name} ». Consulte ta liste avant de réessayer.`;
          feedback.append(warning, createActionLink({ label: "Consulter ma liste", href: `/lists/${current.id}` }));
        } else {
          const failure = document.createElement("p"); failure.textContent = `Le souhait n’a pas été ajouté à « ${current.name} ».`; feedback.append(failure);
        }
        const remaining = selected.slice(completed.length + 1);
        if (remaining.length) {
          const pending = document.createElement("p"); pending.textContent = `Listes non traitées : ${remaining.map(item => item.name).join(", ")}.`; feedback.append(pending);
        }
        // Never replay successful or uncertain writes after a partial batch failure.
        submit.disabled = true; submit.hidden = true; cancel.textContent = "Fermer";
      } finally {
        if (!disposed && !closed) {
          saving = false; cancel.disabled = false; modal.setAttribute("aria-busy", "false"); setButtonLoading(submit, false); submit.disabled = true;
        }
      }
    }
  }
  /** @param {import("../wishlists/wishlistsService.js").Wishlist} item Current destination. */
  function isEligible(item) { return item.id.toLowerCase() !== excludeWishlistId?.toLowerCase() && !item.isArchived && !item.isSuspended; }
}
