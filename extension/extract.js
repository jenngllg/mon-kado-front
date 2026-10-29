/* global document, location, URL */
/** Runs inside the active product tab. It reads the existing page only. */
export function extractProduct() {
  const meta = (/** @type {string} */ key) => document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.getAttribute("content")?.trim() || "";
  /** @type {any[]} */ const products = [];
  const visit = (/** @type {any} */ value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 8 || products.length > 8) return;
    if (Array.isArray(value)) { for (const item of value.slice(0, 100)) visit(item, depth + 1); return; }
    if ((Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]]).includes("Product")) products.push(value);
    if (value["@graph"]) visit(value["@graph"], depth + 1);
  };
  for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 20)) {
    const text = script.textContent || "";
    if (text.length > 262144) continue;
    try { visit(JSON.parse(text)); } catch { /* A merchant may publish malformed metadata. */ }
  }
  const product = products.length === 1 ? products[0] : null;
  const name = (typeof product?.name === "string" ? product.name : "") || meta("og:title") || document.title;
  const offers = product?.offers && !Array.isArray(product.offers) ? product.offers : null;
  const currency = String(offers?.priceCurrency || meta("product:price:currency") || "").toUpperCase();
  const amount = String(offers?.price ?? meta("product:price:amount") ?? "").trim().replace(",", ".");
  const price = currency === "EUR" && /^\d{1,8}(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0 ? amount.replace(".", ",") : "";
  let image = "";
  try {
    const candidate = meta("og:image");
    const expected = new URL(candidate, location.href).href;
    const picture = [...document.images].find(item => item.currentSrc === expected || item.src === expected);
    if (candidate && picture?.complete && picture.naturalWidth && picture.naturalHeight && picture.naturalWidth * picture.naturalHeight <= 40000000) {
      const scale = Math.min(1, 1024 / Math.max(picture.naturalWidth, picture.naturalHeight));
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      const context = canvas.getContext("2d"); if (!context) throw new Error();
      context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL("image/webp", .85);
      if (result.startsWith("data:image/webp;base64,") && result.length <= 2800000) image = result;
    }
  } catch { /* Cross-origin images may not be readable in canvas. */ }
  return { url: location.href, name: [...name.trim()].slice(0, 100).join(""), price, image };
}
