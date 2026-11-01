import { MetaApplicationId, MessengerReturnUrl } from "../../config/metaSharing.js";

/** Builds the explicit recipient-selection destination without sending a message.
 * Mobile routes follow Meta's sdk.openMessenger implementation; desktop uses the Send Dialog.
 * @param {string} link Complete validated share URL, including its bearer fragment.
 * @param {string} userAgent Browser platform hint, never a source of URL parameters.
 * @returns {string} Messenger application URI or web dialog URL. */
export function wishlistMessengerDestination(link, userAgent) {
  if (/Android/i.test(userAgent)) {
    return "intent://share/#Intent;package=com.facebook.orca;scheme=fb-messenger;" +
      `S.android.intent.extra.TEXT=${encodeURIComponent(link)};S.trigger=send_plugin;` +
      `S.platform_app_id=${MetaApplicationId};end`;
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return `fb-messenger://share?link=${encodeURIComponent(link)}&app_id=${MetaApplicationId}`;
  }

  const dialog = new URL("https://www.facebook.com/dialog/send");
  dialog.searchParams.set("app_id", MetaApplicationId);
  dialog.searchParams.set("display", "popup");
  dialog.searchParams.set("link", link);
  dialog.searchParams.set("redirect_uri", MessengerReturnUrl);

  return dialog.href;
}
