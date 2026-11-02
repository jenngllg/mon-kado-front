import { createButton } from "../../components/button.js";
import { addComponentEventListener, disposeComponent, registerComponentCleanup } from "../../components/componentLifecycle.js";
import closeIcon from "../../assets/icons/x-mark.svg?raw";

/** @typedef {{id:string, displayName:string, displayNameTag:string, occurredAt:string, kind:string, activity:string, memberId?:string, actorMemberId?:string|null, actorDisplayName?:string|null, isImpersonated?:boolean, logLevel?:"info"|"error", payload?:unknown}} ActivityEvent */

/** @param {string} timestamp Server instant. @returns {string} Timestamp with milliseconds and explicit zone. */
export function activityTimestamp(timestamp) { return new Date(timestamp).toISOString().replace("T", " ").replace("Z", " UTC"); }

/** @param {ActivityEvent} item Authorized event. @returns {string} Real author, including impersonation. */
export function activityAuthor(item) { return item.isImpersonated ? `Simulation par ${item.actorDisplayName ?? "un administrateur supprimé"}` : "Action de l’utilisateur"; }

/** @param {ActivityEvent} item Authorized event. @returns {HTMLElement} Named severity badge. */
export function activityLevel(item) {
  const badge = node("span", item.logLevel === "error" ? "ERROR" : "INFO"); badge.className = `activity-level activity-level--${item.logLevel ?? "info"}`;
  badge.setAttribute("aria-label", `Niveau : ${item.logLevel === "error" ? "Erreur" : "Information"}`); return badge;
}

/** Opens an authorized event as fields or JSON without another request.
 * @param {HTMLElement} owner Private journal lifetime.
 * @param {ActivityEvent} item Sanitized server document.
 * @param {HTMLButtonElement} trigger Return-focus target.
 */
export function openActivityDocument(owner, item, trigger) {
  if (owner.querySelector(".activity-document")) return;
  const dialog = node("dialog", ""); dialog.className = "activity-document";
  const title = node("h2", "Détail de l’événement"); title.id = `activity-document-${crypto.randomUUID()}`;
  dialog.setAttribute("aria-labelledby", title.id);
  const header = node("div", ""); header.className = "activity-document__header";
  const close = createButton({ label: "Fermer l’événement", variant: "secondary", onClick: finish });
  close.classList.add("activity-document__close"); close.setAttribute("aria-label", "Fermer l’événement");
  const icon = new DOMParser().parseFromString(closeIcon, "image/svg+xml").documentElement;
  icon.setAttribute("focusable", "false"); close.replaceChildren(icon); header.append(title, close);
  const summary = node("div", ""); summary.className = "activity-document__summary";
  const timestamp = node("time", activityTimestamp(item.occurredAt)); timestamp.dateTime = item.occurredAt;
  summary.append(activityLevel(item), timestamp, node("strong", item.activity), node("span", `${item.displayName} #${item.displayNameTag}`), node("span", activityAuthor(item)));
  const modes = node("div", ""); modes.className = "activity-document__modes"; modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "Affichage de l’événement");
  const fields = node("dl", ""); fields.className = "activity-document__fields";
  const source = JSON.stringify(item, null, 2);
  const json = node("pre", source); json.className = "activity-document__json"; json.tabIndex = 0; json.setAttribute("aria-label", "Document JSON complet"); json.hidden = true;
  for (const [key, value] of Object.entries(item)) {
    const row = node("div", ""); row.append(node("dt", key)); const detail = node("dd", "");
    if (value !== null && typeof value === "object") { const content = node("pre", JSON.stringify(value, null, 2)); content.tabIndex = 0; detail.append(content); }
    else detail.textContent = value === null ? "null" : String(value);
    row.append(detail); fields.append(row);
  }
  const fieldsButton = createButton({ label: "Champs", variant: "secondary", onClick: () => show(false) });
  const jsonButton = createButton({ label: "JSON", variant: "secondary", onClick: () => show(true) });
  const copied = node("p", ""); copied.setAttribute("role", "status"); copied.className = "activity-document__copy-status";
  let disposed = false;
  const copy = createButton({ label: "Copier le JSON", variant: "secondary", onClick: () => { void copyDocument(); } });
  modes.append(fieldsButton, jsonButton, copy); dialog.append(header, summary, modes, copied, fields, json);
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); finish(); });
  addComponentEventListener(dialog, dialog, "close", finish);
  registerComponentCleanup(dialog, () => { disposed = true; if (dialog.open) dialog.close(); fields.replaceChildren(); json.textContent = ""; dialog.remove(); });
  owner.append(dialog); show(false); dialog.showModal(); close.focus();

  /** @param {boolean} useJSON Selected display mode. */
  function show(useJSON) { fields.hidden = useJSON; json.hidden = !useJSON; fieldsButton.setAttribute("aria-pressed", String(!useJSON)); jsonButton.setAttribute("aria-pressed", String(useJSON)); }
  function finish() { disposeComponent(dialog); if (trigger.isConnected) trigger.focus(); }
  async function copyDocument() {
    copy.disabled = true;
    try { await navigator.clipboard.writeText(source); if (!disposed) copied.textContent = "JSON copié."; }
    catch { if (!disposed) copied.textContent = "Copie indisponible. Sélectionne le texte dans la vue JSON."; }
    finally { if (!disposed) copy.disabled = false; }
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Native tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Element. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
