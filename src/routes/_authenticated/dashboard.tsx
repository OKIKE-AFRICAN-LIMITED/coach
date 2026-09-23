import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTasks, createTask, updateTask } from "@/lib/tasks.functions";
import { createThread } from "@/lib/threads.functions";
import { fetchUpcomingCalendarEvents } from "@/lib/google.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  MessageCircle,
  Calendar as CalendarIcon,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Plus,
  Loader2,
  CheckSquare,
  SlidersHorizontal,
  ChevronRight,
  Target,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const updateFn = useServerFn(updateTask);
  const createT = useServerFn(createThread);
  const eventsFn = useServerFn(fetchUpcomingCalendarEvents);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Fetch current user
  const { data: userData } = useQuery({
    queryKey: ["user_info"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listFn(),
  });

  // Fetch calendar events
  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ["upcomingEvents"],
    queryFn: () => eventsFn(),
  });

  // Task Mutations
  const createM = useMutation({
    mutationFn: async (title: string) => createFn({ data: { title } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setNewTaskTitle("");
      setIsAddingTask(false);
      toast.success("Task added");
    },
  });

  const toggleM = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "todo" | "done" }) =>
      updateFn({ data: { id, patch: { status } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const newChat = useMutation({
    mutationFn: async () => createT({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  // Time-based greeting
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const userName =
    userData?.user_metadata?.display_name ??
    (userData?.email ? userData.email.split("@")[0] : "");
  const todayDateStr = format(new Date(), "EEEE, MMM d, yyyy");

  // ─── Real derived data only ───────────────────────────────────────────────
  const allTasks = tasksData ?? [];
  const todoTasks = allTasks.filter((t) => t.status === "todo");
  const doneTasks = allTasks.filter((t) => t.status === "done");
  const highPriorityCount = todoTasks.filter((t) => t.priority === "high").length;

  const calendarEvents = calendarData?.events ?? [];
  const todayEvents = calendarEvents.slice(0, 4);

  // Formatted priorities (top 5 real todo tasks)
  const displayedPriorities = todoTasks.slice(0, 5).map((t, index) => ({
    id: t.id,
    num: (index + 1).toString().padStart(2, "0"),
    title: t.title,
    priority:
      t.priority === "high"
        ? "High priority"
        : t.priority === "medium"
          ? "Medium priority"
          : "Low priority",
    due: t.due_at ? `Due ${format(new Date(t.due_at), "HH:mm")}` : null,
  }));

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ─── 1. HEADER ───────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-[#1F2336]">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {greeting}{userName ? ", " : ""}<span className="capitalize text-[#E5C185]">{userName}</span>.
            </h1>
            <p className="text-sm text-[#8A8F9E] font-medium">
              {!tasksLoading && todoTasks.length === 0
                ? "You're all set — add your first task to get started."
                : "Here's what needs your attention today."}
            </p>

            {/* Metadata Pills — real data only, hidden when empty */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-semibold text-[#A0A5B5]">
              <span className="px-2.5 py-1 rounded-md bg-[#0F111A] border border-[#1F2336] text-[#D4AF37]">
                {todayDateStr}
              </span>
              {!tasksLoading && todoTasks.length > 0 && (
                <>
                  <span className="text-[#6C7180]">•</span>
                  <span className="px-2.5 py-1 rounded-md bg-[#0F111A] border border-[#1F2336]">
                    {todoTasks.length} {todoTasks.length === 1 ? "task" : "tasks"}
                  </span>
                </>
              )}
              {!tasksLoading && highPriorityCount > 0 && (
                <>
                  <span className="text-[#6C7180]">•</span>
                  <span className="px-2.5 py-1 rounded-md bg-[#0F111A] border border-[#1F2336] text-amber-400">
                    {highPriorityCount} high priority
                  </span>
                </>
              )}
              {todayEvents.length > 0 && (
                <>
                  <span className="text-[#6C7180]">•</span>
                  <span className="px-2.5 py-1 rounded-md bg-[#0F111A] border border-[#1F2336]">
                    {todayEvents.length} {todayEvents.length === 1 ? "meeting" : "meetings"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── 2. SUMMARY METRICS (real data) ─────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Tasks Open */}
          <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-4 space-y-1 hover:border-[#D4AF37]/30 transition-colors">
            <span className="text-xs text-[#8A8F9E] font-medium block">Tasks Open</span>
            {tasksLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
            ) : (
              <>
                <div className="text-3xl font-bold text-white tracking-tight">{todoTasks.length}</div>
                <span className="text-[11px] font-medium block text-[#8A8F9E]">
                  {todoTasks.length === 0 ? "None yet" : highPriorityCount > 0 ? `${highPriorityCount} high priority` : "All normal priority"}
                </span>
              </>
            )}
          </div>

          {/* Meetings */}
          <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-4 space-y-1 hover:border-[#D4AF37]/30 transition-colors">
            <span className="text-xs text-[#8A8F9E] font-medium block">Meetings Today</span>
            <div className="text-3xl font-bold text-white tracking-tight">{todayEvents.length}</div>
            <span className="text-[11px] font-medium block text-[#8A8F9E]">
              {todayEvents.length === 0 ? "None scheduled" : "From Google Calendar"}
            </span>
          </div>

          {/* Completed */}
          <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-4 space-y-1 hover:border-[#D4AF37]/30 transition-colors col-span-2 lg:col-span-1">
            <span className="text-xs text-[#8A8F9E] font-medium block">Completed</span>
            {tasksLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
            ) : (
              <>
                <div className="text-3xl font-bold text-white tracking-tight">{doneTasks.length}</div>
                <span className="text-[11px] font-medium block text-emerald-400">
                  {doneTasks.length === 0 ? "Start checking off tasks!" : "Great progress"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ─── 3. MAIN GRID ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* TODAY'S PRIORITIES */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-4">

              <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-[#D4AF37]" />
                  <h2 className="text-sm uppercase tracking-wider font-bold text-white">TODAY'S PRIORITIES</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(!isAddingTask)}
                    className="p-1 rounded-md text-[#8A8F9E] hover:text-[#E5C185] text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Task</span>
                  </button>

                  {todoTasks.length > 0 && (
                    <Button
                      onClick={() => navigate({ to: "/tasks" })}
                      size="sm"
                      className="rounded-lg bg-[#171926] border border-[#D4AF37]/30 text-[#E5C185] hover:bg-[#202336] text-xs font-semibold px-3 py-1"
                    >
                      <SlidersHorizontal className="h-3 w-3 mr-1.5" />
                      View All
                    </Button>
                  )}
                </div>
              </div>

              {/* Inline Task Form */}
              {isAddingTask && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newTaskTitle.trim()) createM.mutate(newTaskTitle.trim());
                  }}
                  className="flex items-center gap-2 pt-1 pb-2"
                >
                  <Input
                    autoFocus
                    type="text"
                    placeholder="New priority title..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="flex-1 bg-[#141624] border-[#1F2336] text-xs text-white"
                  />
                  <Button
                    type="submit"
                    disabled={createM.isPending}
                    size="sm"
                    className="bg-[#D4AF37] text-black text-xs font-bold"
                  >
                    {createM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                  </Button>
                </form>
              )}

              {/* Task List */}
              <div className="space-y-3 pt-1">
                {tasksLoading ? (
                  <div className="py-8 flex items-center justify-center text-xs text-[#8A8F9E]">
                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#D4AF37]" />
                    Loading tasks...
                  </div>
                ) : displayedPriorities.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-3 text-center">
                    <div className="h-12 w-12 rounded-xl bg-[#141624] border border-[#1F2336] flex items-center justify-center">
                      <CheckSquare className="h-5 w-5 text-[#D4AF37]/40" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">No tasks yet</p>
                      <p className="text-xs text-[#8A8F9E] mt-0.5">Add your first task to start tracking your day</p>
                    </div>
                    <Button
                      onClick={() => setIsAddingTask(true)}
                      className="rounded-xl bg-[#D4AF37] text-black font-bold text-xs px-4 py-2 hover:scale-105 transition-all"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add your first task
                    </Button>
                  </div>
                ) : (
                  displayedPriorities.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[#141624]/80 border border-[#1F2336] hover:border-[#D4AF37]/30 transition-all group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-[#D4AF37] shrink-0">
                          {item.num}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-[#E5C185] transition-colors">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-[#8A8F9E] mt-0.5">
                            {item.priority}{item.due ? ` · ${item.due}` : ""}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleM.mutate({ id: item.id, status: "done" })}
                        className="h-6 w-6 rounded-lg border border-[#1F2336] hover:border-[#D4AF37] text-[#8A8F9E] hover:text-[#D4AF37] flex items-center justify-center shrink-0 transition-colors"
                        aria-label="Mark complete"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-5 space-y-4">

            {/* AI Coach CTA */}
            <div className="bg-[#0F111A] border border-[#D4AF37]/25 rounded-xl p-5 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
                </div>
                <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-[#D4AF37]">
                  ZIRI AI COACH
                </span>
              </div>
              <p className="text-sm text-[#F3F4F6] leading-relaxed">
                Ask Ziri anything — get coaching, plan your day, or set new goals.
              </p>
              <Button
                onClick={() => newChat.mutate()}
                disabled={newChat.isPending}
                className="w-full rounded-xl bg-[#171926] border border-[#D4AF37]/40 text-[#E5C185] hover:bg-[#202336] text-xs font-semibold py-2"
              >
                {newChat.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <MessageCircle className="h-3.5 w-3.5 mr-1.5" />}
                Chat with Ziri
              </Button>
            </div>

            {/* Quick Links */}
            <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#8A8F9E] block mb-3">Quick Links</span>
              {([
                { label: "My Goals", to: "/goals", icon: Target },
                { label: "Habits", to: "/habits", icon: TrendingUp },
                { label: "Calendar", to: "/calendar", icon: CalendarIcon },
              ] as const).map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#141624] text-[#A0A5B5] hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-2.5 text-xs font-medium">
                    <Icon className="h-3.5 w-3.5 text-[#D4AF37]" />
                    {label}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ─── 4. TODAY'S SCHEDULE (only shown when calendar is connected + has events) */}
        {todayEvents.length > 0 && (
          <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-[#D4AF37]" />
                <h2 className="text-sm uppercase tracking-wider font-bold text-white">TODAY'S SCHEDULE</h2>
              </div>
              <Link
                to="/calendar"
                className="text-xs text-[#E5C185] hover:text-white flex items-center gap-1 transition-colors"
              >
                Open Calendar
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {todayEvents.map((evt, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#141624]/80 border border-[#1F2336] space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#D4AF37]">
                      {evt.start ? format(new Date(evt.start), "HH:mm") : "All Day"}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
                  </div>
                  <p className="text-xs font-semibold text-white truncate">{evt.summary}</p>
                  {evt.location && <p className="text-[11px] text-[#8A8F9E] truncate">{evt.location}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendar empty state */}
        {!calendarLoading && todayEvents.length === 0 && (
          <div className="bg-[#0F111A] border border-[#1F2336] border-dashed rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#141624] border border-[#1F2336] flex items-center justify-center shrink-0">
                <CalendarIcon className="h-5 w-5 text-[#D4AF37]/40" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">No calendar connected</p>
                <p className="text-xs text-[#8A8F9E] mt-0.5">Connect Google Calendar to see your schedule here</p>
              </div>
            </div>
            <Link to="/settings">
              <Button className="rounded-xl bg-[#171926] border border-[#D4AF37]/40 text-[#E5C185] hover:bg-[#202336] text-xs font-semibold px-4 py-2 whitespace-nowrap">
                Connect Calendar
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

