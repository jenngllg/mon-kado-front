/* global AbortSignal, Blob, URL, createImageBitmap, document, fetch, location */

/** Provides a bounded selection of images found on the product page.
 * @param {any} api Browser scripting boundary.
 * @param {HTMLElement} container Image selection fieldset.
 * @param {() => void} onChange Notify the parent when loading changes.
 * @param {(url: string) => Promise<string>} loadSelectedImage Retrieve the selected image through the authenticated site.
 */
export function createImageSelection(api, container, onChange, loadSelectedImage) {
  let selected = "", current = -1, revision = 0, loading = false;
  /** @type {{tabId: number, pageUrl: string} | null} */ let source = null;
  /** @type {HTMLButtonElement[]} */ const buttons = [];
  const feedback = /** @type {HTMLElement} */ (container.querySelector("[data-image-status]"));
  const choices = /** @type {HTMLElement} */ (container.querySelector("[data-image-choices]"));

  function update() {
    buttons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === current)));
    onChange();
  }

  /** @param {string[]} urls URLs already present in the page. */
  function setImages(urls) {
    choices.replaceChildren(); buttons.length = 0;
    container.hidden = urls.length === 0;
    urls.slice(0, 12).forEach((url, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "image-choice"; button.setAttribute("aria-label", `Choisir l’image ${index + 1}`); button.setAttribute("aria-pressed", "false");
      const picture = document.createElement("img"); picture.src = url; picture.alt = ""; picture.referrerPolicy = "no-referrer";
      picture.addEventListener("error", () => { button.disabled = true; button.title = "Image indisponible"; });
      button.append(picture); choices.append(button); buttons.push(button);
      button.addEventListener("click", () => { void select(url, index); });
    });
    update();
  }

  /** @param {string} url Selected image URL. @param {number} index Choice index. */
  async function select(url, index) {
    const version = ++revision;
    loading = true; selected = ""; current = -1; feedback.textContent = "Chargement de l’image…"; update();
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/\.$/, "").toLowerCase();
      if (url.length > 4096 || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port || !host.includes(".") || /^[\d.]+$/.test(host) || /\.(local|localhost|internal|localdomain)$/i.test(host)) throw new Error("image");
      if (!source) throw new Error("page");
      let data = "";
      try {
        const [capture] = await api.scripting.executeScript({ target: { tabId: source.tabId }, func: imageAsWebp, args: [{ url: parsed.href, pageUrl: source.pageUrl }] });
        data = capture?.result || "";
      } catch { /* The image may be displayable but unavailable to page scripts. */ }
      if (!data) data = await loadSelectedImage(parsed.href);
      if (!data || !data.startsWith("data:image/webp;base64,") || data.length > 2800000) throw new Error("image");
      if (version !== revision) return;
      selected = data; current = index; feedback.textContent = "Image sélectionnée.";
    } catch {
      if (version !== revision) return;
      feedback.textContent = "Cette image ne peut pas être importée. Essaie une autre image ou continue sans image.";
    } finally {
      if (version === revision) { loading = false; update(); }
    }
  }

  container.querySelector("[data-image-clear]")?.addEventListener("click", () => {
    revision++; selected = ""; current = -1; loading = false; feedback.textContent = "Aucune image sélectionnée."; update();
  });
  return { setImages, setSource: (/** @type {number} */ tabId, /** @type {string} */ pageUrl) => { source = { tabId, pageUrl }; }, getImage: () => selected, isLoading: () => loading };
}

/** Runs in the product tab; downloads only the selected image without cookies or redirects.
 * @param {{url: string, pageUrl: string}} value The selected image and captured product page.
 */
export async function imageAsWebp({ url, pageUrl }) {
  const MaximumImageBytes = 8 * 1024 * 1024;
  const MaximumPixels = 40_000_000;
  if (location.href !== pageUrl) throw new Error("page changed");
  const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", signal: AbortSignal.timeout(12000) });
  const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(type) || !response.body) throw new Error("image");
  const length = Number(response.headers.get("content-length"));
  if (length > MaximumImageBytes) throw new Error("size");
  const reader = response.body.getReader(); let total = 0; const chunks = [];
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      total += part.value.byteLength; if (total > MaximumImageBytes) throw new Error("size");
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bitmap = await createImageBitmap(new Blob(chunks, { type }));
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MaximumPixels) throw new Error("size");
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d"); if (!context) throw new Error("image");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/webp", .85);
    if (!data.startsWith("data:image/webp;base64,") || data.length > 2800000) throw new Error("image");
    return data;
  } finally { bitmap.close(); }
}
