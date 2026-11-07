import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGoals, createGoal, updateGoal, deleteGoal } from "@/lib/goals.functions";
import { createThread } from "@/lib/threads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Target,
  Plus,
  Sparkles,
  Loader2,
  Trash2,
  CheckCircle2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  component: GoalsPage,
});

function GoalsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listGoals);
  const createFn = useServerFn(createGoal);
  const updateFn = useServerFn(updateGoal);
  const deleteFn = useServerFn(deleteGoal);
  const createT = useServerFn(createThread);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const { data: goalsList = [], isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: () => listFn(),
  });

  const createM = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          target_date: targetDate || null,
          progress: 0,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setTargetDate("");
      toast.success("Goal created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save goal"),
  });

  const updateM = useMutation({
    mutationFn: async ({
      id,
      progress,
      status,
    }: {
      id: string;
      progress: number;
      status?: "active" | "completed";
    }) =>
      updateFn({
        data: {
          id,
          patch: { progress: Math.max(0, Math.min(100, progress)), status },
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const askZiriForGoal = useMutation({
    mutationFn: async (goalTitle?: string) => {
      const prompt = goalTitle
        ? `Help me break down my goal "${goalTitle}" into 3 concrete weekly milestones and create high-priority tasks for the first step.`
        : "Help me define my top 3 strategic goals for this quarter and break them into actionable weekly tasks.";
      const t = await createT({ data: { title: goalTitle ? `Goal Plan: ${goalTitle}` : "Strategic Goal Planning" } });
      sessionStorage.setItem(`ziri_initial_prompt_${t.id}`, prompt);
      return t;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1F2336]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Target className="h-6 w-6 text-[#D4AF37]" />
              Active Goals & Milestones
            </h1>
            <p className="text-sm text-[#8A8F9E] mt-1">
              Connect high-level strategic objectives to daily execution tasks.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-5 py-2 hover:scale-105 transition-all gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0F111A] border border-[#D4AF37]/30 text-white rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-[#E5C185]">
                  New Strategic Goal
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!title.trim()) return;
                  createM.mutate();
                }}
                className="space-y-4 pt-2"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#A0A5B5]">Goal Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                    placeholder="e.g. Launch OKIKE AI Ecosystem to 100 Business Clients"
                    className="bg-[#141624] border-[#1F2336] text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#A0A5B5]">Key Milestones / Success Criteria</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe key results or milestones..."
                    className="bg-[#141624] border-[#1F2336] text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#A0A5B5]">Target Completion Date</Label>
                  <Input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="bg-[#141624] border-[#1F2336] text-xs text-white"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createM.isPending}
                  className="w-full bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs"
                >
                  {createM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Goal"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Goals List or Empty State */}
        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-xs text-[#8A8F9E]">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-[#D4AF37]" />
            Loading goals…
          </div>
        ) : goalsList.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-16 bg-[#0F111A] border border-[#1F2336] rounded-xl">
            <div className="h-16 w-16 rounded-2xl bg-[#141624] border border-[#1F2336] flex items-center justify-center">
              <Target className="h-7 w-7 text-[#D4AF37]/40" />
            </div>
            <div className="text-center space-y-1.5 max-w-sm px-4">
              <p className="text-base font-semibold text-white">No goals set yet</p>
              <p className="text-sm text-[#8A8F9E]">
                Set your first strategic goal to start tracking progress and milestones, or let Coach Ziri break it down into tasks.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                onClick={() => setOpen(true)}
                className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-5 py-2 hover:scale-105 transition-all"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Set Your First Goal
              </Button>
              <Button
                onClick={() => askZiriForGoal.mutate(undefined)}
                disabled={askZiriForGoal.isPending}
                variant="outline"
                className="rounded-xl border-[#1F2336] text-[#A0A5B5] hover:text-white hover:bg-[#141624] text-xs font-medium px-4 py-2"
              >
                {askZiriForGoal.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                Ask Ziri for Help
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goalsList.map((g) => {
              const isCompleted = g.status === "completed" || g.progress >= 100;
              return (
                <div
                  key={g.id}
                  className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 flex flex-col justify-between gap-4 shadow-xl hover:border-[#D4AF37]/30 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={`text-sm font-bold ${
                              isCompleted ? "line-through text-[#8A8F9E]" : "text-white"
                            }`}
                          >
                            {g.title}
                          </h3>
                          {isCompleted ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Achieved
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#E5C185] border border-[#D4AF37]/25 text-[10px] font-semibold">
                              {g.progress}%
                            </span>
                          )}
                        </div>
                        {g.description && (
                          <p className="text-xs text-[#8A8F9E] mt-1 leading-relaxed">
                            {g.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteM.mutate(g.id)}
                        disabled={deleteM.isPending}
                        className="text-[#8A8F9E] hover:text-red-400 p-1 shrink-0"
                        aria-label="Delete goal"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {g.target_date && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#A0A5B5] pt-1">
                        <CalendarIcon className="h-3 w-3 text-[#D4AF37]" />
                        <span>Target: {format(new Date(g.target_date), "MMM d, yyyy")}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar & Quick Controls */}
                  <div className="space-y-3 pt-2 border-t border-[#1F2336]">
                    <div className="w-full h-2 rounded-full bg-[#141624] overflow-hidden border border-[#1F2336]">
                      <div
                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F5E0A3] transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, g.progress))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateM.mutate({ id: g.id, progress: Math.max(0, g.progress - 10) })
                          }
                          disabled={updateM.isPending || g.progress <= 0}
                          className="px-2.5 py-1 rounded-lg bg-[#141624] border border-[#1F2336] text-[11px] font-semibold text-[#A0A5B5] hover:text-white disabled:opacity-40"
                        >
                          -10%
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateM.mutate({ id: g.id, progress: Math.min(100, g.progress + 10) })
                          }
                          disabled={updateM.isPending || g.progress >= 100}
                          className="px-2.5 py-1 rounded-lg bg-[#141624] border border-[#D4AF37]/30 text-[11px] font-semibold text-[#E5C185] hover:bg-[#1F2336] disabled:opacity-40"
                        >
                          +10%
                        </button>
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() =>
                              updateM.mutate({ id: g.id, progress: 100, status: "completed" })
                            }
                            disabled={updateM.isPending}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20"
                          >
                            Complete
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => askZiriForGoal.mutate(g.title)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#D4AF37] hover:underline"
                      >
                        <Sparkles className="h-3 w-3" /> Plan with Ziri
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
