import { contextualReturn, initializeReturnNavigation, returnNavigationState, synchronizeReturnLink, watchReturnNavigation } from "./returnNavigation.js";

initializeReturnNavigation();
let stop = watchReturnNavigation(window, document.body);
let watching = true;
window.addEventListener("pagehide", () => { stop(); watching = false; });
window.addEventListener("pageshow", () => {
  initializeReturnNavigation();
  if (!watching) { stop = watchReturnNavigation(window, document.body); watching = true; }
  for (const link of document.querySelectorAll("a.back-link")) synchronizeReturnLink(/** @type {HTMLAnchorElement} */ (link));
});
document.addEventListener("click", event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
  const link = /** @type {HTMLAnchorElement | null} */ (event.target.closest("a.back-link[href]"));
  if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self") || link.getAttribute("aria-disabled") === "true") return;
  const destination = contextualReturn();
  if (!destination) return;
  event.preventDefault();
  window.history.replaceState(returnNavigationState(window, destination.href, "replace"), "", destination.href);
  window.location.replace(destination.href);
});
