// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { openWishlistMailComposer, openWishlistShareWindow, ShareChannels, wishlistShareDestination, wishlistShareMessage } from "../src/features/wishlists/wishlistShareChannels.js";
import { createWishlistShareSection } from "../src/features/wishlists/wishlistShareSection.js";
import { disposeComponent } from "../src/components/index.js";
import { barrier } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const link = Object.freeze({ id, shareUrl: `https://monkado.test/shared-wishlists/${id}#${"A".repeat(43)}`, etag: '"link"' });
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.restoreAllMocks(); });
/** @param {Partial<Parameters<typeof createWishlistShareSection>[0]>} [options] Dependencies. */
function setup(options = {}) {
  const load = vi.fn(async () => link), create = vi.fn(async () => link), copyText = vi.fn(async () => {});
  const navigate = vi.fn(), close = vi.fn(), openShareWindow = vi.fn(() => ({ navigate, close })), openMailComposer = vi.fn();
  const view = createWishlistShareSection({ wishlistId: id, wishlistName: "Été & Noël", load, create, copyText, openShareWindow, openMailComposer, onUnavailable: vi.fn(), ...options });
  views.push(view); document.body.append(view);
  /** @param {string} name Accessible channel name. */
  function click(name) { /** @type {HTMLButtonElement} */ (view.querySelector(`[aria-label="Partager par ${name}"]`)).click(); }
  const input = /** @type {HTMLTextAreaElement} */ (view.querySelector("textarea"));
  return { view, load, create, copyText, navigate, close, openShareWindow, openMailComposer, click, input };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

describe("share channel destinations", () => {
  it("offers exactly five agreed channels", () => {
    expect(ShareChannels.map(channel => channel.id)).toEqual(["whatsapp", "facebook", "discord", "messenger", "email"]);
  });
  it.each([undefined, "Été & Noël ? #1\n"])("encodes the complete link and name %s", name => {
    const message = wishlistShareMessage(name, link.shareUrl);
    expect(message).toContain(link.shareUrl);
    const whatsapp = new URL(wishlistShareDestination("whatsapp", name, link.shareUrl));
    expect(whatsapp.origin).toBe("https://wa.me"); expect(whatsapp.searchParams.get("text")).toBe(message);
    const facebook = new URL(wishlistShareDestination("facebook", name, link.shareUrl));
    expect(facebook.origin).toBe("https://www.facebook.com"); expect(facebook.searchParams.get("u")).toBe(link.shareUrl);
    const mail = new URL(wishlistShareDestination("email", name, link.shareUrl));
    expect(mail.protocol).toBe("mailto:"); expect(mail.pathname).toBe(""); expect(mail.searchParams.get("body")).toBe(message);
    expect(mail.searchParams.get("subject")).toBe(`Ma liste${name ? ` « ${name} »` : ""} sur MonKado`);
  });
  it.each(["discord", "messenger"])("never sends the secret to the %s opening URL", channel => {
    const destination = wishlistShareDestination(/** @type {import("../src/features/wishlists/wishlistShareChannels.js").ShareChannel} */ (channel), "Ma liste", link.shareUrl);
    expect(destination).not.toContain(link.shareUrl); expect(new URL(destination).hash).toBe("");
  });
  it("reserves and isolates the popup before navigating", () => {
    const close = vi.fn();
    const document = globalThis.document.implementation.createHTMLDocument();
    const popup = { opener: window, document, close };
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(/** @this {HTMLAnchorElement} */ function () {
      expect(this.href).toBe("https://discord.com/channels/@me"); expect(this.rel).toBe("noopener noreferrer");
      expect(this.referrerPolicy).toBe("no-referrer"); expect(this.target).toBe("_self");
    });
    const open = vi.spyOn(window, "open").mockReturnValue(/** @type {Window} */ (/** @type {unknown} */ (popup)));
    const result = openWishlistShareWindow();
    expect(open).toHaveBeenCalledExactlyOnceWith("about:blank", "_blank"); expect(popup.opener).toBeNull();
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute("content")).toBe("no-referrer");
    expect(click).not.toHaveBeenCalled(); result?.navigate("https://discord.com/channels/@me"); result?.close();
    expect(click).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(document.querySelector("a")).toBeNull();
  });
  it("reports a blocked popup", () => {
    vi.spyOn(window, "open").mockReturnValue(null); expect(openWishlistShareWindow()).toBeNull();
  });
  it("opens mail using a native mailto link without a popup", () => {
    const open = vi.spyOn(window, "open");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(/** @this {HTMLAnchorElement} */ function () { expect(this.href).toBe("mailto:?subject=Test"); });
    openWishlistMailComposer("mailto:?subject=Test"); expect(click).toHaveBeenCalledOnce(); expect(open).not.toHaveBeenCalled(); expect(document.querySelector("a")).toBeNull();
  });
});

