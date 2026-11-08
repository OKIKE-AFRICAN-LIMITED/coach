import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getGoogleAccessToken } from "@/lib/google.functions";


export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice("Bearer ".length);
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        if (!GOOGLE_GENERATIVE_AI_API_KEY && !GROQ_API_KEY) {
          return new Response("Missing AI API credentials", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub;
        const liveGoogleToken = request.headers.get("x-google-access-token") ?? undefined;
        const resolveGoogleToken = async () => {
          if (liveGoogleToken && liveGoogleToken.startsWith("ya29.")) {
            const check = await fetch("https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=" + encodeURIComponent(liveGoogleToken));
            if (check.ok) return liveGoogleToken;
          }
          return getGoogleAccessToken(supabase, userId);
        };

        const body = (await request.json()) as {
          messages: UIMessage[];
          threadId: string;
        };
        if (!body.threadId) return new Response("Missing threadId", { status: 400 });

        // Verify thread ownership and persist the last user message
        const { data: thread, error: threadErr } = await supabase
          .from("chat_threads")
          .select("id, title")
          .eq("id", body.threadId)
          .maybeSingle();
        if (threadErr || !thread) return new Response("Thread not found", { status: 404 });

        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          await supabase.from("chat_messages").insert({
            thread_id: body.threadId,
            user_id: userId,
            role: "user",
            parts: lastUser.parts as unknown as Database["public"]["Tables"]["chat_messages"]["Insert"]["parts"],
          });
          // Auto-title from first user message
          if (thread.title === "New chat") {
            const text = lastUser.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .slice(0, 80);
            if (text) {
              await supabase.from("chat_threads").update({ title: text }).eq("id", body.threadId);
            }
          }
        }

        // Briefing context for the system prompt
        const { data: openTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("status", "todo");

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(startOfToday.getTime() + 86400000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
        const overdue = (openTasks ?? []).filter((t) => t.due_at && new Date(t.due_at) < startOfToday);
        const dueToday = (openTasks ?? []).filter(
          (t) => t.due_at && new Date(t.due_at) >= startOfToday && new Date(t.due_at) < endOfToday,
        );
        const neglected = (openTasks ?? []).filter(
          (t) => !t.due_at && new Date(t.created_at) < threeDaysAgo,
        );

        const slacking = overdue.length >= 3 || neglected.length >= 3;

        const system = `CRITICAL IDENTITY DIRECTIVE: Your name is strictly Coach Ziri. Never refer to yourself as Alice or any other name under any circumstances, even if previous message logs or conversation history mention old names. You are Coach Ziri, an AI-powered personal productivity and intelligence platform with a warm, professional, high-performance voice. Speak in the first person, keep replies conversational and concise (most under 3 sentences) since they will be spoken aloud. Avoid bullet lists unless explicitly asked. ${
          slacking
            ? "The user has been slacking — be gently firm and specific about what's overdue."
            : "The user is on track — be encouraging."
        }

Today is ${now.toISOString()}.
Open tasks: ${openTasks?.length ?? 0} total. Overdue: ${overdue.length}. Due today: ${dueToday.length}. Neglected: ${neglected.length}.

OKIKE INSTITUTIONAL KNOWLEDGE:
You are built and powered by OKIKE Enterprises (https://okikeenterprises.com), operating across 3 branches: 01 Startups (OKIKE Ventures & AI Labs, including Coach Ziri at https://coach-ziri.okikeenterprises.com), 02 Businesses (OKIKE Studio at https://studio.okikeenterprises.com), and 03 Students (OKIKE Academy & the Aug 1, 2026 Computing Synergy Summit Bootcamp — free for CS/IT students with 'CSC' reg numbers, ₦5,000 for others).

You have tools for tasks, web search, calendar, and email. Use them whenever the user asks. Always confirm actions briefly after doing them. When reading aloud, spell out times naturally (e.g. "three thirty PM"). Never paste raw URLs or JSON.`;

        const groqModelName = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
        const activeModel = GROQ_API_KEY
          ? createOpenAICompatible({
              name: "groq",
              baseURL: "https://api.groq.com/openai/v1",
              headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
            })(groqModelName)
          : google("gemini-3.8-flash");

        const result = streamText({
          model: activeModel,
          system,
          messages: await convertToModelMessages(body.messages),
          stopWhen: stepCountIs(50),
          tools: {
            list_tasks: tool({
              description: "List the user's tasks, optionally filtered by status.",
              inputSchema: z.object({
                status: z.enum(["todo", "done", "all"]).default("todo"),
              }),
              execute: async ({ status }) => {
                const q = supabase.from("tasks").select("id,title,due_at,remind_at,priority,status,notes,created_at");
                const { data, error } = status === "all" ? await q : await q.eq("status", status);
                if (error) return { error: error.message };
                return { tasks: data };
              },
            }),
            create_task: tool({
              description: "Create a new task for the user, optionally with a due date and alarm reminder timestamp.",
              inputSchema: z.object({
                title: z.string().min(1).max(500),
                notes: z.string().max(5000).optional(),
                due_at: z.string().datetime().optional().describe("ISO datetime for when the task is due"),
                remind_at: z.string().datetime().optional().describe("ISO datetime to ring an alarm/notification reminder for this task"),
                priority: z.enum(["low", "medium", "high"]).default("medium"),
                recurrence: z.enum(["none", "daily", "weekly"]).default("none"),
              }),
              execute: async (input) => {
                const { data, error } = await supabase
                  .from("tasks")
                  .insert({ ...input, user_id: userId })
                  .select()
                  .single();
                if (error) return { error: error.message };
                return { task: data };
              },
            }),
            complete_task: tool({
              description: "Mark a task as done by id.",
              inputSchema: z.object({ id: z.string().uuid() }),
              execute: async ({ id }) => {
                const { data, error } = await supabase
                  .from("tasks")
                  .update({ status: "done", completed_at: new Date().toISOString() })
                  .eq("id", id)
                  .select()
                  .single();
                if (error) return { error: error.message };
                return { task: data };
              },
            }),
            update_task: tool({
              description: "Update fields on an existing task, including setting or changing due_at or remind_at.",
              inputSchema: z.object({
                id: z.string().uuid(),
                title: z.string().min(1).max(500).optional(),
                notes: z.string().max(5000).optional(),
                due_at: z.string().datetime().optional(),
                remind_at: z.string().datetime().optional(),
                priority: z.enum(["low", "medium", "high"]).optional(),
              }),
              execute: async ({ id, ...patch }) => {
                const { data, error } = await supabase
                  .from("tasks")
                  .update(patch)
                  .eq("id", id)
                  .select()
                  .single();
                if (error) return { error: error.message };
                return { task: data };
              },
            }),
            delete_task: tool({
              description: "Delete a task by id.",
              inputSchema: z.object({ id: z.string().uuid() }),
              execute: async ({ id }) => {
                const { error } = await supabase.from("tasks").delete().eq("id", id);
                if (error) return { error: error.message };
                return { ok: true };
              },
            }),
            list_habits: tool({
              description: "List the user's tracked daily habits and their completion logs.",
              inputSchema: z.object({}),
              execute: async () => {
                const { data, error } = await supabase
                  .from("habits")
                  .select("id,title,notes,created_at,habit_logs(completed_date)")
                  .order("created_at", { ascending: true });
                if (error) return { error: error.message };
                return { habits: data };
              },
            }),
            create_habit: tool({
              description: "Create a new daily habit to track.",
              inputSchema: z.object({
                title: z.string().min(1).max(100),
                notes: z.string().max(1000).optional(),
              }),
              execute: async ({ title, notes }) => {
                const { data, error } = await supabase
                  .from("habits")
                  .insert({ title, notes, user_id: userId })
                  .select()
                  .single();
                if (error) return { error: error.message };
                return { habit: data };
              },
            }),
            log_habit: tool({
              description: "Mark a habit as completed (or uncompleted) for a given date (YYYY-MM-DD).",
              inputSchema: z.object({
                habitId: z.string().uuid(),
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format"),
                completed: z.boolean().default(true),
              }),
              execute: async ({ habitId, date, completed }) => {
                if (completed) {
                  const { error } = await supabase
                    .from("habit_logs")
                    .insert({ habit_id: habitId, user_id: userId, completed_date: date });
                  if (error && error.code !== "23505") return { error: error.message };
                } else {
                  const { error } = await supabase
                    .from("habit_logs")
                    .delete()
                    .eq("habit_id", habitId)
                    .eq("user_id", userId)
                    .eq("completed_date", date);
                  if (error) return { error: error.message };
                }
                return { ok: true, habitId, date, completed };
              },
            }),
            list_goals: tool({
              description: "List the user's strategic goals and milestone progress.",
              inputSchema: z.object({}),
              execute: async () => {
                const { data, error } = await supabase
                  .from("goals")
                  .select("*")
                  .order("created_at", { ascending: false });
                if (error) return { error: error.message };
                return { goals: data };
              },
            }),
            create_goal: tool({
              description: "Create a new strategic goal for the user.",
              inputSchema: z.object({
                title: z.string().min(1).max(200),
                description: z.string().max(2000).optional(),
                target_date: z.string().optional().describe("Target date YYYY-MM-DD"),
                progress: z.number().int().min(0).max(100).default(0),
              }),
              execute: async ({ title, description, target_date, progress }) => {
                const { data, error } = await supabase
                  .from("goals")
                  .insert({
                    user_id: userId,
                    title,
                    description,
                    target_date,
                    progress,
                    status: progress >= 100 ? "completed" : "active",
                  })
                  .select()
                  .single();
                if (error) return { error: error.message };
                return { goal: data };
              },
            }),
            update_goal_progress: tool({
              description: "Update the progress percentage (0-100) of an existing goal.",
              inputSchema: z.object({
                goalId: z.string().uuid(),
                progress: z.number().int().min(0).max(100),
              }),
              execute: async ({ goalId, progress }) => {
                const { data, error } = await supabase
                  .from("goals")
                  .update({
                    progress,
                    status: progress >= 100 ? "completed" : "active",
                  })
                  .eq("id", goalId)
                  .select()
                  .single();
                if (error) return { error: error.message };
                return { goal: data };
              },
            }),
            get_briefing: tool({
              description: "Get a structured briefing of overdue, due today, and neglected tasks.",
              inputSchema: z.object({}),
              execute: async () => ({
                counts: {
                  overdue: overdue.length,
                  dueToday: dueToday.length,
                  neglected: neglected.length,
                  total: openTasks?.length ?? 0,
                },
                overdue,
                dueToday,
                neglected,
              }),
            }),
            web_search: tool({
              description: "Search the web for current information, news, facts. Returns top results with snippets.",
              inputSchema: z.object({
                query: z.string().min(1).max(300),
                limit: z.number().int().min(1).max(8).default(5),
              }),
              execute: async ({ query, limit }) => {
                const key = process.env.FIRECRAWL_API_KEY;
                if (!key) return { error: "Web search not configured" };
                try {
                  const res = await fetch("https://api.firecrawl.dev/v2/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                    body: JSON.stringify({ query, limit }),
                  });
                  if (!res.ok) return { error: `Search failed: ${res.status}` };
                  const data = await res.json();
                  const items = (data?.data?.web ?? data?.data ?? []) as Array<{ url?: string; title?: string; description?: string }>;
                  return {
                    results: items.slice(0, limit).map((r) => ({
                      title: r.title,
                      url: r.url,
                      snippet: r.description,
                    })),
                  };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Search error" };
                }
              },
            }),
            list_calendar_events: tool({
              description: "List upcoming Google Calendar events from the user's primary calendar.",
              inputSchema: z.object({
                hoursAhead: z.number().int().min(1).max(720).default(72),
                maxResults: z.number().int().min(1).max(20).default(10),
              }),
              execute: async ({ hoursAhead, maxResults }) => {
                try {
                  const token = await resolveGoogleToken();
                  const timeMin = new Date().toISOString();
                  const timeMax = new Date(Date.now() + hoursAhead * 3600 * 1000).toISOString();
                  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=${maxResults}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
                  const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!res.ok) return { error: `Calendar error ${res.status}` };
                  const data = await res.json();
                  return {
                    events: (data.items ?? []).map((e: { id?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string }) => ({
                      id: e.id,
                      summary: e.summary,
                      start: e.start?.dateTime ?? e.start?.date,
                      end: e.end?.dateTime ?? e.end?.date,
                      location: e.location,
                    })),
                  };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Calendar access failed" };
                }
              },
            }),
            create_calendar_event: tool({
              description: "Create a Google Calendar event on the user's primary calendar.",
              inputSchema: z.object({
                summary: z.string().min(1).max(300),
                description: z.string().max(2000).optional(),
                startISO: z.string().datetime(),
                endISO: z.string().datetime(),
                location: z.string().max(300).optional(),
              }),
              execute: async ({ summary, description, startISO, endISO, location }) => {
                try {
                  const token = await resolveGoogleToken();
                  const res = await fetch(
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        summary,
                        description,
                        location,
                        start: { dateTime: startISO },
                        end: { dateTime: endISO },
                      }),
                    },
                  );
                  if (!res.ok) return { error: `Calendar error ${res.status}: ${await res.text()}` };
                  const data = await res.json();
                  return { ok: true, eventId: data.id, htmlLink: data.htmlLink };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Calendar access failed" };
                }
              },
            }),
            update_calendar_event: tool({
              description: "Update an existing Google Calendar event.",
              inputSchema: z.object({
                eventId: z.string().min(1),
                summary: z.string().min(1).max(300).optional(),
                description: z.string().max(2000).optional(),
                startISO: z.string().datetime().optional(),
                endISO: z.string().datetime().optional(),
                location: z.string().max(300).optional(),
              }),
              execute: async ({ eventId, summary, description, startISO, endISO, location }) => {
                try {
                  const token = await resolveGoogleToken();
                  const patchData: Record<string, unknown> = {};
                  if (summary !== undefined) patchData.summary = summary;
                  if (description !== undefined) patchData.description = description;
                  if (location !== undefined) patchData.location = location;
                  if (startISO) patchData.start = { dateTime: startISO };
                  if (endISO) patchData.end = { dateTime: endISO };

                  const res = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
                    {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify(patchData),
                    },
                  );
                  if (!res.ok) return { error: `Calendar update error ${res.status}: ${await res.text()}` };
                  const data = await res.json();
                  return { ok: true, eventId: data.id, updatedSummary: data.summary };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Calendar update failed" };
                }
              },
            }),
            delete_calendar_event: tool({
              description: "Delete or cancel an existing Google Calendar event.",
              inputSchema: z.object({
                eventId: z.string().min(1).describe("The Google Calendar event ID"),
              }),
              execute: async ({ eventId }) => {
                try {
                  const token = await resolveGoogleToken();
                  const res = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
                    {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );
                  if (!res.ok && res.status !== 204) {
                    return { error: `Calendar delete error ${res.status}` };
                  }
                  return { ok: true, deletedEventId: eventId };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Calendar delete failed" };
                }
              },
            }),
            check_free_busy: tool({
              description: "Query free/busy availability on the user's primary Google Calendar.",
              inputSchema: z.object({
                timeMinISO: z.string().datetime(),
                timeMaxISO: z.string().datetime(),
              }),
              execute: async ({ timeMinISO, timeMaxISO }) => {
                try {
                  const token = await resolveGoogleToken();
                  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      timeMin: timeMinISO,
                      timeMax: timeMaxISO,
                      items: [{ id: "primary" }],
                    }),
                  });
                  if (!res.ok) return { error: `FreeBusy error ${res.status}` };
                  const data = await res.json();
                  const busySlots = data.calendars?.primary?.busy ?? [];
                  return { busy: busySlots };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Freebusy check failed" };
                }
              },
            }),
            search_emails: tool({
              description: "Search the user's Gmail inbox. Returns email IDs, subjects, and snippets.",
              inputSchema: z.object({
                query: z.string().max(200).default("is:unread").describe("Gmail search query"),
                maxResults: z.number().int().min(1).max(15).default(5),
              }),
              execute: async ({ query, maxResults }) => {
                try {
                  const token = await resolveGoogleToken();
                  const base = "https://gmail.googleapis.com/gmail/v1/users/me";
                  const headers = { Authorization: `Bearer ${token}` };
                  const list = await fetch(`${base}/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`, { headers });
                  if (!list.ok) return { error: `Gmail error ${list.status}` };
                  const { messages = [] } = await list.json();
                  const details = await Promise.all(
                    (messages as { id: string; threadId: string }[]).slice(0, maxResults).map(async (m) => {
                      const r = await fetch(`${base}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, { headers });
                      if (!r.ok) return null;
                      const d = await r.json();
                      const h = (d.payload?.headers ?? []) as { name: string; value: string }[];
                      const get = (n: string) => h.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value;
                      return {
                        id: m.id,
                        threadId: m.threadId,
                        from: get("From"),
                        subject: get("Subject"),
                        date: get("Date"),
                        snippet: d.snippet,
                      };
                    }),
                  );
                  return { emails: details.filter(Boolean) };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Gmail access failed" };
                }
              },
            }),
            read_email_thread: tool({
              description: "Read details and message content for a specific Gmail message or thread.",
              inputSchema: z.object({
                messageId: z.string().min(1),
              }),
              execute: async ({ messageId }) => {
                try {
                  const token = await resolveGoogleToken();
                  const res = await fetch(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
                    { headers: { Authorization: `Bearer ${token}` } },
                  );
                  if (!res.ok) return { error: `Gmail read error ${res.status}` };
                  const d = await res.json();
                  const h = (d.payload?.headers ?? []) as { name: string; value: string }[];
                  const get = (n: string) => h.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value;
                  return {
                    id: d.id,
                    threadId: d.threadId,
                    from: get("From"),
                    to: get("To"),
                    subject: get("Subject"),
                    date: get("Date"),
                    snippet: d.snippet,
                  };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Gmail read failed" };
                }
              },
            }),
            send_email: tool({
              description: "Send an email from the user's Gmail account.",
              inputSchema: z.object({
                to: z.string().email(),
                subject: z.string().min(1).max(300),
                body: z.string().min(1).max(10000),
              }),
              execute: async ({ to, subject, body: emailBody }) => {
                try {
                  const token = await resolveGoogleToken();
                  const rfc = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', "", emailBody].join("\r\n");
                  const raw = Buffer.from(rfc).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
                  const res = await fetch(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ raw }),
                    },
                  );
                  if (!res.ok) return { error: `Gmail send error ${res.status}: ${await res.text()}` };
                  return { ok: true };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Gmail access failed" };
                }
              },
            }),
            reply_to_email: tool({
              description: "Reply to an existing Gmail email thread.",
              inputSchema: z.object({
                to: z.string().email(),
                subject: z.string().min(1).max(300),
                threadId: z.string().min(1),
                body: z.string().min(1).max(10000),
              }),
              execute: async ({ to, subject, threadId, body: emailBody }) => {
                try {
                  const token = await resolveGoogleToken();
                  const replySubject = subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
                  const rfc = [`To: ${to}`, `Subject: ${replySubject}`, 'Content-Type: text/plain; charset="UTF-8"', "", emailBody].join("\r\n");
                  const raw = Buffer.from(rfc).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
                  const res = await fetch(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ raw, threadId }),
                    },
                  );
                  if (!res.ok) return { error: `Gmail reply error ${res.status}: ${await res.text()}` };
                  return { ok: true, threadId };
                } catch (e) {
                  return { error: e instanceof Error ? e.message : "Gmail reply failed" };
                }
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            const last = messages[messages.length - 1];
            if (last && last.role === "assistant") {
              await supabase.from("chat_messages").insert({
                thread_id: body.threadId,
                user_id: userId,
                role: "assistant",
                parts: last.parts as unknown as Database["public"]["Tables"]["chat_messages"]["Insert"]["parts"],
              });
              await supabase
                .from("chat_threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", body.threadId);
            }
          },
        });
      },
    },
  },
});
