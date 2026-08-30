import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBriefing, updateTask } from "@/lib/tasks.functions";
import { createThread } from "@/lib/threads.functions";
import { fetchUpcomingCalendarEvents, fetchRecentEmails } from "@/lib/google.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CalendarClock,
  Sparkles,
  MessageCircle,
  Calendar as CalendarIcon,
  Mail as MailIcon,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const briefingFn = useServerFn(getBriefing);
  const updateFn = useServerFn(updateTask);
  const createT = useServerFn(createThread);
  const eventsFn = useServerFn(fetchUpcomingCalendarEvents);
  const emailsFn = useServerFn(fetchRecentEmails);

  const { data, isLoading } = useQuery({
    queryKey: ["briefing"],
    queryFn: () => briefingFn(),
  });

  const { data: calendarData, isLoading: eventsLoading } = useQuery({
    queryKey: ["upcomingEvents"],
    queryFn: () => eventsFn(),
  });

  const { data: emailData, isLoading: emailsLoading } = useQuery({
    queryKey: ["recentEmails"],
    queryFn: () => emailsFn(),
  });

  const toggle = useMutation({
    mutationFn: async (id: string) =>
      updateFn({ data: { id, patch: { status: "done" } } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["briefing"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const newChat = useMutation({
    mutationFn: async () => createT({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
    onError: (e) => {
      console.error("Failed to create chat:", e);
      alert("Failed to create chat: " + String(e));
    },
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const slacking = data && (data.counts.overdue >= 3 || data.counts.neglected >= 3);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading
              ? "Pulling up your day..."
              : slacking
                ? "Heads up — a few things are slipping. Let's tackle them."
                : data?.counts.total === 0
                  ? "Nothing on your plate yet. Add a task to get started."
                  : "Here's what today looks like."}
          </p>
        </div>
        <Button onClick={() => newChat.mutate()} className="gap-2" disabled={newChat.isPending}>
          <MessageCircle className="h-4 w-4" /> 
          {newChat.isPending ? "Creating..." : "Chat with Coach"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Overdue" value={data?.counts.overdue ?? 0} tone={data?.counts.overdue ? "danger" : "muted"} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Due today" value={data?.counts.dueToday ?? 0} tone="primary" icon={<CalendarClock className="h-4 w-4" />} />
        <StatCard label="Neglected" value={data?.counts.neglected ?? 0} tone={data?.counts.neglected ? "warn" : "muted"} icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Total open" value={data?.counts.total ?? 0} tone="muted" />
      </div>

      {/* Google Workspace Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Calendar Agenda Widget */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-500" /> Google Calendar Agenda
              </CardTitle>
              {eventsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <CardDescription className="text-xs">Upcoming events for the next 7 days</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {!calendarData?.connected ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs text-muted-foreground">Connect Google Workspace to see your meetings here.</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings">Connect Calendar</Link>
                </Button>
              </div>
            ) : calendarData.events.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No upcoming events found for this week.</p>
            ) : (
              <ul className="divide-y text-xs space-y-2">
                {calendarData.events.slice(0, 4).map((evt) => (
                  <li key={evt.id} className="pt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate text-slate-800 dark:text-slate-200">{evt.summary}</p>
                      {evt.location && <p className="text-[11px] text-muted-foreground truncate">{evt.location}</p>}
                    </div>
                    <div className="text-right shrink-0 text-[11px] text-muted-foreground">
                      {evt.start ? (
                        <span>{format(new Date(evt.start), "MMM d, h:mm a")}</span>
                      ) : (
                        <span>All day</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Gmail Unread Widget */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MailIcon className="h-4 w-4 text-red-500" /> Gmail Unread Digest
              </CardTitle>
              {emailsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <CardDescription className="text-xs">Recent unread messages from your inbox</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {!emailData?.connected ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs text-muted-foreground">Connect Google Workspace to view unread messages.</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings">Connect Gmail</Link>
                </Button>
              </div>
            ) : emailData.emails.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No unread emails in your inbox.</p>
            ) : (
              <ul className="divide-y text-xs space-y-2">
                {emailData.emails.slice(0, 3).map((email) => (
                  <li key={email.id} className="pt-2 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate text-slate-800 dark:text-slate-200">
                        {email.from ? email.from.replace(/<.*>/, "").trim() : "Unknown Sender"}
                      </span>
                      {email.date && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(email.date), "MMM d")}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {email.subject || "(No Subject)"}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{email.snippet}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Section title="Overdue Tasks" items={data?.overdue ?? []} empty="Nothing overdue — good work." onToggle={(id) => toggle.mutate(id)} />
      <Section title="Due today" items={data?.dueToday ?? []} empty="Nothing scheduled for today." onToggle={(id) => toggle.mutate(id)} />
      <Section title="Neglected (no due date, > 3 days)" items={data?.neglected ?? []} empty="No forgotten tasks. Nice." onToggle={(id) => toggle.mutate(id)} />

      <div className="pt-4 text-center">
        <Link to="/tasks" className="text-sm text-primary hover:underline">
          View all tasks →
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: number; tone: "primary" | "danger" | "warn" | "muted"; icon?: React.ReactNode }) {
  const toneClass = {
    primary: "border-primary/30 bg-primary/5",
    danger: "border-destructive/40 bg-destructive/5",
    warn: "border-amber-500/40 bg-amber-500/5",
    muted: "",
  }[tone];
  return (
    <Card className={toneClass}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="text-3xl font-semibold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}

type Task = {
  id: string;
  title: string;
  due_at: string | null;
  priority: "low" | "medium" | "high";
  notes: string | null;
};

function Section({ title, items, empty, onToggle }: { title: string; items: Task[]; empty: string; onToggle: (id: string) => void }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <Checkbox onCheckedChange={() => onToggle(t.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  {t.due_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.due_at), "MMM d, h:mm a")}
                    </p>
                  )}
                </div>
                <PriorityBadge p={t.priority} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PriorityBadge({ p }: { p: "low" | "medium" | "high" }) {
  const cls = p === "high" ? "bg-destructive/10 text-destructive" : p === "medium" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={cls}>{p}</Badge>;
}
