import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { listTasks, createTask, updateTask } from "@/lib/tasks.functions";
import { listHabits, toggleHabitLog } from "@/lib/habits.functions";
import { createThread } from "@/lib/threads.functions";
import { fetchUpcomingCalendarEvents } from "@/lib/google.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sun,
  Sparkles,
  Plus,
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  ArrowRight,
  Loader2,
  Flame,
  AlertTriangle,
  Volume2,
  Square,
} from "lucide-react";
import { format, isSameDay } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-day")({
  component: MyDayPage,
});

function MyDayPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const updateFn = useServerFn(updateTask);
  const habitsFn = useServerFn(listHabits);
  const toggleHabitFn = useServerFn(toggleHabitLog);
  const createT = useServerFn(createThread);
  const eventsFn = useServerFn(fetchUpcomingCalendarEvents);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [speakingBriefing, setSpeakingBriefing] = useState(false);
  const briefingAudioRef = useRef<HTMLAudioElement | null>(null);

  async function toggleSpeakBriefing(text: string) {
    if (speakingBriefing) {
      briefingAudioRef.current?.pause();
      setSpeakingBriefing(false);
      return;
    }
    setSpeakingBriefing(true);
    try {
      const res = await fetch("/api/public/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        toast.error("Could not synthesize voice briefing");
        setSpeakingBriefing(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (!briefingAudioRef.current) briefingAudioRef.current = new Audio();
      briefingAudioRef.current.src = url;
      briefingAudioRef.current.onended = () => {
        URL.revokeObjectURL(url);
        setSpeakingBriefing(false);
      };
      await briefingAudioRef.current.play();
    } catch {
      setSpeakingBriefing(false);
    }
  }

  const { data: tasksData = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listFn(),
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ["upcomingEvents"],
    queryFn: () => eventsFn(),
  });

  const { data: habitsData = [] } = useQuery({
    queryKey: ["habits"],
    queryFn: () => habitsFn(),
  });

  const createM = useMutation({
    mutationFn: async (title: string) =>
      createFn({
        data: {
          title,
          due_at: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(),
          priority: "high",
          recurrence: "none",
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setNewTaskTitle("");
      setIsAddingTask(false);
      toast.success("Task added to My Day");
    },
  });

  const toggleM = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "todo" | "done" }) =>
      updateFn({ data: { id, patch: { status } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const toggleHabitM = useMutation({
    mutationFn: async ({ habitId, date, completed }: { habitId: string; date: string; completed: boolean }) =>
      toggleHabitFn({ data: { habitId, date, completed } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });

  const newChat = useMutation({
    mutationFn: async () => createT({ data: { title: `My Day Focus — ${format(new Date(), "MMM d")}` } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  const todayStr = format(now, "EEEE, MMMM d, yyyy");
  const todayIsoDate = format(now, "yyyy-MM-dd");

  const todoTasks = tasksData.filter((t) => t.status === "todo");
  const completedTodayCount = tasksData.filter(
    (t) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= startOfToday
  ).length;

  const overdueTasks = todoTasks.filter((t) => t.due_at && new Date(t.due_at) < startOfToday);
  const dueTodayTasks = todoTasks.filter(
    (t) => t.due_at && new Date(t.due_at) >= startOfToday && new Date(t.due_at) < endOfToday
  );
  const highPriorityTasks = todoTasks.filter((t) => t.priority === "high");

  // Curate Today's Execution List: overdue + due today + high priority, falling back to all open tasks
  const focusedIds = new Set([
    ...overdueTasks.map((t) => t.id),
    ...dueTodayTasks.map((t) => t.id),
    ...highPriorityTasks.map((t) => t.id),
  ]);
  const todayTasks =
    focusedIds.size > 0
      ? todoTasks.filter((t) => focusedIds.has(t.id))
      : todoTasks;

  const todayEvents = (calendarData?.events ?? []).filter(
    (e) => e.start && isSameDay(new Date(e.start), now)
  );

  const habitsCompletedToday = habitsData.filter((h) =>
    (h.habit_logs ?? []).some((l: { completed_date: string }) => l.completed_date === todayIsoDate)
  ).length;

  // Dynamic AI Intelligence Briefing derived from real user state
  const briefingSummary = (() => {
    if (tasksLoading) return "Analyzing your live tasks, calendar schedule, and daily habits…";
    const parts: string[] = [];

    if (overdueTasks.length > 0) {
      parts.push(
        `You have ${overdueTasks.length} overdue ${overdueTasks.length === 1 ? "task" : "tasks"} requiring immediate triage.`
      );
    }
    if (dueTodayTasks.length > 0 || highPriorityTasks.length > 0) {
      parts.push(
        `${dueTodayTasks.length} ${dueTodayTasks.length === 1 ? "item is" : "items are"} due today with ${highPriorityTasks.length} high-priority focus ${highPriorityTasks.length === 1 ? "target" : "targets"}.`
      );
    } else if (todoTasks.length === 0) {
      parts.push("Your task queue is completely clear right now.");
    } else {
      parts.push(`You have ${todoTasks.length} open ${todoTasks.length === 1 ? "task" : "tasks"} in your workspace.`);
    }

    if (todayEvents.length > 0) {
      const nextEvt = todayEvents[0];
      const nextTime = nextEvt.start ? format(new Date(nextEvt.start), "HH:mm") : "today";
      parts.push(
        `${todayEvents.length} calendar ${todayEvents.length === 1 ? "event" : "events"} scheduled today (next: "${nextEvt.summary}" at ${nextTime}).`
      );
    }

    if (habitsData.length > 0) {
      parts.push(`Daily habits: ${habitsCompletedToday}/${habitsData.length} completed today.`);
    }

    return parts.join(" ");
  })();

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1F2336]">
          <div>
            <span className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider block">
              {todayStr}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
              <Sun className="h-6 w-6 text-[#D4AF37]" />
              My Day Focus
            </h1>
            <p className="text-sm text-[#8A8F9E] mt-0.5">
              Ziri's live focus plan for today's tasks, schedule, and daily habits.
            </p>
          </div>

          <Button
            onClick={() => newChat.mutate()}
            disabled={newChat.isPending}
            className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-5 py-2.5 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:scale-105 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {newChat.isPending ? "Connecting..." : "Ask Ziri"}
          </Button>
        </div>

        {/* Live AI Morning Briefing Card */}
        <div className="bg-[#0F111A] border border-[#D4AF37]/25 rounded-xl p-5 sm:p-6 space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>DAILY INTELLIGENCE SUMMARY</span>
            </div>
            <div className="flex items-center gap-2">
              {completedTodayCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-semibold">
                  {completedTodayCount} completed today
                </span>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => toggleSpeakBriefing(briefingSummary)}
                disabled={tasksLoading}
                className="h-7 rounded-lg bg-[#141624] border border-[#D4AF37]/30 text-[#E5C185] hover:bg-[#1F2336] text-[11px] font-semibold px-2.5 gap-1.5"
              >
                {speakingBriefing ? (
                  <>
                    <Square className="h-3 w-3 text-rose-400" /> Stop Voice
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-[#D4AF37]" /> Play Voice Briefing
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-sm text-white font-medium leading-relaxed">{briefingSummary}</p>
        </div>

        {/* Main Grid: Left Execution List + Right Today's Schedule & Habits */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Priorities Section (7 cols) */}
          <div className="lg:col-span-7 bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
              <h2 className="text-sm uppercase tracking-wider font-bold text-white">
                TODAY'S EXECUTION LIST ({todayTasks.length})
              </h2>
              <button
                type="button"
                onClick={() => setIsAddingTask(!isAddingTask)}
                className="flex items-center gap-1 text-xs text-[#E5C185] hover:text-white font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add Focus Task
              </button>
            </div>

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
                  placeholder="High-priority task for today..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="bg-[#141624] border-[#1F2336] text-xs text-white"
                />
                <Button
                  type="submit"
                  disabled={createM.isPending}
                  className="bg-[#D4AF37] text-black font-bold text-xs"
                >
                  {createM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
              </form>
            )}

            <div className="space-y-2.5">
              {tasksLoading ? (
                <div className="py-8 flex items-center justify-center text-xs text-[#8A8F9E]">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#D4AF37]" />
                  Loading My Day focus...
                </div>
              ) : todayTasks.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-xs text-[#8A8F9E]">Your My Day execution list is clean.</p>
                  <Button
                    size="sm"
                    onClick={() => setIsAddingTask(true)}
                    className="rounded-xl bg-[#141624] border border-[#D4AF37]/30 text-[#E5C185] hover:bg-[#1F2336] text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add a priority for today
                  </Button>
                </div>
              ) : (
                todayTasks.map((t, idx) => {
                  const isOverdue = t.due_at && new Date(t.due_at) < startOfToday;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[#141624] border border-[#1F2336] hover:border-[#D4AF37]/30 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-mono text-xs font-bold text-[#D4AF37]">
                          {(idx + 1).toString().padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold text-white truncate block">
                            {t.title}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#8A8F9E]">
                            <span
                              className={
                                t.priority === "high"
                                  ? "text-amber-400 font-semibold uppercase"
                                  : "uppercase"
                              }
                            >
                              {t.priority}
                            </span>
                            {t.due_at && (
                              <span
                                className={`flex items-center gap-1 ${
                                  isOverdue ? "text-rose-400 font-semibold" : ""
                                }`}
                              >
                                {isOverdue ? (
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                ) : (
                                  <Clock className="h-2.5 w-2.5" />
                                )}
                                {isOverdue
                                  ? `Overdue (${format(new Date(t.due_at), "MMM d")})`
                                  : `Due ${format(new Date(t.due_at), "HH:mm")}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleM.mutate({ id: t.id, status: "done" })}
                        className="h-6 w-6 rounded-lg border border-[#1F2336] hover:border-[#D4AF37] text-[#8A8F9E] hover:text-[#D4AF37] flex items-center justify-center shrink-0 transition-colors"
                        title="Complete task"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Today's Schedule & Daily Habits (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Today's Meetings */}
            <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
                <h2 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-[#D4AF37]" />
                  Today's Schedule
                </h2>
                <Link to="/calendar" className="text-[11px] text-[#E5C185] hover:underline">
                  Full Calendar
                </Link>
              </div>

              {calendarLoading ? (
                <div className="py-6 flex items-center justify-center text-xs text-[#8A8F9E]">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#D4AF37]" />
                  Checking calendar...
                </div>
              ) : !calendarData?.connected ? (
                <div className="py-4 text-center space-y-2">
                  <p className="text-xs text-[#8A8F9E]">Google Calendar is not connected.</p>
                  <Link to="/settings">
                    <Button
                      size="sm"
                      className="rounded-xl bg-[#141624] border border-[#D4AF37]/30 text-[#E5C185] text-xs"
                    >
                      Connect Calendar <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              ) : todayEvents.length === 0 ? (
                <p className="text-xs text-[#8A8F9E] py-4 text-center">
                  No meetings scheduled for today — wide open for deep work.
                </p>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-[#141624] border border-[#1F2336] space-y-0.5"
                    >
                      <span className="text-[11px] font-mono font-bold text-[#D4AF37]">
                        {evt.start ? format(new Date(evt.start), "HH:mm") : "All Day"}
                        {evt.end ? ` – ${format(new Date(evt.end), "HH:mm")}` : ""}
                      </span>
                      <p className="text-xs font-semibold text-white truncate">{evt.summary}</p>
                      {evt.location && (
                        <p className="text-[10px] text-[#8A8F9E] truncate">{evt.location}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Today's Habit Check-in */}
            <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
                <h2 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
                  <Flame className="h-4 w-4 text-[#D4AF37]" />
                  Today's Habits ({habitsCompletedToday}/{habitsData.length})
                </h2>
                <Link to="/habits" className="text-[11px] text-[#E5C185] hover:underline">
                  Manage
                </Link>
              </div>

              {habitsData.length === 0 ? (
                <p className="text-xs text-[#8A8F9E] py-4 text-center">
                  No daily habits set up yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {habitsData.map((h) => {
                    const doneToday = (h.habit_logs ?? []).some(
                      (l: { completed_date: string }) => l.completed_date === todayIsoDate
                    );
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() =>
                          toggleHabitM.mutate({
                            habitId: h.id,
                            date: todayIsoDate,
                            completed: !doneToday,
                          })
                        }
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                          doneToday
                            ? "bg-[#1A1810] border-[#D4AF37]/40 text-[#F5E0A3]"
                            : "bg-[#141624] border-[#1F2336] text-white hover:border-[#D4AF37]/30"
                        }`}
                      >
                        <span className={`text-xs font-semibold truncate ${doneToday ? "line-through opacity-80" : ""}`}>
                          {h.title}
                        </span>
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${
                            doneToday ? "text-[#D4AF37]" : "text-[#8A8F9E]"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
