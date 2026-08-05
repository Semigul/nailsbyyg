const NOTIFICATION_TITLE = "Ny beställning";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event.data);
  const title = payload.title || NOTIFICATION_TITLE;
  const options = {
    body: payload.body || "En ny beställning har kommit in.",
    icon: "./assets/icons/admin-app-192.png",
    badge: "./assets/icons/admin-app-192.png",
    tag: payload.tag || "new-order",
    renotify: true,
    data: {
      orderId: payload.orderId || ""
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const adminUrl = new URL("./admin.html", self.registration.scope).href;

  event.waitUntil(openAdminApp(adminUrl));
});

function readPushPayload(data) {
  if (!data) {
    return {};
  }

  try {
    return data.json();
  } catch {
    return { body: data.text() };
  }
}

async function openAdminApp(adminUrl) {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });

  for (const windowClient of windows) {
    if (windowClient.url.startsWith(self.registration.scope)) {
      if (windowClient.url !== adminUrl && "navigate" in windowClient) {
        await windowClient.navigate(adminUrl);
      }

      return windowClient.focus();
    }
  }

  return self.clients.openWindow(adminUrl);
}
