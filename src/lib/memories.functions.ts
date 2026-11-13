import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MemoryCategorySchema = z.enum([
  "preference",
  "contact",
  "goal",
  "context",
  "general",
]);

export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;

export const listMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_memories")
      .select("id, category, content, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === "42P01" || error.message.includes("user_memories")) {
        return [];
      }
      throw new Error(error.message);
    }
    return data ?? [];
  });

export const createMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        category: MemoryCategorySchema.default("general"),
        content: z.string().trim().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("user_memories")
      .insert({
        user_id: context.userId,
        category: data.category,
        content: data.content,
      })
      .select("id, category, content, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_memories")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

