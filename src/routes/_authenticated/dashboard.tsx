import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTasks, createTask, updateTask, deleteTask } from "@/lib/tasks.functions";
import { createThread } from "@/lib/threads.functions";
import { fetchUpcomingCalendarEvents } from "@/lib/google.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Bell,
  User,
  Sparkles,
  MessageCircle,
  Clock,
  Calendar as CalendarIcon,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  CheckSquare,
  SlidersHorizontal,
  ChevronRight
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
  const deleteFn = useServerFn(deleteTask);
  const createT = useServerFn(createThread);
  const eventsFn = useServerFn(fetchUpcomingCalendarEvents);

  const [searchQuery, setSearchQuery] = useState("");
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

  // Fetch calendar
  const { data: calendarData } = useQuery({
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

  const userName = userData?.email ? userData.email.split("@")[0] : "Productivity Leader";
  const todayDateStr = format(new Date(), "EEEE, MMM d, yyyy");

  // Fallback priorities matching prompt spec
  const defaultPriorities = [
    { id: "p1", num: "01", title: "Finish MANSHILL proposal", priority: "High priority", due: "Due 10:30", status: "todo" },
    { id: "p2", num: "02", title: "Review personalized app", priority: "Medium priority", due: "Due 12:00", status: "todo" },
    { id: "p3", num: "03", title: "Portfolio for PST NSI", priority: "Medium priority", due: "Due 15:00", status: "todo" },
  ];

  const dbTasks = (tasksData || []).filter(t => t.status === "todo").map((t, index) => ({
    id: t.id,
    num: (index + 1).toString().padStart(2, "0"),
    title: t.title,
    priority: t.priority === "high" ? "High priority" : t.priority === "medium" ? "Medium priority" : "Low priority",
    due: t.due_at ? `Due ${format(new Date(t.due_at), "HH:mm")}` : "Due Today",
    status: t.status,
  }));

  const activePriorities = (dbTasks.length > 0 ? dbTasks : defaultPriorities).filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Today's schedule slots
  const scheduleEvents = calendarData?.events && calendarData.events.length > 0
    ? calendarData.events.slice(0, 4).map(e => ({
        time: e.start ? format(new Date(e.start), "HH:mm") : "All Day",
        title: e.summary,
        location: e.location,
      }))
    : [
        { time: "09:00", title: "Strategy Session", location: "Boardroom A" },
        { time: "11:30", title: "Project Review", location: "Zoom Call" },
        { time: "14:00", title: "Deep Work Window", location: "Focus Block" },
        { time: "16:30", title: "Client Meeting", location: "Executive Lounge" },
      ];

  // Active Goals
  const activeGoals = [
    { id: 1, name: "Launch Product", progress: 78, trend: "+12% this week", milestone: "MVP Deployment" },
    { id: 2, name: "Build Fitness Routine", progress: 64, trend: "4/5 sessions done", milestone: "Streak 14 Days" },
    { id: 3, name: "Learn AI Engineering", progress: 42, trend: "Needs attention", milestone: "Vector Embeddings Module" },
  ];

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ─── 1. TOP BAR (NO REPEATED LOGO) ─────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-[#1F2336]">
          
          {/* Greeting & Metadata Summary */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {greeting}, <span className="capitalize text-[#E5C185]">{userName}</span>.
            </h1>
            <p className="text-sm text-[#8A8F9E] font-medium">
              Here's what needs your attention today.
            </p>

            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-semibold text-[#A0A5B5]">
              <span className="px-2.5 py-1 rounded-md bg-[#0F111A] border border-[#1F2336] text-[#D4AF37]">
                {todayDateStr}
              </span>
              <span className="text-[#6C7180]">•</span>
              <span className="px-2.5 py-1 rounded-md bg-[#0F111A] border border-[#1F2336] text-amber-400">
                3 high priority
              </span>
              <span className="text-[#6C7180]">•</span>
              <span className="px-2.5 py-1 rounded-md bg-[#0F111A] border border-[#1F2336]">
                4 meetings
              </span>
              <span className="text-[#6C7180]">•</span>
              <span className="px-2.5 py-1 rounded-md bg-[#0F111A] border border-[#1F2336]">
                12 tasks
              </span>
            </div>
          </div>

        </div>

        {/* ─── 2. AI DAILY BRIEFING COMPONENT (ZIRI INTELLIGENCE) ───────────── */}
        <div className="bg-[#0F111A] border border-[#D4AF37]/25 rounded-xl p-6 shadow-xl relative overflow-hidden space-y-4">
          
          {/* Subtle Top Light Accent Line */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              </div>
              <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-[#D4AF37]">
                ZIRI INTELLIGENCE
              </span>
            </div>
            <span className="text-[10px] text-[#8A8F9E] font-mono">LIVE BRIEFING</span>
          </div>

          <p className="text-sm md:text-base text-[#F3F4F6] font-normal leading-relaxed max-w-4xl">
            "You have a busy day ahead. I've identified <span className="text-[#E5C185] font-semibold">3 priorities</span> that deserve your attention before noon. You also have a <span className="text-[#E5C185] font-semibold">90-minute focus window</span> this afternoon."
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => navigate({ to: "/tasks" })}
              className="rounded-xl bg-[#171926] border border-[#D4AF37]/40 text-[#E5C185] hover:bg-[#202336] text-xs font-semibold px-4 py-2"
            >
              View Today's Plan
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>

            <Button
              onClick={() => newChat.mutate()}
              variant="outline"
              className="rounded-xl border-[#1F2336] text-[#A0A5B5] hover:text-white hover:bg-[#141624] text-xs font-medium px-4 py-2"
            >
              Ask Ziri
            </Button>
          </div>
        </div>

        {/* ─── 3. SUMMARY METRICS (4 COMPACT CARDS) ─────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Tasks Today */}
          <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-4 space-y-1 hover:border-[#D4AF37]/30 transition-colors">
            <span className="text-xs text-[#8A8F9E] font-medium block">Tasks Today</span>
            <div className="text-3xl font-bold text-white tracking-tight">12</div>
            <span className="text-[11px] text-amber-400 font-medium block">3 high priority</span>
          </div>

          {/* Card 2: Meetings */}
          <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-4 space-y-1 hover:border-[#D4AF37]/30 transition-colors">
            <span className="text-xs text-[#8A8F9E] font-medium block">Meetings</span>
            <div className="text-3xl font-bold text-white tracking-tight">4</div>
            <span className="text-[11px] text-emerald-400 font-medium block">Next in 45m</span>
          </div>

          {/* Card 3: Focus Score */}
          <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-4 space-y-1 hover:border-[#D4AF37]/30 transition-colors">
            <span className="text-xs text-[#8A8F9E] font-medium block">Focus Score</span>
            <div className="text-3xl font-bold text-[#E5C185] tracking-tight">92%</div>
            <span className="text-[11px] text-emerald-400 font-medium block">+8% this week</span>
          </div>

          {/* Card 4: Active Goals */}
          <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-4 space-y-1 hover:border-[#D4AF37]/30 transition-colors">
            <span className="text-xs text-[#8A8F9E] font-medium block">Active Goals</span>
            <div className="text-3xl font-bold text-white tracking-tight">3</div>
            <span className="text-[11px] text-[#A0A5B5] font-medium block">1 milestone due</span>
          </div>

        </div>

        {/* ─── 4. MAIN DASHBOARD GRID (2-COLUMN RESPONSIVE LAYOUT) ──────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN (7 COLS): TODAY'S PRIORITIES */}
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

                  <Button
                    onClick={() => toast.success("Ziri optimized priority order")}
                    size="sm"
                    className="rounded-lg bg-[#171926] border border-[#D4AF37]/30 text-[#E5C185] hover:bg-[#202336] text-xs font-semibold px-3 py-1"
                  >
                    <SlidersHorizontal className="h-3 w-3 mr-1.5" />
                    Let Ziri prioritize
                  </Button>
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

              {/* Task Priority List (Formatted as specified) */}
              <div className="space-y-3 pt-1">
                {tasksLoading ? (
                  <div className="py-6 flex items-center justify-center text-xs text-[#8A8F9E]">
                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#D4AF37]" />
                    Loading priorities...
                  </div>
                ) : activePriorities.length === 0 ? (
                  <p className="text-xs text-[#8A8F9E] py-4 text-center">No open priorities.</p>
                ) : (
                  activePriorities.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[#141624]/80 border border-[#1F2336] hover:border-[#D4AF37]/30 transition-all group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Task Number */}
                        <span className="font-mono text-xs font-bold text-[#D4AF37] shrink-0">
                          {item.num}
                        </span>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-[#E5C185] transition-colors">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-[#8A8F9E] mt-0.5">
                            {item.priority} · <span className="text-[#A0A5B5]">{item.due}</span>
                          </p>
                        </div>
                      </div>

                      {/* Complete Check */}
                      <button
                        type="button"
                        onClick={() =>
                          toggleM.mutate({
                            id: item.id,
                            status: "done",
                          })
                        }
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

          {/* RIGHT COLUMN (5 COLS): AI INSIGHT & FOCUS */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* AI INSIGHT CARD */}
            <div className="bg-[#0F111A] border border-[#D4AF37]/25 rounded-xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#D4AF37]">
                  AI INSIGHT
                </span>
                <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              </div>

              <div className="space-y-2 text-xs text-[#D1D5DB] leading-relaxed">
                <p className="font-medium text-white">
                  "Your workload is <span className="text-amber-400 font-bold">18% higher</span> than your weekly average."
                </p>
                <p className="text-[#8A8F9E]">
                  "You have three tasks competing for the same afternoon window."
                </p>
              </div>

              <Button
                onClick={() => toast.success("Day schedule optimized by Ziri")}
                className="w-full rounded-xl bg-[#171926] border border-[#D4AF37]/40 text-[#E5C185] hover:bg-[#202336] text-xs font-semibold py-2"
              >
                Optimize My Day
              </Button>
            </div>

            {/* FOCUS CARD (Smaller focus visualization) */}
            <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#8A8F9E] block">
                  FOCUS SCORE
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-[#E5C185]">92 / 100</span>
                  <span className="text-xs font-semibold text-emerald-400">Excellent</span>
                </div>
              </div>

              {/* Compact Arc Ring */}
              <div className="relative h-12 w-12 flex items-center justify-center shrink-0">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle cx="24" cy="24" r="18" stroke="#1F2336" strokeWidth="4" fill="transparent" />
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    stroke="#D4AF37"
                    strokeWidth="4"
                    strokeDasharray="113"
                    strokeDashoffset="10"
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
              </div>
            </div>

          </div>

        </div>

        {/* ─── 5. TIMELINE / TODAY'S SCHEDULE ────────────────────────────────── */}
        <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-sm uppercase tracking-wider font-bold text-white">TODAY'S SCHEDULE</h2>
            </div>

            <Button
              onClick={() => navigate({ to: "/dashboard" })}
              variant="ghost"
              size="sm"
              className="text-xs text-[#E5C185] hover:text-white hover:bg-[#171926]"
            >
              Open Calendar
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {scheduleEvents.map((evt, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#141624]/80 border border-[#1F2336] space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#D4AF37]">{evt.time}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
                </div>
                <p className="text-xs font-semibold text-white truncate">{evt.title}</p>
                {evt.location && <p className="text-[11px] text-[#8A8F9E] truncate">{evt.location}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* ─── 6. GOALS SECTION ──────────────────────────────────────────────── */}
        <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-sm uppercase tracking-wider font-bold text-white">ACTIVE GOALS</h2>
            </div>
            <span className="text-xs text-[#8A8F9E]">3 Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeGoals.map((g) => (
              <div key={g.id} className="p-4 rounded-xl bg-[#141624]/80 border border-[#1F2336] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">{g.name}</span>
                  <span className="font-mono font-bold text-[#E5C185]">{g.progress}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-[#07080C] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#D4AF37] transition-all duration-500"
                    style={{ width: `${g.progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#8A8F9E]">
                  <span>{g.trend}</span>
                  <span className="text-[#A0A5B5] font-medium">{g.milestone}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 7. AI RECOMMENDATIONS SECTION (ZIRI RECOMMENDS) ─────────────── */}
        <div className="bg-[#0F111A] border border-[#D4AF37]/30 rounded-xl p-6 space-y-4 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#D4AF37]" />
            <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-[#D4AF37]">
              ZIRI RECOMMENDS
            </h2>
          </div>

          <p className="text-sm text-[#F3F4F6] font-medium leading-relaxed max-w-3xl">
            "Your <span className="text-[#E5C185]">Learn AI Engineering</span> goal has had no activity in 5 days. Consider blocking 45 minutes tomorrow morning."
          </p>

          <Button
            onClick={() => toast.success("45-min focus session scheduled for tomorrow morning")}
            className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-5 py-2 hover:scale-105 transition-all"
          >
            Schedule Focus Session
          </Button>
        </div>

      </div>
    </div>
  );
}
