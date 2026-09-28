import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listHabits, createHabit, deleteHabit, toggleHabitLog } from "@/lib/habits.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Flame, CalendarCheck2, Activity, Loader2 } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/habits")({
  component: HabitsPage,
});

function HabitsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listHabits);
  const create = useServerFn(createHabit);
  const del = useServerFn(deleteHabit);
  const toggle = useServerFn(toggleHabitLog);

  const { data: habits = [], isLoading } = useQuery({
    queryKey: ["habits"],
    queryFn: () => list(),
  });

  const toggleM = useMutation({
    mutationFn: async ({ habitId, date, completed }: { habitId: string; date: string; completed: boolean }) =>
      toggle({ data: { habitId, date, completed } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const delM = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habit deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const createM = useMutation({
    mutationFn: async (payload: { title: string; notes?: string }) => create({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habit created");
      setOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Generate last 30 days
  const today = startOfDay(new Date());
  const last30Days = Array.from({ length: 30 }).map((_, i) => {
    const d = subDays(today, 29 - i);
    return {
      dateObj: d,
      dateStr: format(d, "yyyy-MM-dd"),
      label: format(d, "MMM d"),
      day: format(d, "d"),
      isPast: d < today,
    };
  });

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1F2336]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Activity className="h-6 w-6 text-[#D4AF37]" />
              Habits Tracker
            </h1>
            <p className="text-sm text-[#8A8F9E] mt-1">Track your daily consistency over the last 30 days.</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-5 py-2 hover:scale-105 transition-all gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Habit
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0F111A] border border-[#D4AF37]/30 text-white rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-[#E5C185]">New Habit</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const title = fd.get("title") as string;
                  const notes = fd.get("notes") as string;
                  if (!title) return toast.error("Title required");
                  createM.mutate({ title, notes });
                }}
                className="space-y-4 pt-2"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs text-[#A0A5B5]">Title</Label>
                  <Input id="title" name="title" autoFocus placeholder="e.g. Read 10 pages" className="bg-[#141624] border-[#1F2336] text-xs text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs text-[#A0A5B5]">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Optional notes" className="bg-[#141624] border-[#1F2336] text-xs text-white" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" type="button" onClick={() => setOpen(false)} className="rounded-xl border-[#1F2336] text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createM.isPending} className="rounded-xl bg-[#D4AF37] text-black text-xs font-bold">
                    {createM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Habit"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Habits Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center text-xs text-[#8A8F9E] col-span-full">
              <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#D4AF37]" />
              Loading habits...
            </div>
          ) : habits.length === 0 ? (
            <div className="text-center py-12 border border-[#1F2336] rounded-xl bg-[#0F111A] col-span-full space-y-2">
              <h3 className="text-sm font-semibold text-white">No habits tracked yet</h3>
              <p className="text-[#8A8F9E] text-xs">Create your first habit to start building daily momentum.</p>
            </div>
          ) : (
            habits.map((habit) => {
              const logs = habit.habit_logs || [];
              const totalDays = logs.length;
              const completedDates = new Set(logs.map((l: any) => l.completed_date));
              
              let currentStreak = 0;
              let checkDate = startOfDay(new Date());
              const todayStr = format(checkDate, "yyyy-MM-dd");
              
              if (!completedDates.has(todayStr)) {
                checkDate = subDays(checkDate, 1);
              }
              
              while (true) {
                const dateStr = format(checkDate, "yyyy-MM-dd");
                if (completedDates.has(dateStr)) {
                  currentStreak++;
                  checkDate = subDays(checkDate, 1);
                } else {
                  break;
                }
              }

              return (
                <div key={habit.id} className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 flex flex-col gap-4 hover:border-[#D4AF37]/30 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-white truncate" title={habit.title}>{habit.title}</h3>
                      {habit.notes && (
                        <p className="text-xs text-[#8A8F9E] line-clamp-2 mt-0.5" title={habit.notes}>{habit.notes}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E5C185] bg-[#D4AF37]/10 border border-[#D4AF37]/25 px-2.5 py-0.5 rounded-full">
                          <Flame className="w-3.5 h-3.5 text-[#D4AF37]" />
                          {currentStreak} day streak
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
                          <CalendarCheck2 className="w-3.5 h-3.5" />
                          {totalDays} total days
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={delM.isPending}
                      onClick={() => {
                        if (confirm("Delete this habit forever?")) delM.mutate(habit.id);
                      }}
                      className="text-[#8A8F9E] hover:text-red-400 shrink-0 p-1"
                      aria-label="Delete habit"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="mt-auto pt-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {last30Days.map((d) => {
                        const isCompleted = habit.habit_logs?.some(
                          (log: any) => log.completed_date === d.dateStr
                        );
                        
                        let bgColor = "bg-[#141624] text-[#8A8F9E] border border-[#1F2336]";
                        if (isCompleted) {
                          bgColor = "bg-[#D4AF37] text-black font-bold border border-[#F5E0A3]";
                        } else if (d.isPast) {
                          bgColor = "bg-rose-500/20 text-rose-400 border border-rose-500/30";
                        }
                        
                        return (
                          <button
                            key={d.dateStr}
                            title={`${d.label}: ${isCompleted ? 'Completed' : d.isPast ? 'Missed' : 'Pending'}`}
                            disabled={toggleM.isPending}
                            onClick={() => toggleM.mutate({ 
                              habitId: habit.id, 
                              date: d.dateStr, 
                              completed: !isCompleted 
                            })}
                            className={`w-6 h-6 sm:w-[26px] sm:h-[26px] rounded-md text-[10px] font-medium flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${bgColor}`}
                          >
                            {d.day}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-[#8A8F9E] uppercase tracking-wider font-semibold pt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
                        Done
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        Missed
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#141624] border border-[#1F2336]"></div>
                        Pending
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
