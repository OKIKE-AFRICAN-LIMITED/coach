import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TaskInput = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(5000).optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  remind_at: z.string().datetime().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  recurrence: z.enum(["none", "daily", "weekly"]).default("none"),
});

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*")
      .order("status", { ascending: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => TaskInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("tasks")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: TaskInput.partial().extend({
        status: z.enum(["todo", "done"]).optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const patch: {
      title?: string;
      notes?: string | null;
      due_at?: string | null;
      remind_at?: string | null;
      priority?: "low" | "medium" | "high";
      recurrence?: "none" | "daily" | "weekly";
      status?: "todo" | "done";
      completed_at?: string | null;
    } = { ...data.patch };
    if (patch.status === "done") patch.completed_at = new Date().toISOString();
    if (patch.status === "todo") patch.completed_at = null;
    const { data: row, error } = await context.supabase
      .from("tasks")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBriefing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*")
      .eq("status", "todo");
    if (error) throw new Error(error.message);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const overdue = data.filter((t) => t.due_at && new Date(t.due_at) < startOfToday);
    const dueToday = data.filter(
      (t) => t.due_at && new Date(t.due_at) >= startOfToday && new Date(t.due_at) < endOfToday,
    );
    const neglected = data.filter(
      (t) => !t.due_at && new Date(t.created_at) < threeDaysAgo,
    );
    const upcoming = data.filter((t) => t.due_at && new Date(t.due_at) >= endOfToday);

    return {
      counts: {
        total: data.length,
        overdue: overdue.length,
        dueToday: dueToday.length,
        neglected: neglected.length,
        upcoming: upcoming.length,
      },
      overdue,
      dueToday,
      neglected,
      upcoming,
    };
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      endpoint: z.string().url(),
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: context.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
        } as any,
        { onConflict: "endpoint" }
      );
    if (error) {
      console.error("Failed to save push subscription:", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ endpoint: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const snoozeTaskReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      minutes: z.number().int().min(1).max(1440).default(5),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const newRemindAt = new Date(Date.now() + data.minutes * 60_000).toISOString();
    const { data: row, error } = await context.supabase
      .from("tasks")
      .update({ remind_at: newRemindAt } as any)
      .eq("id", data.taskId)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const dismissTaskReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({ remind_at: null } as any)
      .eq("id", data.taskId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
