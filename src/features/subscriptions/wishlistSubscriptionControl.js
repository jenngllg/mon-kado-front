import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, disposeComponent } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** A stateful, explicit follow command; uncertain writes require a read before another mutation.
 * @param {{shareLinkId: string, loadCurrent: import("./wishlistSubscriptionsService.js").LoadCurrentSubscription, subscribe: import("./wishlistSubscriptionsService.js").SubscribeToWishlist, remove: import("./wishlistSubscriptionsService.js").RemoveSubscription, signal: AbortSignal, onUnavailable: () => void}} options Scoped operations.
 * @returns {HTMLElement} Disposable follow control.
 */
export function createWishlistSubscriptionControl({ shareLinkId, loadCurrent, subscribe, remove, signal, onUnavailable }) {
  const host = document.createElement("div"); host.className = "wishlist-subscription-control";
  const status = document.createElement("span"); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const feedback = document.createElement("div");
  const action = createButton({ label: "S’abonner", variant: "secondary", onClick: () => { void run(true); } });
  action.classList.add("wishlist-subscription-action");
  const retry = createButton({ label: "Vérifier l’abonnement", variant: "secondary", onClick: () => { void run(false); } }); retry.hidden = true;
  host.append(action, status, feedback, retry);
  const lifetime = new AbortController();
  const combined = AbortSignal.any([signal, lifetime.signal]);
  /** @type {import("./wishlistSubscriptionsService.js").WishlistSubscription | null} */ let current = null;
  let disposed = false, busy = false, known = false, owner = false;
  registerComponentCleanup(host, () => { disposed = true; lifetime.abort(); current = null; status.textContent = ""; disposeComponent(feedback); feedback.replaceChildren(); action.disabled = true; retry.disabled = true; });
  addComponentEventListener(host, signal, "abort", () => disposeComponent(host), { once: true });
  if (signal.aborted) disposeComponent(host);
  else void run(false);
  return host;

  function controls() {
    const label = current ? "Se désabonner" : "S’abonner";
    action.setAttribute("aria-label", label); applyActionIcon(action, "bell", label);
    action.setAttribute("aria-pressed", String(!!current));
    action.disabled = busy || !known || owner; action.hidden = owner;
    retry.disabled = busy; host.setAttribute("aria-busy", String(busy));
  }
  /** @param {boolean} mutation Explicit user command, never derived from navigation. */
  async function run(mutation) {
    if (disposed || busy || (mutation && (!known || owner))) return;
    busy = true; retry.hidden = true; disposeComponent(feedback); feedback.replaceChildren(); controls();
    try {
      if (!mutation) current = await loadCurrent(shareLinkId, { signal: combined });
      else if (current) {
        await remove(current.id, { signal: combined });
        current = null;
      } else current = await subscribe(shareLinkId, { signal: combined });
      if (disposed || combined.aborted) return;
      known = true;
      status.textContent = mutation ? (current ? "Abonnement enregistré" : "Abonnement retiré") : "";
    } catch (error) {
      if (disposed || isAbortError(error) || combined.aborted) return;
      const api = error instanceof ApiError ? error : null;
      if (api?.errorCode === "WISHLIST_SUBSCRIPTION_SELF") { owner = true; return; }
      if (api?.statusCode === 404 && api.errorCode !== "WISHLIST_SUBSCRIPTION_NOT_FOUND") { onUnavailable(); return; }
      // Never replay a write whose commit could have happened despite a network failure.
      known = false; retry.hidden = false;
      const translated = toUserFacingError(error);
      feedback.append(createAlert({ ...translated, variant: "error",
        ...(mutation ? { message: "Vérifie ton abonnement avant de réessayer." } : {}) }));
    } finally {
      busy = false;
      if (!disposed) controls();
    }
  }
}
