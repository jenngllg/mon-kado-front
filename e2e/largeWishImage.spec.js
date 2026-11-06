/* global document, HTMLCanvasElement, innerWidth */
import { test, expect } from "./fixture.js";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`large transparent image is prepared once and submitted with keyboard at ${width}px`, async ({ page, context }) => {
    // Arrange: native encoder and decoder, with only the API replaced.
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context); api.state.authenticated = true; api.state.wishExists = false;
    await page.addInitScript(() => {
      const native = HTMLCanvasElement.prototype.toBlob;
      let encodes = 0;
      Object.defineProperty(globalThis, "imageEncodes", { get: () => encodes });
      HTMLCanvasElement.prototype.toBlob = function (...args) { encodes++; return native.apply(this, args); };
    });
    await page.goto(`/lists/${listId}/wishes/new`);
    const source = await page.evaluate(async () => {
      const canvas = document.createElement("canvas"); canvas.width = 1800; canvas.height = 1200;
      const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
      const pixels = ctx.createImageData(canvas.width, canvas.height); let seed = 173;
      for (let i = 0; i < pixels.data.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels.data[i + channel] = seed >>> 24; }
        pixels.data[i + 3] = (i / 4) % canvas.width < 400 ? 0 : 255;
      }
      ctx.putImageData(pixels, 0, 0);
      const data = canvas.toDataURL("image/png"); canvas.width = canvas.height = 0; return data.split(",")[1];
    });
    const buffer = Buffer.from(source, "base64"); expect(buffer.length).toBeGreaterThan(384 * 1024);
    const transport = { uploaded: /** @type {Buffer | null} */ (null) };
    let writes = 0;
    const imageUrl = `http://localhost:7000/api/v1/wishlists/${listId}/wishes/${wishId}/image?token=test-image`;
    await context.route(`**/api/v1/wishlists/${listId}/wishes/${wishId}/image*`, async route => {
      const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"wish-2"' };
      if (route.request().method() === "OPTIONS") return route.fallback();
      if (route.request().method() === "PUT") {
        writes++; const body = route.request().postDataBuffer(); expect(body).not.toBeNull();
        if (!body) throw new Error("Missing multipart upload");
        expect(body.subarray(0, 180).toString()).toContain("Content-Type: image/webp");
        transport.uploaded = body.subarray(body.indexOf("\r\n\r\n") + 4, body.lastIndexOf("\r\n--"));
        api.wish.imageUrl = imageUrl; api.state.wishVersion = 2;
        return route.fulfill({ status: 200, headers, json: api.wish });
      }
      if (!transport.uploaded) throw new Error("Image read before upload");
      return route.fulfill({ status: 200, headers: { ...headers, "Content-Type": "image/webp" }, body: transport.uploaded });
    });

    // Act: prepare on selection, preserve the draft through an invalid replacement, then submit.
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page.locator('input[name="name"]').fill("Image transparente");
    await page.locator('input[type="file"]').setInputFiles({ name: "large.png", mimeType: "image/png", buffer });
    const preview = page.locator(".wish-image-section__preview img");
    await expect(preview).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer", exact: true })).toBeEnabled();
    const encodes = await page.evaluate(() => Reflect.get(globalThis, "imageEncodes"));
    expect(encodes).toBeGreaterThan(0); expect(encodes).toBeLessThanOrEqual(2);
    const pixels = await preview.evaluate(async node => {
      const image = /** @type {HTMLImageElement} */ (node);
      await image.decode(); const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d")); ctx.drawImage(image, 0, 0);
      return { width: image.naturalWidth, height: image.naturalHeight, transparent: ctx.getImageData(1, 1, 1, 1).data[3], opaque: ctx.getImageData(canvas.width - 2, 1, 1, 1).data[3], src: image.src };
    });
    expect(pixels.width).toBeGreaterThanOrEqual(1024); expect(pixels.width).toBeLessThanOrEqual(1600);
    expect(pixels.height / pixels.width).toBeCloseTo(2 / 3, 2);
    expect(pixels.transparent).toBe(0); expect(pixels.opaque).toBe(255);
    await page.locator('input[type="file"]').setInputFiles({ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("invalid") });
    await expect(page.getByText("Format d’image non pris en charge : JPEG, PNG ou WebP non animé uniquement.", { exact: true })).toBeVisible();
    await expect(preview).toHaveAttribute("src", pixels.src);
    await page.getByRole("button", { name: "Continuer", exact: true }).focus(); await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Ajouter le souhait", exact: true }).focus(); await page.keyboard.press("Enter");

    // Assert: the exact prepared bytes are reused, with one write and a readable persisted image.
    await expect(page).toHaveURL(new RegExp(`/lists/${listId}$`));
    expect(writes).toBe(1); expect(api.state.wishWrites).toBe(1);
    expect(await page.evaluate(() => Reflect.get(globalThis, "imageEncodes"))).toBe(encodes);
    expect(transport.uploaded?.length).toBeLessThan(buffer.length / 4);
    await page.reload();
    const stored = page.locator("main .wish-card img").first(); await expect(stored).toBeVisible();
    expect(await stored.evaluate(async node => { const image = /** @type {HTMLImageElement} */ (node); await image.decode(); return image.naturalWidth; })).toBe(pixels.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(api.unexpected).toEqual([]);
  });
}
