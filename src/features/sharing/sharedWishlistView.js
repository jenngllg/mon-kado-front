import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { WishlistOccasions } from "../wishlists/wishlistValidation.js";
import { createWishCard } from "../wishes/wishCard.js";
import { createSharedWishQuantities } from "./sharedWishQuantities.js";

const DateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** Public collection; only its transport retains access to a bearer context.
 * @param {{shareLinkId: string, load: import("./sharedWishlistService.js").LoadSharedWishlist, signal?: AbortSignal, accessSignal?: AbortSignal,
 * createParticipation?: (options: {onUnavailable: () => void, signal: AbortSignal}) => HTMLElement}} options Dependencies.
 * @returns {HTMLElement} Disposable routed view.
 */
export function createSharedWishlistView({ shareLinkId, load, signal, accessSignal, createParticipation }) {
  const view = element("section", ""); view.className = "wishlist-details-view flow";
  const layout = element("div", ""); layout.className = "wishlist-details-layout";
  const information = element("section", ""); information.className = "wishlist-details-info flow";
  const title = element("h1", "Liste de cadeaux partagée"); title.tabIndex = -1;
  const details = element("div", ""); details.className = "flow";
  const gifts = element("section", ""); gifts.className = "wishlist-details-gifts flow";
  const results = element("div", ""); results.className = "flow";
  const filter = document.createElement("input"); filter.type = "checkbox";
  const filterLabel = element("label", ""); filterLabel.className = "shared-wishlist-filter cluster";
  filterLabel.append(filter, element("span", "Afficher uniquement les cadeaux disponibles"));
  const filterHelp = element("p", "Les cadeaux que tu as déjà réservés restent affichés, même si toute leur quantité est réservée.");
  filterHelp.id = `availability-help-${crypto.randomUUID()}`; filter.setAttribute("aria-describedby", filterHelp.id);
  const filterControls = element("div", ""); filterControls.className = "flow"; filterControls.hidden = true;
  filterControls.append(filterLabel, filterHelp);
  const resultStatus = element("p", ""); resultStatus.setAttribute("role", "status");
  gifts.append(element("h2", "Les cadeaux de cette liste"), filterControls, resultStatus, results); gifts.hidden = true;
  const refresh = createButton({ label: "Actualiser la liste", variant: "secondary", onClick: () => { void read(true); } }); refresh.hidden = true;
  information.append(title, details, refresh); layout.append(information, gifts);
  view.append(createActionLink({ label: "Retour à l’accueil", href: "/" }), layout);
  let disposed = false, busy = false, terminal = false;
  let availableOnly = false;
  addComponentEventListener(view, filter, "change", () => {
    if (disposed || busy || terminal) { filter.checked = availableOnly; return; }
    availableOnly = filter.checked; void read(true, true);
  });
  const lifetime = new AbortController();
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); clear(details); clear(results); title.textContent = ""; gifts.hidden = true; refresh.disabled = true; filter.disabled = true; filter.checked = false; availableOnly = false; resultStatus.textContent = ""; });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (accessSignal && !disposed) { addComponentEventListener(view, accessSignal, "abort", unavailable, { once: true }); if (accessSignal.aborted) unavailable(); }
  if (!disposed) void read(false);
  return view;

  /** @param {boolean} explicit User-initiated reread. @param {boolean} [filterChange] Keep focus on the filter after its activation. */
  async function read(explicit, filterChange = false) {
    if (disposed || busy || terminal) return;
    busy = true; clear(details); clear(results); gifts.hidden = filterControls.hidden; refresh.hidden = true; refresh.disabled = true; filter.disabled = true; resultStatus.textContent = "";
    title.textContent = "Liste de cadeaux partagée"; details.setAttribute("aria-busy", "true"); details.append(createLoadingState({ label: "Chargement de la liste…" }));
    try {
      const list = await load(shareLinkId, { signal: lifetime.signal, availableOnly });
      if (disposed || terminal || lifetime.signal.aborted) return;
      clear(details); title.textContent = list.name;
      details.append(element("p", `Une liste de ${list.ownerDisplayName}`), element("p", WishlistOccasions[list.occasion]));
      if (list.eventDate === null) details.append(element("p", "Sans date"));
      else { const date = element("time", DateFormat.format(new Date(list.eventDate + "T00:00:00Z"))); date.dateTime = list.eventDate; details.append(date); }
      if (list.message) { const message = element("p", list.message); message.className = "wishlist-details-note"; details.append(message); }
      gifts.hidden = false; filterControls.hidden = false;
      if (!list.wishes.length) results.append(createEmptyState({ title: availableOnly ? "Aucun cadeau ne correspond à ce filtre" : "Cette liste ne contient pas encore de cadeau", message: availableOnly ? "Décoche le filtre pour consulter tous les cadeaux de cette liste." : "Les idées cadeaux apparaîtront ici." }));
      else {
        const cards = element("ul", ""); cards.className = "wish-grid"; cards.setAttribute("role", "list");
        for (const wish of list.wishes) {
          const card = createWishCard(wish, false, { editable: false, detailHref: `/shared-wishlists/${shareLinkId}/wishes/${wish.id}` });
          const content = card.querySelector(".wish-card__content");
          content?.insertBefore(createSharedWishQuantities(wish), content.querySelector("a"));
          cards.append(card);
        }
        results.append(cards);
      }
      refresh.hidden = false;
      if (explicit) resultStatus.textContent = `${list.wishes.length} cadeau${list.wishes.length > 1 ? "x" : ""} affiché${list.wishes.length > 1 ? "s" : ""}.`;
      if (explicit && !filterChange) title.focus();
      if (createParticipation) details.append(createParticipation({ onUnavailable: unavailable, signal: lifetime.signal }));
    } catch (error) {
      if (disposed || terminal || isAbortError(error)) return;
      clear(details);
      if (error instanceof ApiError && error.statusCode === 404) {
        terminal = true; lifetime.abort(); gifts.hidden = true; title.textContent = "Lien de partage indisponible";
        details.append(element("p", "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."));
        if (explicit) title.focus();
      } else {
        const translated = toUserFacingError(error), extra = [];
        const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
        if (correlation) extra.push(`Référence : ${correlation}`);
        if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
        const alert = createAlert({ ...translated, detail: extra.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
        details.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } })); if (explicit) alert.focus();
      }
    } finally { busy = false; if (!disposed) { details.setAttribute("aria-busy", "false"); refresh.disabled = terminal; filter.disabled = terminal; if (filterChange && !terminal && resultStatus.textContent) filter.focus(); } }
  }
  function unavailable() {
    if (disposed || terminal) return;
    terminal = true; lifetime.abort(); clear(details); clear(results); gifts.hidden = true; refresh.hidden = true;
    title.textContent = "Lien de partage indisponible";
    details.append(element("p", "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."));
    title.focus();
  }
}
/** @param {"missing" | "invalid"} state Entry without usable credentials. @returns {HTMLElement} No-network state. */
export function createSharedWishlistEntryView(state) {
  const view = element("section", ""); view.className = "error-view flow";
  view.append(element("h1", state === "missing" ? "Rouvre le lien reçu" : "Lien de partage indisponible"),
    element("p", state === "missing" ? "Pour consulter cette liste, ouvre à nouveau le lien de partage qui t’a été envoyé." : "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."),
    createActionLink({ label: "Retour à l’accueil", href: "/" }));
  return view;
}
/** @param {HTMLElement} container Disposable subtree. */
function clear(container) { disposeComponent(container); container.replaceChildren(); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Element tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
