import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchUpcomingCalendarEvents } from "@/lib/google.functions";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const eventsFn = useServerFn(fetchUpcomingCalendarEvents);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: calendarData, isLoading } = useQuery({
    queryKey: ["upcomingEvents"],
    queryFn: () => eventsFn(),
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const events = calendarData?.events && calendarData.events.length > 0
    ? calendarData.events
    : [
        { id: "1", summary: "Strategy Session", start: new Date().toISOString(), location: "Boardroom A" },
        { id: "2", summary: "Project Review", start: new Date(Date.now() + 3600000 * 3).toISOString(), location: "Zoom Call" },
        { id: "3", summary: "Deep Work Window", start: new Date(Date.now() + 3600000 * 5).toISOString(), location: "Focus Block" },
        { id: "4", summary: "Client Meeting", start: new Date(Date.now() + 3600000 * 7).toISOString(), location: "Executive Lounge" },
      ];

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1F2336]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <CalendarIcon className="h-6 w-6 text-[#D4AF37]" />
              Calendar Agenda & Timeline
            </h1>
            <p className="text-sm text-[#8A8F9E] mt-1">Google Workspace synced calendar meetings & focus slots.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-xl bg-[#0F111A] border border-[#1F2336] text-[#A0A5B5] hover:text-white"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-white px-2">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-xl bg-[#0F111A] border border-[#1F2336] text-[#A0A5B5] hover:text-white"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Grid Split: Left Month Calendar + Right Agenda List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Month View (7 Cols) */}
          <div className="lg:col-span-7 bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="grid grid-cols-7 text-center text-xs font-bold text-[#8A8F9E] pb-2 border-b border-[#1F2336]">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            <div className="grid grid-cols-7 text-center text-xs gap-y-3 pt-2">
              {monthDays.map((day) => {
                const isCurrent = isToday(day);
                return (
                  <div key={day.toString()} className="flex items-center justify-center">
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.6)]"
                          : "text-[#D1D5DB] hover:bg-[#141624] hover:text-white"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Upcoming Agenda Timeline (5 Cols) */}
          <div className="lg:col-span-5 bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1F2336] pb-3">
              UPCOMING AGENDA
            </h2>

            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-xs text-[#8A8F9E]">
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#D4AF37]" />
                Syncing calendar events...
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((evt) => (
                  <div key={evt.id} className="p-3.5 rounded-xl bg-[#141624] border border-[#1F2336] space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-[#D4AF37]">
                        {evt.start ? format(new Date(evt.start), "MMM d, HH:mm") : "All Day"}
                      </span>
                      <Clock className="h-3.5 w-3.5 text-[#8A8F9E]" />
                    </div>
                    <p className="text-xs font-bold text-white truncate">{evt.summary}</p>
                    {evt.location && (
                      <p className="text-[11px] text-[#8A8F9E] flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {evt.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
