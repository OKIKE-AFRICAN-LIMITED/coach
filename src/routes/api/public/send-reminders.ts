import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWebPush } from "@/lib/push-notifications";

export const Route = createFileRoute("/api/public/send-reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => handleCheckReminders(request),
      POST: async ({ request }) => handleCheckReminders(request),
    },
  },
});

async function handleCheckReminders(request: Request) {
  // Guard with PUSH_CRON_SECRET if configured
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

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  try {
    // 1. Find all active tasks where remind_at has arrived
    const { data: dueTasks, error: tasksError } = await supabaseAdmin
      .from("tasks")
      .select("id, user_id, title, notes, remind_at")
      .eq("status", "todo")
      .not("remind_at", "is", null)
      .lte("remind_at", nowIso)
      .gte("remind_at", twoHoursAgo);

    if (tasksError) {
      console.error("Error fetching due tasks:", tasksError);
      return new Response(JSON.stringify({ error: tasksError.message }), { status: 500 });
    }

    if (!dueTasks || dueTasks.length === 0) {
      return new Response(JSON.stringify({ status: "ok", sentCount: 0, message: "No tasks due" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const task of dueTasks) {
      // Find all push subscriptions for this user
      const { data: subs, error: subsError } = await supabaseAdmin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", task.user_id);

      if (subsError || !subs || subs.length === 0) {
        // No push subscription registered for this user yet
        continue;
      }

      const payload = {
        title: `⏰ ${task.title}`,
        body: task.notes || "Your scheduled task reminder is due.",
        tag: `ziri-task-${task.id}`,
        data: {
          taskId: task.id,
          remindAt: task.remind_at,
          url: "/tasks",
        },
      };

      for (const sub of subs) {
        const result = await sendWebPush(sub, payload);
        if (result.success) {
          sentCount++;
        } else if (result.shouldRemove) {
          // Subscription is no longer valid (e.g. user revoked permission in browser)
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        }
      }

      // Clear remind_at so we don't repeat the push on the next cycle.
      // If the user clicks "Snooze 5m" on their notification, remind_at will be set to +5min.
      await supabaseAdmin
        .from("tasks")
        .update({ remind_at: null } as any)
        .eq("id", task.id);
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        tasksProcessed: dueTasks.length,
        sentCount,
        timestamp: nowIso,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Failed to process reminders:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