describe("owner channel actions", () => {
  it("shows local accessible icons only below a confirmed active link", async () => {
    const gate = barrier(); const ui = setup({ load: async () => { await gate.promise; return link; } });
    const channels = /** @type {HTMLElement} */ (ui.view.querySelector(".wishlist-share__channels"));
    expect(channels.hidden).toBe(true); expect([...channels.querySelectorAll("button")].every(button => button.disabled)).toBe(true);
    gate.resolve(); await settle(); expect(channels.hidden).toBe(false); expect(channels.previousElementSibling?.contains(ui.input)).toBe(true);
    expect([...channels.querySelectorAll("button")].map(button => button.getAttribute("aria-label"))).toEqual(["Partager par WhatsApp", "Partager par Facebook", "Partager par Discord", "Partager par Messenger", "Partager par mail"]);
    expect([...channels.querySelectorAll("img")].every(image => image.getAttribute("src")?.startsWith("/images/share/") && image.alt === "")).toBe(true);
    expect(ui.create).not.toHaveBeenCalled(); expect(ui.copyText).not.toHaveBeenCalled(); expect(ui.openShareWindow).not.toHaveBeenCalled();
  });
  it.each(["WhatsApp", "Facebook"])("opens %s only on explicit click without a link mutation", async name => {
    const ui = setup(); await settle(); ui.click(name); await settle();
    expect(ui.openShareWindow).toHaveBeenCalledOnce(); expect(ui.navigate).toHaveBeenCalledOnce();
    expect([...new URL(ui.navigate.mock.calls[0][0]).searchParams.values()].join(" ")).toContain(link.shareUrl);
    if (name === "Facebook") expect(ui.copyText).toHaveBeenCalledExactlyOnceWith(wishlistShareMessage("Été & Noël", link.shareUrl));
    else expect(ui.copyText).not.toHaveBeenCalled();
    expect(ui.create).not.toHaveBeenCalled(); expect(ui.close).not.toHaveBeenCalled();
    expect(ui.view.textContent).not.toContain("envoyé");
  });
  it("opens the mail composer without a popup or server message", async () => {
    const ui = setup(); await settle(); ui.click("mail"); await settle();
    expect(ui.openMailComposer).toHaveBeenCalledExactlyOnceWith(wishlistShareDestination("email", "Été & Noël", link.shareUrl));
    expect(ui.openShareWindow).not.toHaveBeenCalled(); expect(ui.copyText).not.toHaveBeenCalled(); expect(ui.create).not.toHaveBeenCalled();
    expect(ui.view.textContent).not.toContain("envoyé");
  });
  it.each(["Facebook", "Discord", "Messenger"])("copies before opening %s and blocks duplicate clicks", async name => {
    const gate = barrier(), copyText = vi.fn(async () => { await gate.promise; }); const ui = setup({ copyText }); await settle();
    ui.click(name); ui.click(name); window.dispatchEvent(new Event("focus"));
    expect(ui.openShareWindow).toHaveBeenCalledOnce(); expect(ui.navigate).toHaveBeenCalledOnce(); expect(ui.load).toHaveBeenCalledOnce();
    expect(copyText.mock.invocationCallOrder[0]).toBeLessThan(ui.openShareWindow.mock.invocationCallOrder[0]);
    expect(copyText).toHaveBeenCalledExactlyOnceWith(wishlistShareMessage("Été & Noël", link.shareUrl));
    expect([...ui.view.querySelectorAll("button")].every(item => item.disabled)).toBe(true);
    gate.resolve(); await settle(); expect(ui.navigate).toHaveBeenCalledOnce(); expect(ui.close).not.toHaveBeenCalled();
    expect(ui.view.textContent).toContain(`Message copié, colle-le dans ${name}`);
  });
  it("offers a safe explicit link when a popup is blocked and clears it on refresh", async () => {
    const ui = setup({ openShareWindow: () => null }); await settle(); ui.click("Facebook"); await settle();
    const fallback = /** @type {HTMLAnchorElement} */ (ui.view.querySelector("a"));
    expect(fallback.textContent).toBe("Ouvrir Facebook"); expect(fallback.rel).toBe("noopener noreferrer");
    expect(new URL(fallback.href).searchParams.get("u")).toBe(link.shareUrl);
    window.dispatchEvent(new Event("focus")); await settle(); expect(ui.view.querySelector("a")).toBeNull();
  });
  it.each(["Facebook", "Discord", "Messenger"])("still opens %s and selects the link when copying fails", async name => {
    const ui = setup({ copyText: async () => { throw Error(link.shareUrl); } }); await settle(); ui.click(name); await settle();
    expect(ui.close).not.toHaveBeenCalled(); expect(ui.navigate).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(ui.input);
    expect(ui.input.selectionEnd).toBe(link.shareUrl.length); expect(ui.view.textContent).not.toContain(link.shareUrl);
  });
  it("opens immediately and ignores late clipboard completion after disposal", async () => {
    const gate = barrier(); const ui = setup({ copyText: async () => { await gate.promise; } }); await settle(); ui.click("Messenger");
    disposeComponent(ui.view); gate.resolve(); await settle();
    expect(ui.close).not.toHaveBeenCalled(); expect(ui.navigate).toHaveBeenCalledOnce();
    expect(ui.view.textContent).not.toContain("Message copié");
    expect(/** @type {HTMLElement} */ (ui.view.querySelector(".wishlist-share__channels")).hidden).toBe(true);
  });
  it("hides channels for private lists and after failed refresh", async () => {
    const ui = setup(); await settle(); ui.load.mockRejectedValueOnce(Error("No read")); window.dispatchEvent(new Event("focus")); await settle();
    expect(/** @type {HTMLElement} */ (ui.view.querySelector(".wishlist-share__channels")).hidden).toBe(true);
    const privateUi = setup({ load: async () => null }); await settle(); privateUi.click("Facebook");
    expect(privateUi.openShareWindow).not.toHaveBeenCalled(); expect(privateUi.create).not.toHaveBeenCalled();
  });
});
