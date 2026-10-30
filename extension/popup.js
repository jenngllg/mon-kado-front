/* global chrome, browser, document */
import { extractProduct } from "./extract.js";
import { createImageSelection } from "./imageSelection.js";

const api = typeof browser !== "undefined" ? browser : chrome;
const status = document.querySelector("#status"), form = document.querySelector("#form"), list = document.querySelector("#list"), name = document.querySelector("#name"), price = document.querySelector("#price"), color = document.querySelector("#color"), size = document.querySelector("#size"), add = document.querySelector("#add");
let product = null, siteTab = null, supportsVariants = false, saving = false, completed = false;
const images = createImageSelection(api, document.querySelector("#images"), () => { add.disabled = saving || completed || images.isLoading(); }, async url => {
  if (siteTab === null) throw new Error("session");
  const result = await api.tabs.sendMessage(siteTab, { action: "image", value: { listId: list.value, url } });
  return result?.image || "";
});

async function initialize() {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) throw new Error("page");
    const [capture] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: extractProduct });
    product = capture?.result;
    if (!product?.url) throw new Error("page");
    images.setSource(tab.id, product.url);
    const candidates = await api.tabs.query({ url: ["https://www.monkado.fr/*"] });
    let updateRequired = false;
    for (const candidate of candidates) {
      if (!candidate.id) continue;
      try {
        const probe = await api.tabs.sendMessage(candidate.id, { action: "probe" });
        if (!probe?.ready) { updateRequired = true; continue; }
        const response = await api.tabs.sendMessage(candidate.id, { action: "lists" });
        if (!Array.isArray(response?.lists)) continue;
        siteTab = candidate.id;
        supportsVariants = probe.supportsVariants === true;
        for (const item of response.lists) { const option = document.createElement("option"); option.value = item.id; option.textContent = item.name; list.append(option); }
        break;
      } catch { /* This tab may not have reloaded since extension installation. */ }
    }
    if (siteTab === null) { status.textContent = updateRequired ? "Le site MonKado doit être mis à jour avant d’utiliser l’extension." : "Connecte-toi sur le site MonKado, actualise l’onglet, puis rouvre l’extension."; return; }
    if (!list.options.length) { status.textContent = "Aucune liste disponible dans MonKado."; return; }
    name.value = product.name; price.value = product.price;
    images.setImages(product.images || []);
    status.textContent = !product.price || !product.name ? "Vérifie et complète les informations du produit." : "";
    form.hidden = false;
  } catch { status.textContent = "Cette page ne peut pas être lue. Ouvre une page produit et réessaie."; }
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (saving || completed || images.isLoading() || !product || siteTab === null) return;
  if (!name.value.trim() || !/^\d{1,8}(?:[.,]\d{1,2})?$/.test(price.value.trim()) && price.value.trim() !== "") { status.textContent = "Vérifie le nom et le prix."; return; }
  if ((color.value.trim() || size.value.trim()) && !supportsVariants) { status.textContent = "Actualise l’onglet MonKado pour enregistrer la couleur et la taille, puis rouvre l’extension."; return; }
  const listId = list.value, listName = list.selectedOptions[0]?.textContent?.trim() || "";
  const confirmation = listName ? `Souhait ajouté à la liste « ${listName} ».` : "Souhait ajouté.";
  saving = true; add.disabled = true; status.textContent = "Ajout en cours…";
  try {
    const result = await api.tabs.sendMessage(siteTab, { action: "create", value: { listId, name: name.value, price: price.value, color: color.value, size: size.value, url: product.url, image: images.getImage() } });
    if (result?.success) { completed = true; status.textContent = confirmation; form.hidden = true; return; }
    if (result?.error === "image") { completed = true; form.hidden = true; status.textContent = `${confirmation} Son image n’a pas pu être enregistrée.`; return; }
    if (result?.error === "rejected" || result?.error === "invalid" || result?.error === "login") { status.textContent = "Ajout impossible. Vérifie les informations et ta connexion MonKado."; return; }
    completed = true; status.textContent = "L’ajout n’a pas pu être confirmé. Consulte ta liste avant de réessayer.";
  } catch { completed = true; status.textContent = "L’ajout n’a pas pu être confirmé. Consulte ta liste avant de réessayer."; }
  finally { saving = false; add.disabled = completed; }
});
void initialize();
