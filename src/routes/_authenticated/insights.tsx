import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, BarChart2, Zap, Sparkles, Brain, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const metrics = [
    { title: "Weekly Focus Velocity", value: "92%", change: "+8% vs last week", desc: "Optimal peak performance output" },
    { title: "Task Completion Rate", value: "88%", change: "+14% vs average", desc: "24 tasks completed on time" },
    { title: "Meeting Load Index", value: "14.5 hrs", change: "-2.5 hrs vs average", desc: "More deep work capacity preserved" },
    { title: "Habit Consistency Score", value: "95%", change: "28/30 days completed", desc: "High streak continuity" },
  ];

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="pb-6 border-b border-[#1F2336]">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <TrendingUp className="h-6 w-6 text-[#D4AF37]" />
            Intelligence Insights & Velocity
          </h1>
          <p className="text-sm text-[#8A8F9E] mt-1">Deep analytics on your productivity patterns, focus velocity, and execution momentum.</p>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, i) => (
            <div key={i} className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-2 shadow-xl hover:border-[#D4AF37]/30 transition-colors">
              <span className="text-xs text-[#8A8F9E] font-medium block">{m.title}</span>
              <div className="text-3xl font-bold text-white tracking-tight">{m.value}</div>
              <span className="text-[11px] font-semibold text-[#D4AF37] block">{m.change}</span>
              <p className="text-[10px] text-[#8A8F9E] pt-1 border-t border-[#1F2336]">{m.desc}</p>
            </div>
          ))}
        </div>

        {/* Deep AI Analysis Panel */}
        <div className="bg-[#0F111A] border border-[#D4AF37]/30 rounded-xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
            <Brain className="h-4 w-4 text-[#D4AF37]" />
            <span>COACH ZIRI PATTERN RECOGNITION</span>
          </div>

          <div className="space-y-3 text-xs text-[#D1D5DB] leading-relaxed">
            <div className="p-3.5 rounded-xl bg-[#141624] border border-[#1F2336] flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Peak Focus Window Identified</p>
                <p className="text-[#8A8F9E] mt-0.5">Your highest output occurs between 14:00 and 16:30. Protect this window from low-priority meetings.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141624] border border-[#1F2336] flex items-start gap-3">
              <Zap className="h-4 w-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Context Switch Reduction</p>
                <p className="text-[#8A8F9E] mt-0.5">Batching task execution by priority reduced your daily context switching overhead by 22%.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
