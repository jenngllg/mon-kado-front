import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { activityAuthor, activityLevel, activityTimestamp, openActivityDocument } from "./activityDocument.js";

/** @typedef {import('./activityDocument.js').ActivityEvent} ActivityEvent */
/** @typedef {{items:ActivityEvent[],currentPage:number,totalPages:number,totalCount:number,hasPreviousPage:boolean,hasNextPage:boolean}} ActivityPage */

const columns = [
  { key: "logLevel", label: "Niveau", selected: true }, { key: "kind", label: "Type", selected: false },
  { key: "member", label: "Membre", selected: true }, { key: "actor", label: "Auteur réel", selected: true },
  { key: "payload", label: "Payload", selected: false },
];

/** Display the private activity journal as a document explorer.
 * @param {import("../../auth/sessionManager.js").SessionManager} session Authenticated transport.
 * @param {AbortSignal} signal Route lifetime.
 * @returns {HTMLElement} Disposable journal.
 */
export function createActivityView(session, signal) {
  const view = node("section", ""); view.className = "activity-view flow";
  const title = node("h1", "Activité des membres");
  const form = node("form", ""); form.className = "activity-filters"; form.setAttribute("aria-label", "Filtrer le journal");
  const search = node("input", ""); search.type = "search"; search.maxLength = 100;
  const kind = select([["", "Tout"], ["pageVisit", "Visites"], ["action", "Actions"]]);
  const level = select([["", "Tous les niveaux"], ["info", "Information"], ["error", "Erreur"]]);
  form.append(createFormField({ label: "Membre, activité ou payload", control: search }), createFormField({ label: "Type", control: kind }), createFormField({ label: "Niveau de log", control: level }), createButton({ label: "Filtrer", type: "submit" }));
  const workspace = node("div", ""); workspace.className = "activity-workspace";
  const fieldPicker = node("details", ""); fieldPicker.className = "activity-columns"; fieldPicker.open = window.matchMedia("(min-width: 70rem)").matches;
  fieldPicker.append(node("summary", "Colonnes affichées"));
  const selected = new Set(columns.filter(column => column.selected).map(column => column.key));
  for (const column of columns) {
    const label = node("label", ""); const input = node("input", ""); input.type = "checkbox"; input.checked = selected.has(column.key);
    label.append(input, node("span", column.label)); fieldPicker.append(label);
    addComponentEventListener(view, input, "change", () => { if (input.checked) selected.add(column.key); else selected.delete(column.key); syncColumns(); });
  }
  const results = node("div", ""); results.className = "activity-results";
  const announcement = node("p", ""); announcement.className = "visually-hidden"; announcement.setAttribute("role", "status");
  workspace.append(fieldPicker, results); view.append(title, form, announcement, workspace);
  let page = 1, disposed = false;
  /** @type {AbortController | null} */ let pending = null;
  addComponentEventListener(view, form, "submit", event => { event.preventDefault(); page = 1; void read(); });
  registerComponentCleanup(view, () => { disposed = true; pending?.abort(); clear(); announcement.textContent = ""; });
  addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
  if (!signal.aborted) void read(); else disposeComponent(view);
  return view;

  function clear() {
    const detail = view.querySelector(".activity-document"); if (detail instanceof HTMLElement) disposeComponent(detail);
    disposeComponent(results); results.replaceChildren();
  }
  function syncColumns() {
    for (const column of columns) results.querySelectorAll(`[data-column="${column.key}"]`).forEach(cell => { if (cell instanceof HTMLElement) cell.hidden = !selected.has(column.key); });
  }
  async function read() {
    pending?.abort(); const operation = new AbortController(); pending = operation;
    clear(); results.setAttribute("aria-busy", "true"); announcement.textContent = "";
    results.append(createLoadingState({ label: "Chargement de l’activité…" }));
    const query = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search.value.trim()) query.set("q", search.value.trim());
    if (kind.value) query.set("kind", kind.value);
    if (level.value) query.set("logLevel", level.value);
    try {
      const response = await session.request(`/api/v1/admin/member-activity-events?${query}`, { method: "GET", authentication: "required", signal: operation.signal });
      if (disposed || operation.signal.aborted) return;
      const data = /** @type {ActivityPage | null} */ (response.data);
      if (response.status !== 200 || !validPage(data)) throw new Error("Invalid activity response");
      clear(); page = data.currentPage;
      const count = `${data.totalCount} résultat${data.totalCount === 1 ? "" : "s"}`;
      const heading = node("div", ""); heading.className = "activity-results__heading";
      heading.append(node("strong", count), node("span", data.totalPages ? `Page ${data.currentPage} sur ${data.totalPages}` : "")); results.append(heading); announcement.textContent = count;
      if (!data.items.length) results.append(node("p", "Aucune activité ne correspond à ces filtres.")); else renderTable(data.items);
      const pagination = node("nav", ""); pagination.className = "activity-pagination"; pagination.setAttribute("aria-label", "Pages du journal");
      pagination.append(createButton({ label: "Précédent", variant: "secondary", disabled: !data.hasPreviousPage, onClick: () => { page--; void read(); } }), createButton({ label: "Suivant", variant: "secondary", disabled: !data.hasNextPage, onClick: () => { page++; void read(); } }));
      results.append(pagination); syncColumns();
    } catch {
      if (disposed || operation.signal.aborted) return;
      clear(); const error = node("p", "Impossible de charger l’activité."); error.setAttribute("role", "alert");
      results.append(error, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(); } }));
    } finally { if (!disposed && !operation.signal.aborted) results.setAttribute("aria-busy", "false"); }
  }

  /** @param {ActivityEvent[]} items One authorized page, in server order. */
  function renderTable(items) {
    const region = node("div", ""); region.className = "activity-table-region"; region.tabIndex = 0; region.setAttribute("role", "region"); region.setAttribute("aria-label", "Événements du journal, tableau défilant");
    const table = node("table", ""); table.className = "activity-table";
    const caption = node("caption", "Journal d’activité des membres"); caption.className = "visually-hidden";
    const head = node("thead", ""); const headings = node("tr", "");
    for (const [label, key] of [["Détail", ""], ["Timestamp (UTC)", ""], ["Niveau", "logLevel"], ["Activité", ""], ["Type", "kind"], ["Membre", "member"], ["Auteur réel", "actor"], ["Payload", "payload"]]) {
      const th = node("th", label); th.scope = "col"; if (key) th.dataset.column = key; headings.append(th);
    }
    head.append(headings); const body = node("tbody", "");
    for (const item of items) {
      const row = node("tr", ""); row.dataset.eventId = item.id;
      const details = createButton({ label: `Détails de l’événement « ${item.activity} »`, variant: "ghost", onClick: () => openActivityDocument(view, item, details) });
      details.setAttribute("aria-haspopup", "dialog"); applyActionIcon(details, "arrowRight", "Voir l’événement"); cell(row, details, "", "activity-table__command");
      const timestamp = node("time", activityTimestamp(item.occurredAt)); timestamp.dateTime = item.occurredAt; cell(row, timestamp, "", "activity-table__timestamp"); cell(row, activityLevel(item), "logLevel");
      const event = node("div", ""); event.className = "activity-table__event";
      event.append(node("strong", item.activity), node("small", item.kind === "pageVisit" ? "Visite" : "Action")); cell(row, event);
      cell(row, item.kind, "kind"); cell(row, `${item.displayName} #${item.displayNameTag}`, "member"); cell(row, activityAuthor(item), "actor");
      const preview = node("code", item.payload == null ? "null" : JSON.stringify(item.payload)); preview.className = "activity-table__preview"; cell(row, preview, "payload");
      body.append(row);
    }
    table.append(caption, head, body); region.append(table); results.append(region);
  }
}

