// Coach Ziri Service Worker
// Handles background push notifications, alarms, and offline caching for Web & PWA (iOS, Android, Windows, macOS)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Web Push Event (Receives background notifications even when app/PWA is closed) ───
self.addEventListener("push", (event) => {
  let data = {
    title: "⏰ Task Reminder",
    body: "You have a scheduled reminder due.",
    tag: "ziri-reminder",
    data: {},
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const taskId = data.data?.taskId;
  const tag = data.tag || (taskId ? `ziri-task-${taskId}` : "ziri-reminder");

  const options = {
    body: data.body,
    icon: "/icon-512.png",
    badge: "/icon-512.png",
    tag: tag,
    requireInteraction: true,
    renotify: true,
    vibrate: [300, 100, 300, 100, 300, 500, 300, 100, 300],
    data: {
      taskId: taskId,
      url: data.data?.url || "/tasks",
      remindAt: data.data?.remindAt,
    },
    actions: [
      { action: "snooze_5", title: "⏱ Snooze 5m" },
      { action: "dismiss", title: "✓ Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── Notification Click / Action Buttons ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const taskId = event.notification.data?.taskId;
  const targetUrl = event.notification.data?.url || "/tasks";

  if (action === "snooze_5" || action === "snooze") {
    event.waitUntil(
      (async () => {
        // 1. Tell any open window/tabs to snooze this task
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: "SNOOZE_REMINDER", taskId, minutes: 5 });
        }

        // 2. Also call the backend action API directly so snooze is saved to DB even if no tab is open
        if (taskId) {
          try {
            await fetch("/api/reminders/action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "snooze", taskId, minutes: 5 }),
            });
          } catch (e) {
            console.error("SW snooze fetch failed:", e);
          }
        }
      })()
    );
    return;
  }

  if (action === "dismiss") {
    event.waitUntil(
      (async () => {
        // 1. Tell any open window/tabs to dismiss
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: "DISMISS_REMINDER", taskId });
        }

        // 2. Call backend action API to dismiss in DB
        if (taskId) {
          try {
            await fetch("/api/reminders/action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "dismiss", taskId }),
            });
          } catch (e) {
            console.error("SW dismiss fetch failed:", e);
          }
        }
      })()
    );
    return;
  }

  // Default click on notification body: focus existing tab or open /tasks
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "NAVIGATE_TO", url: targetUrl, taskId });
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })()
  );
});

// ─── Handle messages from page ───
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
