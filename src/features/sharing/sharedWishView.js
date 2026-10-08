import { refreshOnReturn } from "../../components/refreshOnReturn.js";
import { withWishSort } from "../wishes/wishSorting.js";
import { ApiError, isAbortError } from "../../api/apiError.js";
import { memberOriginQuery } from "../members/memberNavigation.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createBackLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createWishImage } from "../wishes/wishImage.js";
import { createSharedWishQuantities } from "./sharedWishQuantities.js";
import { createWishDetailInformation, createWishDetailProductLink, createWishDetailReservationStatus } from "../wishes/wishDetailPresentation.js";
import { createWishCopyActions } from "./wishCopyActions.js";

/** A fresh public detail, without participant information or owner actions.
 * @param {{shareLinkId: string, wishId: string, loadOne: import("./sharedWishlistService.js").LoadSharedWish, copy?: import("./wishCopyActions.js").WishCopyOperations, signal?: AbortSignal, accessSignal?: AbortSignal, fromMemberId?: string | null, returnSort?: string | null,
 * createReservation?: (onUnavailable: () => void, wish: import("./sharedWishlistService.js").SharedWishDetail, onSaved: (message?: string) => void, onBusy: (busy: boolean) => void, onUnrecognized: () => void, onVerified: (wish: import("./sharedWishlistService.js").SharedWishDetail) => void) => HTMLElement}} options Dependencies.
 * @returns {HTMLElement} Disposable routed view.
 */
export function createSharedWishView({ shareLinkId, wishId, loadOne, copy, signal, accessSignal, createReservation, fromMemberId, returnSort }) {
  const view = element("section", ""); view.className = "shared-wish-view flow";
  const back = createBackLink({ label: "Retour à la liste", href: withWishSort(`/shared-wishlists/${shareLinkId}${memberOriginQuery(fromMemberId)}`, returnSort) });
  const title = element("h1", "Souhait partagé"); title.tabIndex = -1;
  const results = element("div", ""); results.className = "shared-wish-results flow";
  const notice = element("p", ""); notice.setAttribute("role", "status"); notice.hidden = true;
  view.append(back, title, notice, results);
  let disposed = false, busy = false, terminal = false, mutationBusy = false, copying = false;
  const lifetime = new AbortController();
  const copyActions = copy ? createWishCopyActions({ ...copy, signal: lifetime.signal, onUnavailable: unavailable, onBusy: value => { copying = value; } }) : null;
  if (copyActions) view.append(copyActions.element);
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); clear(); title.textContent = ""; notice.textContent = "";
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (accessSignal && !disposed) { addComponentEventListener(view, accessSignal, "abort", unavailable, { once: true }); if (accessSignal.aborted) unavailable(); }
  if (!disposed) void read(false);
  if (!disposed) refreshOnReturn(view, () => { void read(false); });
  return view;

  function clear() { if (results.contains(title)) view.insertBefore(title, notice); disposeComponent(results); results.replaceChildren(); }
  function clearNotice() { notice.textContent = ""; notice.hidden = true; }
  function unavailable() {
    if (disposed || terminal) return;
    terminal = true; lifetime.abort(); clear(); clearNotice(); back.hidden = true;
    title.textContent = "Lien de partage indisponible";
    const alert = element("p", "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."); alert.setAttribute("role", "alert");
    results.append(alert);
    results.setAttribute("aria-busy", "false"); title.focus();
  }

  /** @param {boolean} explicit User-initiated reread. */
  async function read(explicit) {
    if (disposed || busy || terminal || mutationBusy || copying) return;
    busy = true; clear(); title.textContent = "Souhait partagé";
    results.setAttribute("aria-busy", "true"); results.append(createLoadingState({ label: "Chargement du souhait…" }));
    try {
      const wish = await loadOne(shareLinkId, wishId, { signal: lifetime.signal });
      if (disposed || terminal || lifetime.signal.aborted) return;
      clear(); title.textContent = wish.name;
      if (wish.isFavorite) title.append(createWishFavoriteIndicator());
      const layout = element("div", ""); layout.className = "shared-wish-layout";
      const information = createWishDetailInformation(wish, title);
      const desired = element("p", `Quantité souhaitée : ${wish.quantity}`);
      let quantities = createSharedWishQuantities(wish);
      information.append(desired, quantities);
      const status = createWishDetailReservationStatus(wish); if (status) information.insertBefore(status, quantities);
      const actions = element("div", ""); actions.className = "cluster";
      if (copyActions) actions.append(copyActions.button(wish.id));
      if (wish.url) {
        actions.append(createWishDetailProductLink(wish.url, wish.name));
      } else if (wish.productUnavailable) information.append(element("p", "Lien produit indisponible"));
      if (actions.childElementCount) information.append(actions);
      layout.append(createWishImage(wish), information); results.append(layout);
      if (createReservation && wish.reservedQuantity !== null) information.append(createReservation(() => {
        if (disposed || terminal) return;
        terminal = true; lifetime.abort(); clear(); clearNotice();
        title.textContent = "Souhait introuvable"; title.focus();
      }, wish, (message = "Réservation enregistrée") => {
        if (disposed || terminal) return;
        notice.textContent = message; notice.hidden = false; void read(true);
      }, value => {
        mutationBusy = value;
        copyActions?.setBlocked(value);
        if (value) { notice.textContent = ""; notice.hidden = true; }
      }, () => {
        if (disposed || terminal) return;
        clearNotice(); results.querySelectorAll(".shared-wish-quantities__personal").forEach(line => { line.textContent = ""; line.remove(); });
      }, fresh => {
        if (disposed || terminal || !results.contains(layout)) return;
        desired.textContent = `Quantité souhaitée : ${fresh.quantity}`;
        const next = createSharedWishQuantities(fresh);
        information.querySelector(".wish-detail__reservation")?.remove();
        const nextStatus = createWishDetailReservationStatus(fresh); if (nextStatus) information.insertBefore(nextStatus, quantities);
        disposeComponent(quantities); quantities.replaceWith(next); quantities = next;
      }));
      if (explicit) title.focus();
    } catch (error) {
      if (disposed || terminal || isAbortError(error)) return;
      clear();
      if (error instanceof ApiError && error.statusCode === 404) {
        terminal = true; lifetime.abort(); clearNotice();
        const missingWish = error.errorCode === "SHARED_WISH_NOT_FOUND";
        title.textContent = missingWish ? "Souhait introuvable" : "Lien de partage indisponible";
        back.hidden = !missingWish;
        const alert = element("p", missingWish ? "Ce souhait ne peut pas être consulté. Retourne à la liste pour retrouver les autres souhaits." :
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
      if (!disposed) { results.setAttribute("aria-busy", "false"); }
    }
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Element tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
import { createWishFavoriteIndicator } from "../wishes/wishFavoriteIndicator.js";