/** @param {ActivityPage | null} data Untrusted transport value. @returns {data is ActivityPage} Valid page. */
function validPage(data) {
  return !!data && Array.isArray(data.items) &&
    Number.isInteger(data.currentPage) && data.currentPage >= 1 && Number.isInteger(data.totalPages) && data.totalPages >= 0 &&
    Number.isInteger(data.totalCount) && data.totalCount >= 0 && typeof data.hasPreviousPage === "boolean" && typeof data.hasNextPage === "boolean" &&
    data.items.every(item => item && typeof item.id === "string" && typeof item.displayName === "string" && typeof item.displayNameTag === "string" &&
      typeof item.activity === "string" && ["action", "pageVisit"].includes(item.kind) && typeof item.occurredAt === "string" && Number.isFinite(Date.parse(item.occurredAt)) &&
      (item.logLevel === undefined || item.logLevel === "info" || item.logLevel === "error") &&
      (item.isImpersonated === undefined || typeof item.isImpersonated === "boolean") &&
      (item.memberId === undefined || typeof item.memberId === "string") &&
      (item.actorMemberId == null || typeof item.actorMemberId === "string") &&
      (item.actorDisplayName == null || typeof item.actorDisplayName === "string"));
}
/** @param {HTMLTableRowElement} row Parent. @param {string | HTMLElement} value Safe content. @param {string} [column] Optional column. @param {string} [className] Presentation. @returns {HTMLTableCellElement} Cell. */
function cell(row, value, column = "", className = "") { const result = node("td", ""); if (typeof value === "string") result.textContent = value; else result.append(value); if (column) result.dataset.column = column; result.className = className; row.append(result); return result; }
/** @param {string[][]} options Native options. @returns {HTMLSelectElement} Control. */
function select(options) { const control = node("select", ""); for (const [value, label] of options) { const option = node("option", label); option.value = value; control.append(option); } return control; }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Native tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Element. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
