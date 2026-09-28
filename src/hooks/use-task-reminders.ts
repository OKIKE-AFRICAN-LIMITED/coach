import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTasks } from "@/lib/tasks.functions";
import type { AlarmTask } from "@/components/AlarmOverlay";

const POLL_INTERVAL_MS = 20_000;
const GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutes
const FIRED_KEY = "ziri_fired_reminders_v2";
const SNOOZE_KEY = "ziri_snoozed_reminders";

// ---------- localStorage helpers ----------

function getFiredMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function markFired(id: string) {
  try {
    const map = getFiredMap();
    map[id] = new Date().toISOString();
    localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {}
}

function hasFired(id: string): boolean {
  return id in getFiredMap();
}

function getSnoozeMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function snoozeReminder(id: string, minutes: number) {
  try {
    const map = getSnoozeMap();
    map[id] = new Date(Date.now() + minutes * 60_000).toISOString();
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
  } catch {}
}

function isSnoozed(id: string): boolean {
  const map = getSnoozeMap();
  const until = map[id];
  if (!until) return false;
  if (new Date(until) > new Date()) return true;
  // snooze expired — clear it so it can fire again
  delete map[id];
  try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(map)); } catch {}
  return false;
}

function pruneOldEntries() {
  try {
    const map = getFiredMap();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let changed = false;
    for (const [id, ts] of Object.entries(map)) {
      if (new Date(ts) < cutoff) { delete map[id]; changed = true; }
    }
    if (changed) localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {}
}

// ---------- Notification permission ----------

async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

// ---------- Native notification (background / PWA) ----------

function fireNativeNotification(task: AlarmTask) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(`⏰ ${task.title}`, {
      body: task.notes || "Your task reminder is due — tap to open.",
      icon: "/icon-512.png",
      tag: `ziri-alarm-${task.id}`,
      requireInteraction: true, // stays until user acts on it
      // @ts-ignore – vibrate is valid in PWA/Android context
      vibrate: [300, 100, 300, 100, 300, 500, 300, 100, 300],
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {}
}

// ---------- Custom event to trigger the in-app AlarmOverlay ----------

export const ALARM_EVENT = "ziri:alarm";

export interface AlarmEventDetail {
  tasks: AlarmTask[];
}

function dispatchAlarm(tasks: AlarmTask[]) {
  window.dispatchEvent(new CustomEvent<AlarmEventDetail>(ALARM_EVENT, { detail: { tasks } }));
}

// ---------- Hook ----------

export function useTaskReminders() {
  const list = useServerFn(listTasks);
  const initialized = useRef(false);

  useEffect(() => {
    pruneOldEntries();
  }, []);

  useQuery({
    queryKey: ["tasks", "reminders-poll"],
    queryFn: async () => {
      const tasks = await list();
      const now = new Date();

      const isFirstRun = !initialized.current;
      if (isFirstRun) initialized.current = true;

      const toFire: AlarmTask[] = [];

      for (const task of tasks) {
        if (task.status === "done") continue;
        if (!task.remind_at) continue;
        if (hasFired(task.id)) continue;
        if (isSnoozed(task.id)) continue;

        const remindAt = new Date(task.remind_at);
        const msOverdue = now.getTime() - remindAt.getTime();

        if (msOverdue < 0) continue; // not due yet

        if (isFirstRun && msOverdue > GRACE_PERIOD_MS) {
          // Stale — silently dismiss so we don't spam on login
          markFired(task.id);
          continue;
        }

        markFired(task.id);
        toFire.push({ id: task.id, title: task.title, notes: task.notes });
      }

      if (toFire.length > 0) {
        // Always fire the in-app alarm overlay
        dispatchAlarm(toFire);
        // Also fire native notifications for each task (shows in OS tray / lock screen)
        toFire.forEach(fireNativeNotification);
      }

      return tasks;
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}
