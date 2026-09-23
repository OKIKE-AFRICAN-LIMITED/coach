import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/google-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state"); // contains redirect_uri + user token
        const error = url.searchParams.get("error");

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
        const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

        // Determine the redirect base (where to send the user back after)
        const origin = new URL(request.url).origin;
        const redirectBase = `${origin}/settings`;

        if (error) {
          return Response.redirect(`${redirectBase}?google_error=${encodeURIComponent(error)}`);
        }

        if (!code) {
          return Response.redirect(`${redirectBase}?google_error=no_code`);
        }

        // Parse state: we encode the user's Supabase JWT and redirect URI in state
        let userToken: string | null = null;
        let postRedirect = redirectBase;
        try {
          const decoded = JSON.parse(Buffer.from(state ?? "", "base64").toString("utf-8"));
          userToken = decoded.token ?? null;
          postRedirect = decoded.redirect ?? redirectBase;
        } catch {
          // state may be absent (direct connect), will still try to use the code
        }

        // Exchange the auth code for Google tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: `${origin}/api/google-callback`,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error("[google-callback] token exchange failed:", errText);
          return Response.redirect(`${redirectBase}?google_error=token_exchange_failed`);
        }

        const tokens = await tokenRes.json() as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          token_type: string;
        };

        if (!tokens.refresh_token) {
          // No refresh token — user already granted consent previously,
          // Google only sends refresh_token on first consent or when prompt=consent
          console.warn("[google-callback] No refresh_token in response. Access token only.");
          return Response.redirect(`${redirectBase}?google_warning=no_refresh_token`);
        }

        // Get user identity from the access token
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (!userInfoRes.ok) {
          return Response.redirect(`${redirectBase}?google_error=userinfo_failed`);
        }

        const userInfo = await userInfoRes.json() as { id: string; email: string };

        // Save to Supabase using service role (bypasses RLS so we can upsert by google user id)
        if (SUPABASE_SERVICE_KEY) {
          const adminSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          // Look up Supabase user by their session token (preferred) or by email
          let userId: string | null = null;

          if (userToken) {
            const { data } = await adminSupabase.auth.getUser(userToken);
            userId = data.user?.id ?? null;
          }

          if (!userId) {
            // Fallback: find user by email
            const { data } = await adminSupabase.auth.admin.listUsers();
            const match = data?.users?.find((u) => u.email === userInfo.email);
            userId = match?.id ?? null;
          }

          if (userId) {
            await adminSupabase
              .from("user_integrations")
              .upsert({
                user_id: userId,
                google_refresh_token: tokens.refresh_token,
                updated_at: new Date().toISOString(),
              }, { onConflict: "user_id" });
          }
        } else {
          // Fallback: use RPC via user's own token
          if (userToken) {
            const userSupabase = createClient<Database>(SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY!, {
              global: { headers: { Authorization: `Bearer ${userToken}` } },
              auth: { persistSession: false, autoRefreshToken: false },
            });
            await userSupabase.rpc("set_google_refresh_token", { token: tokens.refresh_token });
          }
        }

        return Response.redirect(`${redirectBase}?google_connected=1`);
      },
    },
  },
});
