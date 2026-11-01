import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

for (const viewport of [{ width: 560, height: 760 }, { width: 390, height: 844 }]) {
  test(`adds a product after sign-in at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const api = await controlledApi(context);
    const fragment = new URLSearchParams({ url: "https://shop.example/product?variant=42" });
    await page.goto("/");
    const opened = page.waitForEvent("popup");
    await page.evaluate(url => { globalThis.window.open(url, "_blank", "width=560,height=760"); }, `/extension/add#${fragment}`);
    const popup = await opened;
    await popup.setViewportSize(viewport);
    await expect(popup).toHaveURL(/\/login\?returnTo=/);
    expect(popup.url()).not.toContain("shop.example");
    await popup.getByLabel("Adresse e-mail").fill("test@example.test");
    await popup.getByLabel("Mot de passe", { exact: false }).fill("password-test");
    await popup.getByRole("button", { name: "Se connecter", exact: true }).click();
    await expect(popup.getByRole("textbox", { name: "Nom du souhait" })).toHaveValue("");
    await popup.getByRole("textbox", { name: "Nom du souhait" }).fill("Théière");
    await expect(popup.getByRole("combobox", { name: "Liste" })).toHaveValue(listId);
    await popup.screenshot({ path: `.local/extension-add-${viewport.width}.png`, fullPage: true });
    const closed = popup.waitForEvent("close");
    await popup.getByRole("button", { name: "Ajouter", exact: true }).click();
    await closed;
    expect(api.state.wishWrites).toBe(1);
    expect(api.wish.url).toBe("https://shop.example/product?variant=42");
    expect(api.unexpected).toEqual([]);
  });
}
