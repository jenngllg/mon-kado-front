import { addComponentEventListener } from "./componentLifecycle.js";

/** Refresh read-only data when returning to the window, without discarding edits.
 * @param {HTMLElement} owner Disposable view or section.
 * @param {() => void} read Guarded, read-only operation.
 */
export function refreshOnReturn(owner, read) {
  let edited = false;
  addComponentEventListener(owner, owner, "input", () => { edited = true; });
  addComponentEventListener(owner, window, "focus", () => {
    if (!owner.isConnected || edited || owner.querySelector("dialog[open]")) return;
    read();
  });
}
