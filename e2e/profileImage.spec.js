import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`profile photo removal remains visible and keyboard usable at ${width}px`, async ({ page, context }, testInfo) => {
    const api = await controlledApi(context); api.state.authenticated = true;
    const memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
    const photoPath = `/api/v1/members/${memberId}/profile/image`;
    const fixtureImage = await page.evaluate(() => {
      const canvas = globalThis.document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
      const paint = canvas.getContext("2d");
      if (!paint) throw new Error("The fixture requires a canvas context");
      paint.fillStyle = "#dfe5d7"; paint.fillRect(0, 0, 128, 128);
      paint.fillStyle = "#123f2b"; paint.beginPath(); paint.arc(64, 64, 32, 0, Math.PI * 2); paint.fill();
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"photo-current"' };
    let hasPhoto = true, removals = 0;
    await context.route("**/api/v1/auth/sessions/current", async route => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ status: 200, headers, json: {
        id: memberId, displayName: "Camille test", email: "test@example.test", roles: ["member"], isGoogleLinked: false,
        profileImageUrl: hasPhoto ? `http://localhost:7000${photoPath}?imageId=019c52dd-56c1-7cc6-8a95-243f3a032e09` : null,
      } });
    });
    await context.route(`**${photoPath}?*`, route => route.fulfill({ status: 200, headers: { ...headers, "Content-Type": "image/png" },
      body: Buffer.from(fixtureImage, "base64") }));
    await context.route("**/api/v1/members/current/profile/image", async route => {
      if (route.request().method() !== "DELETE") return route.fallback();
      expect(route.request().headers()["if-match"]).toBe('"photo-current"');
      removals++; hasPhoto = false;
      await route.fulfill({ status: 204, headers: { ...headers, ETag: '"photo-removed"' } });
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/profile");
    const section = page.locator(".profile-image-section");
    const remove = section.getByRole("button", { name: "Supprimer la photo", exact: true });
    await expect(section.locator(".member-avatar img")).toBeVisible();
    await expect(remove).toBeVisible();
    await expect(remove).toBeEnabled();
    await expect(remove.locator("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(remove).toHaveClass(/icon-action--danger/);
    await expect(remove).toHaveCSS("color", "rgb(180, 35, 24)");
    await expect(remove).toHaveCSS("background-color", "rgb(255, 254, 250)");
    expect(await remove.evaluate(el => globalThis.getComputedStyle(el).borderTopColor)).toBe(
      await section.getByRole("button", { name: "Remplacer la photo", exact: true }).evaluate(el => globalThis.getComputedStyle(el).borderTopColor));
    await expect(remove).toHaveCSS("width", "44px");
    await expect(remove).toHaveCSS("height", "44px");
    await remove.hover();
    await expect(remove).toHaveCSS("color", "rgb(180, 35, 24)");
    await remove.focus();
    await expect(remove).toBeFocused();
    await expect(remove).toHaveCSS("outline-style", "solid");
    await section.screenshot({ path: testInfo.outputPath("profile-photo-removal.png") });
    expect(removals).toBe(0);
    await remove.press("Enter");
    await expect(section.getByText("Photo supprimée", { exact: true })).toBeVisible();
    await expect(remove).toBeHidden();
    expect(removals).toBe(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(api.unexpected).toEqual([]);
  });
}

for (const width of [390, 768, 1440]) {
  test(`profile crop uses one save above the name at ${width}px`, async ({ page, context }, testInfo) => {
    const api = await controlledApi(context); api.state.authenticated = true;
    /** @type {string[]} */ const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const photo = readFileSync(new URL("../src/assets/design/birthday.webp", import.meta.url));
    const memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
    const imageUrl = `http://localhost:7000/api/v1/members/${memberId}/profile/image?imageId=019c52dd-56c1-7cc6-8a95-243f3a032e09`;
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"photo-current"' };
    let displayName = "MonKado", version = '"photo-current"', uploaded = 0;
    /** @type {string[]} */ const writes = [];
    await context.route("**/api/v1/auth/sessions/current", async route => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ status: 200, headers: { ...headers, ETag: version }, json: {
        id: memberId, displayName, email: "test@example.test", roles: ["member"], isGoogleLinked: false, profileImageUrl: imageUrl,
      } });
    });
    await context.route("**/api/v1/members/*/profile/image?*", route => route.fulfill({ status: 200, headers: { ...headers, "Content-Type": "image/webp" }, body: photo }));
    await context.route("**/api/v1/members/current/profile", async route => {
      if (route.request().method() !== "PUT") return route.fallback();
      expect(route.request().headers()["if-match"]).toBe(version);
      displayName = route.request().postDataJSON().displayName; version = '"name-saved"'; writes.push("name");
      await route.fulfill({ status: 200, headers: { ...headers, ETag: version }, json: { displayName, profileImageUrl: imageUrl } });
    });
    await context.route("**/api/v1/members/current/profile/image", async route => {
      if (route.request().method() !== "PUT") return route.fallback();
      expect(route.request().headers()["if-match"]).toBe('"name-saved"');
      expect(route.request().postDataBuffer()?.includes(Buffer.from("Content-Type: image/png"))).toBe(true);
      uploaded++; version = '"photo-saved"'; writes.push("photo");
      await route.fulfill({ status: 200, headers: { ...headers, ETag: version }, json: { displayName, profileImageUrl: imageUrl } });
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/profile");
    const form = page.getByRole("form", { name: "Modifier mon profil" });
    const section = page.locator(".profile-image-section");
    const input = form.getByRole("textbox", { name: "Nom d’affichage" });
    const save = form.getByRole("button", { name: "Enregistrer", exact: true });
    const choose = () => section.locator('input[type="file"]').setInputFiles({ name: "photo.webp", mimeType: "image/webp", buffer: photo });
    await expect(section.getByRole("button", { name: "Remplacer la photo", exact: true })).toBeEnabled();
    await expect(section).toHaveCSS("border-top-width", "0px");
    await expect(section).toHaveCSS("padding-top", "0px");
    const photoHeading = section.getByRole("heading", { name: "Photo de profil", exact: true });
    await expect(photoHeading).toHaveClass("visually-hidden");
    await expect(photoHeading).toHaveCSS("clip-path", "inset(50%)");
    await choose();
    const crop = section.locator(".profile-photo-crop__viewport");
    await expect(crop.locator("img")).toBeVisible();
    await expect(section).toHaveCSS("border-top-width", "0px");
    await expect(save).toBeEnabled();
    await expect(section.locator('input[type="range"]')).toHaveCount(1);
    await expect(form.getByRole("button", { name: "Enregistrer", exact: true })).toHaveCount(1);
    await expect(section.locator(".profile-image-section__body")).toBeHidden();
    await expect(section.getByRole("button", { name: "Valider le recadrage" })).toHaveCount(0);
    await expect(section.getByText("Photo enregistrée", { exact: true })).toBeHidden();
    await section.getByRole("slider", { name: "Zoom" }).evaluate(control => {
      const range = /** @type {HTMLInputElement} */ (control);
      range.value = "2"; range.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await form.screenshot({ path: testInfo.outputPath("profile-crop-form.png") });
    await page.screenshot({ path: testInfo.outputPath("profile-crop-page.png"), fullPage: true });
    const initial = await crop.locator("img").getAttribute("style");
    await crop.press("ArrowRight");
    expect(await crop.locator("img").getAttribute("style")).not.toBe(initial);
    await expect(crop).toHaveCSS("outline-style", "solid");
    const cropBox = await section.boundingBox(), nameBox = await input.boundingBox();
    expect(cropBox && nameBox && cropBox.y + cropBox.height < nameBox.y).toBe(true);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await form.screenshot({ path: testInfo.outputPath("profile-crop-keyboard-focus.png") });
    await input.fill("MonKado modifié");
    await section.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(input).toHaveValue("MonKado modifié");
    await expect(crop).toHaveCount(0);
    expect(uploaded).toBe(0);
    await choose();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(section.getByText("Photo enregistrée", { exact: true })).toBeVisible();
    expect(writes).toEqual(["name", "photo"]); expect(uploaded).toBe(1);
    await expect(crop).toHaveCount(0);
    await choose();
    await expect(save).toBeEnabled();
    await expect(section.getByText("Photo enregistrée", { exact: true })).toBeHidden();
    expect(errors).toEqual([]); expect(api.unexpected).toEqual([]);
  });
}
