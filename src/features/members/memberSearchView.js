import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createEmptyState, createFormField, createLoadingState, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { validateMemberSearch } from "./memberSearchValidation.js";

/** A public, explicitly submitted search with view-local query state.
 * @param {{search: import("./memberSearchService.js").SearchMembers, signal?: AbortSignal}} options Operations.
 * @returns {HTMLElement} Disposable routed view.
 */
export function createMemberSearchView({ search, signal }) {
  const view = node("section", ""); view.className = "flow";
  const title = node("h1", "Rechercher un membre");
  const form = node("form", ""); form.noValidate = true; form.className = "flow"; form.setAttribute("aria-label", "Rechercher un membre");
  const input = node("input", ""); input.type = "search"; input.name = "displayName"; input.autocomplete = "off";
  const field = createFormField({ label: "Nom d’affichage", control: input, required: true, description: "Saisis au moins deux caractères du nom du membre. 80 caractères maximum." });
  const summary = node("div", ""); summary.hidden = true;
  const submit = createButton({ label: "Rechercher", type: "submit" });
  const status = node("p", ""); status.setAttribute("role", "status"); status.className = "visually-hidden";
  const results = node("div", ""); results.className = "flow";
  form.append(summary, field, submit); view.append(title, form, status, results);
  const lifetime = new AbortController();
  let disposed = false, busy = false, dirty = false, checked = false, submitted = "", requestedPage = 1;
  /** @type {HTMLButtonElement | null} */ let pressed = null;
  /** @type {(() => void) | null} */ let deferred = null;
  addComponentEventListener(view, input, "input", () => { dirty = true; if (checked) validate(); });
  addComponentEventListener(view, input, "blur", event => {
    if (!dirty) return;
    if (pressed && /** @type {FocusEvent} */ (event).relatedTarget === pressed) deferred = validate;
    else validate();
  });
  addComponentEventListener(view, view, "pointerdown", event => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    pressed = target instanceof HTMLButtonElement ? target : null;
  });
  addComponentEventListener(view, document, "pointerup", event => {
    if (!(event.target instanceof Node && pressed?.contains(event.target))) flushBlur();
    pressed = null;
  });
  addComponentEventListener(view, document, "pointercancel", () => { pressed = null; flushBlur(); });
  addComponentEventListener(view, form, "submit", event => {
    event.preventDefault(); deferred = null;
    if (disposed || busy) return;
    if (validate()) {
      clear(summary); summary.hidden = false;
      summary.append(createAlert({ title: "Recherche à vérifier", message: "Vérifie le nom indiqué avant de rechercher un membre.", variant: "error" }));
      input.focus(); return;
    }
    submitted = input.value.trim(); requestedPage = 1; void read();
  });
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); submitted = ""; input.value = ""; input.disabled = true; submit.disabled = true;
    deferred = null; pressed = null; status.textContent = ""; setFormFieldValidation(field, null); clear(summary); clear(results);
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  return view;

  function flushBlur() { const action = deferred; deferred = null; action?.(); }
  function validate() {
    checked = true;
    const error = validateMemberSearch(input.value); setFormFieldValidation(field, error);
    if (!error) { clear(summary); summary.hidden = true; }
    return error;
  }
  /** @param {number} page Explicit target page. */
  function go(page) { flushBlur(); if (disposed || busy) return; requestedPage = page; void read(); }
  async function read() {
    if (disposed || busy) return;
    busy = true; input.disabled = true; submit.disabled = true; status.textContent = "";
    clear(results); results.setAttribute("aria-busy", "true");
    results.append(createLoadingState({ label: "Recherche de membres…" }));
    try {
      const page = await search(submitted, { page: requestedPage, signal: lifetime.signal });
      if (disposed) return;
      clear(results);
      const heading = node("h2", "Résultats de la recherche"); heading.tabIndex = -1; results.append(heading);
      const totalPages = Math.ceil(page.totalCount / page.pageSize);
      if (requestedPage > Math.max(1, totalPages)) {
        results.append(createEmptyState({ title: "Cette page n’est plus disponible", message: "Les résultats ont changé. Reviens à la première page pour poursuivre." }),
          createButton({ label: "Revenir à la première page", variant: "secondary", onClick: () => go(1) }));
        status.textContent = "Cette page n’est plus disponible";
      } else if (page.totalCount === 0) {
        results.append(createEmptyState({ title: "Aucun membre trouvé", message: "Essaie un autre nom pour poursuivre ta recherche." }));
        status.textContent = "Aucun membre trouvé";
      } else {
        const message = `${page.totalCount} membre${page.totalCount > 1 ? "s" : ""} trouvé${page.totalCount > 1 ? "s" : ""}. Page ${requestedPage} sur ${totalPages}.`;
        results.append(node("p", message)); status.textContent = message;
        const collection = node("ul", ""); collection.className = "wishlists-grid"; collection.setAttribute("role", "list");
        for (const member of page.items) {
          const item = node("li", member.displayName); item.className = "wishlist-card"; collection.append(item);
        }
        results.append(collection);
        if (totalPages > 1) {
          const navigation = node("nav", ""); navigation.className = "cluster"; navigation.setAttribute("aria-label", "Pages des résultats de membres");
          const previous = createButton({ label: "Page précédente", variant: "secondary", onClick: () => go(requestedPage - 1) }); previous.disabled = requestedPage === 1;
          const next = createButton({ label: "Page suivante", variant: "secondary", onClick: () => go(requestedPage + 1) }); next.disabled = requestedPage === totalPages;
          navigation.append(previous, next); results.append(navigation);
        }
      }
      heading.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      clear(results);
      const translated = toUserFacingError(error), extra = [];
      const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
      if (correlation) extra.push(`Référence : ${correlation}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const alert = createAlert({ ...translated, detail: extra.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      results.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { flushBlur(); void read(); } })); alert.focus();
    } finally {
      if (!disposed) { busy = false; input.disabled = false; submit.disabled = false; results.setAttribute("aria-busy", "false"); }
    }
  }
}
/** @param {HTMLElement} element Owned result container. */
function clear(element) { disposeComponent(element); element.replaceChildren(); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Element tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Element. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
