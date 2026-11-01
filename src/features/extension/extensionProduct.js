import { validateImportUrl } from "../wishes/wishImportService.js";

const Key = "monkado.extension.product";
const LifetimeMs = 30 * 60 * 1000;

/** Captures the product in this tab before authentication can redirect, and removes it from history. */
export function captureExtensionProduct(/** @type {Window} */ browser) {
  if (browser.location.pathname !== "/extension/add" || !browser.location.hash) return;
  const fragment = new URLSearchParams(browser.location.hash.slice(1));
  const values = fragment.getAll("url");
  browser.history.replaceState(browser.history.state, "", browser.location.pathname);
  try {
    browser.sessionStorage.removeItem(Key);
    if (values.length === 1 && validateImportUrl(values[0]) === null) {
      browser.sessionStorage.setItem(Key, JSON.stringify({ url: values[0], expires: Date.now() + LifetimeMs }));
    }
  } catch { /* The view reports an unavailable product when storage is blocked. */ }
}

/** Returns a bounded, tab-local product link after authentication. */
export function readExtensionProduct() {
  try {
    const raw = window.sessionStorage.getItem(Key);
    if (!raw || raw.length > 10000) return null;
    const product = JSON.parse(raw);
    if (typeof product?.url === "string" && typeof product.expires === "number" && product.expires > Date.now() && product.expires <= Date.now() + LifetimeMs && validateImportUrl(product.url) === null) return product.url;
    window.sessionStorage.removeItem(Key);
  } catch { /* Treat unavailable or malformed storage as an absent link. */ }
  return null;
}

/** Discards the tab-local product after confirmed creation. */
export function clearExtensionProduct() {
  try { window.sessionStorage.removeItem(Key); } catch { /* Storage may be unavailable. */ }
}
