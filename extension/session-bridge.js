/* global chrome, document, crypto, CustomEvent, setTimeout, clearTimeout */
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message || !["probe", "lists", "create"].includes(message.action)) return false;
  const id = crypto.randomUUID();
  const timer = setTimeout(() => { document.removeEventListener("monkado-extension-response", receive); respond({ error: message.action === "probe" ? "unavailable" : "uncertain" }); }, message.action === "probe" ? 1500 : 30000);
  function receive(event) {
    if (!(event instanceof CustomEvent) || event.detail?.id !== id) return;
    clearTimeout(timer); document.removeEventListener("monkado-extension-response", receive); respond(event.detail.result);
  }
  document.addEventListener("monkado-extension-response", receive);
  document.dispatchEvent(new CustomEvent("monkado-extension-request", { detail: { id, action: message.action, value: message.value } }));
  return true;
});
