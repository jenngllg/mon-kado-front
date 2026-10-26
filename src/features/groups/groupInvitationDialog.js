import { ApiError, isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Searches only inside the modal and sends one explicitly selected invitation.
 * @param {{parent:HTMLElement,trigger:HTMLButtonElement,signal:AbortSignal,
 * search:import("../members/memberSearchService.js").SearchMembers,
 * invite:(id:string,signal:AbortSignal)=>Promise<unknown>,onRefresh:()=>Promise<void>}} options
 */
export function openGroupInvitationDialog({ parent, trigger, signal, search, invite, onRefresh }) {
  const dialog = document.createElement("dialog"); dialog.className = "group-dialog group-invite-search flow";
  const title = document.createElement("h2"); title.textContent = "Inviter un proche"; title.id = `group-invite-${crypto.randomUUID()}`;
  dialog.setAttribute("aria-labelledby", title.id);
  const form = document.createElement("form"); form.className = "group-search-form";
  const input = document.createElement("input"); input.type = "search"; input.required = true; input.maxLength = 85;
  const submit = createButton({ label: "Rechercher", type: "submit", variant: "secondary" });
  form.append(createFormField({ label: "Pseudo ou pseudo#1234", control: input, required: true }), submit);
  const results = document.createElement("div"); results.className = "flow"; results.setAttribute("aria-live", "polite");
  const feedback = document.createElement("div"); feedback.setAttribute("role", "alert");
  const actions = document.createElement("div"); actions.className = "cluster";
  const closeButton = createButton({ label: "Fermer", variant: "secondary", onClick: close }); actions.append(closeButton);
  const lifetime = new AbortController(), combined = AbortSignal.any([signal, lifetime.signal]);
  let reading = false, pending = false, blocked = false, disposed = false, changed = false, currentPage = 1;
  dialog.append(title, form, results, feedback, actions);
  addComponentEventListener(dialog, form, "submit", event => { event.preventDefault(); currentPage = 1; void read(); });
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); close(); });
  addComponentEventListener(dialog, dialog, "close", close);
  addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true });
  registerComponentCleanup(dialog, () => { disposed = true; lifetime.abort(); if (dialog.open) dialog.close(); dialog.remove(); });
  if (signal.aborted) { disposeComponent(dialog); return; }
  parent.append(dialog); dialog.showModal(); input.focus();

  function close() {
    if (pending || disposed) return;
    disposeComponent(dialog); if (trigger.isConnected) trigger.focus();
    if (changed && !signal.aborted) void onRefresh();
  }
  function sync() {
    if (disposed) return;
    const locked = reading || pending || blocked;
    input.disabled = submit.disabled = locked; closeButton.disabled = pending;
    for (const button of results.querySelectorAll("button")) {
      if (locked) { if (!button.disabled) button.dataset.inviteBusy = "true"; button.disabled = true; }
      else if (button.dataset.inviteBusy === "true") { button.disabled = false; delete button.dataset.inviteBusy; }
    }
    dialog.setAttribute("aria-busy", String(reading || pending));
  }
  async function read() {
    if (reading || pending || blocked || combined.aborted || !input.value.trim()) return;
    reading = true; clear(results); clear(feedback); results.append(createLoadingState({ label: "Recherche en cours…" })); sync();
    try {
      const page = await search(input.value, { page: currentPage, signal: combined });
      if (combined.aborted) return;
      clear(results);
      for (const member of page.items) {
        const row = document.createElement("div"); row.className = "group-invitation";
        const name = document.createElement("span"); name.textContent = `${member.displayName}#${member.displayNameTag ?? ""}`;
        row.append(name, createButton({ label: `Inviter ${member.displayName}`, onClick: () => { void send(member.id); } })); results.append(row);
      }
      if (!page.items.length) { const empty = document.createElement("p"); empty.textContent = "Aucun membre trouvé."; results.append(empty); }
      const nav = document.createElement("nav"); nav.className = "cluster"; nav.setAttribute("aria-label", "Pagination"); nav.hidden = Math.ceil(page.totalCount / page.pageSize) < 2;
      const previous = createButton({ label: "Précédente", variant: "secondary", onClick: () => { currentPage--; void read(); } }); previous.disabled = currentPage <= 1;
      const next = createButton({ label: "Suivante", variant: "secondary", onClick: () => { currentPage++; void read(); } }); next.disabled = currentPage >= Math.ceil(page.totalCount / page.pageSize);
      nav.append(previous, next); results.append(nav);
    } catch (error) { if (!combined.aborted && !isAbortError(error)) { clear(results); feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" })); } }
    finally { reading = false; sync(); }
  }
  /** @param {string} id */
  async function send(id) {
    if (reading || pending || blocked || combined.aborted) return;
    pending = true; changed = true; clear(feedback); sync();
    try { await invite(id, combined); if (!combined.aborted) { pending = false; close(); } }
    catch (error) {
      if (combined.aborted || isAbortError(error)) return;
      feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
      blocked = !(error instanceof ApiError && error.kind === "http" && error.statusCode !== null && [400, 409, 422].includes(error.statusCode));
      if (blocked) { const notice = document.createElement("p"); notice.textContent = "Ferme cette fenêtre pour vérifier les invitations avant de recommencer."; feedback.append(notice); }
    } finally { pending = false; sync(); }
  }
}

/** @param {HTMLElement} element */
function clear(element) { disposeComponent(element); element.replaceChildren(); }
