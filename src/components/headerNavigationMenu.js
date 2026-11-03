import { addComponentEventListener, registerComponentCleanup } from "./componentLifecycle.js";

/** Creates a header disclosure with native navigation links and explicit commands.
 * @param {{items:ReadonlyArray<{label:string,href:string,routeName:string}>,onOpen:()=>void,label?:string,className?:string,actions?:HTMLElement[]}} options Authorized navigation items and commands.
 */
export function createHeaderNavigationMenu({ items, onOpen, label = "Administration", className = "app-admin-menu", actions = [] }) {
  const element = document.createElement("li"); element.className = "app-header-navigation-menu";
  const disclosure = document.createElement("details"); disclosure.className = className;
  const toggle = document.createElement("summary"); toggle.className = "app-navigation__link";
  const caption = document.createElement("span"); caption.className = "app-header-navigation-menu__label"; caption.textContent = label;
  toggle.setAttribute("aria-label", label);
  toggle.append(caption);
  const panel = document.createElement("ul"); panel.className = `${className}__links`;
  panel.id = `header-navigation-${crypto.randomUUID()}`; toggle.setAttribute("aria-controls", panel.id); toggle.setAttribute("aria-expanded", "false");
  /** @type {Map<string,HTMLAnchorElement>} */ const links = new Map();
  for (const item of items) {
    const row = document.createElement("li"); const link = document.createElement("a");
    link.className = "app-navigation__link"; link.href = item.href; link.textContent = item.label;
    row.append(link); panel.append(row); links.set(item.routeName, link);
  }
  for (const action of actions) { const row = document.createElement("li"); row.append(action); panel.append(row); }
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
      const choices = [...links.values(), ...actions]; (key.key === "ArrowDown" ? choices[0] : choices.at(-1))?.focus();
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
  return { element, links, trigger: toggle, close, setActive };

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
