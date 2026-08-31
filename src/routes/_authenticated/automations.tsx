import { createFileRoute } from "@tanstack/react-router";
import { Zap, Play, CheckCircle2, Sliders, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/automations")({
  component: AutomationsPage,
});

function AutomationsPage() {
  const automations = [
    { id: 1, title: "Google Calendar Event → Task Prioritization", desc: "Auto-generates high priority prep tasks 30 mins before scheduled client meetings.", active: true },
    { id: 2, title: "Gmail Unread Digest → Evening Action Summary", desc: "Summarizes urgent unread email threads into your daily briefing at 18:00.", active: true },
    { id: 3, title: "Focus Window Protection Rules", desc: "Automatically declines low-priority meeting invites during designated 90-minute focus blocks.", active: true },
    { id: 4, title: "Stagnant Goal Nudge & Re-scheduling", desc: "Alerts Ziri to suggest focus sessions when a goal shows no activity for 5 days.", active: true },
  ];

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="pb-6 border-b border-[#1F2336]">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Zap className="h-6 w-6 text-[#D4AF37]" />
            AI Workflows & Automations
          </h1>
          <p className="text-sm text-[#8A8F9E] mt-1">Autonomous intelligence routines running in the background for your productivity.</p>
        </div>

        {/* Active Rules List */}
        <div className="space-y-4">
          {automations.map((a) => (
            <div key={a.id} className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl hover:border-[#D4AF37]/30 transition-colors">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{a.title}</h3>
                  <p className="text-xs text-[#8A8F9E] leading-relaxed">{a.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </div>
                <Button
                  onClick={() => toast.success(`Executed "${a.title}"`)}
                  size="sm"
                  className="rounded-xl bg-[#141624] border border-[#D4AF37]/30 text-[#E5C185] hover:bg-[#1F2336] text-xs font-semibold"
                >
                  <Play className="h-3 w-3 mr-1" /> Run Now
                </Button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
