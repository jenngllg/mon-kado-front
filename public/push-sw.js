// No fetch handler: this worker never caches authenticated pages or API data.
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(self.clients.claim()); });
self.addEventListener("push", event => {
  // RFC 8030 empty pushes intentionally contain no names, wishes or secret links.
  event.waitUntil(self.registration.showNotification("MonKado", {
    body: "Tu as une nouvelle notification dans MonKado.",
    icon: "/icons/monkado-192.png", badge: "/icons/monkado-192.png",
    tag: "monkado-notifications", data: { path: "/?notifications=1" },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("/?notifications=1", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.focus(); client.postMessage({ type: "monkado-open-notifications" }); return;
    }
    await self.clients.openWindow(url);
  })());
});
