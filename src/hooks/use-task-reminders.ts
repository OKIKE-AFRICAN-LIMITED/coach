import { useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listTasks,
  snoozeTaskReminder,
  dismissTaskReminder,
  savePushSubscription,
} from "@/lib/tasks.functions";
import type { AlarmTask } from "@/components/AlarmOverlay";

export type { AlarmTask };

const POLL_INTERVAL_MS = 15_000; // Poll every 15 seconds
const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes grace period

// ─── Storage keys ────────────────────────────────────────────────────────────
const DISMISSED_KEY = "ziri_dismissed_v4";
const SNOOZE_KEY = "ziri_snoozed_v4";
const RINGING_KEY = "ziri_ringing_v4";

// ─── In-memory active snooze timeouts ────────────────────────────────────────
const activeSnoozeTimeouts = new Map<string, number>();

// ─── Local Storage Helpers ───────────────────────────────────────────────────
function getDismissed(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function markDismissedLocally(id: string) {
  try {
    const m = getDismissed();
    m[id] = new Date().toISOString();
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(m));
  } catch {}
}

export function isDismissedLocally(id: string): boolean {
  return id in getDismissed();
}

function getSnoozeMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getSnoozeUntil(id: string): string | null {
  const m = getSnoozeMap();
  return m[id] || null;
}

export function isSnoozedLocally(id: string): boolean {
  const m = getSnoozeMap();
  const until = m[id];
  if (!until) return false;
  if (new Date(until).getTime() > Date.now()) return true;
  // Expired: clean up
  delete m[id];
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(m));
  } catch {}
  return false;
}

// ─── Ringing Overlay Tracking (sessionStorage) ────────────────────────────────
function getRinging(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(RINGING_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function markRinging(id: string) {
  const s = getRinging();
  s.add(id);
  try {
    sessionStorage.setItem(RINGING_KEY, JSON.stringify([...s]));
  } catch {}
}

export function unmarkRinging(id: string) {
  const s = getRinging();
  s.delete(id);
  try {
    sessionStorage.setItem(RINGING_KEY, JSON.stringify([...s]));
  } catch {}
}

// ─── Native & Service Worker Notifications ───────────────────────────────────
export async function fireNativeNotification(task: AlarmTask) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const title = `⏰ ${task.title}`;
  const body = task.notes || "Your task reminder is due — tap to open.";

  // Prefer ServiceWorkerRegistration.showNotification (supports actions, vibration, lock screen on PWA)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, {
          body,
          icon: "/icon-512.png",
          badge: "/icon-512.png",
          tag: `ziri-alarm-${task.id}`,
          requireInteraction: true,
          renotify: true,
          // @ts-ignore
          vibrate: [300, 100, 300, 100, 300, 500, 300, 100, 300],
          data: { taskId: task.id, url: "/tasks" },
          actions: [
            { action: "snooze_5", title: "⏱ Snooze 5m" },
            { action: "dismiss", title: "✓ Dismiss" },
          ],
        });
        return;
      }
    } catch (e) {
      console.warn("ServiceWorker showNotification failed, using fallback:", e);
    }
  }

  // Fallback to standard window Notification
  try {
    const n = new Notification(title, {
      body,
      icon: "/icon-512.png",
      tag: `ziri-alarm-${task.id}`,
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {}
}

// ─── Web Push Subscription ───────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function ensurePushSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const vapidKey =
    import.meta.env.VITE_VAPID_PUBLIC_KEY ||
    "BLDvLoxoZQIfpCJINqRliYhEnuXhdl-ViO9-Z95Wxw9Wb6QHmiLg71yaiqBu6PnCrljhr3zRdBaiLQ06SMVzGXs";

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      const appServerKey = urlBase64ToUint8Array(vapidKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
    }

    if (sub) {
      const p256dh = sub.getKey("p256dh");
      const auth = sub.getKey("auth");
      if (p256dh && auth) {
        const p256dhStr = btoa(String.fromCharCode(...new Uint8Array(p256dh)));
        const authStr = btoa(String.fromCharCode(...new Uint8Array(auth)));

        // Save to Supabase via server function
        await savePushSubscription({
          data: {
            endpoint: sub.endpoint,
            p256dh: p256dhStr,
            auth: authStr,
          },
        });
        return true;
      }
    }
  } catch (err) {
    console.warn("Failed to subscribe for Web Push:", err);
  }
  return false;
}

// ─── Custom DOM Event for Alarm Overlay ───────────────────────────────────────
export const ALARM_EVENT = "ziri:alarm";
export interface AlarmEventDetail {
  tasks: AlarmTask[];
}

