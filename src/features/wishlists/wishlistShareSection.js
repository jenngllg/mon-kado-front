import { refreshOnReturn } from "../../components/refreshOnReturn.js";
import { ApiError, isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createWishlistShareRenewDialog } from "./wishlistShareRenewDialog.js";
import { createWishlistShareRevokeDialog } from "./wishlistShareRevokeDialog.js";
import { openWishlistMailComposer, openWishlistMessengerComposer, openWishlistShareWindow, ShareChannels, wishlistShareDestination, wishlistShareMessage } from "./wishlistShareChannels.js";

/** Owner-only share section, independent of the gift collection.
 * @param {{wishlistId: string, wishlistName?: string, revoke?: import("./wishlistShareService.js").RevokeWishlistShare, load: import("./wishlistShareService.js").LoadWishlistShare,
 * create: import("./wishlistShareService.js").CreateWishlistShare, renew?: import("./wishlistShareService.js").RenewWishlistShare, copyText: (text: string) => Promise<void>,
 * onUnavailable: (state: "wishlistMissing" | "suspended") => void, onRevoked?: () => void, onBusy?: (pending: boolean) => void, signal?: AbortSignal,
 * openShareWindow?: () => import("./wishlistShareChannels.js").ShareWindow | null, openMailComposer?: (url: string) => void,
 * openMessengerComposer?: (url: string) => void}} options Dependencies.
 * @returns {HTMLElement} Disposable section.
 */
