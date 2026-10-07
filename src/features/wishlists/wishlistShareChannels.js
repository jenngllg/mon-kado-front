import whatsapp from "../../assets/share/whatsapp.svg";
import facebook from "../../assets/share/facebook.png";
import messenger from "../../assets/share/messenger.svg";
import email from "../../assets/share/email.svg";
import { wishlistMessengerDestination } from "./wishlistMessengerShare.js";

/** @typedef {"whatsapp" | "facebook" | "messenger" | "email"} ShareChannel */
/** @typedef {{navigate: (url: string) => void, close: () => void}} ShareWindow */

export const ShareChannels = Object.freeze([
  { id: "whatsapp", name: "WhatsApp", icon: whatsapp, copy: false },
  { id: "facebook", name: "Facebook", icon: facebook, copy: true },
  { id: "messenger", name: "Messenger", icon: messenger, copy: false },
  { id: "email", name: "mail", icon: email, copy: false },
]);

/** @param {string | undefined} name List name. @param {string} link Complete validated bearer link. @returns {string} Plain message. */
export function wishlistShareMessage(name, link) {
  return `Découvre ma liste${name ? ` « ${name} »` : ""} sur MonKado : ${link}`;
}

/** @param {ShareChannel} channel Destination. @param {string | undefined} name List name.
 * @param {string} link Complete validated link, including its fragment.
 * @param {string} [userAgent] Browser platform hint for Messenger.
 * @returns {string} Explicit user-initiated destination. */
export function wishlistShareDestination(channel, name, link, userAgent = navigator.userAgent) {
  const message = wishlistShareMessage(name, link);
  if (channel === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(message)}`;
  if (channel === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
  if (channel === "messenger") return wishlistMessengerDestination(link, userAgent);
  const subject = `Ma liste${name ? ` « ${name} »` : ""} sur MonKado`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}

/** Reserves a window during the click, before asynchronous clipboard work loses user activation.
 * @returns {ShareWindow | null} Isolated window, or null when popups are blocked. */
export function openWishlistShareWindow() {
  const popup = window.open("about:blank", "_blank");
  if (!popup) return null;
  popup.opener = null;
  const policy = popup.document.createElement("meta");
  policy.name = "referrer"; policy.content = "no-referrer";
  popup.document.head.append(policy);
  return { navigate: url => {
    // Anchor navigation applies its referrer policy even in an inherited about:blank document.
    const anchor = popup.document.createElement("a");
    anchor.href = url; anchor.target = "_self"; anchor.rel = "noopener noreferrer"; anchor.referrerPolicy = "no-referrer";
    popup.document.body.append(anchor); anchor.click(); anchor.remove();
  }, close: () => popup.close() };
}

/** Opens the device mail composer without leaving an empty browser tab.
 * @param {string} url Encoded mailto URL. */
export function openWishlistMailComposer(url) {
  openExternalComposer(url);
}

/** Opens the native Messenger sharing interface on supported mobile platforms.
 * @param {string} url Encoded application URI, never a desktop-specific deep link. */
export function openWishlistMessengerComposer(url) {
  openExternalComposer(url);
}

/** @param {string} url Explicit user-selected external composer destination. */
function openExternalComposer(url) {
  const anchor = document.createElement("a"); anchor.href = url;
  anchor.rel = "noopener noreferrer"; anchor.referrerPolicy = "no-referrer";
  document.body.append(anchor); anchor.click(); anchor.remove();
}
