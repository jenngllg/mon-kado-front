import { createWishCard } from "../wishes/wishCard.js";
import { createWishesReorderView } from "../wishes/wishesReorderView.js";
import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistId, WishlistOccasions } from "./wishlistValidation.js";

const DateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });


/** Mounts owner-only list details and independently refreshable gifts.
 * @param {{wishlistId: string, loadOne: import("./wishlistsService.js").LoadWishlist,
 * loadWishes: import("../wishes/wishesService.js").LoadWishes, reorder?: import("../wishes/wishesService.js").ReorderWishes, signal?: AbortSignal}} options View dependencies.
 * @returns {HTMLElement} Routed component, with explicit disposal.
 */
export function createWishlistDetailsView({ wishlistId, loadOne, loadWishes, reorder, signal }) {
  const view = element("section", ""); view.className = "wishlist-details-view flow";
  const back = createActionLink({ label: "Retour à Mes listes", href: RoutePaths.Lists });
  const layout = element("div", ""); layout.className = "wishlist-details-layout";
  const information = element("section", ""); information.className = "wishlist-details-info flow";
  const title = element("h1", "Détail de la liste"); title.tabIndex = -1;
  const listContent = element("div", ""); listContent.className = "flow";
  information.append(title, listContent);
  const gifts = element("section", ""); gifts.className = "wishlist-details-gifts flow"; gifts.hidden = true;
  const heading = element("h2", "Les cadeaux de ta liste"); heading.tabIndex = -1;
  const results = element("div", ""); results.className = "flow";
  const refresh = createButton({ label: "Actualiser les cadeaux", variant: "secondary", onClick: () => { void readGifts(true); } }); refresh.hidden = true;
  const organize = createButton({ label: "Réorganiser les cadeaux", variant: "secondary", onClick: enterReorder }); organize.hidden = true;
  const notice = element("div", ""); notice.hidden = true;
  const reorderHost = element("div", ""); reorderHost.hidden = true;
  gifts.append(heading, organize, results, refresh, reorderHost); layout.append(information, gifts); view.append(back, notice, layout);
  const lifetime = new AbortController();
  let disposed = false; let busy = false; let terminal = false; let listLoaded = false; let reordering = false;
  /** @type {import("./wishlistsService.js").CreatedWishlist | null} */ let list = null;
  /** @type {import("../wishes/wishesService.js").WishCollection | null} */ let collection = null;
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); list = null; collection = null;
    clear(reorderHost); clear(notice); clear(listContent); clear(results); title.textContent = ""; gifts.hidden = true; refresh.disabled = true;
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void readList(false);
  return view;

  function enterReorder() {
    if (!reorder || disposed || busy || terminal || reordering || !list || list.wishlist.isSuspended || !collection || collection.wishes.length < 2) return;
    reordering = true; organize.hidden = true; refresh.hidden = true; clear(notice); notice.hidden = true;
    clear(results); results.hidden = true; renderList(); reorderHost.hidden = false;
    reorderHost.append(createWishesReorderView({ wishlistId, loadWishlist: loadOne, loadWishes, reorder, signal: lifetime.signal,
      onSaved: () => exitReorder(true), onCancel: () => exitReorder(false) }));
  }
  /** @param {boolean} saved Confirmed mutation. */
  async function exitReorder(saved) {
    if (disposed || lifetime.signal.aborted) return;
    reordering = false; clear(reorderHost); reorderHost.hidden = true; results.hidden = false;
    if (saved) { notice.hidden = false; notice.append(createAlert({ title: "Ordre des cadeaux enregistré", message: "L’ordre a été enregistré. La collection est relue depuis le serveur.", variant: "success" })); }
    listLoaded = false; collection = null; await readList(false);
    if (!disposed && !terminal) heading.focus();
  }
  /** @param {boolean} explicit Retry initiated by the owner. */
  async function readList(explicit) {
    if (disposed || busy || terminal || reordering) return;
    if (!isWishlistId(wishlistId)) { notFound(); return; }
    busy = true; information.setAttribute("aria-busy", "true"); clear(listContent);
    listContent.append(createLoadingState({ label: "Chargement de ta liste…" }));
    try {
      const loaded = await loadOne(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      list = loaded; renderList(); listLoaded = true;
      if (explicit) title.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      if (error instanceof ApiError && error.statusCode === 404) { notFound(); if (explicit) title.focus(); }
      else showError(listContent, error, () => { void readList(true); }, explicit);
    } finally { busy = false; if (!disposed) information.setAttribute("aria-busy", "false"); }
    if (!disposed && listLoaded && !terminal) await readGifts(false);
  }
  function renderList() {
    if (!list) return;
    clear(listContent); const item = list.wishlist; title.textContent = item.name;
    listContent.append(element("p", WishlistOccasions[item.occasion]));
    if (item.eventDate === null) listContent.append(element("p", "Sans date"));
    else { const date = element("time", DateFormat.format(new Date(item.eventDate + "T00:00:00Z"))); date.dateTime = item.eventDate; listContent.append(date); }
    if (item.message) { const message = element("p", item.message); message.className = "wishlist-details-note"; listContent.append(message); }
    if (item.isSuspended) listContent.append(createAlert({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" }));
    else if (!reordering) {
      const add = createActionLink({ label: "Ajouter un cadeau", href: RoutePaths.NewWish.replace(":listId", wishlistId) });
      add.classList.add("home-hero__primary-action"); listContent.append(add);
      listContent.append(createActionLink({ label: "Modifier les informations", href: RoutePaths.EditList.replace(":listId", wishlistId) }));
      const danger = element("div", ""); danger.className = "wishlist-details-danger";
      danger.append(createActionLink({ label: "Supprimer cette liste", href: RoutePaths.DeleteList.replace(":listId", wishlistId), variant: "danger" })); listContent.append(danger);
    }
  }
  /** @param {boolean} explicit Explicit retry or refresh. */
  async function readGifts(explicit) {
    if (disposed || busy || terminal || reordering || !listLoaded) return;
    busy = true; collection = null; organize.hidden = true; gifts.hidden = false; refresh.disabled = true;
    results.setAttribute("aria-busy", "true"); clear(results);
    results.append(createLoadingState({ label: "Chargement de tes cadeaux…" }));
    try {
      const loaded = await loadWishes(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      collection = loaded; clear(results);
      if (collection.wishes.length === 0) results.append(createEmptyState({ title: "Cette liste ne contient pas encore de cadeau", message: "Tes idées cadeaux apparaîtront ici." }));
      else {
        const cards = element("ul", ""); cards.className = "wish-grid"; cards.setAttribute("role", "list");
        for (const item of collection.wishes) cards.append(createWishCard(item, list?.wishlist.isSuspended === true)); results.append(cards);
      }
      organize.hidden = !reorder || list?.wishlist.isSuspended === true || collection.wishes.length < 2;
      refresh.hidden = false; if (explicit) heading.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      refresh.hidden = true;
      if (error instanceof ApiError && error.statusCode === 404) { notFound(); if (explicit) title.focus(); }
      else showError(results, error, () => { void readGifts(true); }, explicit);
    } finally { busy = false; if (!disposed) { results.setAttribute("aria-busy", "false"); refresh.disabled = false; } }
  }
  function notFound() {
    terminal = true; list = null; collection = null; listLoaded = false;
    title.textContent = "Liste introuvable"; clear(listContent); clear(results); gifts.hidden = true;
    listContent.append(createAlert({ title: "Liste introuvable", message: "Cette liste n’est pas disponible. Tu peux revenir à Mes listes.", variant: "error" }));
  }
}

/** @param {HTMLElement} container Owned subtree. */
function clear(container) { disposeComponent(container); container.replaceChildren(); }

/** @param {HTMLElement} container Error destination. @param {unknown} error Normalized failure.
 * @param {() => void} retry Explicit retry. @param {boolean} focus User action. */
function showError(container, error, retry, focus) {
  const translated = toUserFacingError(error); const details = [];
  const correlationId = error instanceof ApiError ? error.correlationId : translated.correlationId;
  if (correlationId) details.push(`Référence : ${correlationId}`);
  if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
  clear(container);
  const alert = createAlert({ ...translated, detail: details.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
  container.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: retry })); if (focus) alert.focus();
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Uninterpreted text. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
