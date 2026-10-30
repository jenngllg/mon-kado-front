import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createButton, createFormField, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { validateWishField } from "../wishes/wishValidation.js";
import { clearExtensionProduct, readExtensionProduct } from "./extensionProduct.js";

/** Adds the extension's current product using the regular authenticated services.
 * @param {{lists: {load: import("../wishlists/wishlistsService.js").LoadWishlists},
 * wishes: {create: import("../wishes/wishesService.js").CreateWish}, signal: AbortSignal}} options Dependencies.
 */
export function createExtensionAddView({ lists, wishes, signal }) {
  const section = document.createElement("section"); section.className = "extension-add flow";
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    const environment = document.createElement("p"); environment.className = "extension-add__environment";
    environment.textContent = "Essai local · listes et comptes locaux"; section.append(environment);
  }
  const heading = document.createElement("h1"); heading.textContent = "Ajouter un souhait";
  const feedback = document.createElement("p"); feedback.setAttribute("role", "status");
  const form = document.createElement("form"); form.className = "wishlist-form flow"; form.noValidate = true;
  const select = document.createElement("select"); select.name = "wishlist";
  const listField = createFormField({ label: "Liste", control: select, required: true });
  const name = document.createElement("input"); name.name = "name"; name.maxLength = 200;
  const nameField = createFormField({ label: "Nom du souhait", control: name, required: true });
  const price = document.createElement("input"); price.name = "price"; price.inputMode = "decimal";
  const priceField = createFormField({ label: "Prix en euros", control: price });
  const product = readExtensionProduct();
  const link = document.createElement("a"); link.textContent = "Voir le produit"; link.target = "_blank"; link.rel = "noopener noreferrer";
  if (product) link.href = product;
  const submit = createButton({ label: "Ajouter", type: "submit" });
  const actions = document.createElement("div"); actions.className = "extension-add__actions"; actions.append(link, submit);
  form.append(listField, nameField, priceField, actions); section.append(heading, feedback, form);
  const lifetime = new AbortController();
  let busy = false, completed = false, disposed = false;
  const stop = () => { disposed = true; lifetime.abort(); };
  registerComponentCleanup(section, stop);
  addComponentEventListener(section, signal, "abort", stop, { once: true });
  if (signal.aborted) stop();
  function sync() { select.disabled = name.disabled = price.disabled = submit.disabled = busy || completed || disposed || !product; }
  function message(/** @type {string} */ text) { feedback.textContent = text; }
  async function initialize() {
    if (!product) { form.hidden = true; message("Lien indisponible. Relance l’extension depuis une page produit."); return; }
    busy = true; sync(); message("Chargement de tes listes…");
    try {
      const available = (await lists.load({ signal: lifetime.signal })).filter(item => !item.isArchived && !item.isSuspended);
      if (disposed) return;
      if (!available.length) { form.hidden = true; message("Tu n’as aucune liste disponible. Crée ou désarchive une liste dans MonKado."); section.append(createActionLink({ label: "Mes listes", href: "/lists" })); return; }
      for (const list of available) { const option = document.createElement("option"); option.value = list.id; option.textContent = list.name; select.append(option); }
      message("");
    } catch (error) {
      if (!disposed && !isAbortError(error)) { form.hidden = true; message(toUserFacingError(error).message); }
    } finally { busy = false; sync(); }
  }
  addComponentEventListener(section, form, "submit", event => {
    event.preventDefault();
    if (busy || completed || disposed || !product) return;
    const nameError = validateWishField("name", name.value), priceError = validateWishField("price", price.value);
    setFormFieldValidation(nameField, nameError); setFormFieldValidation(priceField, priceError);
    if (nameError || priceError) { (nameError ? name : price).focus(); return; }
    void save();
  });
  async function save() {
    if (!product) return;
    busy = true; sync(); message("Enregistrement du souhait…");
    const listId = select.value;
    try {
      await wishes.create(listId, { name: name.value, price: price.value, url: product, note: "", quantity: "1", isFavorite: false, isSurprise: false, acceptsSecondHand: false }, { signal: lifetime.signal });
      if (disposed) return;
      completed = true; clearExtensionProduct();
      message("Souhait ajouté à ta liste. Tu peux fermer cette fenêtre.");
      form.hidden = true; section.append(createActionLink({ label: "Voir ma liste", href: `/lists/${listId}` }));
      if (document.documentElement.getAttribute("data-monkado-extension") === "true") document.dispatchEvent(new CustomEvent("monkado-wish-added"));
      else window.close();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      if (!(error instanceof ApiError) || error.kind !== "http" || error.statusCode === null || error.statusCode >= 500) {
        completed = true; message("L’ajout n’a pas pu être confirmé. Consulte ta liste avant de réessayer.");
        section.append(createActionLink({ label: "Voir ma liste", href: `/lists/${listId}` }));
      } else message(toUserFacingError(error).message);
    } finally { busy = false; sync(); }
  }
  sync(); if (!disposed) void initialize();
  return section;
}
