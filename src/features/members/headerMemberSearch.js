import { createButton } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { validateMemberSearch } from "./memberSearchValidation.js";
import { alignHeaderPanel } from "../../components/headerPanelPosition.js";

/** A persistent desktop search field with a compact-header disclosure.
 * @param {{onSearch: (query: string) => void, onOpen?: () => void}} options Explicit navigation and mutual exclusion.
 */
export function createHeaderMemberSearch({ onSearch, onOpen = () => {} }) {
  const element = document.createElement("form"); element.className = "app-member-search";
  element.setAttribute("role", "search"); element.setAttribute("aria-label", "Recherche de membres"); element.noValidate = true;
  element.dataset.open = "false";
  const desktop = window.matchMedia("(min-width: 80rem)");
  const trigger = createButton({ label: "Rechercher un membre", variant: "ghost", onClick: () => setOpen(!open, true) });
  applyActionIcon(trigger, "search", "Rechercher un membre"); trigger.classList.add("app-member-search__toggle");
  const panel = document.createElement("div"); panel.className = "app-member-search__panel"; panel.id = `header-search-${crypto.randomUUID()}`;
  trigger.setAttribute("aria-controls", panel.id); trigger.setAttribute("aria-expanded", "false");
  const input = document.createElement("input"); input.type = "search"; input.name = "q"; input.autocomplete = "off";
  input.classList.add("form-field__control");
  input.placeholder = "Pseudo ou identifiant"; input.setAttribute("aria-label", "Pseudo ou identifiant");
  const submit = createButton({ label: "Lancer la recherche", type: "submit", variant: "ghost" });
  applyActionIcon(submit, "arrowRight", "Lancer la recherche"); submit.classList.add("app-member-search__submit");
  panel.append(input, submit); element.append(trigger, panel);
  let open = false, disposed = false;
  const resize = new ResizeObserver(() => fitPanel());
  addComponentEventListener(element, window, "resize", fitPanel);
  addComponentEventListener(element, input, "input", () => { input.setCustomValidity(""); input.removeAttribute("aria-invalid"); });
  addComponentEventListener(element, element, "submit", event => {
    event.preventDefault(); if ((!open && !desktop.matches) || disposed) return;
    const error = validateMemberSearch(input.value);
    input.setCustomValidity(error ?? "");
    if (error) { input.setAttribute("aria-invalid", "true"); input.reportValidity(); input.focus(); return; }
    const query = input.value.trim(); setOpen(false); onSearch(query);
  });
  addComponentEventListener(element, element, "keydown", event => {
    if (/** @type {KeyboardEvent} */ (event).key !== "Escape" || !open || desktop.matches) return;
    event.preventDefault(); event.stopPropagation(); setOpen(false, true);
  });
  // Collapse after activation so the compact header cannot move a pressed target.
  addComponentEventListener(element, document, "click", event => {
    if (!desktop.matches && open && event.target instanceof Node && !element.contains(event.target)) setOpen(false);
  });
  addComponentEventListener(element, input, "focus", () => { if (desktop.matches) onOpen(); });
  addComponentEventListener(element, desktop, "change", () => {
    const restoreFocus = element.contains(document.activeElement);
    open = false; sync();
    if (restoreFocus) (desktop.matches ? input : trigger).focus({ preventScroll: true });
  });
  registerComponentCleanup(element, () => { setOpen(false); disposed = true; sync(); resize.disconnect(); });
  sync();
  return { element, close: () => setOpen(false) };

  /** @param {boolean} value Next disclosure state. @param {boolean} [focus] User-initiated focus movement. */
  function setOpen(value, focus = false) {
    if (disposed) return;
    open = value;
    if (open) onOpen();
    else { input.value = ""; input.setCustomValidity(""); input.removeAttribute("aria-invalid"); }
    sync();
    if (focus) (open ? input : trigger).focus({ preventScroll: true });
  }
  function sync() {
    const visible = !disposed && (desktop.matches || open);
    element.dataset.open = String(visible); trigger.hidden = desktop.matches;
    if (desktop.matches) trigger.removeAttribute("aria-expanded");
    else trigger.setAttribute("aria-expanded", String(visible));
    panel.inert = !visible; panel.setAttribute("aria-hidden", String(!visible)); input.disabled = !visible; submit.disabled = !visible;
    resize.disconnect();
    if (visible && !desktop.matches) { resize.observe(element.closest("header") ?? element); fitPanel(); }
  }
  function fitPanel() {
    if (disposed || !open || desktop.matches || !element.isConnected) return;
    alignHeaderPanel(panel, trigger);
  }
}
