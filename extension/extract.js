/* global document, getComputedStyle, HTMLImageElement, location, URL */
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
  /** @param {unknown} amount Untrusted price. @param {unknown} currency Currency code. */
  const euroPrice = (amount, currency) => {
    if (typeof currency !== "string" || currency.toUpperCase() !== "EUR") return "";
    const text = String(amount ?? "").trim().replace(",", ".");
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text) || Number(text) <= 0) return "";
    const [whole, cents] = text.split(".");
    return cents === undefined ? whole : `${whole},${cents.padEnd(2, "0")}`;
  };
  /** @param {unknown} value Date or date-time in structured data. @param {boolean} end Whether the date includes its full last day. */
  const boundary = (value, end) => {
    if (value === undefined || value === null) return end ? Infinity : -Infinity;
    if (typeof value !== "string") return NaN;
    const calendar = /^(\d{4}-\d{2}-\d{2})Z?$/.exec(value);
    const parsed = Date.parse(calendar ? `${calendar[1]}T00:00:00Z` : value);
    return Number.isFinite(parsed) && calendar && end ? parsed + 86_399_999 : parsed;
  };
  let price = euroPrice(offers?.price, offers?.priceCurrency || meta("product:price:currency"));
  const specs = offers?.priceSpecification;
  if (!price && specs) {
    const candidates = (Array.isArray(specs) ? specs : [specs]).slice(0, 20).flatMap(spec => {
      if (!spec || typeof spec !== "object" || spec.priceType || spec.referenceQuantity || spec.unitCode || spec.unitText || spec.eligibleQuantity || spec.eligibleCustomerType) return [];
      const start = boundary(spec.validFrom, false), end = boundary(spec.validThrough, true), now = Date.now();
      if (!(start <= now && now <= end)) return [];
      const value = euroPrice(spec.price, spec.priceCurrency || offers?.priceCurrency);
      return value ? [value] : [];
    });
    const distinct = [...new Set(candidates)];
    if (distinct.length === 1) price = distinct[0];
  }
  if (!price && !specs) price = euroPrice(meta("product:price:amount"), meta("product:price:currency"));
  const heading = [...document.querySelectorAll("h1")].find(node => node.getClientRects().length > 0);
  const headingRect = heading?.getBoundingClientRect();
  /** @param {Element} node Whether an element or an ancestor suppresses this content. */
  const suppressed = node => {
    /** @type {Element | null} */ let current = node;
    for (let depth = 0; current && depth < 12; current = current.parentElement, depth++) {
      if (current.matches("del, s, strike, [hidden], [aria-hidden='true']")) return true;
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.textDecorationLine?.includes("line-through")) return true;
    }
    return false;
  };
  /** @param {Element} node Approximate distance from the main product title. */
  const distance = node => {
    if (!headingRect) return Infinity;
    let element = node;
    while (element.parentElement && (element.getBoundingClientRect().width < 8 || element.getBoundingClientRect().height < 8)) element = element.parentElement;
    const rect = element.getBoundingClientRect();
    const horizontal = Math.max(0, headingRect.left - rect.right, rect.left - headingRect.right);
    return Math.abs(rect.top - headingRect.bottom) + horizontal * 0.5;
  };
  if (!price && !specs && heading && headingRect) {
    const scope = heading.closest("main, [role='main']") || document.body;
    const nodes = scope.querySelectorAll("[itemprop='price'], [id*='price' i], [id*='price' i] span, [class*='price' i], [class*='price' i] span, [aria-label*='€']");
    const candidates = [...nodes].slice(0, 2000).flatMap(node => {
      if (suppressed(node)) return [];
      const text = (node.getAttribute("aria-label") || node.getAttribute("content") || node.textContent || "").replace(/\s/g, "");
      const match = /^(\d{1,8}(?:[.,]\d{1,2})?)€$/.exec(text);
      let amount = match?.[1] || "";
      if (!amount && /^\d{1,8}(?:[.,]\d{1,2})?$/.test(text) && node.parentElement && !suppressed(node.parentElement)) {
        const parentText = (node.parentElement.textContent || "").replace(/\s/g, "");
        const amounts = [...parentText.matchAll(/(?:^|[^\d.,])(\d{1,8}(?:[.,]\d{1,2})?)€/g)];
        if (amounts.length === 1 && euroPrice(amounts[0][1], "EUR") === euroPrice(text, "EUR")) amount = text;
      }
      const value = euroPrice(amount, "EUR");
      const score = distance(node);
      return value && Number.isFinite(score) ? [{ value, score }] : [];
    }).sort((a, b) => a.score - b.score);
    if (candidates.length) {
      const nearest = candidates.filter(item => item.score <= candidates[0].score + 24);
      const distinct = [...new Set(nearest.map(item => item.value))];
      if (distinct.length === 1) price = distinct[0];
    }
  }
  /** @type {string[]} */ const images = [];
  /** @param {unknown} value Image URL or JSON-LD ImageObject. */
  const addImage = value => {
    if (Array.isArray(value)) { for (const item of value.slice(0, 20)) addImage(item); return; }
    if (value && typeof value === "object") { const item = /** @type {{contentUrl?: unknown, url?: unknown}} */ (value); addImage(item.contentUrl || item.url); return; }
    if (typeof value !== "string" || !value.trim() || value.length > 4096 || images.length >= 12) return;
    try {
      const url = new URL(value, location.href);
      const host = url.hostname.replace(/\.$/, "").toLowerCase();
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port || !host.includes(".") || /^[\d.]+$/.test(host) || /\.(local|localhost|internal|localdomain)$/i.test(host)) return;
      url.hash = "";
      if (!images.includes(url.href)) images.push(url.href);
    } catch { /* Ignore invalid image metadata. */ }
  };
  addImage(product?.image);
  addImage(meta("og:image"));
  if (images.length < 2 && headingRect) {
    const candidates = [...document.querySelectorAll("img")].slice(0, 500).filter(picture =>
      picture instanceof HTMLImageElement && picture.naturalWidth >= 36 && picture.naturalHeight >= 36 &&
      !picture.closest("header, footer, nav") && !suppressed(picture) && !/logo|icon|payment|badge/i.test(`${picture.alt} ${picture.currentSrc || picture.src}`));
    candidates.sort((a, b) => {
      /** @param {HTMLImageElement} picture */
      const score = picture => distance(picture) - Math.min(200, picture.naturalWidth * picture.naturalHeight / 2000);
      return score(a) - score(b);
    });
    for (const picture of candidates.slice(0, 12)) addImage(picture.currentSrc || picture.src);
  }
  return { url: location.href, name: [...name.trim()].slice(0, 100).join(""), price, images };
}
