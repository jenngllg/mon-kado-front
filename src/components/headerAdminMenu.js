import { addComponentEventListener, registerComponentCleanup } from "./componentLifecycle.js";

/** Creates an administrator navigation disclosure with native links.
 * @param {{items:ReadonlyArray<{label:string,href:string,routeName:string}>,onOpen:()=>void}} options Authorized navigation items.
 */
export function createHeaderAdminMenu({ items, onOpen }) {
  const element = document.createElement("li"); element.className = "app-admin-navigation";
  const disclosure = document.createElement("details"); disclosure.className = "app-admin-menu";
  const toggle = document.createElement("summary"); toggle.className = "app-navigation__link"; toggle.textContent = "Administration";
  const panel = document.createElement("ul"); panel.className = "app-admin-menu__links";
  panel.id = `admin-navigation-${crypto.randomUUID()}`; toggle.setAttribute("aria-controls", panel.id); toggle.setAttribute("aria-expanded", "false");
  /** @type {Map<string,HTMLAnchorElement>} */ const links = new Map();
  for (const item of items) {
    const row = document.createElement("li"); const link = document.createElement("a");
    link.className = "app-navigation__link"; link.href = item.href; link.textContent = item.label;
    row.append(link); panel.append(row); links.set(item.routeName, link);
  }
  disclosure.append(toggle, panel); element.append(disclosure);
  addComponentEventListener(element, disclosure, "toggle", () => {
    toggle.setAttribute("aria-expanded", String(disclosure.open));
    if (disclosure.open) onOpen();
  });
  addComponentEventListener(element, disclosure, "keydown", event => {
    const key = /** @type {KeyboardEvent} */ (event);
    if (key.key === "Escape" && disclosure.open) { key.preventDefault(); key.stopPropagation(); close(true); }
    if (key.target === toggle && (key.key === "ArrowDown" || key.key === "ArrowUp")) {
      key.preventDefault(); disclosure.open = true; toggle.setAttribute("aria-expanded", "true");
      const choices = [...links.values()]; (key.key === "ArrowDown" ? choices[0] : choices.at(-1))?.focus();
    }
  });
  addComponentEventListener(element, disclosure, "focusout", event => {
    const target = /** @type {FocusEvent} */ (event).relatedTarget;
    if (target instanceof Node && !disclosure.contains(target)) close();
  });
  addComponentEventListener(element, document, "pointerdown", event => {
    if (event.target instanceof Node && !disclosure.contains(event.target)) close();
  });
  registerComponentCleanup(element, () => close());
  return { element, links, close, setActive };

  /** @param {boolean} [restoreFocus] Return focus after keyboard dismissal. */
  function close(restoreFocus = false) {
    disclosure.open = false; toggle.setAttribute("aria-expanded", "false");
    if (restoreFocus && toggle.isConnected) toggle.focus();
  }
  /** @param {boolean} active Whether this section contains the current page. */
  function setActive(active) {
    disclosure.dataset.active = String(active);
    if (active) toggle.setAttribute("aria-description", "Section active"); else toggle.removeAttribute("aria-description");
  }
}
