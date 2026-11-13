import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWebPush } from "@/lib/push-notifications";

export const Route = createFileRoute("/api/public/send-briefings")({
  server: {
    handlers: {
      GET: async ({ request }) => handleDailyBriefings(request),
      POST: async ({ request }) => handleDailyBriefings(request),
    },
  },
});

function parseHhMmToMinutes(hhmm: string | null | undefined, fallbackMinutes: number): number {
  if (!hhmm) return fallbackMinutes;
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallbackMinutes;
  }
  return h * 60 + m;
}

function getLocalClock(nowUtc: Date, offsetMinutes: number): { dateStr: string; minutesOfDay: number } {
  const local = new Date(nowUtc.getTime() + offsetMinutes * 60_000);
  const dateStr = local.toISOString().slice(0, 10);
  const minutesOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
  return { dateStr, minutesOfDay };
}

async function handleDailyBriefings(request: Request) {
  const configuredSecret = process.env.PUSH_CRON_SECRET;
  if (configuredSecret) {
    const authHeader = request.headers.get("authorization") || "";
    const xSecret = request.headers.get("x-cron-secret") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (token !== configuredSecret && xSecret !== configuredSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const nowUtc = new Date();
    const { data: subs, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth");

    if (subsError) {
      return new Response(JSON.stringify({ error: subsError.message }), { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ status: "ok", sentCount: 0, message: "No push subscribers" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const subsByUser = new Map<string, typeof subs>();
    for (const s of subs) {
      const list = subsByUser.get(s.user_id) ?? [];
      list.push(s);
      subsByUser.set(s.user_id, list);
    }

    const userIds = [...subsByUser.keys()];
    const { data: profiles, error: profError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, display_name, push_time, evening_push_time, timezone_offset_minutes, last_morning_briefing_date, last_evening_briefing_date",
      )
      .in("id", userIds);

    if (profError) {
      return new Response(JSON.stringify({ error: profError.message }), { status: 500 });
    }

    let sentCount = 0;
    let morningSent = 0;
    let eveningSent = 0;

    for (const profile of profiles ?? []) {
      const userSubs = subsByUser.get(profile.id) ?? [];
      if (userSubs.length === 0) continue;

      const offset = typeof profile.timezone_offset_minutes === "number" ? profile.timezone_offset_minutes : 60;
      const { dateStr, minutesOfDay } = getLocalClock(nowUtc, offset);

      const morningTarget = parseHhMmToMinutes(profile.push_time, 8 * 60);
      const eveningTarget = parseHhMmToMinutes(profile.evening_push_time, 20 * 60);

      const isMorningWindow =
        minutesOfDay >= morningTarget &&
        minutesOfDay < morningTarget + 20 &&
        profile.last_morning_briefing_date !== dateStr;

      const isEveningWindow =
        minutesOfDay >= eveningTarget &&
        minutesOfDay < eveningTarget + 20 &&
        profile.last_evening_briefing_date !== dateStr;

      if (!isMorningWindow && !isEveningWindow) continue;

      const { data: tasks } = await supabaseAdmin
        .from("tasks")
        .select("id, status, due_at, updated_at")
        .eq("user_id", profile.id);

      const todoTasks = (tasks ?? []).filter((t) => t.status === "todo");
      const dueToday = todoTasks.filter((t) => t.due_at && t.due_at.slice(0, 10) === dateStr).length;
      const overdue = todoTasks.filter((t) => t.due_at && t.due_at.slice(0, 10) < dateStr).length;
      const doneToday = (tasks ?? []).filter(
        (t) => t.status === "done" && t.updated_at && t.updated_at.slice(0, 10) === dateStr,
      ).length;

      const firstName = profile.display_name?.trim().split(/\s+/)[0] || "there";

      const sendToUser = async (payload: {
        title: string;
        body: string;
        tag: string;
        data: { url: string };
      }) => {
        let ok = false;
        for (const sub of userSubs) {
          const res = await sendWebPush(sub, payload);
          if (res.success) {
            sentCount++;
            ok = true;
          } else if (res.shouldRemove) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
        return ok;
      };

      if (isMorningWindow) {
        const sent = await sendToUser({
          title: `☀️ Good morning, ${firstName}`,
          body: `${dueToday} due today, ${overdue} overdue, ${todoTasks.length} open. Tap to plan your day with Coach Ziri.`,
          tag: `ziri-briefing-morning-${dateStr}`,
          data: { url: "/chat/new?briefing=morning" },
        });
        if (sent) {
          morningSent++;
          await supabaseAdmin
            .from("profiles")
            .update({ last_morning_briefing_date: dateStr })
            .eq("id", profile.id);
        }
      }

      if (isEveningWindow) {
        const sent = await sendToUser({
          title: `🌙 Evening Check-In, ${firstName}`,
          body: `You completed ${doneToday} task${doneToday === 1 ? "" : "s"} today with ${todoTasks.length} still open. Tap to review with Coach Ziri.`,
          tag: `ziri-briefing-evening-${dateStr}`,
          data: { url: "/chat/new?briefing=evening" },
        });
        if (sent) {
          eveningSent++;
          await supabaseAdmin
            .from("profiles")
            .update({ last_evening_briefing_date: dateStr })
            .eq("id", profile.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        morningSent,
        eveningSent,
        sentCount,
        timestamp: nowUtc.toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("Failed to process daily briefings:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

