import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { WishlistOccasions as OccasionLabels } from "./wishlistValidation.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { wishlistArtwork } from "./wishlistArtwork.js";
import { createWishlistDeleteDialog } from "./wishlistDeleteDialog.js";

const DateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Creates an owned-list overview with a fresh, view-owned read.
 * @param {{load: import("./wishlistsService.js").LoadWishlists, loadOne?: import("./wishlistsService.js").LoadWishlist, remove?: import("./wishlistsService.js").RemoveWishlist, isArchived?: boolean, signal?: AbortSignal}} options Injectable read and route lifetime.
 * @returns {HTMLElement} Routed component.
 */
export function createWishlistsView({ load, loadOne, remove, isArchived = false, signal }) {
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
  create.classList.add("ui-button", "ui-button--primary", "page-primary-action");
  header.append(introduction);
  const toolbar = textElement("div", "");
  toolbar.className = "wishlists-view__toolbar";
  const results = textElement("div", "");
  results.className = "wishlists-view__results flow";
  const tabs = textElement("nav", ""); tabs.className = "wishlist-archive-tabs cluster"; tabs.setAttribute("aria-label", "Catégories de listes");
  for (const [label, archived] of [["Actives", false], ["Archivées", true]]) {
    const tab = createActionLink({ label: String(label), href: archived ? "/lists?isArchived=true" : "/lists" });
    if (archived === isArchived) tab.setAttribute("aria-current", "page");
    tabs.append(tab);
  }
  toolbar.append(tabs, create);
  view.append(header, toolbar, results);
  const lifetime = new AbortController();
  let disposed = false;
  let busy = false;
  /** @type {HTMLDialogElement | null} */ let deletionDialog = null;
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

  /** @param {string} wishlistId Selected list. @param {HTMLButtonElement} trigger Focus return target. */
  function openDeletion(wishlistId, trigger) {
    if (!loadOne || !remove || disposed || busy || deletionDialog) return;
    const modal = createWishlistDeleteDialog({ wishlistId, loadOne, remove, signal: lifetime.signal,
      onDeleted: async () => { if (disposed) return; modal.close(); await read(true); },
    });
    deletionDialog = modal;
    modal.addEventListener("close", () => {
      deletionDialog = null;
      if (!disposed && trigger.isConnected) trigger.focus();
    }, { once: true, signal: lifetime.signal });
    view.append(modal); modal.showModal();
  }

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
        for (const item of items) collection.append(createCard(item, openDeletion));
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
 * @param {(id: string, trigger: HTMLButtonElement) => void} onDelete Open confirmation.
 * @returns {HTMLLIElement} A semantic card; only its action is interactive.
 */
function createCard(item, onDelete) {
  const card = textElement("li", "");
  card.className = "wishlist-card";
  const cover = document.createElement("img");
  cover.className = "wishlist-card__cover";
  cover.src = wishlistArtwork(item.occasion);
  cover.alt = ""; cover.loading = "lazy"; cover.width = 400; cover.height = 500;
  const content = textElement("div", "");
  content.className = "wishlist-card__content";
  const occasion = textElement("p", OccasionLabels[item.occasion]);
  occasion.className = "wishlist-card__occasion";
  const heading = textElement("h2", "");
  const open = createActionLink({ label: item.name, href: RoutePaths.ListDetails.replace(":listId", item.id) });
  open.setAttribute("aria-label", "Ouvrir la liste « " + item.name + " »");
  open.classList.add("wishlist-card__open");
  heading.append(open);
  content.append(heading, occasion);
  if (item.eventDate !== null) {
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
    const actions = textElement("div", "");
    actions.className = "wishlist-card__actions";
    actions.setAttribute("role", "group");
    actions.setAttribute("aria-label", "Actions de la liste « " + item.name + " »");
    if (!item.isArchived) {
      const edit = createActionLink({ label: "Modifier", href: RoutePaths.EditList.replace(":listId", item.id) });
      edit.setAttribute("aria-label", "Modifier la liste « " + item.name + " »");
      applyActionIcon(edit, "edit", "Modifier");
      actions.append(edit);
    }
    const remove = createButton({ label: "Supprimer", variant: "danger", onClick: () => onDelete(item.id, remove) });
    remove.setAttribute("aria-label", "Supprimer la liste « " + item.name + " »");
    applyActionIcon(remove, "delete", "Supprimer");
    remove.classList.add("icon-action--danger");
    actions.append(remove);
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
