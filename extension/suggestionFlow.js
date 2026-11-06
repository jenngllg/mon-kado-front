/* global document, Option, Event */
import { createImageSelection } from "./imageSelection.js";

/** Keeps the horizontal quantity control within the same limits as MonKado. */
export function createQuantityControl(form) {
  const quantity = form.querySelector('[data-field="quantity"]');
  const decrease = form.querySelector('[data-quantity-decrease]'), increase = form.querySelector('[data-quantity-increase]');
  function sync() {
    const value = quantity.valueAsNumber, invalid = !quantity.validity.valid;
    decrease.disabled = quantity.disabled || invalid || value <= 1;
    increase.disabled = quantity.disabled || invalid || value >= 100;
  }
  for (const [button, delta] of [[decrease, -1], [increase, 1]]) button.addEventListener("click", () => {
    if (quantity.disabled || !quantity.validity.valid) return;
    const next = quantity.valueAsNumber + delta;
    if (next < 1 || next > 100) return;
    quantity.value = String(next); quantity.dispatchEvent(new Event("input", { bubbles: true }));
  });
  quantity.addEventListener("input", sync); sync();
  return sync;
}

/** Person-first suggestions preserve a separate product draft and per-destination outcomes. */
export function createSuggestionFlow({ api, form, product, siteTab, productTab, supportsQuantities, onMessage, onBusy }) {
  const name = form.querySelector('[data-field="name"]'), price = form.querySelector('[data-field="price"]');
  const quantity = form.querySelector('[data-field="quantity"]'), syncQuantity = createQuantityControl(form);
  const add = form.querySelector('[type="submit"]');
  form.querySelector(".variants").remove(); form.querySelector(".favorite-control").remove();
  const oldDestination = form.querySelector("select").closest("label");
  const personLabel = document.createElement("label"); personLabel.append("Pour qui ? *");
  const person = document.createElement("select"); person.required = true; personLabel.append(person);
  const picker = document.createElement("details"); picker.className = "list-picker"; picker.open = true; picker.hidden = true;
  const summary = document.createElement("summary"); summary.textContent = "Listes *";
  const choices = document.createElement("fieldset"), legend = document.createElement("legend"); legend.textContent = "Listes *"; choices.append(legend); picker.append(summary, choices);
  const privacy = document.createElement("p"); privacy.className = "suggestion-privacy"; privacy.hidden = true;
  const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Réessayer"; retry.hidden = true;
  oldDestination.replaceWith(personLabel, picker, privacy, retry);
  name.value = product.name; price.value = product.price; add.textContent = "Proposer l’idée";
  let people = [], lists = [], inputs = [], loading = false, saving = false, completed = false, initialized = false, imagesInitialized = false;
  let revision = 0, lastMessage = "", peopleLoading = false, retryRead = () => loadRecipients();
  const created = new Set(), imageFailures = new Set();
  const images = createImageSelection(api, form.querySelector("[data-image-choices]").closest("fieldset"), sync, async url => {
    const result = await api.tabs.sendMessage(siteTab, { action: "suggestionImage", value: { listId: selected()[0], url } });
    return result?.image || "";
  });
  images.setSource(productTab, product.url);
  form.querySelector("[data-image-choices]").closest("fieldset").hidden = true;

  function selected() { return inputs.filter(input => input.checked).map(input => input.value); }
  function message(text) { lastMessage = text; onMessage(text); }
  function sync() {
    const frozen = saving || completed || created.size > 0;
    for (const control of form.querySelectorAll("input,select,button")) control.disabled = frozen;
    syncQuantity();
    person.disabled = frozen || peopleLoading;
    choices.disabled = frozen || loading;
    retry.disabled = frozen || loading;
    add.disabled = saving || completed || loading || images.isLoading() || !selected().length;
    form.setAttribute("aria-busy", String(saving || loading));
  }
  function resetLists() {
    lists = []; inputs = []; choices.replaceChildren(legend); picker.hidden = true; privacy.hidden = true;
  }
  async function loadRecipients() {
    const version = ++revision;
    loading = true; peopleLoading = true; retry.hidden = true; resetLists(); person.replaceChildren(new Option("Choisir une personne", ""));
    message("Chargement des membres de tes groupes…"); sync();
    try {
      const response = await api.tabs.sendMessage(siteTab, { action: "suggestionRecipients" });
      if (version !== revision) return;
      if (!Array.isArray(response?.recipients) || response.recipients.some(item => typeof item.id !== "string" || typeof item.name !== "string")) throw new Error("recipients");
      people = response.recipients;
      for (const item of people) person.append(new Option(item.name, item.id));
      message(people.length ? "" : "Aucun autre membre dans tes groupes.");
    } catch {
      if (version !== revision) return;
      message("Les membres de tes groupes n’ont pas pu être chargés."); retryRead = loadRecipients; retry.hidden = false;
    } finally { if (version === revision) { loading = false; peopleLoading = false; sync(); } }
  }
  async function loadLists() {
    const version = ++revision, recipient = people.find(item => item.id === person.value);
    resetLists(); retry.hidden = true;
    if (!recipient) { loading = false; message(""); sync(); return; }
    loading = true; message("Chargement des listes…"); sync();
    try {
      const response = await api.tabs.sendMessage(siteTab, { action: "suggestionLists", value: { recipientId: recipient.id } });
      if (version !== revision) return;
      if (!Array.isArray(response?.lists) || response.lists.some(item => typeof item.id !== "string" || typeof item.name !== "string" || typeof item.groupName !== "string")) throw new Error("lists");
      lists = response.lists;
      for (const [index, item] of lists.entries()) {
        const label = document.createElement("label"), input = document.createElement("input");
        input.type = "checkbox"; input.value = item.id; input.checked = index === 0;
        input.addEventListener("change", sync); inputs.push(input); label.append(input, document.createTextNode(`${item.name} — ${item.groupName}`)); choices.append(label);
      }
      picker.hidden = !lists.length; picker.open = true; privacy.hidden = !lists.length;
      privacy.textContent = `Visible par les membres des groupes indiqués, sauf ${recipient.name}.`;
      message(lists.length ? "" : "Cette personne n’a aucune liste partagée dans tes groupes.");
      if (lists.length && !imagesInitialized) { imagesInitialized = true; images.setImages(product.images || []); }
    } catch {
      if (version !== revision) return;
      message("Les listes de cette personne n’ont pas pu être chargées."); retryRead = loadLists; retry.hidden = false;
    } finally { if (version === revision) { loading = false; sync(); } }
  }
  function names(ids) { return lists.filter(item => ids.includes(item.id)).map(item => `« ${item.name} — ${item.groupName} »`).join(", "); }
  function confirmation(ids) { return `Idée proposée dans ${names(ids)}.`; }
  retry.addEventListener("click", () => { void retryRead(); });
  person.addEventListener("change", () => { if (!saving && !completed && !created.size) void loadLists(); });
  picker.addEventListener("keydown", event => { if (event.key === "Escape" && picker.open) { event.preventDefault(); picker.open = false; summary.focus(); } });
  summary.addEventListener("click", event => { if (saving || completed || created.size) event.preventDefault(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving || completed || loading || images.isLoading() || !selected().length) return;
    if (!quantity.reportValidity()) return;
    if (!supportsQuantities && Number(quantity.value) !== 1) { message("La mise à jour du site MonKado est nécessaire pour enregistrer cette quantité."); return; }
    if (!name.value.trim() || !/^\d{1,8}(?:[.,]\d{1,2})?$/.test(price.value.trim()) && price.value.trim() !== "") { message("Vérifie le nom et le prix."); return; }
    const selectedIds = selected(), pending = selectedIds.filter(id => !created.has(id)), rejected = [];
    saving = true; onBusy(true); message("Proposition en cours…"); sync();
    try {
      for (const listId of pending) {
        const result = await api.tabs.sendMessage(siteTab, { action: "createSuggestion", value: { listId, name: name.value, price: price.value, quantity: quantity.value, url: product.url, image: images.getImage() } });
        if (result?.success === true) { created.add(listId); if (result.imageSaved === false) imageFailures.add(listId); continue; }
        if (["rejected", "invalid", "login"].includes(result?.error)) { rejected.push(listId); continue; }
        completed = true; message(`${created.size ? confirmation([...created]) + " " : ""}La proposition dans ${names([listId])} n’a pas pu être confirmée. Vérifie les idées dans MonKado avant de réessayer.`); return;
      }
      if (rejected.length) {
        message(`${created.size ? confirmation([...created]) + " " : ""}Proposition refusée dans ${names(rejected)}. Vérifie les informations et tes accès au groupe.`);
        if (created.size) add.textContent = "Réessayer les listes restantes";
        return;
      }
      completed = true; form.hidden = true;
      message(confirmation(selectedIds) + (imageFailures.size ? ` Image non enregistrée dans ${names([...imageFailures])}.` : ""));
    } catch {
      completed = true; message(`${created.size ? confirmation([...created]) + " " : ""}La proposition n’a pas pu être confirmée. Vérifie les idées dans MonKado avant de réessayer.`);
    } finally { saving = false; onBusy(false); sync(); }
  });
  return { show() { form.hidden = completed; onMessage(lastMessage); if (!initialized) { initialized = true; void loadRecipients(); } else sync(); } };
}
