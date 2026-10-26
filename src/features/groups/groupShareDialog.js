import { ApiError, isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { createLocalQrCode } from "../twoFactor/localQrCode.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Share admission credentials only after an explicit member action.
 * @param {{parent:HTMLElement,trigger:HTMLButtonElement,signal:AbortSignal,groupId:string,owner:boolean,
 * service:Pick<ReturnType<typeof import("./groupsService.js").createGroupsService>,"joinLink"|"createJoinLink"|"revokeJoinLink">,
 * copy?:(text:string)=>Promise<void>}} options Scoped operations.
 */
export function openGroupShareDialog({ parent, trigger, signal, groupId, owner, service, copy = text => navigator.clipboard.writeText(text) }) {
  if (signal.aborted || parent.querySelector(".group-share-dialog")) return;
  const dialog = node("dialog", ""); dialog.className = "group-dialog group-share-dialog flow";
  const title = node("h2", "Partager le groupe"); title.id = `group-share-${crypto.randomUUID()}`; dialog.setAttribute("aria-labelledby", title.id);
  const content = node("div", ""); content.className = "flow";
  const feedback = node("div", ""); feedback.setAttribute("role", "status");
  const actions = node("div", ""); actions.className = "cluster";
  const closeButton = createButton({ label: "Fermer", variant: "secondary", onClick: close }); actions.append(closeButton);
  const lifetime = new AbortController(), combined = AbortSignal.any([signal, lifetime.signal]);
  let disposed = false, pending = false;
  /** @type {{link:import("./groupsService.js").GroupJoinLink,etag:string}|null} */ let current = null;
  dialog.append(title, content, feedback, actions);
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); close(); });
  addComponentEventListener(dialog, dialog, "close", close);
  addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true });
  registerComponentCleanup(dialog, () => { disposed = true; lifetime.abort(); current = null; clear(content); clear(feedback); if (dialog.open) dialog.close(); dialog.remove(); trigger.disabled = signal.aborted; });
  parent.append(dialog); trigger.disabled = true; dialog.showModal(); closeButton.focus(); void read();
  function close() { if (pending || disposed) return; disposeComponent(dialog); if (!signal.aborted && trigger.isConnected) trigger.focus(); }
  function busy() { closeButton.disabled = pending; for (const button of content.querySelectorAll("button")) button.disabled = pending; dialog.setAttribute("aria-busy", String(pending)); }
  async function read() {
    clear(content); clear(feedback); content.append(createLoadingState({ label: "Chargement du partage…" }));
    try { const result = await service.joinLink(groupId, { signal: combined }); if (!combined.aborted) { current = result; render(); } }
    catch (error) {
      if (combined.aborted || isAbortError(error)) return;
      clear(content);
      if (error instanceof ApiError && error.statusCode === 404 && error.errorCode === "GROUP_JOIN_LINK_NOT_FOUND") inactive();
      else { feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" })); content.append(createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(); } })); }
    }
  }
  function inactive() {
    content.append(node("p", "Un lien, un code ou un QR code pour rejoindre le groupe sans validation."), createButton({ label: "Activer le partage", onClick: () => { void mutate(false); } }));
  }
  function render() {
    clear(content); if (!current) { inactive(); return; }
    content.append(node("p", "Partage ce QR code, le lien ou le code du groupe. La personne connectée rejoint le groupe sans validation."));
    const qr = createLocalQrCode(current.link.joinUrl); qr.setAttribute("aria-label", "QR code pour rejoindre le groupe"); qr.classList.add("group-share-qr"); content.append(qr);
    for (const [label, value, command] of [["Lien du groupe", current.link.joinUrl, "Copier le lien"], ["Code du groupe", current.link.code.match(/.{4}/g)?.join("-") ?? current.link.code, "Copier le code"]]) {
      const control = document.createElement("input"); control.readOnly = true; control.value = value; control.spellcheck = false;
      const field = createFormField({ label, control }); field.classList.add("group-share-field");
      field.classList.toggle("group-share-field--code", command === "Copier le code");
      const button = createButton({ label: command, variant: "secondary", onClick: () => { void copyValue(value); } }); applyActionIcon(button, "copy", command); field.append(button); content.append(field);
    }
    if (owner) content.append(createButton({ label: "Désactiver le lien et le code", variant: "secondary", onClick: () => { void mutate(true); } }));
  }
  /** @param {string} value Copy only on an explicit action, without remote QR providers. */
  async function copyValue(value) {
    if (disposed || pending) return;
    try { await copy(value); if (!combined.aborted) { clear(feedback); feedback.textContent = "Copié !"; } }
    catch { if (!combined.aborted) { clear(feedback); feedback.textContent = "La copie a échoué. Tu peux sélectionner le texte."; } }
  }
  /** @param {boolean} revoke Explicit versioned mutation. */
  async function mutate(revoke) {
    if (pending || disposed || (revoke && !current)) return;
    pending = true; clear(feedback); busy();
    try {
      if (revoke && current) { await service.revokeJoinLink(groupId, { etag: current.etag, signal: combined }); if (!combined.aborted) current = null; }
      else { const result = await service.createJoinLink(groupId, { signal: combined }); if (!combined.aborted) current = result; }
      if (!combined.aborted) render();
    } catch (error) {
      if (combined.aborted || isAbortError(error)) return;
      // Verify an uncertain result once with a read; never replay the mutation.
      await read();
      if (!combined.aborted) feedback.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
    } finally { pending = false; if (!disposed) busy(); }
  }
}
/** @param {HTMLElement} element Owned content. */
function clear(element) { disposeComponent(element); element.replaceChildren(); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag @param {string} copy */
function node(tag, copy) { const element = document.createElement(tag); element.textContent = copy; return element; }
