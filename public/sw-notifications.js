self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "KuXtaL";
  const body = data.body || "Nueva alerta de salud";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [200, 100, 200],
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || "/"));
});
