// @vitest-environment happy-dom
/* global document, KeyboardEvent, PointerEvent */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHeaderMemberSearch } from "../src/features/members/headerMemberSearch.js";
import { createApplicationShell } from "../src/app/applicationShell.js";
import { disposeComponent } from "../src/components/index.js";

/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
function setup() {
  const onSearch = vi.fn(), onOpen = vi.fn(), ui = createHeaderMemberSearch({ onSearch, onOpen });
  views.push(ui.element); document.body.append(ui.element);
  const input = /** @type {HTMLInputElement} */ (ui.element.querySelector("input"));
  const trigger = /** @type {HTMLButtonElement} */ (ui.element.querySelector("button"));
  const submit = () => ui.element.dispatchEvent(new Event("submit", { cancelable: true }));
  return { ...ui, onSearch, onOpen, input, trigger, submit };
}
describe("header member search", () => {
  it("starts inert, opens only on explicit activation and focuses its labeled field", () => {
    const ui = setup();
    expect(ui.input.disabled).toBe(true); expect(ui.input.parentElement?.inert).toBe(true);
    expect(ui.trigger.getAttribute("aria-expanded")).toBe("false");
    ui.trigger.click();
    expect(ui.input.disabled).toBe(false); expect(ui.input.parentElement?.inert).toBe(false);
    expect(ui.trigger.getAttribute("aria-expanded")).toBe("true"); expect(document.activeElement).toBe(ui.input);
    expect(ui.onOpen).toHaveBeenCalledOnce(); expect(ui.onSearch).not.toHaveBeenCalled();
  });
  it("validates before navigation, submits trimmed names and clears the disclosure", () => {
    const ui = setup(); ui.trigger.click(); ui.input.value = "a"; ui.submit();
    expect(ui.onSearch).not.toHaveBeenCalled(); expect(ui.input.getAttribute("aria-invalid")).toBe("true");
    ui.input.value = "  Camille#1234  "; ui.input.dispatchEvent(new Event("input")); ui.submit();
    expect(ui.onSearch).toHaveBeenCalledExactlyOnceWith("Camille#1234");
    expect(ui.input.value).toBe(""); expect(ui.input.disabled).toBe(true); expect(ui.trigger.getAttribute("aria-expanded")).toBe("false");
    ui.submit(); expect(ui.onSearch).toHaveBeenCalledOnce();
  });
  it("closes on Escape and returns keyboard focus to the magnifier", () => {
    const ui = setup(); ui.trigger.click(); ui.input.value = "Camille";
    ui.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(ui.trigger); expect(ui.input.disabled).toBe(true); expect(ui.input.value).toBe("");
  });
  it("closes on outside interaction without stealing focus or navigating", () => {
    const ui = setup(), outside = document.createElement("button"); document.body.append(outside);
    ui.trigger.click(); outside.focus(); outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(ui.input.disabled).toBe(false);
    outside.click();
    expect(ui.input.disabled).toBe(true); expect(document.activeElement).toBe(outside); expect(ui.onSearch).not.toHaveBeenCalled();
  });
  it("clears input and listeners when disposed", () => {
    const ui = setup(); ui.trigger.click(); ui.input.value = "Camille"; disposeComponent(ui.element);
    ui.trigger.click(); ui.submit(); expect(ui.input.disabled).toBe(true); expect(ui.input.value).toBe(""); expect(ui.onSearch).not.toHaveBeenCalled();
  });
  it("keeps the mobile menu and search mutually exclusive", () => {
    const shell = createApplicationShell({ onMemberSearch: vi.fn() }); views.push(shell.element); document.body.append(shell.element);
    const toggle = /** @type {HTMLButtonElement} */ (shell.element.querySelector('.app-member-search__toggle'));
    const menu = /** @type {HTMLButtonElement} */ (shell.element.querySelector('.app-menu-button'));
    menu.click(); expect(menu.getAttribute("aria-expanded")).toBe("true");
    toggle.click(); expect(toggle.getAttribute("aria-expanded")).toBe("true"); expect(menu.getAttribute("aria-expanded")).toBe("false");
    menu.click(); expect(toggle.getAttribute("aria-expanded")).toBe("false"); expect(menu.getAttribute("aria-expanded")).toBe("true");
    toggle.click(); shell.setCurrentRoute(null); expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});
