import { createButton } from "../../components/index.js";
import { registerComponentCleanup } from "../../components/componentLifecycle.js";
import { openWishlistMailComposer, openWishlistMessengerComposer, openWishlistShareWindow, ShareChannels, shareContentWithSystem, shareDestination } from "../wishlists/wishlistShareChannels.js";

/** Same channels and platform handoff as list sharing, with invitation-specific copy.
 * @param {{name:string,link:string,copy:(text:string)=>Promise<void>,status:HTMLElement,
 * openWindow?:typeof openWishlistShareWindow,openMail?:typeof openWishlistMailComposer,
 * openMessenger?:typeof openWishlistMessengerComposer,shareSystem?:typeof shareContentWithSystem}} options Explicit share commands.
 */
export function createGroupShareChannels({ name, link, copy, status, openWindow = openWishlistShareWindow, openMail = openWishlistMailComposer, openMessenger = openWishlistMessengerComposer, shareSystem = shareContentWithSystem }) {
  const channels = document.createElement("div"); channels.className = "wishlist-share__channels";
  channels.setAttribute("role", "group"); channels.setAttribute("aria-label", "Partager le groupe sur un canal");
  let disposed = false, pending = false;
  registerComponentCleanup(channels, () => { disposed = true; });
  for (const channel of ShareChannels) {
    const button = createButton({ label: `Partager par ${channel.name}`, variant: "secondary", onClick: () => { void share(/** @type {import("../wishlists/wishlistShareChannels.js").ShareChannel} */ (channel.id)); } });
    button.classList.add("icon-action"); button.setAttribute("aria-label", `Partager par ${channel.name}`); button.title = `Partager par ${channel.name}`;
    button.dataset.shareChannel = channel.id;
    const icon = document.createElement("img"); icon.src = channel.icon; icon.alt = ""; icon.width = icon.height = 24;
    button.replaceChildren(icon);
    const entry = document.createElement("div"), label = document.createElement("span");
    entry.className = "wishlist-share__channel"; label.className = "wishlist-share__channel-name"; label.textContent = channel.id === "email" ? "E-mail" : channel.name;
    entry.append(button, label); channels.append(entry);
  }
  return channels;

  /** @param {import("../wishlists/wishlistShareChannels.js").ShareChannel} channel Explicit selection. */
  async function share(channel) {
    if (disposed || pending) return;
    const message = `Rejoins le groupe « ${name} » sur MonKado : ${link}`, subject = `Invitation au groupe « ${name} » sur MonKado`;
    const destination = shareDestination(channel, { message, subject, link });
    pending = true; status.textContent = "";
    /** @type {import("../wishlists/wishlistShareChannels.js").ShareWindow|null} */ let popup = null;
    for (const button of channels.querySelectorAll("button")) button.disabled = true;
    try {
      if (channel === "discord") {
        status.textContent = "Choisis Discord dans le menu de partage.";
        await shareSystem({ title: subject, text: message });
      } else if (channel === "email") openMail(destination);
      else if (channel === "messenger" && !destination.startsWith("https:")) openMessenger(destination);
      else {
        const copied = channel === "facebook" ? copy(message).then(() => true, () => false) : null;
        popup = openWindow();
        if (popup) { popup.navigate(destination); popup = null; }
        else if (!disposed) {
          const fallback = document.createElement("a"); fallback.href = destination; fallback.target = "_blank"; fallback.rel = "noopener noreferrer"; fallback.referrerPolicy = "no-referrer";
          fallback.textContent = `Ouvrir ${ShareChannels.find(item => item.id === channel)?.name}`; fallback.className = "action-link";
          status.replaceChildren(document.createTextNode("La fenêtre n’a pas pu être ouverte. "), fallback);
        }
        if (copied && await copied && !disposed) status.append(document.createTextNode(" Message copié, colle-le dans Facebook."));
      }
    } catch (error) {
      popup?.close();
      if (!disposed) status.textContent = error instanceof DOMException && error.name === "AbortError" ? "Partage fermé." : "Le partage automatique est indisponible. Tu peux copier le lien.";
    } finally {
      pending = false;
      if (!disposed) for (const button of channels.querySelectorAll("button")) button.disabled = false;
    }
  }
}
