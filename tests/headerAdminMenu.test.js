// @vitest-environment happy-dom
/* global document, KeyboardEvent, FocusEvent, PointerEvent */
import { afterEach, expect, it, vi } from "vitest";
import { createHeaderAdminMenu } from "../src/components/headerAdminMenu.js";
import { disposeComponent } from "../src/components/componentLifecycle.js";

/** @type {HTMLElement[]} */ const owners = [];
afterEach(() => { owners.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
function setup(empty = false) {
  const onOpen = vi.fn();
  const ui = createHeaderAdminMenu({ onOpen, items: empty ? [] : [{ label: "Journal", href: "/admin/activity", routeName: "journal" }, { label: "Comptes", href: "/admin/members", routeName: "members" }] });
  owners.push(ui.element); document.body.append(ui.element);
  const menu = /** @type {HTMLDetailsElement} */ (ui.element.querySelector("details"));
  const trigger = /** @type {HTMLElement} */ (menu.querySelector("summary"));
  return { ...ui, menu, trigger, onOpen };
}
it("opens the first or last administrator destination with arrows and returns focus on Escape", () => {
  const ui = setup(); ui.trigger.focus();
  for (const [key, destination] of [["ArrowDown", "journal"], ["ArrowUp", "members"]]) {
    ui.trigger.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    expect(ui.menu.open).toBe(true); expect(document.activeElement).toBe(ui.links.get(destination));
    ui.menu.dispatchEvent(new Event("toggle")); expect(ui.onOpen).toHaveBeenCalled();
    ui.menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(ui.menu.open).toBe(false); expect(document.activeElement).toBe(ui.trigger);
    expect(ui.trigger.getAttribute("aria-expanded")).toBe("false");
  }
});
it("keeps internal interaction open and dismisses when focus or pointer leaves the section", () => {
  const ui = setup(); const outside = document.createElement("button"); document.body.append(outside);
  ui.menu.open = true; ui.menu.dispatchEvent(new Event("toggle"));
  ui.menu.dispatchEvent(new FocusEvent("focusout", { relatedTarget: ui.links.get("journal") })); expect(ui.menu.open).toBe(true);
  ui.menu.dispatchEvent(new FocusEvent("focusout", { relatedTarget: null })); expect(ui.menu.open).toBe(true);
  ui.trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); expect(ui.menu.open).toBe(true);
  ui.menu.dispatchEvent(new FocusEvent("focusout", { relatedTarget: outside })); expect(ui.menu.open).toBe(false);
  ui.menu.open = true; outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); expect(ui.menu.open).toBe(false);
  ui.setActive(true); expect(ui.trigger.getAttribute("aria-description")).toBe("Section active");
  ui.setActive(false); expect(ui.trigger.hasAttribute("aria-description")).toBe(false);
  ui.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  ui.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); expect(ui.menu.open).toBe(false);
});
it("handles an empty authorized navigation and removes its listeners on disposal", () => {
  const ui = setup(true); ui.trigger.focus();
  ui.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  expect(document.activeElement).toBe(ui.trigger); disposeComponent(ui.element); expect(ui.menu.open).toBe(false);
});
