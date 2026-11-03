import { addComponentEventListener, registerComponentCleanup, disposeComponent } from "../../components/componentLifecycle.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { alignHeaderPanel } from "../../components/headerPanelPosition.js";

/** Creates a lazy notification disclosure without navigating away from the current page.
 * @param {{render:(signal:AbortSignal)=>HTMLElement,onOpen:()=>void}} options Authenticated content and sibling-menu dismissal.
 */
export function createHeaderNotificationsMenu({ render, onOpen }) {
  const element = document.createElement("details"); element.className = "app-notifications-menu";
  const trigger = document.createElement("summary"); trigger.className = "app-navigation__link app-notifications-link";
  applyActionIcon(trigger, "bell", "Notifications");
  const panel = document.createElement("div"); panel.className = "app-notifications-panel";
  panel.id = `header-notifications-${crypto.randomUUID()}`;
  trigger.setAttribute("aria-controls", panel.id); trigger.setAttribute("aria-expanded", "false");
  element.append(trigger, panel);
  /** @type {AbortController|null} */ let controller = null;
  const resize = new ResizeObserver(() => fitPanel());

  function fitPanel() {
    if (!controller || !element.isConnected) return;
    if (element.closest(".app-header-notifications")) alignHeaderPanel(panel, trigger);
    panel.style.setProperty("--notifications-available-height", `${Math.max(44, window.innerHeight - panel.getBoundingClientRect().top - 16)}px`);
  }

  function show() {
    if (controller) return;
    controller = new AbortController();
    element.open = true; trigger.setAttribute("aria-expanded", "true");
    onOpen(); panel.append(render(controller.signal));
    resize.observe(element.closest("header") ?? element); fitPanel();
  }
  /** @param {boolean} [restoreFocus] Return focus after keyboard dismissal. */
  function close(restoreFocus = false) {
    element.open = false; trigger.setAttribute("aria-expanded", "false");
    controller?.abort(); controller = null; disposeComponent(panel); panel.replaceChildren();
    resize.disconnect();
    if (restoreFocus && trigger.isConnected) trigger.focus();
  }
  addComponentEventListener(element, trigger, "click", event => {
    event.preventDefault(); if (element.open) close(); else show();
  });
  addComponentEventListener(element, element, "toggle", () => {
    if (element.open) show(); else close();
  });
  addComponentEventListener(element, element, "keydown", event => {
    const key = /** @type {KeyboardEvent} */ (event);
    if (key.target === trigger && (key.key === "ArrowDown" || key.key === "ArrowUp")) {
      key.preventDefault(); show();
      const choices = [...panel.querySelectorAll("a,button:not(:disabled),[tabindex='-1']")];
      const choice = key.key === "ArrowDown" ? choices[0] : choices.at(-1);
      if (choice instanceof HTMLElement) choice.focus();
    }
  });
  // Loading or disabling an action can temporarily return focus to the document.
  addComponentEventListener(element, document, "keydown", event => {
    const key = /** @type {KeyboardEvent} */ (event);
    if (key.key === "Escape" && element.open) { key.preventDefault(); key.stopPropagation(); close(true); }
  }, true);
  addComponentEventListener(element, element, "focusout", event => {
    const target = /** @type {FocusEvent} */ (event).relatedTarget;
    if (target instanceof Node && target !== document.body && !element.contains(target)) close();
  });
  addComponentEventListener(element, document, "pointerdown", event => {
    if (event.target instanceof Node && !element.contains(event.target)) close();
  });
  addComponentEventListener(element, window, "resize", fitPanel);
  registerComponentCleanup(element, close);
  return { element, trigger, open: show, close };
}
