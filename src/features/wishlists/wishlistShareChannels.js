import whatsapp from "../../assets/share/whatsapp.svg";
import facebook from "../../assets/share/facebook.png";
import messenger from "../../assets/share/messenger.svg";
import email from "../../assets/share/email.svg";
import discord from "../../assets/share/discord.svg";
import x from "../../assets/share/x.svg";
import { wishlistMessengerDestination } from "./wishlistMessengerShare.js";

/** @typedef {"whatsapp" | "facebook" | "messenger" | "discord" | "x" | "email"} ShareChannel */
/** @typedef {{navigate: (url: string) => void, close: () => void}} ShareWindow */

export const ShareChannels = Object.freeze([
  { id: "whatsapp", name: "WhatsApp", icon: whatsapp, copy: false },
  { id: "facebook", name: "Facebook", icon: facebook, copy: true },
  { id: "messenger", name: "Messenger", icon: messenger, copy: false },
  { id: "discord", name: "Discord", icon: discord, copy: false },
  { id: "x", name: "X", icon: x, copy: false },
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
  const subject = `Ma liste${name ? ` « ${name} »` : ""} sur MonKado`;
  return shareDestination(channel, { message, subject, link }, userAgent);
}

/** @param {ShareChannel} channel Destination. @param {{message:string,subject:string,link:string}} content Prepared sharing copy.
 * @param {string} [userAgent] Browser platform hint. */
export function shareDestination(channel, { message, subject, link }, userAgent = navigator.userAgent) {
  if (channel === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(message)}`;
  if (channel === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
  if (channel === "messenger") return wishlistMessengerDestination(link, userAgent);
  if (channel === "x") return `https://x.com/intent/tweet?text=${encodeURIComponent(message)}`;
  // Discord sharing uses the system picker, which has no destination URL.
  if (channel === "discord") return "";
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

/** Hands the prepared message to the system picker during the initiating click.
 * The user selects Discord and confirms recipients in the receiving app.
 * @param {string | undefined} name List name.
 * @param {string} link Complete validated bearer link, including its fragment.
 * @returns {Promise<void>} Handoff only; it does not confirm delivery. */
export function shareWishlistWithSystem(name, link) {
  const data = { title: name ? `Ma liste « ${name} » · MonKado` : "Ma liste · MonKado", text: wishlistShareMessage(name, link) };
  return shareContentWithSystem(data);
}

/** @param {{title:string,text:string}} data Prepared content shared only on a user action. */
export function shareContentWithSystem(data) {
  if (typeof navigator.share !== "function" || (typeof navigator.canShare === "function" && !navigator.canShare(data))) {
    throw new DOMException("System sharing is unavailable.", "NotSupportedError");
  }
  // Include the complete link once in the text; separate url fields can duplicate it in receiving apps.
  return navigator.share(data);
}

/** @param {string} url Explicit user-selected destination. */
function openExternalComposer(url) {
  const anchor = document.createElement("a"); anchor.href = url;
  anchor.rel = "noopener noreferrer"; anchor.referrerPolicy = "no-referrer";
  document.body.append(anchor); anchor.click(); anchor.remove();
}
