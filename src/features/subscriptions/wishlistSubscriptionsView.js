import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { wishlistArtwork } from "../wishlists/wishlistArtwork.js";
import { WishlistOccasions } from "../wishlists/wishlistValidation.js";

const DateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Creates the current member's followed-list gallery.
 * @param {{load: import("./wishlistSubscriptionsService.js").LoadSubscriptions, remove: import("./wishlistSubscriptionsService.js").RemoveSubscription, signal: AbortSignal, onOpen?: (href: string) => void}} options Scoped reads and explicit mutations.
 * @returns {HTMLElement} Routed disposable view.
 */
export function createWishlistSubscriptionsView({ load, remove, signal, onOpen }) {
  const view = node("section", ""); view.className = "wishlists-view wishlist-subscriptions-view flow";
  const title = node("h1", "Listes suivies"); title.tabIndex = -1;
  const header = node("div", ""); header.className = "wishlists-view__header"; header.append(title);
  const status = node("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const results = node("div", ""); results.className = "wishlists-view__results flow";
  const feedback = node("div", "");
  const pagination = node("nav", ""); pagination.className = "cluster"; pagination.setAttribute("aria-label", "Pages de listes suivies");
  const previous = createButton({ label: "Précédente", variant: "secondary", onClick: () => { if (!busy && page > 1) { page -= 1; void read(); } } });
  const next = createButton({ label: "Suivante", variant: "secondary", onClick: () => { if (!busy && page < pages) { page += 1; void read(); } } });
  pagination.append(previous, next);
  pagination.hidden = true;
  view.append(header, status, feedback, results, pagination);
  const lifetime = new AbortController();
  const combined = AbortSignal.any([signal, lifetime.signal]);
  let disposed = false, busy = false, page = 1, pages = 0;
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); clear(results); clear(feedback); status.textContent = ""; pagination.hidden = true; });
  addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
  if (signal.aborted) disposeComponent(view);
  else void read();
  return view;

  /** @param {HTMLElement} host Owned content region. */
  function clear(host) { disposeComponent(host); host.replaceChildren(); }
  function controls() {
    results.setAttribute("aria-busy", String(busy));
    previous.disabled = busy || page <= 1; next.disabled = busy || page >= pages;
    for (const button of results.querySelectorAll("button")) button.disabled = busy;
  }
  async function read() {
    if (disposed || busy) return;
    busy = true; clear(feedback); clear(results); controls();
    results.append(createLoadingState({ label: "Chargement des listes suivies…" }));
    pagination.hidden = true;
    try {
      let result = await load({ page, signal: combined });
      if (disposed || combined.aborted) return;
      // A confirmed deletion can remove the last card of the last page.
      if (page > 1 && !result.items.length && result.totalCount <= (page - 1) * result.pageSize) {
        page = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
        result = await load({ page, signal: combined });
        if (disposed || combined.aborted) return;
      }
      clear(results); pages = Math.ceil(result.totalCount / result.pageSize);
      if (!result.items.length) results.append(node("p", "Tu ne suis encore aucune liste."));
      else {
        const grid = node("ul", ""); grid.className = "wishlists-grid"; grid.setAttribute("role", "list");
        for (const item of result.items) grid.append(card(item));
        results.append(grid);
      }
      pagination.hidden = pages < 2;
      status.textContent = "Listes suivies chargées";
    } catch (error) {
      if (disposed || isAbortError(error) || combined.aborted) return;
      clear(results); showError(error, false);
    } finally {
      busy = false;
      if (!disposed) controls();
    }
  }
  /** @param {unknown} error Transport failure. @param {boolean} uncertain Mutation uncertainty. */
  function showError(error, uncertain) {
    clear(feedback);
    feedback.append(createAlert({ ...toUserFacingError(error), variant: "error",
      ...(uncertain ? { message: "Vérifie tes listes suivies avant de réessayer." } : {}) }));
    feedback.append(createButton({ label: uncertain ? "Vérifier les listes suivies" : "Réessayer", variant: "secondary", onClick: () => { void read(); } }));
  }
  /** @param {import("./wishlistSubscriptionsService.js").WishlistSubscription} item Revalidated summary. */
  function card(item) {
    const card = node("li", ""); card.className = "wishlist-card";
    const cover = document.createElement("img"); cover.className = "wishlist-card__cover";
    cover.src = wishlistArtwork(item.occasion); cover.alt = ""; cover.loading = "lazy"; cover.width = 400; cover.height = 500;
    const content = node("div", ""); content.className = "wishlist-card__content";
    const heading = node("h2", "");
    const link = createActionLink({ label: item.name, href: item.shareHref }); link.classList.add("wishlist-card__open");
    link.setAttribute("aria-label", `Ouvrir la liste « ${item.name} »`);
    if (onOpen) addComponentEventListener(card, link, "click", event => {
      const click = /** @type {MouseEvent} */ (event);
      if (click.button !== 0 || click.ctrlKey || click.metaKey || click.shiftKey || click.altKey) return;
      click.preventDefault(); if (!busy) onOpen(item.shareHref);
    });
    heading.append(link);
    const author = node("p", `Par ${item.ownerDisplayName}`); author.className = "wishlist-card__author";
    const occasion = node("p", WishlistOccasions[item.occasion]); occasion.className = "wishlist-card__occasion";
    content.append(heading, author, occasion);
    if (item.eventDate !== null) {
      const date = node("time", DateFormat.format(new Date(item.eventDate + "T00:00:00Z"))); date.dateTime = item.eventDate;
      content.append(date);
    }
    const actions = node("div", ""); actions.className = "wishlist-card__actions";
    const unfollow = createButton({ label: "Se désabonner", variant: "secondary", onClick: () => { void unsubscribe(item, unfollow); } });
    unfollow.setAttribute("aria-label", `Se désabonner de « ${item.name} »`); applyActionIcon(unfollow, "bell", "Se désabonner");
    unfollow.setAttribute("aria-pressed", "true"); actions.append(unfollow);
    card.append(cover, content, actions);
    registerComponentCleanup(card, () => { link.removeAttribute("href"); cover.removeAttribute("src"); });
    return card;
  }
  /** @param {import("./wishlistSubscriptionsService.js").WishlistSubscription} item Target. @param {HTMLButtonElement} trigger Explicit command. */
  async function unsubscribe(item, trigger) {
    if (disposed || busy) return;
    busy = true; clear(feedback); controls();
    try {
      await remove(item.id, { signal: combined });
      if (disposed || combined.aborted) return;
      busy = false; await read();
      if (!disposed) title.focus();
    } catch (error) {
      if (disposed || isAbortError(error) || combined.aborted) return;
      if (error instanceof ApiError && error.statusCode === 404) { busy = false; await read(); return; }
      showError(error, true);
      // Keep mutations disabled until an explicit fresh read resolves the uncertainty.
      trigger.focus();
      for (const button of results.querySelectorAll("button")) button.disabled = true;
    } finally {
      busy = false;
      if (!disposed) { previous.disabled = page <= 1; next.disabled = page >= pages; results.setAttribute("aria-busy", "false"); }
    }
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Native element. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Native node. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
