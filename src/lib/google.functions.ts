import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export async function getGoogleAccessToken(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("user_integrations")
    .select("google_refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.google_refresh_token) {
    throw new Error("Google account not connected. Please connect Google Workspace in Settings.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Server missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET credentials.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: data.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Google Access Token. Please re-connect your Google account in Settings.");
  }

  const tokenData = await response.json();
  return tokenData.access_token as string;
}

export const getGoogleIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_integrations")
      .select("google_refresh_token, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      connected: Boolean(data?.google_refresh_token),
      updatedAt: data?.updated_at ?? null,
    };
  });

export const disconnectGoogleIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type CalendarEventItem = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  location?: string;
  htmlLink?: string;
};

export const fetchUpcomingCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ connected: boolean; events: CalendarEventItem[] }> => {
    try {
      const token = await getGoogleAccessToken(context.supabase, context.userId);
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=6&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return { connected: true, events: [] };
      }

      const data = await res.json();
      const events: CalendarEventItem[] = (data.items ?? []).map((e: {
        id: string;
        summary?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        location?: string;
        htmlLink?: string;
      }) => ({
        id: e.id,
        summary: e.summary ?? "Untitled Event",
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        location: e.location,
        htmlLink: e.htmlLink,
      }));

      return { connected: true, events };
    } catch {
      return { connected: false, events: [] };
    }
  });

export type EmailDigestItem = {
  id: string;
  threadId: string;
  from?: string;
  subject?: string;
  date?: string;
  snippet?: string;
};

export const fetchRecentEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ connected: boolean; emails: EmailDigestItem[] }> => {
    try {
      const token = await getGoogleAccessToken(context.supabase, context.userId);
      const base = "https://gmail.googleapis.com/gmail/v1/users/me";
      const headers = { Authorization: `Bearer ${token}` };

      const listRes = await fetch(`${base}/messages?maxResults=5&q=${encodeURIComponent("is:unread")}`, { headers });
      if (!listRes.ok) {
        return { connected: true, emails: [] };
      }

      const { messages = [] } = await listRes.json();
      const details = await Promise.all(
        (messages as { id: string; threadId: string }[]).slice(0, 5).map(async (m): Promise<EmailDigestItem | null> => {
          const r = await fetch(
            `${base}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers },
          );
          if (!r.ok) return null;
          const d = await r.json();
          const h = (d.payload?.headers ?? []) as { name: string; value: string }[];
          const getHeader = (name: string) => h.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value;
          return {
            id: m.id,
            threadId: m.threadId,
            from: getHeader("From"),
            subject: getHeader("Subject"),
            date: getHeader("Date"),
            snippet: d.snippet,
          };
        }),
      );

      return {
        connected: true,
        emails: details.filter((x): x is EmailDigestItem => x !== null),
      };
    } catch {
      return { connected: false, emails: [] };
    }
  });
