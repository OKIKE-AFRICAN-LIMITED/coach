import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/reminders/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            action?: "snooze" | "dismiss";
            taskId?: string;
            minutes?: number;
          };

          const { action, taskId, minutes = 5 } = body;

          if (!taskId || !action) {
            return new Response(JSON.stringify({ error: "Missing taskId or action" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (action === "snooze") {
            const newRemindAt = new Date(Date.now() + minutes * 60_000).toISOString();
            const { error } = await supabaseAdmin
              .from("tasks")
              .update({ remind_at: newRemindAt } as any)
              .eq("id", taskId);

            if (error) {
              console.error("Failed to snooze task in DB:", error);
              return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            }

            return new Response(JSON.stringify({ success: true, remindAt: newRemindAt }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (action === "dismiss") {
            const { error } = await supabaseAdmin
              .from("tasks")
              .update({ remind_at: null } as any)
              .eq("id", taskId);

            if (error) {
              console.error("Failed to dismiss task in DB:", error);
              return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            }

            return new Response(JSON.stringify({ success: true, dismissed: true }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
        } catch (err: any) {
          console.error("Reminder action error:", err);
          return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
