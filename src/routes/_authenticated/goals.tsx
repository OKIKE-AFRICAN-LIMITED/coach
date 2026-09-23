import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createThread } from "@/lib/threads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, Plus, Sparkles, Loader2 } from "lucide-react";
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

  // Goals are not yet persisted in the DB — empty for new users
  const goalsList: never[] = [];

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

        {/* Add Goal Form */}
        {isAdding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (goalName.trim()) {
                toast.info("Goal tracking coming soon — tell Ziri about your goal in the chat!");
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

        {/* Goals List or Empty State */}
        {goalsList.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="h-16 w-16 rounded-2xl bg-[#0F111A] border border-[#1F2336] flex items-center justify-center">
              <Target className="h-7 w-7 text-[#D4AF37]/40" />
            </div>
            <div className="text-center space-y-1.5 max-w-sm">
              <p className="text-base font-semibold text-white">No goals set yet</p>
              <p className="text-sm text-[#8A8F9E]">
                Set your first goal to start tracking progress and milestones. You can also ask Ziri to help you define meaningful goals.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                onClick={() => setIsAdding(true)}
                className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-5 py-2 hover:scale-105 transition-all"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Set Your First Goal
              </Button>
              <Button
                onClick={() => newChat.mutate()}
                disabled={newChat.isPending}
                variant="outline"
                className="rounded-xl border-[#1F2336] text-[#A0A5B5] hover:text-white hover:bg-[#141624] text-xs font-medium px-4 py-2"
              >
                {newChat.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                Ask Ziri for Help
              </Button>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}

