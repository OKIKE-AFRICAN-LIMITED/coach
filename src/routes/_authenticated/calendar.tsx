import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchUpcomingCalendarEvents, createGoogleCalendarEvent } from "@/lib/google.functions";
import { listTasks } from "@/lib/tasks.functions";
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
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Loader2,
  Plus,
  CheckSquare,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const qc = useQueryClient();
  const eventsFn = useServerFn(fetchUpcomingCalendarEvents);
  const tasksFn = useServerFn(listTasks);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ["upcomingEvents"],
    queryFn: () => eventsFn(),
  });

  const { data: tasksData = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => tasksFn(),
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingEmptyDays = monthStart.getDay(); // 0 (Sun) - 6 (Sat)

  const connected = calendarData?.connected ?? false;
  const allEvents = calendarData?.events ?? [];
  const openTasksWithDue = tasksData.filter((t) => t.status === "todo" && t.due_at);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Filter events & tasks for either the selected date or upcoming agenda
  const displayedEvents = selectedDate
    ? allEvents.filter((e) => e.start && isSameDay(new Date(e.start), selectedDate))
    : allEvents.filter((e) => !e.start || new Date(e.start) >= startOfToday);

  const displayedDueTasks = selectedDate
    ? openTasksWithDue.filter((t) => t.due_at && isSameDay(new Date(t.due_at), selectedDate))
    : openTasksWithDue.filter((t) => t.due_at && new Date(t.due_at) >= startOfToday).slice(0, 8);

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
            <p className="text-sm text-[#8A8F9E] mt-1">
              {connected
                ? "Live Google Calendar events and task deadlines."
                : "Task deadlines timeline — connect Google Workspace in Settings to sync meetings."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[#0F111A] border border-[#1F2336] rounded-xl p-1">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg text-[#A0A5B5] hover:text-white hover:bg-[#141624] transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs sm:text-sm font-bold text-white px-2.5 min-w-[120px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg text-[#A0A5B5] hover:text-white hover:bg-[#141624] transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {connected ? (
              <NewCalendarEventDialog onCreated={() => qc.invalidateQueries({ queryKey: ["upcomingEvents"] })} />
            ) : (
              <Link to="/settings">
                <Button className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-4 py-2">
                  Connect Google Calendar
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Grid Split: Left Month Calendar + Right Agenda List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Month View (7 Cols) */}
          <div className="lg:col-span-7 bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8A8F9E]">
                {selectedDate ? `Selected: ${format(selectedDate, "EEE, MMM d")}` : "Click any day to inspect"}
              </span>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="text-xs font-semibold text-[#D4AF37] hover:underline"
                >
                  Show all upcoming
                </button>
              )}
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-bold text-[#8A8F9E] pb-2 border-b border-[#1F2336]">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            <div className="grid grid-cols-7 text-center text-xs gap-y-2 pt-2">
              {Array.from({ length: leadingEmptyDays }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-11" />
              ))}
              {monthDays.map((day) => {
                const isCurrent = isToday(day);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                const hasEvents = allEvents.some((e) => e.start && isSameDay(new Date(e.start), day));
                const hasDueTasks = openTasksWithDue.some((t) => t.due_at && isSameDay(new Date(t.due_at), day));

                return (
                  <div key={day.toISOString()} className="flex flex-col items-center justify-center h-11">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDate((prev) => (prev && isSameDay(prev, day) ? null : day))
                      }
                      className={`h-9 w-9 rounded-xl flex flex-col items-center justify-center text-xs transition-all relative ${
                        isSelected
                          ? "bg-[#D4AF37] text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.5)]"
                          : isCurrent
                            ? "bg-[#1A1810] border border-[#D4AF37]/60 text-[#F5E0A3] font-bold"
                            : "text-[#D1D5DB] hover:bg-[#141624] hover:text-white"
                      }`}
                    >
                      <span>{format(day, "d")}</span>
                      {(hasEvents || hasDueTasks) && (
                        <span className="flex items-center gap-0.5 mt-0.5">
                          {hasEvents && (
                            <span
                              className={`h-1 w-1 rounded-full ${
                                isSelected ? "bg-black" : "bg-[#D4AF37]"
                              }`}
                            />
                          )}
                          {hasDueTasks && (
                            <span
                              className={`h-1 w-1 rounded-full ${
                                isSelected ? "bg-black/70" : "bg-emerald-400"
                              }`}
                            />
                          )}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 pt-3 border-t border-[#1F2336] text-[11px] text-[#8A8F9E]">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
                <span>Calendar Event</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Task Due</span>
              </div>
            </div>
          </div>

          {/* Right Upcoming Agenda Timeline (5 Cols) */}
          <div className="lg:col-span-5 bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {selectedDate ? format(selectedDate, "MMM d, yyyy") : "UPCOMING AGENDA"}
              </h2>
              <span className="text-[11px] text-[#8A8F9E]">
                {displayedEvents.length} {displayedEvents.length === 1 ? "event" : "events"}
              </span>
            </div>

            {calendarLoading || tasksLoading ? (
              <div className="py-8 flex items-center justify-center text-xs text-[#8A8F9E]">
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#D4AF37]" />
                Syncing calendar & deadlines...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Calendar Events */}
                {displayedEvents.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#141624]/60 border border-[#1F2336] text-center space-y-1.5">
                    <p className="text-xs font-semibold text-white">
                      {selectedDate ? "No calendar events on this day" : "No upcoming calendar events"}
                    </p>
                    <p className="text-[11px] text-[#8A8F9E]">
                      {connected
                        ? "Use '+ New Event' above or ask Coach Ziri to schedule a meeting."
                        : "Connect Google Workspace in Settings to see your live Google Calendar events."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {displayedEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-3.5 rounded-xl bg-[#141624] border border-[#1F2336] hover:border-[#D4AF37]/30 transition-colors space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-[#D4AF37]">
                            {evt.start ? format(new Date(evt.start), "MMM d, HH:mm") : "All Day"}
                            {evt.end ? ` – ${format(new Date(evt.end), "HH:mm")}` : ""}
                          </span>
                          {evt.htmlLink ? (
                            <a
                              href={evt.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#8A8F9E] hover:text-[#D4AF37]"
                              title="Open in Google Calendar"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-[#8A8F9E]" />
                          )}
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

                {/* Task Deadlines Section */}
                {displayedDueTasks.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-[#1F2336]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5" />
                      Task Deadlines ({displayedDueTasks.length})
                    </span>
                    <div className="space-y-2">
                      {displayedDueTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-xl bg-[#141624]/70 border border-[#1F2336] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{t.title}</p>
                            {t.due_at && (
                              <p className="text-[10px] text-[#8A8F9E] font-mono">
                                Due {format(new Date(t.due_at), "MMM d, HH:mm")}
                              </p>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                            {t.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewCalendarEventDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [startISO, setStartISO] = useState("");
  const [endISO, setEndISO] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const createEvt = useServerFn(createGoogleCalendarEvent);

  const m = useMutation({
    mutationFn: async () =>
      createEvt({
        data: {
          summary,
          startISO: new Date(startISO).toISOString(),
          endISO: new Date(endISO).toISOString(),
          location: location || undefined,
          description: description || undefined,
        },
      }),
    onSuccess: () => {
      onCreated();
      setOpen(false);
      setSummary("");
      setStartISO("");
      setEndISO("");
      setLocation("");
      setDescription("");
      toast.success("Event added to Google Calendar");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create event"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-4 py-2 hover:scale-105 transition-all gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Event
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0F111A] border border-[#D4AF37]/30 text-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-[#E5C185]">
            Schedule Google Calendar Event
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!summary.trim() || !startISO || !endISO) return;
            m.mutate();
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <Label className="text-xs text-[#A0A5B5]">Event Title</Label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Executive Strategy Sync"
              className="bg-[#141624] border-[#1F2336] text-xs text-white"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#A0A5B5]">Start Time</Label>
              <Input
                type="datetime-local"
                value={startISO}
                onChange={(e) => setStartISO(e.target.value)}
                required
                className="bg-[#141624] border-[#1F2336] text-xs text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#A0A5B5]">End Time</Label>
              <Input
                type="datetime-local"
                value={endISO}
                onChange={(e) => setEndISO(e.target.value)}
                required
                className="bg-[#141624] border-[#1F2336] text-xs text-white"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#A0A5B5]">Location / Meeting Link</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional room or video call link"
              className="bg-[#141624] border-[#1F2336] text-xs text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#A0A5B5]">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional agenda notes..."
              className="bg-[#141624] border-[#1F2336] text-xs text-white"
            />
          </div>
          <Button
            type="submit"
            disabled={m.isPending}
            className="w-full bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs"
          >
            {m.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Event"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
