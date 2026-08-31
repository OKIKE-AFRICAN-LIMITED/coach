import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTasks, createTask, updateTask } from "@/lib/tasks.functions";
import { createThread } from "@/lib/threads.functions";
import { fetchUpcomingCalendarEvents } from "@/lib/google.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sun, Sparkles, Plus, CheckCircle2, Clock, Calendar as CalendarIcon, ArrowRight, Loader2, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
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
  const createT = useServerFn(createThread);
  const eventsFn = useServerFn(fetchUpcomingCalendarEvents);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listFn(),
  });

  const { data: calendarData } = useQuery({
    queryKey: ["upcomingEvents"],
    queryFn: () => eventsFn(),
  });

  const createM = useMutation({
    mutationFn: async (title: string) => createFn({ data: { title } }),
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

  const newChat = useMutation({
    mutationFn: async () => createT({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const todayStr = format(new Date(), "EEEE, MMMM d, yyyy");

  const todayTasks = (tasksData || []).filter(t => t.status === "todo");

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1F2336]">
          <div>
            <span className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider block">{todayStr}</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
              <Sun className="h-6 w-6 text-[#D4AF37]" />
              My Day Focus
            </h1>
            <p className="text-sm text-[#8A8F9E] mt-0.5">Ziri's curated focus plan for maximum daily momentum.</p>
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

        {/* AI Morning Briefing Card */}
        <div className="bg-[#0F111A] border border-[#D4AF37]/25 rounded-xl p-5 sm:p-6 space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>DAILY INTELLIGENCE SUMMARY</span>
          </div>
          <p className="text-sm text-white font-medium leading-relaxed">
            "Your schedule has 3 high priority execution items before 12:00 PM. A 90-minute deep work block is allocated from 14:00 to 15:30."
          </p>
        </div>

        {/* Priorities Section */}
        <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
            <h2 className="text-sm uppercase tracking-wider font-bold text-white">TODAY'S EXECUTION LIST</h2>
            <button
              type="button"
              onClick={() => setIsAddingTask(!isAddingTask)}
              className="flex items-center gap-1 text-xs text-[#E5C185] hover:text-white font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Add Task
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
                placeholder="Task title for My Day..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="bg-[#141624] border-[#1F2336] text-xs text-white"
              />
              <Button type="submit" disabled={createM.isPending} className="bg-[#D4AF37] text-black font-bold text-xs">
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
              <p className="text-xs text-[#8A8F9E] py-4 text-center">Your My Day list is clean.</p>
            ) : (
              todayTasks.map((t, idx) => (
                <div key={t.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#141624] border border-[#1F2336] hover:border-[#D4AF37]/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-[#D4AF37]">
                      {(idx + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="text-xs font-semibold text-white truncate">{t.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleM.mutate({ id: t.id, status: "done" })}
                    className="h-6 w-6 rounded-lg border border-[#1F2336] hover:border-[#D4AF37] text-[#8A8F9E] hover:text-[#D4AF37] flex items-center justify-center shrink-0 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
