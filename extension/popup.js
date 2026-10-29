/* global chrome, document */
import { extractProduct } from "./extract.js";

const status = document.querySelector("#status"), form = document.querySelector("#form"), list = document.querySelector("#list"), name = document.querySelector("#name"), price = document.querySelector("#price"), image = document.querySelector("#image"), add = document.querySelector("#add");
let product = null, siteTab = null, saving = false, completed = false;

async function initialize() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) throw new Error("page");
    const [capture] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractProduct });
    product = capture?.result;
    if (!product?.url) throw new Error("page");
    const candidates = await chrome.tabs.query({ url: ["https://www.monkado.fr/*"] });
    let updateRequired = false;
    for (const candidate of candidates) {
      if (!candidate.id) continue;
      try {
        const probe = await chrome.tabs.sendMessage(candidate.id, { action: "probe" });
        if (!probe?.ready) { updateRequired = true; continue; }
        const response = await chrome.tabs.sendMessage(candidate.id, { action: "lists" });
        if (!Array.isArray(response?.lists)) continue;
        siteTab = candidate.id;
        for (const item of response.lists) { const option = document.createElement("option"); option.value = item.id; option.textContent = item.name; list.append(option); }
        break;
      } catch { /* This tab may not have reloaded since extension installation. */ }
    }
    if (siteTab === null) { status.textContent = updateRequired ? "Le site MonKado doit être mis à jour avant d’utiliser l’extension." : "Connecte-toi sur le site MonKado, actualise l’onglet, puis rouvre l’extension."; return; }
    if (!list.options.length) { status.textContent = "Aucune liste disponible dans MonKado."; return; }
    name.value = product.name; price.value = product.price;
    if (product.image) { image.src = product.image; image.hidden = false; }
    status.textContent = !product.price || !product.name ? "Vérifie et complète les informations du produit." : !product.image ? "Image indisponible depuis cette page." : "";
    form.hidden = false;
  } catch { status.textContent = "Cette page ne peut pas être lue. Ouvre une page produit et réessaie."; }
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (saving || completed || !product || siteTab === null) return;
  if (!name.value.trim() || !/^\d{1,8}(?:[.,]\d{1,2})?$/.test(price.value.trim()) && price.value.trim() !== "") { status.textContent = "Vérifie le nom et le prix."; return; }
  saving = true; add.disabled = true; status.textContent = "Ajout en cours…";
  try {
    const result = await chrome.tabs.sendMessage(siteTab, { action: "create", value: { listId: list.value, name: name.value, price: price.value, url: product.url, image: product.image } });
    if (result?.success) { completed = true; status.textContent = "Souhait ajouté."; form.hidden = true; return; }
    if (result?.error === "image") { completed = true; form.hidden = true; status.textContent = "Souhait ajouté, mais son image n’a pas pu être enregistrée."; return; }
    if (result?.error === "rejected" || result?.error === "invalid" || result?.error === "login") { status.textContent = "Ajout impossible. Vérifie les informations et ta connexion MonKado."; return; }
    completed = true; status.textContent = "L’ajout n’a pas pu être confirmé. Consulte ta liste avant de réessayer.";
  } catch { completed = true; status.textContent = "L’ajout n’a pas pu être confirmé. Consulte ta liste avant de réessayer."; }
  finally { saving = false; add.disabled = completed; }
});
void initialize();
