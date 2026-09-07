import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

const OccasionLabels = Object.freeze({ birthday: "Anniversaire", christmas: "Noël", wedding: "Mariage", birth: "Naissance", other: "Autre" });
const DateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Creates an owned-list overview with a fresh, view-owned read.
 * @param {{load: import("./wishlistsService.js").LoadWishlists, signal?: AbortSignal}} options Injectable read and route lifetime.
 * @returns {HTMLElement} Routed component.
 */
export function createWishlistsView({ load, signal }) {
  const view = textElement("section", "");
  view.className = "wishlists-view flow";
  const header = textElement("div", "");
  header.className = "wishlists-view__header";
  const introduction = textElement("div", "");
  introduction.className = "flow";
  const title = textElement("h1", "Mes listes");
  title.tabIndex = -1;
  introduction.append(title, textElement("p", "Retrouve tes listes et prépare tes prochains événements."));
  const create = createActionLink({ label: "Créer une liste", href: RoutePaths.NewList });
  create.classList.add("home-hero__primary-action");
  header.append(introduction, create);
  const results = textElement("div", "");
  results.className = "wishlists-view__results flow";
  view.append(header, results);
  const lifetime = new AbortController();
  let disposed = false;
  let busy = false;
  registerComponentCleanup(view, () => {
    disposed = true;
    lifetime.abort();
    results.replaceChildren();
    results.setAttribute("aria-busy", "false");
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void read(false);
  return view;

  /** @param {HTMLElement} content Owned result state. */
  function show(content) {
    disposeComponent(results);
    results.replaceChildren(content);
  }

  /** @param {boolean} focus Whether this is an explicit retry. */
  async function read(focus) {
    if (disposed || busy) return;
    busy = true;
    results.setAttribute("aria-busy", "true");
    show(createLoadingState({ label: "Chargement de tes listes…" }));
    try {
      const items = await load({ signal: lifetime.signal });
      if (disposed) return;
      if (items.length === 0) {
        show(createEmptyState({ title: "Tu n’as pas encore de liste", message: "Crée ta première liste pour réunir tes idées cadeaux." }));
      } else {
        const collection = textElement("ul", "");
        collection.className = "wishlists-grid";
        collection.setAttribute("role", "list");
        for (const item of items) collection.append(createCard(item));
        show(collection);
      }
      if (focus) title.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      const translated = toUserFacingError(error);
      const details = [];
      if (translated.correlationId) details.push("Référence : " + translated.correlationId);
      if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) {
        details.push("Réessaie dans " + translated.retryAfterSeconds + " seconde(s).");
      }
      const alert = createAlert({ variant: "error", title: translated.title, message: translated.message, detail: details.join(" ") || null });
      alert.tabIndex = -1;
      show(alert);
      results.append(createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } }));
      if (focus) alert.focus();
    } finally {
      busy = false;
      if (!disposed) results.setAttribute("aria-busy", "false");
    }
  }
}

/** @param {import("./wishlistsService.js").Wishlist} item Validated, minimal read model.
 * @returns {HTMLLIElement} A semantic card; only its action is interactive.
 */
function createCard(item) {
  const card = textElement("li", "");
  card.className = "wishlist-card";
  const occasion = textElement("p", OccasionLabels[item.occasion]);
  occasion.className = "wishlist-card__occasion";
  card.append(occasion, textElement("h2", item.name));
  if (item.eventDate === null) card.append(textElement("p", "Sans date"));
  else {
    const date = textElement("time", DateFormat.format(new Date(item.eventDate + "T00:00:00Z")));
    date.dateTime = item.eventDate;
    card.append(date);
  }
  if (item.isSuspended) {
    const suspension = textElement("div", "");
    suspension.className = "wishlist-card__suspension";
    suspension.append(textElement("strong", "Liste suspendue"), textElement("p", "Consultation uniquement"));
    card.append(suspension);
  }
  const open = createActionLink({ label: "Ouvrir", href: RoutePaths.ListDetails.replace(":listId", item.id) });
  open.setAttribute("aria-label", "Ouvrir la liste « " + item.name + " »");
  open.classList.add("wishlist-card__open");
  card.append(open);
  return card;
}

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag Native element.
 * @param {string} value Text, never markup.
 * @returns {HTMLElementTagNameMap[T]} Native node.
 */
function textElement(tag, value) {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}
