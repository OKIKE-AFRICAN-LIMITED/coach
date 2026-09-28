import { useEffect, useState, useCallback } from "react";
import { startAlarm, stopAlarm } from "@/lib/alarm-sound";
import { markDismissedLocally, unmarkRinging } from "@/hooks/use-task-reminders";
import { Bell, X, Clock } from "lucide-react";

export interface AlarmTask {
  id: string;
  title: string;
  notes?: string | null;
}

interface AlarmOverlayProps {
  tasks: AlarmTask[];
  onDismiss: (taskId: string) => void;
  onDismissAll: () => void;
  onSnooze: (task: AlarmTask, minutes: number) => void;
}

export function AlarmOverlay({ tasks, onDismiss, onDismissAll, onSnooze }: AlarmOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = tasks[currentIndex] ?? tasks[0];

  useEffect(() => {
    startAlarm();
    return () => stopAlarm();
  }, []);

  const handleDismiss = useCallback(() => {
    markDismissedLocally(current.id);
    unmarkRinging(current.id);
    onDismiss(current.id);
    if (tasks.length <= 1) {
      stopAlarm();
      onDismissAll();
    } else {
      setCurrentIndex((i) => Math.min(i, tasks.length - 2));
    }
  }, [current, tasks, onDismiss, onDismissAll]);

  const handleDismissAll = useCallback(() => {
    tasks.forEach((t) => {
      markDismissedLocally(t.id);
      unmarkRinging(t.id);
      onDismiss(t.id);
    });
    stopAlarm();
    onDismissAll();
  }, [tasks, onDismiss, onDismissAll]);

  const handleSnooze = useCallback((minutes: number) => {
    unmarkRinging(current.id);
    onSnooze(current, minutes);
    if (tasks.length <= 1) {
      stopAlarm();
      onDismissAll();
    } else {
      setCurrentIndex((i) => Math.min(i, tasks.length - 2));
    }
  }, [current, tasks, onSnooze, onDismissAll]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(5,5,7,0.95)", backdropFilter: "blur(12px)" }}
    >
      {/* Pulsing rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-80 rounded-full border-2 border-[#D4AF37]/20 animate-ping" style={{ animationDuration: "2s" }} />
        <div className="absolute w-60 h-60 rounded-full border-2 border-[#D4AF37]/30 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
      </div>

      <div className="relative w-full max-w-sm mx-4 bg-[#0F111A] border border-[#D4AF37]/40 rounded-2xl shadow-[0_0_60px_rgba(212,175,55,0.25)] overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#D4AF37] to-[#AA7C11]" />

        <div className="px-6 pt-6 pb-4 text-center">
          <div className="flex items-center justify-center mb-3">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/15 flex items-center justify-center animate-pulse">
              <Bell className="h-8 w-8 text-[#D4AF37]" />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold mb-1">⏰ Task Reminder</p>
          <h2 className="text-xl font-bold text-white leading-snug">{current.title}</h2>
          {current.notes && <p className="text-sm text-[#8A8F9E] mt-2 leading-relaxed">{current.notes}</p>}
        </div>

        {tasks.length > 1 && (
          <div className="mx-6 mb-3 px-3 py-2 rounded-lg bg-[#141624] border border-[#1F2336] text-center">
            <p className="text-xs text-[#8A8F9E]">
              <span className="text-[#D4AF37] font-semibold">{tasks.length}</span> reminders pending
              {currentIndex < tasks.length - 1 && (
                <button type="button" onClick={() => setCurrentIndex((i) => i + 1)} className="ml-2 text-[#D4AF37]/70 hover:text-[#D4AF37] underline">
                  Next →
                </button>
              )}
            </p>
          </div>
        )}

        <div className="px-6 pb-6 space-y-2.5">
          {/* Snooze options */}
          <p className="text-[10px] text-center text-[#6C7180] uppercase tracking-widest">Snooze for</p>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => handleSnooze(mins)}
                className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-[#141624] border border-[#1F2336] text-xs text-[#A0A5B5] hover:border-[#D4AF37]/40 hover:text-white transition-colors"
              >
                <Clock className="h-3 w-3" />
                {mins} min
              </button>
            ))}
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
          >
            Dismiss
          </button>

          {tasks.length > 1 && (
            <button
              type="button"
              onClick={handleDismissAll}
              className="w-full py-2 rounded-xl border border-[#1F2336] text-xs text-[#8A8F9E] hover:text-white hover:border-[#D4AF37]/30 transition-colors flex items-center justify-center gap-1"
            >
              <X className="h-3 w-3" /> Dismiss all {tasks.length} reminders
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
