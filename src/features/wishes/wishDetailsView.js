import { isAbortError } from "../../api/apiError.js";
import { createBackLink } from "../../components/backLink.js";
import { createActionLink, createAlert, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createWishImage } from "./wishImage.js";
import { createWishFavoriteIndicator } from "./wishFavoriteIndicator.js";
import { createSharedWishQuantities } from "../sharing/sharedWishQuantities.js";

/** Read-only owner detail. Quantities are projected and protected by the API.
 * @param {{wishlistId: string, wishId: string, loadOne: import("./wishesService.js").LoadWish, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLElement} Disposable detail with fresh reads on return.
 */
export function createWishDetailsView({ wishlistId, wishId, loadOne, signal }) {
  const view = document.createElement("section"); view.className = "shared-wish-view wish-owner-detail flow";
  const back = createBackLink({ label: "Retour à la liste", href: `/lists/${wishlistId}` });
  const content = document.createElement("div"); content.className = "flow";
  view.append(back, content);
  let disposed = false;
  let request = new AbortController();
  registerComponentCleanup(view, () => { disposed = true; request.abort(); disposeComponent(content); content.replaceChildren(); });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  addComponentEventListener(view, window, "focus", () => { void read(); });
  addComponentEventListener(view, document, "visibilitychange", () => { if (!document.hidden) void read(); });
  if (!disposed) void read();
  return view;

  async function read() {
    if (disposed) return;
    request.abort(); request = new AbortController();
    const active = request;
    disposeComponent(content); content.replaceChildren(createLoadingState({ label: "Chargement du souhait…" }));
    try {
      const { wish } = await loadOne(wishlistId, wishId, { signal: active.signal });
      if (disposed || active.signal.aborted) return;
      disposeComponent(content); content.replaceChildren();
      const title = document.createElement("h1"); title.textContent = wish.name;
      if (wish.isFavorite) title.append(createWishFavoriteIndicator());
      const information = document.createElement("div"); information.className = "flow";
      for (const text of [wish.note, wish.price === null ? null : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(wish.price), `Quantité souhaitée : ${wish.quantity}`]) {
        if (!text) continue;
        const line = document.createElement("p"); line.textContent = text; information.append(line);
      }
      information.append(createSharedWishQuantities({ reservedQuantity: wish.reservedQuantity ?? null, availableQuantity: wish.availableQuantity ?? null, currentParticipantReservedQuantity: null }));
      if (wish.url) {
        const product = createActionLink({ label: "Voir le produit", href: wish.url });
        product.target = "_blank"; product.rel = "noopener noreferrer"; information.append(product);
      }
      const layout = document.createElement("div"); layout.className = "shared-wish-layout";
      layout.append(createWishImage(wish), information);
      content.append(title, layout);
    } catch (error) {
      if (disposed || active.signal.aborted || isAbortError(error)) return;
      const translated = toUserFacingError(error);
      disposeComponent(content); content.replaceChildren(createAlert({ title: translated.title, message: translated.message, variant: "error" }));
    }
  }
}
