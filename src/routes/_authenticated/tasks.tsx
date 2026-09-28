import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTasks, createTask, updateTask, deleteTask } from "@/lib/tasks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, CheckCircle2, Clock, Filter as FilterIcon, CheckSquare, Loader2, Bell } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

type Filter = "all" | "today" | "overdue" | "upcoming" | "done";

function TasksPage() {
  const qc = useQueryClient();
  const list = useServerFn(listTasks);
  const update = useServerFn(updateTask);
  const del = useServerFn(deleteTask);
  const [filter, setFilter] = useState<Filter>("all");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => list(),
  });

  const toggleM = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "todo" | "done" }) =>
      update({ data: { id, patch: { status } } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["briefing"] });
    },
  });

  const delM = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["briefing"] });
      toast.success("Task deleted");
    },
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);

  const filtered = tasks.filter((t) => {
    if (filter === "done") return t.status === "done";
    if (t.status === "done") return false;
    if (filter === "all") return true;
    if (filter === "overdue") return t.due_at && new Date(t.due_at) < startOfToday;
    if (filter === "today") return t.due_at && new Date(t.due_at) >= startOfToday && new Date(t.due_at) < endOfToday;
    if (filter === "upcoming") return t.due_at && new Date(t.due_at) >= endOfToday;
    return true;
  });

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All Tasks" },
    { id: "today", label: "Today" },
    { id: "overdue", label: "Overdue" },
    { id: "upcoming", label: "Upcoming" },
    { id: "done", label: "Done" },
  ];

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1F2336]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <CheckSquare className="h-6 w-6 text-[#D4AF37]" />
              Tasks Workspace
            </h1>
            <p className="text-sm text-[#8A8F9E] mt-1">Manage and track your execution priorities.</p>
          </div>
          <NewTaskDialog />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-medium">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-xl border transition-all ${
                filter === f.id
                  ? "bg-[#1A1810] border-[#D4AF37]/50 text-[#F5E0A3] font-semibold shadow-sm"
                  : "bg-[#0F111A] border-[#1F2336] text-[#8A8F9E] hover:text-white hover:border-[#D4AF37]/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Task List Card */}
        <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 shadow-xl space-y-3">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center text-xs text-[#8A8F9E]">
              <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#D4AF37]" />
              Loading tasks...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8A8F9E] space-y-2">
              <p>No tasks found in this view.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((t) => {
                const isDone = t.status === "done";
                return (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all group ${
                      isDone
                        ? "bg-[#131520]/40 border-[#1F2336] text-[#8A8F9E]"
                        : "bg-[#141624]/90 border-[#202438] text-white hover:border-[#D4AF37]/40"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          toggleM.mutate({ id: t.id, status: isDone ? "todo" : "done" })
                        }
                        className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isDone
                            ? "border-[#D4AF37] bg-[#D4AF37] text-[#050507]"
                            : "border-[#D4AF37]/50 hover:border-[#D4AF37]"
                        }`}
                      >
                        {isDone && <CheckCircle2 className="h-3.5 w-3.5 fill-current" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold ${isDone ? "line-through opacity-70" : "text-white"}`}>
                          {t.title}
                        </p>
                        {t.notes && <p className="text-[11px] text-[#8A8F9E] truncate mt-0.5">{t.notes}</p>}
                        {t.due_at && (
                          <p className="text-[10px] text-[#A0A5B5] mt-0.5">
                            Due {format(new Date(t.due_at), "MMM d, HH:mm")}
                          </p>
                        )}
                        {t.remind_at && (
                          <p className="text-[10px] text-[#D4AF37]/80 mt-0.5 flex items-center gap-1">
                            <Bell className="h-2.5 w-2.5" />
                            Reminder {format(new Date(t.remind_at), "MMM d, HH:mm")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        t.priority === "high"
                          ? "bg-red-500/10 text-red-400 border border-red-500/30"
                          : t.priority === "medium"
                            ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                            : "bg-[#1F2336] text-[#8A8F9E]"
                      }`}>
                        {t.priority}
                      </span>

                      <button
                        type="button"
                        onClick={() => delM.mutate(t.id)}
                        disabled={delM.isPending}
                        className="p-1 rounded text-[#8A8F9E] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function NewTaskDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const qc = useQueryClient();
  const create = useServerFn(createTask);

  const m = useMutation({
    mutationFn: async () =>
      create({
        data: {
          title,
          notes: notes || null,
          due_at: due ? new Date(due).toISOString() : null,
          remind_at: remindAt ? new Date(remindAt).toISOString() : null,
          priority,
          recurrence: "none",
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["briefing"] });
      setOpen(false);
      setTitle(""); setNotes(""); setDue(""); setRemindAt(""); setPriority("medium");
      toast.success("Task added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-5 py-2 hover:scale-105 transition-all gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0F111A] border border-[#D4AF37]/30 text-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-[#E5C185]">New Task</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            m.mutate();
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <Label className="text-xs text-[#A0A5B5]">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
              placeholder="Task title..."
              className="bg-[#141624] border-[#1F2336] text-xs text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#A0A5B5]">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes..."
              className="bg-[#141624] border-[#1F2336] text-xs text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#A0A5B5]">Due Date</Label>
              <Input
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="bg-[#141624] border-[#1F2336] text-xs text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#A0A5B5]">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger className="bg-[#141624] border-[#1F2336] text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0F111A] border-[#1F2336] text-white">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#A0A5B5] flex items-center gap-1">
              <Bell className="h-3 w-3 text-[#D4AF37]" /> Remind Me At
            </Label>
            <Input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              className="bg-[#141624] border-[#1F2336] text-xs text-white"
            />
            <p className="text-[10px] text-[#6C7180]">You'll get a notification at this exact time.</p>
          </div>
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs"
            disabled={m.isPending}
          >
            {m.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
