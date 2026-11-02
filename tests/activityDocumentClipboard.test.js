// @vitest-environment happy-dom
/* global document */
import { afterEach, expect, it, vi } from "vitest";
import { openActivityDocument } from "../src/features/admin/activityDocument.js";
import { disposeComponent } from "../src/components/componentLifecycle.js";
import { barrier } from "./sessionTestHelpers.js";
/** @type {HTMLElement[]} */ const owners = [];
afterEach(() => { owners.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.restoreAllMocks(); });
const item = { id: "event", displayName: "Léa", displayNameTag: "1234", occurredAt: "2026-11-02T08:00:00Z", kind: "action", activity: "Lecture", payload: null, isImpersonated: true, actorDisplayName: null };
function setup() {
  const owner = document.createElement("section"), trigger = document.createElement("button"); owner.append(trigger); document.body.append(owner); owners.push(owner);
  openActivityDocument(owner, item, trigger); const dialog = /** @type {HTMLDialogElement} */ (owner.querySelector("dialog"));
  const copy = /** @type {HTMLButtonElement} */ ([...dialog.querySelectorAll("button")].find(button => button.textContent === "Copier le JSON"));
  return { owner, trigger, dialog, copy };
}
it.each([true, false])("copies the sanitized document and provides usable feedback on success=%s", async success => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(() => success ? Promise.resolve() : Promise.reject(new Error("denied")));
  const ui = setup(); ui.copy.click(); await vi.waitFor(() => expect(ui.copy.disabled).toBe(false));
  expect(write).toHaveBeenCalledExactlyOnceWith(JSON.stringify(item, null, 2));
  expect(ui.dialog.querySelector('[role="status"]')?.textContent).toContain(success ? "JSON copié." : "Copie indisponible.");
  expect(ui.dialog.textContent).toContain("un administrateur supprimé");
  openActivityDocument(ui.owner, item, ui.trigger); expect(ui.owner.querySelectorAll("dialog")).toHaveLength(1);
  ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true })); expect(document.activeElement).toBe(ui.trigger);
});
it.each([true, false])("does not restore document content after disposal while a copy settles: %s", async success => {
  const gate = barrier(); vi.spyOn(navigator.clipboard, "writeText").mockImplementation(async () => { await gate.promise; if (!success) throw new Error("denied"); });
  const ui = setup(); ui.copy.click(); expect(ui.copy.disabled).toBe(true); disposeComponent(ui.owner); gate.resolve();
  await gate.promise; await Promise.resolve(); await Promise.resolve(); expect(ui.dialog.isConnected).toBe(false); expect(ui.dialog.querySelector("pre")?.textContent).toBe("");
});
