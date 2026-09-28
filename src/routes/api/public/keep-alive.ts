import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/keep-alive")({
  server: {
    handlers: {
      GET: async () => handleKeepAlive(),
      POST: async () => handleKeepAlive(),
    },
  },
});

async function handleKeepAlive() {
  const startTime = Date.now();

  try {
    // Perform a lightweight query to generate active REST/PostgREST traffic on Supabase
    const { count, error } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("[Keep-Alive] Supabase ping returned error:", error);
      return new Response(
        JSON.stringify({ status: "error", error: error.message, timeMs: Date.now() - startTime }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Supabase kept alive successfully",
        profilesCount: count,
        timeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Keep-Alive] Exception pinging Supabase:", err);
    return new Response(
      JSON.stringify({ status: "error", message: err?.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