export function createWishlistShareSection({ wishlistId, wishlistName, load, create, renew, revoke, copyText, onUnavailable, onRevoked, onBusy = () => {}, signal, openShareWindow = openWishlistShareWindow, openMailComposer = openWishlistMailComposer, openMessengerComposer = openWishlistMessengerComposer }) {
  const section = document.createElement("section"); section.className = "wishlist-share flow";
  const title = document.createElement("h2"); title.textContent = "Partager ma liste"; title.tabIndex = -1;
  const help = document.createElement("p"); help.textContent = "Une liste partagée est visible sur ton profil et accessible à tous.";
  const feedback = document.createElement("div");
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const empty = document.createElement("p"); empty.textContent = "Aucun lien de partage créé";
  const input = document.createElement("textarea"); input.readOnly = true; input.rows = 2; input.spellcheck = false; input.autocomplete = "off";
  const field = createFormField({ label: "Lien de partage", control: input });
  const channels = document.createElement("div"); channels.className = "wishlist-share__channels";
  channels.setAttribute("role", "group"); channels.setAttribute("aria-label", "Partager la liste sur un canal");
  const channelButtons = ShareChannels.map(channel => {
    const button = createButton({ label: `Partager par ${channel.name}`, variant: "secondary", onClick: () => { void shareOn(/** @type {import("./wishlistShareChannels.js").ShareChannel} */ (channel.id)); } });
    button.classList.add("icon-action"); button.title = button.getAttribute("aria-label") ?? `Partager par ${channel.name}`;
    button.setAttribute("aria-label", `Partager par ${channel.name}`);
    const icon = document.createElement("img"); icon.src = channel.icon; icon.alt = ""; icon.width = 24; icon.height = 24;
    const label = document.createElement("span"); label.className = "wishlist-share__channel-name"; label.textContent = channel.id === "email" ? "E-mail" : channel.name;
    const entry = document.createElement("div"); entry.className = "wishlist-share__channel"; entry.append(button, label);
    button.replaceChildren(icon); channels.append(entry);
    return button;
  });
  const actions = document.createElement("div"); actions.className = "wishlist-share__actions";
  const generate = createButton({ label: "Créer le lien de partage", onClick: () => { void perform(true, true); } });
  const copy = createButton({ label: "Copier le lien", onClick: () => { void copyLink(); } });
  const renewButton = createButton({ label: "Renouveler le lien", variant: "secondary", onClick: openRenewal });
  const revokeButton = createButton({ label: "Désactiver le partage", variant: "danger", onClick: openRevocation });
  const linkRow = document.createElement("div"); linkRow.className = "wishlist-share__link-row"; linkRow.append(field, copy);
  actions.append(generate, renewButton, revokeButton); section.append(title, help, feedback, status, empty, linkRow, channels, actions);
  const lifetime = new AbortController();
  let disposed = false; let busy = false; let terminal = false; let absent = false;
  /** @type {import("./wishlistShareService.js").WishlistShareLink | null} */ let link = null;
  /** @type {HTMLDialogElement | null} */ let dialog = null;
  /** @type {import("./wishlistShareChannels.js").ShareWindow | null} */ let pendingWindow = null;
  registerComponentCleanup(section, () => { disposed = true; lifetime.abort(); pendingWindow?.close(); pendingWindow = null; wishlistName = undefined; dialog = null; link = null; input.value = ""; clearFeedback(); status.textContent = ""; sync(); });
  if (signal) {
    addComponentEventListener(section, signal, "abort", () => disposeComponent(section), { once: true });
    if (signal.aborted) disposeComponent(section);
  }
  sync(); if (!disposed) void perform(false, false);
  if (!disposed) refreshOnReturn(section, () => { void perform(false, false); });
  return section;

  function sync() {
    onBusy(!disposed && (busy || dialog !== null));
    section.setAttribute("aria-busy", String(busy && !disposed));
    generate.hidden = !absent || terminal || disposed; copy.hidden = !link || terminal || disposed;
    empty.hidden = !absent || terminal || disposed;
    field.hidden = !link || terminal || disposed;
    linkRow.hidden = !link || terminal || disposed;
    channels.hidden = !link || terminal || disposed;
    renewButton.hidden = !renew || !link || busy || terminal || disposed;
    revokeButton.hidden = !revoke || !wishlistName || !link || busy || terminal || disposed;
    for (const button of [generate, copy, renewButton, revokeButton, ...channelButtons]) button.disabled = busy || terminal || disposed || dialog !== null || (channelButtons.includes(button) && !link);
  }
  function openRevocation() {
    if (!revoke || !wishlistName || !link || disposed || terminal || busy || dialog) return;
    clearFeedback(); status.textContent = "";
    dialog = createWishlistShareRevokeDialog({ wishlistId, wishlistName, etag: link.etag, load, revoke, signal: lifetime.signal,
      onInvalidate: () => { link = null; input.value = ""; absent = false; empty.textContent = "Aucun lien de partage actif"; status.textContent = "Rouvre la liste avant toute nouvelle opération de partage."; sync(); },
      onRead: result => { if (disposed) return; link = result; input.value = result?.shareUrl ?? ""; absent = result === null; status.textContent = ""; sync(); },
      onRevoked: () => { if (disposed) return; link = null; input.value = ""; absent = true; status.textContent = ""; sync(); onRevoked?.(); },
      onUnavailable: state => { if (disposed) return; terminal = true; link = null; input.value = ""; sync(); onUnavailable(state); },
      onClose: revoked => { dialog = null; if (disposed || !section.isConnected) return; sync(); if (!revoked && !revokeButton.hidden && !revokeButton.disabled) revokeButton.focus(); else title.focus(); },
    });
    section.append(dialog); sync(); dialog.showModal();
  }
  function openRenewal() {
    if (!renew || !link || disposed || terminal || busy || dialog) return;
    clearFeedback(); status.textContent = "";
    dialog = createWishlistShareRenewDialog({ wishlistId, etag: link.etag, load, renew, signal: lifetime.signal,
      onInvalidate: () => { link = null; input.value = ""; absent = false; status.textContent = "Rouvre la liste avant toute nouvelle opération de partage."; sync(); },
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

    try {
      const result = await (mutation ? create : load)(wishlistId, { signal: lifetime.signal });
      if (disposed) return;
      link = result; absent = result === null; input.value = result?.shareUrl ?? ""; clearFeedback();
      if (mutation) {
        const announcement = document.createElement("span"); announcement.className = "visually-hidden";
        announcement.textContent = "Lien de partage créé"; status.append(announcement);
      }
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
        message = "Un lien de partage existe déjà.";
      } else if (mutation && (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode ?? 500) >= 500)) {
        message = "La création du lien ne peut pas être confirmée. Rouvre la liste pour vérifier son état.";
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
  /** @param {import("./wishlistShareChannels.js").ShareChannel} channel Explicitly selected channel. */
  async function shareOn(channel) {
    if (disposed || terminal || busy || dialog || !link) return;
    const currentLink = link.shareUrl;
    busy = true; clearFeedback(); status.textContent = ""; sync();
    try {
      const destination = wishlistShareDestination(channel, wishlistName, currentLink);
      if (channel === "email") { openMailComposer(destination); return; }
      if (channel === "messenger" && !destination.startsWith("https:")) {
        openMessengerComposer(destination);
        return;
      }
      const channelOptions = ShareChannels.find(item => item.id === channel);
      // Start clipboard access while the originating page still has focus, then navigate without awaiting it.
      const copied = channelOptions?.copy ? copyText(wishlistShareMessage(wishlistName, currentLink)).then(() => true, () => false) : null;
      pendingWindow = openShareWindow();
      if (pendingWindow) {
        pendingWindow.navigate(destination); pendingWindow = null;
      } else {
        const fallback = document.createElement("a"); fallback.href = destination; fallback.target = "_blank"; fallback.rel = "noopener noreferrer"; fallback.referrerPolicy = "no-referrer";
        fallback.className = "action-link action-link--secondary";
        fallback.textContent = `Ouvrir ${ShareChannels.find(item => item.id === channel)?.name}`;
        feedback.append(fallback);
        status.textContent += `${status.textContent ? " " : ""}La fenêtre n’a pas pu être ouverte.`;
      }
      if (copied) {
        const success = await copied;
        if (disposed) return;
        if (success) status.textContent += `${status.textContent ? " " : ""}Message copié, colle-le dans ${channelOptions?.name}.`;
        else {
          status.textContent += `${status.textContent ? " " : ""}La copie automatique est indisponible. Copie le lien manuellement.`;
          input.focus(); input.select();
        }
      }
    } catch {
      pendingWindow?.close(); pendingWindow = null;
      if (!disposed) {
        status.textContent = "Le partage automatique est indisponible. Copie le lien manuellement.";
        input.focus(); input.select();
      }
    } finally { busy = false; if (!disposed) sync(); }
  }
}
