import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

for (const width of [240, 390, 768, 1024, 1716]) {
  test(`creation without preview, responsive form and submit at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 917 });
    await page.clock.install({ time: new Date("2026-10-08T10:00:00+02:00") });
    const api = await controlledApi(context); api.state.authenticated = true;
    /** @type {string[]} */ const errors = []; page.on("pageerror", error => errors.push(error.message));
    /** @type {unknown[]} */ const writes = [];
    page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/wishlists") writes.push(request.postDataJSON()); });
    // Act
    await page.goto("/lists/new");
    const view = page.locator(".wishlist-create-view");
    const form = page.getByRole("form", { name: "Créer une liste", exact: true });
    const name = form.getByRole("textbox", { name: /Nom de la liste/ });
    const occasion = form.getByRole("combobox", { name: /Occasion/ });
    const date = form.getByLabel("Date de l’événement", { exact: true });
    const message = form.getByRole("textbox", { name: "Message", exact: true });
    const submit = form.getByRole("button", { name: "Créer ma liste", exact: true });
    await expect(view.getByRole("heading", { name: "Créer une liste" })).toBeVisible();
    await expect(view.locator("aside, img, dialog, .wishlist-live-preview")).toHaveCount(0);
    await expect(view.getByText("Aperçu", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("creation-empty.png"), fullPage: true });
    await submit.click();
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    expect(api.state.listWrites).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("creation-validation.png"), fullPage: true });
    await name.fill("Mon anniversaire");
    await occasion.selectOption("birthday");
    await date.fill("2027-01-18");
    await message.fill("Pour me faire de beaux cadeaux à mon anniversaire :)");
    await message.blur();
    await expect(view.getByRole("alert")).toHaveCount(0);
    const info = form.getByRole("button", { name: "À propos du mode surprise" });
    await info.focus();
    await expect(form.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(form.getByRole("tooltip")).toBeHidden();
    await expect(info).toBeFocused();
    const surprise = form.getByRole("switch", { name: "Mode surprise" });
    await expect(surprise).toBeChecked();
    await surprise.uncheck(); await surprise.check(); await info.blur();
    const boxes = await Promise.all([name, occasion, date, message, submit].map(control => control.boundingBox()));
    const [nameBox, occasionBox, dateBox, messageBox, submitBox] = boxes;
    expect(nameBox).not.toBeNull(); expect(occasionBox).not.toBeNull(); expect(dateBox).not.toBeNull(); expect(messageBox).not.toBeNull(); expect(submitBox).not.toBeNull();
    if (!nameBox || !occasionBox || !dateBox || !messageBox || !submitBox) throw new Error("Missing creation fields");
    expect(messageBox.width).toBeCloseTo(nameBox.width, 0);
    expect(messageBox.x).toBeCloseTo(nameBox.x, 0);
    if (width > 768) {
      expect(occasionBox.y).toBeCloseTo(dateBox.y, 0);
      expect(occasionBox.width).toBeCloseTo(dateBox.width, 0);
      expect(dateBox.x).toBeGreaterThan(occasionBox.x + occasionBox.width);
    } else {
      expect(occasionBox.width).toBeCloseTo(nameBox.width, 0);
      expect(dateBox.y).toBeGreaterThan(occasionBox.y + occasionBox.height);
    }
    for (const field of await form.locator(".form-field").all()) {
      const labelBox = await field.locator("label").boundingBox();
      const controlBox = await field.locator("input, select, textarea").boundingBox();
      expect((labelBox?.y ?? 0) + (labelBox?.height ?? 0)).toBeLessThan(controlBox?.y ?? 0);
    }
    expect(submitBox.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("creation-filled.png"), fullPage: true });
    if (width === 1716) {
      await page.evaluate(() => globalThis.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("creation-viewport.png") });
      await form.screenshot({ path: testInfo.outputPath("creation-form.png") });
    }
    await submit.click();
    // Assert
    await expect(page).toHaveURL(`/lists/${listId}`);
    await expect(page.getByRole("heading", { name: "Mon anniversaire", exact: true })).toBeVisible();
    expect(writes).toEqual([{ name: "Mon anniversaire", occasion: "birthday", eventDate: "2027-01-18", message: "Pour me faire de beaux cadeaux à mon anniversaire :)", surpriseMode: true }]);
    expect(api.state.listWrites).toBe(1); expect(api.unexpected).toEqual([]); expect(errors).toEqual([]);
  });
}

test("creation preserves the draft and blocks duplicate submits while pending", async ({ page, context }, testInfo) => {
  // Arrange
  await page.setViewportSize({ width: 1716, height: 917 });
  const api = await controlledApi(context); api.state.authenticated = true;
  /** @type {(() => void) | undefined} */ let release;
  const pending = new Promise(resolve => { release = () => resolve(undefined); });
  let writes = 0;
  await context.route("**/api/v1/wishlists", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    writes++; await pending; return route.fallback();
  });
  // Act
  await page.goto("/lists/new");
  const form = page.getByRole("form", { name: "Créer une liste", exact: true });
  await form.getByRole("textbox", { name: /Nom de la liste/ }).fill("Liste à conserver");
  await form.getByRole("combobox", { name: /Occasion/ }).selectOption("other");
  const submit = form.getByRole("button", { name: "Créer ma liste", exact: true });
  await submit.click();
  await expect(form).toHaveAttribute("aria-busy", "true");
  await expect(form.getByRole("button", { name: "Chargement…", exact: true })).toBeDisabled();
  await expect(form.getByRole("switch")).toBeDisabled();
  await expect(form.getByRole("textbox", { name: /Nom de la liste/ })).toHaveValue("Liste à conserver");
  await form.evaluate(element => { if (element instanceof globalThis.HTMLFormElement) element.requestSubmit(); });
  await page.screenshot({ path: testInfo.outputPath("creation-pending.png"), fullPage: true });
  // Assert
  expect(writes).toBe(1); release?.();
  await expect(page).toHaveURL(`/lists/${listId}`);
  expect(api.state.listWrites).toBe(1); expect(api.unexpected).toEqual([]);
});
