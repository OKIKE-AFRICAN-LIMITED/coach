import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAutomationLogs,
  runAutomation,
  type AutomationId,
} from "@/lib/automations.functions";
import {
  Zap,
  Play,
  CheckCircle2,
  Loader2,
  History,
  ArrowUpRight,
  Calendar,
  Mail,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/automations")({
  component: AutomationsPage,
});

const AUTOMATION_DEFS: {
  id: AutomationId;
  title: string;
  desc: string;
  icon: typeof Zap;
}[] = [
  {
    id: "calendar_prep",
    title: "Google Calendar Event → Task Prioritization",
    desc: "Scans upcoming meetings in the next 48 hours and auto-generates high-priority prep tasks with reminders 30 mins before start.",
    icon: Calendar,
  },
  {
    id: "gmail_digest",
    title: "Gmail Unread Digest → Coach Ziri Briefing",
    desc: "Pulls unread priority emails from Gmail and synthesizes an actionable briefing thread in Coach Ziri.",
    icon: Mail,
  },
  {
    id: "overdue_triage",
    title: "Overdue & Neglected Task Auto-Triage",
    desc: "Reschedules overdue or neglected tasks to your next focus window and escalates priority so nothing slips.",
    icon: AlertTriangle,
  },
  {
    id: "habit_nudge",
    title: "Daily Habit Streak Protection Nudge",
    desc: "Checks uncompleted daily habits and schedules a 1-hour reminder task to protect your active streaks.",
    icon: Flame,
  },
];

const ACTIVE_STORAGE_KEY = "ziri_automations_enabled_v1";

function AutomationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const logsFn = useServerFn(listAutomationLogs);
  const runFn = useServerFn(runAutomation);

  const [enabledMap, setEnabledMap] = useState<Record<AutomationId, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ACTIVE_STORAGE_KEY) ?? "{}");
      return {
        calendar_prep: saved.calendar_prep ?? true,
        gmail_digest: saved.gmail_digest ?? true,
        overdue_triage: saved.overdue_triage ?? true,
        habit_nudge: saved.habit_nudge ?? true,
      };
    } catch {
      return {
        calendar_prep: true,
        gmail_digest: true,
        overdue_triage: true,
        habit_nudge: true,
      };
    }
  });

  const [runningId, setRunningId] = useState<AutomationId | null>(null);

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["automation-logs"],
    queryFn: () => logsFn(),
  });

  const runM = useMutation({
    mutationFn: async (id: AutomationId) => {
      setRunningId(id);
      return runFn({ data: { id } });
    },
    onSuccess: (res) => {
      setRunningId(null);
      qc.invalidateQueries({ queryKey: ["automation-logs"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["threads"] });
      toast.success(res.summary, {
        action: res.threadId
          ? {
              label: "Open Digest",
              onClick: () =>
                navigate({ to: "/chat/$threadId", params: { threadId: res.threadId! } }),
            }
          : undefined,
      });
    },
    onError: (err) => {
      setRunningId(null);
      toast.error(err instanceof Error ? err.message : "Automation failed");
    },
  });

  function toggleEnabled(id: AutomationId, checked: boolean) {
    setEnabledMap((prev) => {
      const next = { ...prev, [id]: checked };
      try {
        localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1F2336]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Zap className="h-6 w-6 text-[#D4AF37]" />
              AI Workflows & Automations
            </h1>
            <p className="text-sm text-[#8A8F9E] mt-1">
              Execute autonomous productivity routines across Google Calendar, Gmail, Tasks, and Habits.
            </p>
          </div>
        </div>

        {/* Active Rules List */}
        <div className="space-y-4">
          {AUTOMATION_DEFS.map((a) => {
            const Icon = a.icon;
            const isActive = enabledMap[a.id];
            const isRunning = runningId === a.id && runM.isPending;
            const lastLog = logs.find((l) => l.automationId === a.id);

            return (
              <div
                key={a.id}
                className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl hover:border-[#D4AF37]/30 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">{a.title}</h3>
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[#1F2336] text-[#8A8F9E] text-[10px] font-semibold">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8A8F9E] leading-relaxed">{a.desc}</p>
                    {lastLog && (
                      <p className="text-[11px] text-[#E5C185]/90 pt-1">
                        Last run ({format(new Date(lastLog.createdAt), "MMM d, HH:mm")}):{" "}
                        <span className="text-[#A0A5B5]">{lastLog.summary}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => toggleEnabled(a.id, checked)}
                    aria-label={`Toggle ${a.title}`}
                  />
                  <Button
                    onClick={() => runM.mutate(a.id)}
                    disabled={runM.isPending || !isActive}
                    size="sm"
                    className="rounded-xl bg-[#141624] border border-[#D4AF37]/30 text-[#E5C185] hover:bg-[#1F2336] text-xs font-semibold min-w-[100px]"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running…
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1.5" /> Run Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Execution History Log */}
        <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
              <History className="h-4 w-4 text-[#D4AF37]" />
              <span>RECENT AUTOMATION EXECUTION LOG</span>
            </div>
            <span className="text-[11px] text-[#8A8F9E] font-mono">{logs.length} runs</span>
          </div>

          {logsLoading ? (
            <div className="py-6 flex items-center justify-center text-xs text-[#8A8F9E]">
              <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#D4AF37]" />
              Loading execution logs…
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-[#8A8F9E] py-4 text-center">
              No automation runs recorded yet. Click "Run Now" on any workflow above to execute it.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const def = AUTOMATION_DEFS.find((d) => d.id === log.automationId);
                return (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-[#141624] border border-[#1F2336] text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-[#E5C185] block">
                        {def?.title ?? log.automationId}
                      </span>
                      <span className="text-[#A0A5B5] text-[11px] block mt-0.5">
                        {log.summary}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#8A8F9E] shrink-0">
                      {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                    </span>
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
