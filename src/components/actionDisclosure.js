import { addComponentEventListener } from "./componentLifecycle.js";

/** Creates a keyboard-accessible disclosure for secondary actions.
 * @param {string} label Visible trigger label.
 * @param {string} accessibleLabel Contextual trigger name.
 * @param {HTMLElement[]} content Disclosure contents.
 * @returns {HTMLDetailsElement} Native disclosure.
 */
export function createActionDisclosure(label, accessibleLabel, content) {
  const disclosure = document.createElement("details");
  disclosure.className = "action-disclosure";
  const trigger = document.createElement("summary");
  trigger.textContent = label;
  trigger.setAttribute("aria-label", accessibleLabel);
  const panel = document.createElement("div");
  panel.className = "action-disclosure__panel";
  panel.append(...content);
  disclosure.append(trigger, panel);
  addComponentEventListener(disclosure, disclosure, "keydown", event => {
    if (/** @type {KeyboardEvent} */ (event).key !== "Escape") return;
    disclosure.open = false;
    trigger.focus();
  });
  addComponentEventListener(disclosure, document, "click", event => {
    if (!disclosure.contains(/** @type {Node} */ (event.target))) disclosure.open = false;
  });
  return disclosure;
}
