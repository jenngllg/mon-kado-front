import { describe, expect, it } from "vitest";
import { wishlistMessengerDestination } from "../src/features/wishlists/wishlistMessengerShare.js";

const link = "https://www.monkado.fr/shared-wishlists/019c52dd-56c1-7cc6-8a95-243f3a032e04#" + "A".repeat(43);

describe("Messenger recipient selection", () => {
  it.each(["Windows NT 10.0", "Macintosh", "Linux", ""])("uses the web Send Dialog on %s", userAgent => {
    const destination = new URL(wishlistMessengerDestination(link, userAgent));
    expect(destination.origin).toBe("https://www.facebook.com");
    expect(destination.pathname).toBe("/dialog/send");
    expect(Object.fromEntries(destination.searchParams)).toEqual({
      app_id: "1072330919122670", display: "popup", link, redirect_uri: "https://www.monkado.fr/",
    });
    expect(destination.hash).toBe("");
  });
  it.each(["iPhone", "iPad", "iPod"])("uses native Messenger sharing on %s without losing the fragment", userAgent => {
    const destination = new URL(wishlistMessengerDestination(link, userAgent));
    expect(destination.protocol).toBe("fb-messenger:"); expect(destination.hostname).toBe("share");
    expect(destination.searchParams.get("link")).toBe(link);
    expect(destination.searchParams.get("app_id")).toBe("1072330919122670");
    expect(destination.hash).toBe("");
  });
  it("targets only the official Android Messenger package and encodes the full link", () => {
    expect(wishlistMessengerDestination(link, "Mozilla/5.0 Android")).toBe(
      "intent://share/#Intent;package=com.facebook.orca;scheme=fb-messenger;" +
      `S.android.intent.extra.TEXT=${encodeURIComponent(link)};S.trigger=send_plugin;` +
      "S.platform_app_id=1072330919122670;end",
    );
  });
  it.each(["Windows", "Android", "iPhone"])("encodes delimiters as link data, never as routing parameters on %s", userAgent => {
    const trickyLink = link + "&app_id=999;end?redirect_uri=https://evil.test/%25\n";
    const destination = wishlistMessengerDestination(trickyLink, userAgent);
    if (userAgent === "Android") {
      expect(destination).toContain(`S.android.intent.extra.TEXT=${encodeURIComponent(trickyLink)};`);
      expect(destination).not.toContain(";end?redirect_uri=");
    } else {
      const parsed = new URL(destination);
      expect(parsed.searchParams.get("link")).toBe(trickyLink);
      expect(parsed.searchParams.get("app_id")).toBe("1072330919122670");
      expect(parsed.searchParams.get("redirect_uri")).toBe(userAgent === "Windows" ? "https://www.monkado.fr/" : null);
    }
  });
});
