import { ApiError, isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createWishlistShareRenewDialog } from "./wishlistShareRenewDialog.js";
import { createWishlistShareRevokeDialog } from "./wishlistShareRevokeDialog.js";

/** Owner-only share section, independent of the gift collection.
 * @param {{wishlistId: string, wishlistName?: string, revoke?: import("./wishlistShareService.js").RevokeWishlistShare, load: import("./wishlistShareService.js").LoadWishlistShare,
 * create: import("./wishlistShareService.js").CreateWishlistShare, renew?: import("./wishlistShareService.js").RenewWishlistShare, copyText: (text: string) => Promise<void>,
 * onUnavailable: (state: "wishlistMissing" | "suspended") => void, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLElement} Disposable section.
 */
export function createWishlistShareSection({ wishlistId, wishlistName, load, create, renew, revoke, copyText, onUnavailable, signal }) {
  const section = document.createElement("section"); section.className = "wishlist-share flow";
  const title = document.createElement("h2"); title.textContent = "Partager ma liste"; title.tabIndex = -1;
  const help = document.createElement("p"); help.textContent = "Toute personne possédant ce lien peut consulter ta liste. Partage-le uniquement avec les personnes de ton choix.";
  const feedback = document.createElement("div");
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const empty = document.createElement("p"); empty.textContent = "Aucun lien de partage créé";
  const input = document.createElement("textarea"); input.readOnly = true; input.rows = 4; input.spellcheck = false; input.autocomplete = "off";
  const field = createFormField({ label: "Lien de partage", control: input });
  const actions = document.createElement("div"); actions.className = "wishlist-share__actions";
  const generate = createButton({ label: "Créer le lien de partage", onClick: () => { void perform(true, true); } });
  const copy = createButton({ label: "Copier le lien", onClick: () => { void copyLink(); } });
  const refresh = createButton({ label: "Actualiser le lien", variant: "secondary", onClick: () => { void perform(false, true); } });
  const renewButton = createButton({ label: "Renouveler le lien", variant: "secondary", onClick: openRenewal });
  const revokeButton = createButton({ label: "Désactiver le partage", variant: "danger", onClick: openRevocation });
  actions.append(generate, copy, refresh, renewButton, revokeButton); section.append(title, help, feedback, status, empty, field, actions);
  const lifetime = new AbortController();
  let disposed = false; let busy = false; let terminal = false; let absent = false;
  /** @type {import("./wishlistShareService.js").WishlistShareLink | null} */ let link = null;
  /** @type {HTMLDialogElement | null} */ let dialog = null;
  registerComponentCleanup(section, () => { disposed = true; lifetime.abort(); wishlistName = undefined; dialog = null; link = null; input.value = ""; clearFeedback(); status.textContent = ""; sync(); });
  if (signal) {
    addComponentEventListener(section, signal, "abort", () => disposeComponent(section), { once: true });
    if (signal.aborted) disposeComponent(section);
  }
  sync(); if (!disposed) void perform(false, false);
  return section;

  function sync() {
    section.setAttribute("aria-busy", String(busy && !disposed));
    generate.hidden = !absent || terminal || disposed; copy.hidden = !link || terminal || disposed;
    refresh.hidden = terminal || disposed; empty.hidden = !absent || terminal || disposed;
    field.hidden = !link || terminal || disposed;
    renewButton.hidden = !renew || !link || busy || terminal || disposed;
    revokeButton.hidden = !revoke || !wishlistName || !link || busy || terminal || disposed;
    for (const button of [generate, copy, refresh, renewButton, revokeButton]) button.disabled = busy || terminal || disposed || dialog !== null;
  }
  function openRevocation() {
    if (!revoke || !wishlistName || !link || disposed || terminal || busy || dialog) return;
    clearFeedback(); status.textContent = "";
    dialog = createWishlistShareRevokeDialog({ wishlistId, wishlistName, etag: link.etag, load, revoke, signal: lifetime.signal,
      onInvalidate: () => { link = null; input.value = ""; absent = false; empty.textContent = "Aucun lien de partage actif"; status.textContent = "Relis le lien avant toute nouvelle opération de partage."; sync(); },
      onRead: result => { if (disposed) return; link = result; input.value = result?.shareUrl ?? ""; absent = result === null; status.textContent = ""; sync(); },
      onRevoked: () => { if (disposed) return; link = null; input.value = ""; absent = true; status.textContent = "Partage désactivé"; sync(); },
      onUnavailable: state => { if (disposed) return; terminal = true; link = null; input.value = ""; sync(); onUnavailable(state); },
      onClose: revoked => { dialog = null; if (disposed || !section.isConnected) return; sync(); if (!revoked && !revokeButton.hidden && !revokeButton.disabled) revokeButton.focus(); else title.focus(); },
    });
    section.append(dialog); sync(); dialog.showModal();
  }
  function openRenewal() {
    if (!renew || !link || disposed || terminal || busy || dialog) return;
    clearFeedback(); status.textContent = "";
    dialog = createWishlistShareRenewDialog({ wishlistId, etag: link.etag, load, renew, signal: lifetime.signal,
      onInvalidate: () => { link = null; input.value = ""; absent = false; status.textContent = "Relis le lien avant toute nouvelle opération de partage."; sync(); },
      onRead: result => { if (disposed) return; link = result; input.value = result?.shareUrl ?? ""; absent = result === null; status.textContent = ""; sync(); },
      onRenewed: result => { if (disposed) return; link = result; input.value = result.shareUrl; absent = false; status.textContent = "Lien de partage renouvelé. Communique le nouveau lien aux personnes de ton choix."; sync(); },
      onUnavailable: state => { if (disposed) return; terminal = true; link = null; input.value = ""; sync(); onUnavailable(state); },
      onClose: renewed => { dialog = null; if (disposed || !section.isConnected) return; sync(); if (!renewed && !renewButton.hidden && !renewButton.disabled) renewButton.focus(); else title.focus(); },
    });
    section.append(dialog); sync(); dialog.showModal();
  }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); }
  /** @param {boolean} mutation Creation rather than read. @param {boolean} explicit User action. */
  async function perform(mutation, explicit) {
    if (disposed || terminal || busy || dialog || (mutation && !absent)) return;
    busy = true; absent = false; link = null; input.value = ""; status.textContent = ""; clearFeedback();
    feedback.append(createLoadingState({ label: mutation ? "Création du lien de partage…" : "Chargement du lien de partage…" })); sync();
    refresh.textContent = "Actualiser le lien";
    try {
      const result = await (mutation ? create : load)(wishlistId, { signal: lifetime.signal });
      if (disposed) return;
      link = result; absent = result === null; input.value = result?.shareUrl ?? ""; clearFeedback();
      if (mutation) status.textContent = "Lien de partage créé";
      if (explicit) title.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      clearFeedback();
      if (error instanceof ApiError && (error.statusCode === 404 || error.errorCode === "WISHLIST_SUSPENDED")) {
        terminal = true; sync(); onUnavailable(error.errorCode === "WISHLIST_SUSPENDED" ? "suspended" : "wishlistMissing"); return;
      }
      const translated = toUserFacingError(error);
      const details = [];
      if (error instanceof ApiError && error.correlationId) details.push(`Référence : ${error.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) details.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      let message = translated.message;
      if (mutation && error instanceof ApiError && error.errorCode === "WISHLIST_SHARE_LINK_ALREADY_EXISTS") {
        message = "Un lien de partage existe déjà."; refresh.textContent = "Charger le lien existant";
      } else if (mutation && (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode ?? 500) >= 500)) {
        message = "La création du lien ne peut pas être confirmée. Actualise le lien avant de réessayer.";
      } else if (mutation) absent = true;
      const alert = createAlert({ title: translated.title, message, detail: details.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      feedback.append(alert); if (explicit) alert.focus();
    } finally { busy = false; if (!disposed) sync(); }
  }
  async function copyLink() {
    if (disposed || terminal || busy || dialog || !link) return;
    busy = true; clearFeedback(); status.textContent = ""; sync();
    try {
      await copyText(link.shareUrl);
      if (!disposed) status.textContent = "Lien copié";
    } catch {
      if (!disposed) {
        status.textContent = "La copie automatique est indisponible. Sélectionne le lien puis copie-le manuellement.";
        input.focus(); input.select();
      }
    } finally { busy = false; if (!disposed) sync(); }
  }
}
