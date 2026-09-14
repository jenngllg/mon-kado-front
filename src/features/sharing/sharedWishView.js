import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createWishImage } from "../wishes/wishImage.js";
import { createSharedWishQuantities } from "./sharedWishQuantities.js";

const PriceFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** A fresh public detail, without participant information or owner actions.
 * @param {{shareLinkId: string, wishId: string, loadOne: import("./sharedWishlistService.js").LoadSharedWish, signal?: AbortSignal, accessSignal?: AbortSignal,
 * createReservation?: (onUnavailable: () => void, wish: import("./sharedWishlistService.js").SharedWishDetail, onSaved: () => void, onBusy: (busy: boolean) => void) => HTMLElement}} options Dependencies.
 * @returns {HTMLElement} Disposable routed view.
 */
export function createSharedWishView({ shareLinkId, wishId, loadOne, signal, accessSignal, createReservation }) {
  const view = element("section", ""); view.className = "shared-wish-view flow";
  const back = createActionLink({ label: "Retour à la liste", href: `/shared-wishlists/${shareLinkId}` });
  const title = element("h1", "Cadeau partagé"); title.tabIndex = -1;
  const results = element("div", ""); results.className = "flow";
  const notice = element("p", ""); notice.setAttribute("role", "status"); notice.hidden = true;
  const refresh = createButton({ label: "Actualiser le cadeau", variant: "secondary", onClick: () => { void read(true); } }); refresh.hidden = true;
  view.append(back, title, notice, results, refresh, createActionLink({ label: "Retour à l’accueil", href: "/" }));
  let disposed = false, busy = false, terminal = false, mutationBusy = false;
  const lifetime = new AbortController();
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); clear(); title.textContent = ""; notice.textContent = ""; refresh.disabled = true;
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (accessSignal && !disposed) { addComponentEventListener(view, accessSignal, "abort", unavailable, { once: true }); if (accessSignal.aborted) unavailable(); }
  if (!disposed) void read(false);
  return view;

  function clear() { disposeComponent(results); results.replaceChildren(); }
  function unavailable() {
    if (disposed || terminal) return;
    terminal = true; lifetime.abort(); clear(); back.hidden = true; refresh.hidden = true;
    title.textContent = "Lien de partage indisponible";
    const alert = element("p", "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."); alert.setAttribute("role", "alert");
    results.append(alert);
    results.setAttribute("aria-busy", "false"); title.focus();
  }

  /** @param {boolean} explicit User-initiated reread. */
  async function read(explicit) {
    if (disposed || busy || terminal || mutationBusy) return;
    busy = true; clear(); title.textContent = "Cadeau partagé"; refresh.hidden = true; refresh.disabled = true;
    results.setAttribute("aria-busy", "true"); results.append(createLoadingState({ label: "Chargement du cadeau…" }));
    try {
      const wish = await loadOne(shareLinkId, wishId, { signal: lifetime.signal });
      if (disposed || terminal || lifetime.signal.aborted) return;
      clear(); title.textContent = wish.name;
      const layout = element("div", ""); layout.className = "shared-wish-layout";
      const information = element("div", ""); information.className = "shared-wish-information flow";
      if (wish.note !== null && wish.note !== "") {
        const note = element("p", wish.note); note.className = "wishlist-details-note"; information.append(note);
      }
      const price = element("p", wish.price === null ? "Prix non renseigné" : PriceFormat.format(wish.price)); price.className = "wish-card__price";
      information.append(price, element("p", `Quantité souhaitée : ${wish.quantity}`));
      information.append(createSharedWishQuantities(wish));
      if (wish.url) {
        const product = createActionLink({ label: "Voir le produit", href: wish.url }); product.target = "_blank"; product.rel = "noopener noreferrer";
        product.setAttribute("aria-label", `Voir le produit « ${wish.name} » (nouvel onglet)`); information.append(product);
      } else if (wish.productUnavailable) information.append(element("p", "Lien produit indisponible"));
      layout.append(createWishImage(wish), information); results.append(layout);
      if (createReservation) results.append(createReservation(() => {
        if (disposed || terminal) return;
        terminal = true; lifetime.abort(); clear(); refresh.hidden = true;
        title.textContent = "Cadeau introuvable"; title.focus();
      }, wish, () => {
        if (disposed || terminal) return;
        notice.textContent = "Réservation enregistrée"; notice.hidden = false; void read(true);
      }, value => { mutationBusy = value; refresh.disabled = disposed || terminal || busy || value; }));
      refresh.hidden = false; if (explicit) title.focus();
    } catch (error) {
      if (disposed || terminal || isAbortError(error)) return;
      clear();
      if (error instanceof ApiError && error.statusCode === 404) {
        terminal = true; lifetime.abort();
        const missingWish = error.errorCode === "SHARED_WISH_NOT_FOUND";
        title.textContent = missingWish ? "Cadeau introuvable" : "Lien de partage indisponible";
        back.hidden = !missingWish;
        const alert = element("p", missingWish ? "Ce cadeau ne peut pas être consulté. Retourne à la liste pour retrouver les autres idées cadeaux." :
          "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé.");
        alert.setAttribute("role", "alert"); alert.tabIndex = -1; results.append(alert); if (explicit) alert.focus();
      } else {
        const translated = toUserFacingError(error), extra = [];
        const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
        if (correlation) extra.push(`Référence : ${correlation}`);
        if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
        const alert = createAlert({ ...translated, detail: extra.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
        results.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } })); if (explicit) alert.focus();
      }
    } finally {
      busy = false;
      if (!disposed) { results.setAttribute("aria-busy", "false"); refresh.disabled = terminal || mutationBusy; }
    }
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Element tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
