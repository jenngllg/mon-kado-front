/* global chrome, browser, document, crypto, CustomEvent, setTimeout, clearTimeout */
const api = typeof browser !== "undefined" ? browser : chrome;
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== api.runtime.id || !message || !["probe", "lists", "image", "create"].includes(message.action)) return false;
  const id = crypto.randomUUID();
  const timer = setTimeout(() => { document.removeEventListener("monkado-extension-response", receive); respond({ error: message.action === "probe" ? "unavailable" : "uncertain" }); }, message.action === "probe" ? 1500 : 30000);
  function receive(event) {
    if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;
    let response;
    try { response = JSON.parse(event.detail); } catch { return; }
    if (response?.id !== id) return;
    clearTimeout(timer); document.removeEventListener("monkado-extension-response", receive); respond(response.result);
  }
  document.addEventListener("monkado-extension-response", receive);
  document.dispatchEvent(new CustomEvent("monkado-extension-request", { detail: JSON.stringify({ id, action: message.action, value: message.value }) }));
  return true;
});
