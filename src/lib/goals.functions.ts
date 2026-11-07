import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GoalInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  target_date: z.string().optional().nullable(),
  progress: z.number().int().min(0).max(100).default(0),
});

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("goals")
      .select("*")
      .eq("user_id", context.userId)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });

    // Gracefully return empty array if migration hasn't been applied to remote DB yet
    if (error) {
      if (error.code === "42P01" || error.message.includes("goals")) {
        return [];
      }
      throw new Error(error.message);
    }
    return data ?? [];
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => GoalInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("goals")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description ?? null,
        target_date: data.target_date || null,
        progress: data.progress ?? 0,
        status: (data.progress ?? 0) >= 100 ? "completed" : "active",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const updateGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          title: z.string().min(1).max(200).optional(),
          description: z.string().max(2000).optional().nullable(),
          target_date: z.string().optional().nullable(),
          progress: z.number().int().min(0).max(100).optional(),
          status: z.enum(["active", "completed", "archived"]).optional(),
        }),
      })
      .parse(d)
  )
  .handler(async ({ context, data }) => {
    const patch = { ...data.patch };
    if (typeof patch.progress === "number") {
      if (patch.progress >= 100) patch.status = "completed";
      else if (!patch.status) patch.status = "active";
    }
    const { data: row, error } = await context.supabase
      .from("goals")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("goals")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