export function dispatchAlarm(tasks: AlarmTask[]) {
  if (tasks.length === 0) return;
  window.dispatchEvent(new CustomEvent<AlarmEventDetail>(ALARM_EVENT, { detail: { tasks } }));
}

// ─── Global Snooze & Dismiss Handlers ─────────────────────────────────────────
export function setClientSnooze(task: AlarmTask, minutes: number, onRefire?: () => void) {
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  const m = getSnoozeMap();
  m[task.id] = until;
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(m));
  } catch {}

  // Remove from ringing
  unmarkRinging(task.id);

  // Clear any existing timer
  if (activeSnoozeTimeouts.has(task.id)) {
    window.clearTimeout(activeSnoozeTimeouts.get(task.id));
  }

  // Set an exact timer for when snooze ends
  const timeoutId = window.setTimeout(() => {
    activeSnoozeTimeouts.delete(task.id);
    // Remove expired snooze
    const curr = getSnoozeMap();
    delete curr[task.id];
    try {
      localStorage.setItem(SNOOZE_KEY, JSON.stringify(curr));
    } catch {}

    // Mark ringing and fire immediately!
    markRinging(task.id);
    dispatchAlarm([task]);
    fireNativeNotification(task);
    onRefire?.();
  }, minutes * 60_000);

  activeSnoozeTimeouts.set(task.id, timeoutId);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTaskReminders() {
  const list = useServerFn(listTasks);
  const snoozeFn = useServerFn(snoozeTaskReminder);
  const dismissFn = useServerFn(dismissTaskReminder);
  const qc = useQueryClient();
  const initialized = useRef(false);

  // Ensure push subscription when notification permission is granted
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      ensurePushSubscribed().catch(() => {});
    }
  }, []);

  // Poll tasks for reminders
  useQuery({
    queryKey: ["tasks", "reminders-poll"],
    queryFn: async () => {
      const tasks = await list();
      const now = Date.now();
      const isFirstRun = !initialized.current;
      if (isFirstRun) initialized.current = true;

      const toFire: AlarmTask[] = [];

      for (const task of tasks) {
        if (task.status === "done") continue;
        if (!task.remind_at) continue;

        // Skip permanently dismissed tasks
        if (isDismissedLocally(task.id)) continue;

        // Check if currently snoozed
        if (isSnoozedLocally(task.id)) continue;

        // Skip if already ringing on screen
        if (getRinging().has(task.id)) continue;

        const remindTime = new Date(task.remind_at).getTime();
        const msOverdue = now - remindTime;

        // Not yet due
        if (msOverdue < 0) continue;

        // If stale on initial app load (> 15 minutes overdue)
        if (isFirstRun && msOverdue > GRACE_PERIOD_MS) {
          markDismissedLocally(task.id);
          continue;
        }

        // Due! Mark ringing and queue for alarm
        markRinging(task.id);
        toFire.push({
          id: task.id,
          title: task.title,
          notes: task.notes,
        });
      }

      if (toFire.length > 0) {
        dispatchAlarm(toFire);
        toFire.forEach(fireNativeNotification);
      }

      return tasks;
    },
    refetchInterval: POLL_INTERVAL_MS,
    // CRITICAL: continue polling even when tab/PWA is in background!
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  // Export functions to trigger snooze & dismiss across client + server
  const handleSnooze = useCallback(
    async (task: AlarmTask, minutes: number) => {
      // 1. Immediate client feedback & exact timer
      setClientSnooze(task, minutes, () => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      });

      // 2. Persist to database so push notifications and other devices know the new time
      try {
        await snoozeFn({ data: { taskId: task.id, minutes } });
        qc.invalidateQueries({ queryKey: ["tasks"] });
      } catch (err) {
        console.error("Failed to persist snooze to DB:", err);
      }
    },
    [snoozeFn, qc]
  );

  const handleDismiss = useCallback(
    async (taskId: string) => {
      markDismissedLocally(taskId);
      unmarkRinging(taskId);

      // Clear any active snooze timer
      if (activeSnoozeTimeouts.has(taskId)) {
        window.clearTimeout(activeSnoozeTimeouts.get(taskId));
        activeSnoozeTimeouts.delete(taskId);
      }

      try {
        await dismissFn({ data: { taskId } });
        qc.invalidateQueries({ queryKey: ["tasks"] });
      } catch (err) {
        console.error("Failed to persist dismiss to DB:", err);
      }
    },
    [dismissFn, qc]
  );

  return { handleSnooze, handleDismiss };
}
