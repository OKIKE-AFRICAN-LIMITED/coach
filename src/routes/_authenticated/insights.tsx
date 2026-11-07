import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTasks } from "@/lib/tasks.functions";
import { listHabits } from "@/lib/habits.functions";
import { fetchUpcomingCalendarEvents } from "@/lib/google.functions";
import {
  TrendingUp,
  BarChart2,
  Zap,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Flame,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, subDays, startOfDay, isSameDay } from "date-fns";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const tasksFn = useServerFn(listTasks);
  const habitsFn = useServerFn(listHabits);
  const calendarFn = useServerFn(fetchUpcomingCalendarEvents);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => tasksFn(),
  });

  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ["habits"],
    queryFn: () => habitsFn(),
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ["upcomingEvents"],
    queryFn: () => calendarFn(),
  });

  const isLoading = tasksLoading || habitsLoading || calendarLoading;

  const now = new Date();
  const todayStart = startOfDay(now);
  const sevenDaysAgo = subDays(todayStart, 7);
  const thirtyDaysAgoStr = format(subDays(todayStart, 29), "yyyy-MM-dd");

  // 1. Task Metrics
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done");
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const overdueTasks = todoTasks.filter((t) => t.due_at && new Date(t.due_at) < todayStart);
  const highPriorityTodo = todoTasks.filter((t) => t.priority === "high");

  const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;
  const completedLast7d = doneTasks.filter(
    (t) => t.completed_at && new Date(t.completed_at) >= sevenDaysAgo
  ).length;

  // 2. Habit Consistency Score (last 30 days)
  const totalPossibleHabitDays = habits.length * 30;
  const habitLogsLast30d = habits.reduce((acc, h) => {
    const count = (h.habit_logs ?? []).filter(
      (l: { completed_date: string }) => l.completed_date >= thirtyDaysAgoStr
    ).length;
    return acc + count;
  }, 0);
  const habitConsistencyPct =
    totalPossibleHabitDays > 0
      ? Math.min(100, Math.round((habitLogsLast30d / totalPossibleHabitDays) * 100))
      : 0;

  // 3. Weekly Focus Velocity (tasks completed + habits logged in last 7 days)
  const sevenDaysAgoStr = format(sevenDaysAgo, "yyyy-MM-dd");
  const habitLogsLast7d = habits.reduce((acc, h) => {
    const count = (h.habit_logs ?? []).filter(
      (l: { completed_date: string }) => l.completed_date >= sevenDaysAgoStr
    ).length;
    return acc + count;
  }, 0);
  const weeklyVelocityActions = completedLast7d + habitLogsLast7d;

  // 4. Meeting Load Index (next 7 days from Google Calendar)
  const sevenDaysAhead = new Date(now.getTime() + 7 * 86400000);
  const next7dEvents = (calendarData?.events ?? []).filter((e) => {
    if (!e.start) return false;
    const d = new Date(e.start);
    return d >= todayStart && d <= sevenDaysAhead;
  });

  const meetingHours7d = next7dEvents.reduce((acc, e) => {
    if (!e.start || !e.end) return acc + 0.5;
    const diffHrs = (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3_600_000;
    return acc + (diffHrs > 0 && diffHrs <= 12 ? diffHrs : 1);
  }, 0);

  // 5. Last 7 Days Daily Activity Breakdown
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(todayStart, 6 - i);
    const dStr = format(d, "yyyy-MM-dd");
    const tasksDoneOnDay = doneTasks.filter(
      (t) => t.completed_at && isSameDay(new Date(t.completed_at), d)
    ).length;
    const habitsDoneOnDay = habits.reduce((acc, h) => {
      const hit = (h.habit_logs ?? []).some(
        (l: { completed_date: string }) => l.completed_date === dStr
      );
      return acc + (hit ? 1 : 0);
    }, 0);
    return {
      label: format(d, "EEE"),
      dateLabel: format(d, "MMM d"),
      tasks: tasksDoneOnDay,
      habits: habitsDoneOnDay,
      total: tasksDoneOnDay + habitsDoneOnDay,
    };
  });
  const maxDailyTotal = Math.max(1, ...last7Days.map((d) => d.total));

  const metrics = [
    {
      title: "Task Completion Rate",
      value: totalTasks > 0 ? `${completionRate}%` : "—",
      change: `${doneTasks.length} of ${totalTasks} total tasks done`,
      desc: `${completedLast7d} completed in the last 7 days`,
    },
    {
      title: "7-Day Execution Output",
      value: `${weeklyVelocityActions}`,
      change: `${completedLast7d} tasks · ${habitLogsLast7d} habit check-ins`,
      desc: "Combined weekly momentum actions",
    },
    {
      title: "7-Day Meeting Load",
      value: calendarData?.connected ? `${meetingHours7d.toFixed(1)} hrs` : "Not Linked",
      change: calendarData?.connected
        ? `${next7dEvents.length} events in next 7 days`
        : "Connect Google Calendar in Settings",
      desc:
        meetingHours7d > 15
          ? "High meeting load — guard deep work"
          : "Healthy deep-work capacity preserved",
    },
    {
      title: "Habit Consistency (30d)",
      value: habits.length > 0 ? `${habitConsistencyPct}%` : "—",
      change:
        habits.length > 0
          ? `${habitLogsLast30d} check-ins across ${habits.length} ${habits.length === 1 ? "habit" : "habits"}`
          : "No habits created yet",
      desc: "30-day rolling consistency score",
    },
  ];

  // Dynamic Pattern Recognition Insights
  const patterns: {
    icon: "ok" | "warn" | "zap" | "calendar";
    title: string;
    detail: string;
  }[] = [];

  if (overdueTasks.length > 0) {
    patterns.push({
      icon: "warn",
      title: `${overdueTasks.length} Overdue ${overdueTasks.length === 1 ? "Task Needs" : "Tasks Need"} Triage`,
      detail: `You have ${overdueTasks.length} past-due ${overdueTasks.length === 1 ? "item" : "items"} ("${overdueTasks[0].title}"${overdueTasks.length > 1 ? ` and ${overdueTasks.length - 1} more` : ""}). Use Automations or ask Coach Ziri to reschedule them.`,
    });
  } else if (totalTasks > 0) {
    patterns.push({
      icon: "ok",
      title: "Zero Overdue Backlog",
      detail: "All open tasks are on schedule with zero past-due bottlenecks.",
    });
  }

  if (highPriorityTodo.length > 0) {
    patterns.push({
      icon: "zap",
      title: `${highPriorityTodo.length} High-Priority ${highPriorityTodo.length === 1 ? "Target" : "Targets"} Open`,
      detail: `Focus your prime work block on "${highPriorityTodo[0].title}" before tackling lower-priority items.`,
    });
  }

  if (habits.length > 0) {
    patterns.push({
      icon: "ok",
      title: "Habit Momentum Analysis",
      detail: `You've logged ${habitLogsLast7d} habit completions over the past 7 days (${habitConsistencyPct}% 30-day consistency across ${habits.length} active ${habits.length === 1 ? "habit" : "habits"}).`,
    });
  }

  if (calendarData?.connected) {
    patterns.push({
      icon: "calendar",
      title: "Upcoming Schedule Density",
      detail:
        next7dEvents.length === 0
          ? "Your next 7 days have 0 meetings on Google Calendar — maximum deep work availability."
          : `You have ${next7dEvents.length} scheduled ${next7dEvents.length === 1 ? "event" : "events"} (${meetingHours7d.toFixed(1)} hrs total) over the next 7 days.`,
    });
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-6 border-b border-[#1F2336]">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <TrendingUp className="h-6 w-6 text-[#D4AF37]" />
            Intelligence Insights & Velocity
          </h1>
          <p className="text-sm text-[#8A8F9E] mt-1">
            Live analytics computed directly from your tasks, habits, and Google Calendar.
          </p>
        </div>

        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-xs text-[#8A8F9E]">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-[#D4AF37]" />
            Computing live workspace telemetry…
          </div>
        ) : (
          <>
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((m, i) => (
                <div
                  key={i}
                  className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-2 shadow-xl hover:border-[#D4AF37]/30 transition-colors"
                >
                  <span className="text-xs text-[#8A8F9E] font-medium block">{m.title}</span>
                  <div className="text-3xl font-bold text-white tracking-tight">{m.value}</div>
                  <span className="text-[11px] font-semibold text-[#D4AF37] block">{m.change}</span>
                  <p className="text-[10px] text-[#8A8F9E] pt-1 border-t border-[#1F2336]">
                    {m.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* 7-Day Execution Chart */}
            <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                  <BarChart2 className="h-4 w-4 text-[#D4AF37]" />
                  <span>7-DAY EXECUTION THROUGHPUT (TASKS + HABITS)</span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-[#8A8F9E]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#D4AF37]" /> Tasks Done
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Habits Logged
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-3 pt-4 items-end h-40">
                {last7Days.map((day) => {
                  const taskH = Math.round((day.tasks / maxDailyTotal) * 100);
                  const habitH = Math.round((day.habits / maxDailyTotal) * 100);
                  return (
                    <div
                      key={day.dateLabel}
                      className="flex flex-col items-center justify-end h-full gap-2"
                    >
                      <span className="text-[10px] font-mono text-[#A0A5B5]">
                        {day.total > 0 ? day.total : ""}
                      </span>
                      <div className="w-full max-w-[42px] bg-[#141624] rounded-lg p-1 h-24 flex flex-col justify-end gap-0.5 border border-[#1F2336]">
                        {day.habits > 0 && (
                          <div
                            style={{ height: `${Math.max(12, habitH)}%` }}
                            className="w-full bg-emerald-400 rounded-sm transition-all"
                            title={`${day.habits} habits`}
                          />
                        )}
                        {day.tasks > 0 && (
                          <div
                            style={{ height: `${Math.max(12, taskH)}%` }}
                            className="w-full bg-[#D4AF37] rounded-sm transition-all"
                            title={`${day.tasks} tasks`}
                          />
                        )}
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold text-white block">{day.label}</span>
                        <span className="text-[10px] text-[#6C7180] block">{day.dateLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deep AI Analysis Panel */}
            <div className="bg-[#0F111A] border border-[#D4AF37]/30 rounded-xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                <Brain className="h-4 w-4 text-[#D4AF37]" />
                <span>COACH ZIRI LIVE DIAGNOSTICS</span>
              </div>

              {patterns.length === 0 ? (
                <p className="text-xs text-[#8A8F9E]">
                  Add tasks or habits to unlock personalized execution diagnostics.
                </p>
              ) : (
                <div className="space-y-3 text-xs text-[#D1D5DB] leading-relaxed">
                  {patterns.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#141624] border border-[#1F2336] flex items-start gap-3"
                    >
                      {p.icon === "warn" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : p.icon === "zap" ? (
                        <Zap className="h-4 w-4 text-[#D4AF37] shrink-0 mt-0.5" />
                      ) : p.icon === "calendar" ? (
                        <CalendarIcon className="h-4 w-4 text-[#E5C185] shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold text-white">{p.title}</p>
                        <p className="text-[#8A8F9E] mt-0.5">{p.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
