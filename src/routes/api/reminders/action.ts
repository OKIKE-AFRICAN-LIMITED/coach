import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyReminderActionToken } from "@/lib/push-notifications";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/reminders/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            action?: "snooze" | "dismiss";
            taskId?: string;
            minutes?: number;
            actionToken?: string;
          };

          const { action, taskId, minutes = 5, actionToken } = body;
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          if (!taskId || !uuidRegex.test(taskId) || !action) {
            return new Response(JSON.stringify({ error: "Missing or invalid taskId or action" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Require either a valid signed push actionToken (for background SW) or a valid user JWT
          let authorizedUserId: string | null = null;
          const hasValidActionToken = Boolean(actionToken && verifyReminderActionToken(taskId, actionToken));

          if (!hasValidActionToken) {
            const auth = request.headers.get("authorization");
            if (!auth?.startsWith("Bearer ")) {
              return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
              });
            }
            const jwt = auth.slice("Bearer ".length);
            const supabase = createClient<Database>(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_PUBLISHABLE_KEY!,
              {
                global: { headers: { Authorization: `Bearer ${jwt}` } },
                auth: { persistSession: false, autoRefreshToken: false },
              },
            );
            const { data: claims, error: claimsErr } = await supabase.auth.getClaims(jwt);
            if (claimsErr || !claims?.claims?.sub) {
              return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
              });
            }
            authorizedUserId = claims.claims.sub;
          }

          const clampedMinutes = Math.max(1, Math.min(1440, Number(minutes) || 5));

          if (action === "snooze") {
            const newRemindAt = new Date(Date.now() + clampedMinutes * 60_000).toISOString();
            let q = supabaseAdmin
              .from("tasks")
              .update({ remind_at: newRemindAt })
              .eq("id", taskId)
              .eq("status", "todo");
            if (authorizedUserId) q = q.eq("user_id", authorizedUserId);
            const { error } = await q;

            if (error) {
              console.error("Failed to snooze task in DB:", error);
              return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            }

            return new Response(JSON.stringify({ success: true, remindAt: newRemindAt }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (action === "dismiss") {
            let q = supabaseAdmin
              .from("tasks")
              .update({ remind_at: null })
              .eq("id", taskId);
            if (authorizedUserId) q = q.eq("user_id", authorizedUserId);
            const { error } = await q;

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
