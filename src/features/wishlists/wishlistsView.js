import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { WishlistOccasions as OccasionLabels } from "./wishlistValidation.js";
import { createActionDisclosure } from "../../components/actionDisclosure.js";
import { wishlistArtwork } from "./wishlistArtwork.js";
import { createWishlistArchiveButton } from "./wishlistArchiveButton.js";

const DateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Creates an owned-list overview with a fresh, view-owned read.
 * @param {{load: import("./wishlistsService.js").LoadWishlists, loadOne?: import("./wishlistsService.js").LoadWishlist,
 * setArchived?: import("./wishlistsService.js").SetArchivedWishlist, isArchived?: boolean, signal?: AbortSignal}} options Injectable read and route lifetime.
 * @returns {HTMLElement} Routed component.
 */
export function createWishlistsView({ load, loadOne, setArchived, isArchived = false, signal }) {
  const view = textElement("section", "");
  view.className = "wishlists-view flow";
  const header = textElement("div", "");
  header.className = "wishlists-view__header";
  const introduction = textElement("div", "");
  introduction.className = "flow";
  const title = textElement("h1", "Mes listes");
  title.tabIndex = -1;
  introduction.append(title);
  const create = createActionLink({ label: "Créer une liste", href: RoutePaths.NewList });
  create.classList.add("home-hero__primary-action");
  header.append(introduction, create);
  const results = textElement("div", "");
  results.className = "wishlists-view__results flow";
  const tabs = textElement("nav", ""); tabs.className = "wishlist-archive-tabs cluster"; tabs.setAttribute("aria-label", "Catégories de listes");
  for (const [label, archived] of [["Actives", false], ["Archivées", true]]) {
    const tab = createActionLink({ label: String(label), href: archived ? "/lists?isArchived=true" : "/lists" });
    if (archived === isArchived) tab.setAttribute("aria-current", "page");
    tabs.append(tab);
  }
  view.append(header, tabs, results);
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
      const items = await load({ signal: lifetime.signal, ...(isArchived ? { isArchived: true } : {}) });
      if (disposed) return;
      if (items.length === 0) {
        if (isArchived) show(textElement("p", "Aucune liste archivée"));
        else show(createEmptyState({ title: "Tu n’as pas encore de liste", message: "Crée ta première liste pour réunir tes souhaits." }));
      } else {
        const collection = textElement("ul", "");
        collection.className = "wishlists-grid";
        collection.setAttribute("role", "list");
        for (const item of items) collection.append(createCard(item, loadOne && setArchived ? createWishlistArchiveButton({
          wishlist: item, loadOne, setArchived, signal: lifetime.signal,
          onUpdated: () => read(true),
          onError: error => { const alert = createAlert({ ...toUserFacingError(error), variant: "error" }); results.prepend(alert); },
        }) : null));
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
 * @param {HTMLButtonElement | null} archive Archive control.
 * @returns {HTMLLIElement} A semantic card; only its action is interactive.
 */
function createCard(item, archive) {
  const card = textElement("li", "");
  card.className = "wishlist-card";
  const cover = document.createElement("img");
  cover.className = "wishlist-card__cover";
  cover.src = wishlistArtwork(item.occasion);
  cover.alt = ""; cover.loading = "lazy";
  const content = textElement("div", "");
  content.className = "wishlist-card__content";
  const occasion = textElement("p", OccasionLabels[item.occasion]);
  occasion.className = "wishlist-card__occasion";
  const heading = textElement("h2", "");
  const icon = document.createElement("img"); icon.alt = "";
  icon.className = "wishlist-card__icon"; icon.src = wishlistArtwork(item.occasion).replace(".webp", "-icon.webp");
  const open = createActionLink({ label: item.name, href: RoutePaths.ListDetails.replace(":listId", item.id) });
  open.setAttribute("aria-label", "Ouvrir la liste « " + item.name + " »");
  open.classList.add("wishlist-card__open");
  heading.append(icon, open);
  content.append(heading, occasion);
  if (item.eventDate === null) content.append(textElement("p", "Sans date"));
  else {
    const date = textElement("time", DateFormat.format(new Date(item.eventDate + "T00:00:00Z")));
    date.dateTime = item.eventDate;
    content.append(date);
  }
  if (item.isSuspended) {
    const suspension = textElement("div", "");
    suspension.className = "wishlist-card__suspension";
    suspension.append(textElement("strong", "Liste suspendue"), textElement("p", "Consultation uniquement"));
    content.append(suspension);
  }
  if (!item.isSuspended) {
    const edit = createActionLink({ label: "Modifier", href: RoutePaths.EditList.replace(":listId", item.id) });
    edit.setAttribute("aria-label", "Modifier la liste « " + item.name + " »");
    const remove = createActionLink({ label: "Supprimer", href: RoutePaths.DeleteList.replace(":listId", item.id), variant: "danger" });
    /** @type {HTMLElement[]} */ const commands = item.isArchived ? [remove] : [edit, remove];
    if (archive) commands.unshift(archive);
    const actions = createActionDisclosure("⋯", "Actions de la liste « " + item.name + " »", commands);
    actions.classList.add("wishlist-card__actions");
    card.append(actions);
  }
  card.prepend(cover, content);
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
