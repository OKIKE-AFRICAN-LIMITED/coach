// Coach Ziri Service Worker
// Handles push notifications so alarms fire even when the app is in the background
// or installed as a PWA on iOS / Android / Windows.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click — focus or open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const taskId = event.notification.data?.taskId;

  if (action === "snooze") {
    // Tell the page to snooze this task (5 minutes)
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "SNOOZE_REMINDER", taskId, minutes: 5 });
        }
        if (clients.length === 0) {
          return self.clients.openWindow("/tasks");
        }
      })
    );
    return;
  }

  // Default: focus existing window or open app
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/tasks");
    })
  );
});

// Handle messages from the page
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
