import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

const StatusLabels = Object.freeze({ active: "Active", cancelled: "Annulée", unavailable: "Indisponible" });
const DateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Member-only history; the router owns identity changes and initial focus.
 * @param {{load: import("./reservationHistoryService.js").LoadReservationHistory, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLElement} Disposable routed view.
 */
export function createReservationHistoryView({ load, signal }) {
  const view = node("section", ""); view.className = "reservation-history-view flow";
  const title = node("h1", "Mes réservations"); title.tabIndex = -1;
  const refresh = createButton({ label: "Actualiser mes réservations", variant: "secondary", onClick: () => { void read(true); } });
  const results = node("div", ""); results.className = "flow";
  view.append(title, node("p", "Retrouve les réservations liées à ton compte et leur historique."),
    node("p", "Chaque entrée présente la dernière quantité et l’état d’une réservation, pas le détail de chacune de ses modifications. Les dates sont affichées en UTC."),
    node("p", "Pour consulter un cadeau ou gérer ta réservation, rouvre le lien de partage reçu. L’historique ne donne pas, à lui seul, accès à la liste."), refresh, results);
  const lifetime = new AbortController(); let disposed = false, busy = false;
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); clear(); refresh.disabled = true; });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (!disposed) void read(false);
  return view;

  function clear() { disposeComponent(results); results.replaceChildren(); }
  /** @param {boolean} explicit User-requested refresh or retry. */
  async function read(explicit) {
    if (disposed || busy) return;
    busy = true; refresh.disabled = true; clear(); results.setAttribute("aria-busy", "true");
    results.append(createLoadingState({ label: "Chargement de tes réservations…" }));
    try {
      const page = await load({ signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      clear();
      if (page.totalCount === 0) results.append(createEmptyState({ title: "Tu n’as pas encore de réservation dans ton historique", message: "Les réservations liées à ton compte apparaîtront ici." }));
      else {
        results.append(node("p", `${page.items.length} réservation${page.items.length > 1 ? "s" : ""} affichée${page.items.length > 1 ? "s" : ""} sur ${page.totalCount}.`));
        if (page.totalCount > page.items.length) results.append(node("p", "Les 20 entrées les plus récentes sont présentées. La navigation dans la suite de l’historique sera disponible prochainement."));
        const collection = node("ul", ""); collection.className = "wishlists-grid"; collection.setAttribute("role", "list");
        for (const item of page.items) {
          const card = node("li", ""); card.className = "wishlist-card reservation-history-card flow";
          card.append(node("h2", item.wishName), node("p", `Liste : ${item.wishlistName}`), node("p", `Statut : ${StatusLabels[item.status]}`), node("p", `Dernière quantité réservée : ${item.quantity}`));
          appendDate(card, "Réservée le", item.createdAt); appendDate(card, "Dernière activité", item.lastActivityAt);
          if (item.endedAt) appendDate(card, "Terminée le", item.endedAt);
          if (item.status === "unavailable") card.append(node("p", "Cette réservation n’est plus disponible. Son historique reste conservé."));
          collection.append(card);
        }
        results.append(collection);
      }
      if (explicit) title.focus();
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      clear(); const translated = toUserFacingError(error), extra = [];
      const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
      if (correlation) extra.push(`Référence : ${correlation}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const alert = createAlert({ ...translated, detail: extra.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      results.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } }));
      if (explicit) alert.focus();
    } finally { busy = false; if (!disposed) { results.setAttribute("aria-busy", "false"); refresh.disabled = false; } }
  }
}
/** @param {HTMLElement} parent Card. @param {string} label Date label. @param {string} value UTC timestamp. */
function appendDate(parent, label, value) { const line = node("p", `${label} : `), time = node("time", `${DateFormat.format(new Date(value))} UTC`); time.dateTime = value; line.append(time); parent.append(line); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
