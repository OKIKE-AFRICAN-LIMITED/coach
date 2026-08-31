import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createThread } from "@/lib/threads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, Plus, TrendingUp, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  component: GoalsPage,
});

function GoalsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createT = useServerFn(createThread);

  const [isAdding, setIsAdding] = useState(false);
  const [goalName, setGoalName] = useState("");

  const newChat = useMutation({
    mutationFn: async () => createT({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const goalsList = [
    { id: 1, name: "Launch Product", progress: 78, trend: "+12% this week", milestone: "MVP Deployment", tasksCount: 8 },
    { id: 2, name: "Build Fitness Routine", progress: 64, trend: "4/5 sessions done", milestone: "Streak 14 Days", tasksCount: 5 },
    { id: 3, name: "Learn AI Engineering", progress: 42, trend: "Needs attention", milestone: "Vector Embeddings Module", tasksCount: 12 },
  ];

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
            <p className="text-sm text-[#8A8F9E] mt-1">Connect high-level objectives to daily execution tasks.</p>
          </div>

          <Button
            onClick={() => setIsAdding(!isAdding)}
            className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-5 py-2 hover:scale-105 transition-all gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add Goal
          </Button>
        </div>

        {/* Form */}
        {isAdding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (goalName.trim()) {
                toast.success(`Goal "${goalName}" created`);
                setGoalName("");
                setIsAdding(false);
              }
            }}
            className="bg-[#0F111A] border border-[#D4AF37]/30 rounded-xl p-4 flex items-center gap-2"
          >
            <Input
              autoFocus
              type="text"
              placeholder="Goal title..."
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              className="bg-[#141624] border-[#1F2336] text-xs text-white"
            />
            <Button type="submit" className="bg-[#D4AF37] text-black font-bold text-xs">
              Save
            </Button>
          </form>
        )}

        {/* Goals List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {goalsList.map((g) => (
            <div key={g.id} className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-4 shadow-xl hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white">{g.name}</h3>
                <span className="font-mono text-xs font-bold text-[#E5C185]">{g.progress}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-[#050507] overflow-hidden border border-[#1F2336]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E5C185] transition-all duration-500"
                  style={{ width: `${g.progress}%` }}
                />
              </div>

              <div className="space-y-1 text-xs text-[#8A8F9E] border-t border-[#1F2336] pt-3">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="text-[#A0A5B5] font-medium">{g.trend}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Next Milestone</span>
                  <span className="text-white font-medium">{g.milestone}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span>Connected Tasks</span>
                  <span className="text-[#D4AF37] font-semibold">{g.tasksCount} active</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Recommendations Section */}
        <div className="bg-[#0F111A] border border-[#D4AF37]/30 rounded-xl p-6 space-y-4 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#D4AF37]" />
            <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-[#D4AF37]">
              ZIRI RECOMMENDS FOR GOALS
            </h2>
          </div>

          <p className="text-sm text-[#F3F4F6] font-medium leading-relaxed max-w-3xl">
            "Your <span className="text-[#E5C185]">Learn AI Engineering</span> goal has had no activity in 5 days. Consider blocking 45 minutes tomorrow morning."
          </p>

          <Button
            onClick={() => toast.success("Focus block added to calendar")}
            className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-5 py-2 hover:scale-105 transition-all"
          >
            Schedule Focus Session
          </Button>
        </div>

      </div>
    </div>
  );
}
