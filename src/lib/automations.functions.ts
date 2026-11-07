import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getGoogleAccessToken } from "@/lib/google.functions";
import { format } from "date-fns";

export type AutomationId =
  | "calendar_prep"
  | "gmail_digest"
  | "overdue_triage"
  | "habit_nudge";

export interface AutomationLogItem {
  id: string;
  automationId: string;
  summary: string;
  createdAt: string;
}

export const listAutomationLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomationLogItem[]> => {
    const { data, error } = await context.supabase
      .from("activity_logs")
      .select("id, action, details, created_at")
      .eq("user_id", context.userId)
      .like("action", "automation:%")
      .order("created_at", { ascending: false })
      .limit(15);

    if (error || !data) return [];

    return data.map((row) => {
      const details = (row.details ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        automationId: row.action.replace("automation:", ""),
        summary: String(details.summary ?? "Executed workflow"),
        createdAt: row.created_at,
      };
    });
  });

export const runAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.enum(["calendar_prep", "gmail_digest", "overdue_triage", "habit_nudge"]),
      })
      .parse(d)
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ ok: boolean; summary: string; threadId?: string }> => {
      const { supabase, userId } = context;
      let summary = "";
      let threadId: string | undefined;

      if (data.id === "calendar_prep") {
        // 1. Fetch upcoming Google Calendar events for the next 48 hours
        let token: string;
        try {
          token = await getGoogleAccessToken(supabase, userId);
        } catch {
          throw new Error(
            "Google Calendar is not connected. Connect Google Workspace in Settings first."
          );
        }

        const timeMin = new Date().toISOString();
        const timeMax = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=15&timeMin=${encodeURIComponent(
          timeMin
        )}&timeMax=${encodeURIComponent(timeMax)}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error(`Google Calendar returned ${res.status}`);
        }
        const calJson = await res.json();
        const events = (calJson.items ?? []) as Array<{
          id: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
        }>;

        const { data: existingTasks } = await supabase
          .from("tasks")
          .select("title")
          .eq("user_id", userId)
          .eq("status", "todo");

        const existingTitles = new Set(
          (existingTasks ?? []).map((t) => t.title.toLowerCase())
        );

        let createdCount = 0;
        for (const evt of events) {
          const title = `Prep: ${evt.summary ?? "Upcoming Meeting"}`;
          if (existingTitles.has(title.toLowerCase())) continue;

          const startStr = evt.start?.dateTime ?? evt.start?.date;
          const startDate = startStr ? new Date(startStr) : new Date(Date.now() + 3600_000);
          const prepTime = new Date(
            Math.max(Date.now() + 5 * 60_000, startDate.getTime() - 30 * 60_000)
          ).toISOString();

          const { error: insErr } = await supabase.from("tasks").insert({
            user_id: userId,
            title,
            notes: `Auto-generated prep task 30m before "${evt.summary ?? "Meeting"}"`,
            due_at: prepTime,
            remind_at: prepTime,
            priority: "high",
            recurrence: "none",
          });
          if (!insErr) {
            createdCount++;
            existingTitles.add(title.toLowerCase());
          }
        }

        summary =
          events.length === 0
            ? "Scanned Google Calendar (next 48h): no upcoming meetings found."
            : createdCount > 0
              ? `Created ${createdCount} high-priority meeting prep ${createdCount === 1 ? "task" : "tasks"} from ${events.length} upcoming ${events.length === 1 ? "event" : "events"}.`
              : `All ${events.length} upcoming meetings in the next 48h already have prep tasks.`;
      } else if (data.id === "gmail_digest") {
        let token: string;
        try {
          token = await getGoogleAccessToken(supabase, userId);
        } catch {
          throw new Error(
            "Gmail is not connected. Connect Google Workspace in Settings first."
          );
        }

        const base = "https://gmail.googleapis.com/gmail/v1/users/me";
        const headers = { Authorization: `Bearer ${token}` };
        const listRes = await fetch(
          `${base}/messages?maxResults=5&q=${encodeURIComponent("is:unread")}`,
          { headers }
        );
        if (!listRes.ok) {
          throw new Error(`Gmail API returned ${listRes.status}`);
        }
        const { messages = [] } = await listRes.json();

        if (messages.length === 0) {
          summary = "Inbox Zero: No unread emails found in your Gmail inbox.";
        } else {
          const snippets: string[] = [];
          for (const m of (messages as { id: string }[]).slice(0, 5)) {
            const r = await fetch(
              `${base}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
              { headers }
            );
            if (!r.ok) continue;
            const d = await r.json();
            const h = (d.payload?.headers ?? []) as { name: string; value: string }[];
            const from =
              h.find((x) => x.name.toLowerCase() === "from")?.value ?? "Unknown Sender";
            const subj =
              h.find((x) => x.name.toLowerCase() === "subject")?.value ?? "(No subject)";
            snippets.push(`• **${subj}** (from ${from}) — ${d.snippet ?? ""}`);
          }

          // Create a Coach Ziri digest thread with these unread emails
          const { data: thread } = await supabase
            .from("chat_threads")
            .insert({
              user_id: userId,
              title: `Gmail Unread Digest (${format(new Date(), "MMM d, HH:mm")})`,
            })
            .select()
            .single();

          if (thread) {
            threadId = thread.id;
            const digestText = `Here is your automated unread Gmail digest (${snippets.length} priority ${snippets.length === 1 ? "thread" : "threads"}):\n\n${snippets.join(
              "\n"
            )}\n\nAsk me to reply to any of these or turn them into tasks.`;

            await supabase.from("chat_messages").insert({
              thread_id: thread.id,
              user_id: userId,
              role: "assistant",
              parts: [{ type: "text", text: digestText }],
            });
          }

          summary = `Summarized ${snippets.length} unread Gmail ${snippets.length === 1 ? "thread" : "threads"} into a Coach Ziri briefing.`;
        }
      } else if (data.id === "overdue_triage") {
        const { data: openTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "todo");

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const threeDaysAgo = new Date(now.getTime() - 3 * 86400_000);

        // Target reschedule time: today at 17:00, or tomorrow at 10:00 if already past 16:30
        const targetDue = new Date(now);
        if (now.getHours() >= 16) {
          targetDue.setDate(targetDue.getDate() + 1);
          targetDue.setHours(10, 0, 0, 0);
        } else {
          targetDue.setHours(17, 0, 0, 0);
        }
        const targetDueIso = targetDue.toISOString();

        const overdue = (openTasks ?? []).filter(
          (t) => t.due_at && new Date(t.due_at) < startOfToday
        );
        const neglected = (openTasks ?? []).filter(
          (t) => !t.due_at && new Date(t.created_at) < threeDaysAgo
        );

        let updatedCount = 0;
        for (const t of overdue) {
          const { error } = await supabase
            .from("tasks")
            .update({ due_at: targetDueIso, priority: "high" })
            .eq("id", t.id);
          if (!error) updatedCount++;
        }
        for (const t of neglected) {
          const { error } = await supabase
            .from("tasks")
            .update({ due_at: targetDueIso, priority: "high" })
            .eq("id", t.id);
          if (!error) updatedCount++;
        }

        summary =
          updatedCount === 0
            ? "No overdue or neglected tasks found — your task backlog is clean."
            : `Triaged and rescheduled ${updatedCount} overdue/neglected ${updatedCount === 1 ? "task" : "tasks"} to ${format(
                targetDue,
                "MMM d, HH:mm"
              )} (High Priority).`;
      } else if (data.id === "habit_nudge") {
        const { data: habits } = await supabase
          .from("habits")
          .select("*, habit_logs(*)")
          .eq("user_id", userId);

        const todayStr = format(new Date(), "yyyy-MM-dd");
        const pendingHabits = (habits ?? []).filter(
          (h) =>
            !(h.habit_logs ?? []).some(
              (l: { completed_date: string }) => l.completed_date === todayStr
            )
        );

        if (!habits || habits.length === 0) {
          summary = "No active habits configured yet. Add habits in the Habits tracker first.";
        } else if (pendingHabits.length === 0) {
          summary = `All ${habits.length} daily habits are completed for today!`;
        } else {
          const habitNames = pendingHabits.map((h) => h.title).join(", ");
          const remindTime = new Date(Date.now() + 60 * 60_000).toISOString();
          const title = `Complete today's habits: ${habitNames.slice(0, 120)}`;

          await supabase.from("tasks").insert({
            user_id: userId,
            title,
            notes: `Automated nudge for ${pendingHabits.length} pending daily ${pendingHabits.length === 1 ? "habit" : "habits"}: ${habitNames}`,
            due_at: remindTime,
            remind_at: remindTime,
            priority: "medium",
            recurrence: "none",
          });

          summary = `Created a 1-hour focus reminder for ${pendingHabits.length} uncompleted ${pendingHabits.length === 1 ? "habit" : "habits"} today (${habitNames}).`;
        }
      }

      // Record execution in activity_logs
      await supabase.from("activity_logs").insert({
        user_id: userId,
        action: `automation:${data.id}`,
        details: { summary, executedAt: new Date().toISOString() },
      });

      return { ok: true, summary, threadId };
    }
  );

