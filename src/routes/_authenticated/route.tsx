import { createFileRoute, Outlet, redirect, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { createThread, listThreads } from "@/lib/threads.functions";
import { listTasks } from "@/lib/tasks.functions";
import { listHabits } from "@/lib/habits.functions";
import {
  Search,
  Bell,
  Sparkles,
  User,
  LayoutDashboard,
  Sun,
  CheckSquare,
  Target,
  Calendar,
  Activity,
  Bot,
  TrendingUp,
  Zap,
  Settings,
  MessageSquare,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTaskReminders, ALARM_EVENT, ensurePushSubscribed } from "@/hooks/use-task-reminders";
import { AlarmOverlay } from "@/components/AlarmOverlay";
import type { AlarmTask } from "@/components/AlarmOverlay";
import type { AlarmEventDetail } from "@/hooks/use-task-reminders";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminRoute = pathname.startsWith("/admin");

  // Background task reminder polling hook with snooze and dismiss actions
  const { handleSnooze: hookSnooze, handleDismiss: hookDismiss } = useTaskReminders();

  const createT = useServerFn(createThread);
  const listTasksFn = useServerFn(listTasks);
  const listHabitsFn = useServerFn(listHabits);
  const listThreadsFn = useServerFn(listThreads);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");

  const { data: cmdTasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listTasksFn(),
    enabled: cmdOpen,
  });

  const { data: cmdHabits = [] } = useQuery({
    queryKey: ["habits"],
    queryFn: () => listHabitsFn(),
    enabled: cmdOpen,
  });

  const { data: cmdThreads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listThreadsFn(),
    enabled: cmdOpen,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const newChat = useMutation({
    mutationFn: async (promptText?: string) => {
      const title = promptText ? promptText.slice(0, 80) : undefined;
      const t = await createT({ data: { title } });
      if (promptText) {
        sessionStorage.setItem(`ziri_initial_prompt_${t.id}`, promptText);
      }
      return t;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      setCmdOpen(false);
      setCmdQuery("");
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const [alarmTasks, setAlarmTasks] = useState<AlarmTask[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    () => ("Notification" in window ? Notification.permission : "denied")
  );
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    localStorage.getItem("ziri_notif_banner_dismissed") === "1"
  );

  const requestNotifPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result !== "default") setBannerDismissed(true);
    if (result === "granted") {
      await ensurePushSubscribed();
    }
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    localStorage.setItem("ziri_notif_banner_dismissed", "1");
  }, []);

  // Register Service Worker for PWA background notifications
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .then(() => {
          if (Notification.permission === "granted") {
            ensurePushSubscribed().catch(() => {});
          }
        })
        .catch(() => {});

      // Listen for SW messages (snooze/dismiss triggered from native notification actions)
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === "SNOOZE_REMINDER") {
          const taskId = event.data.taskId;
          const mins = event.data.minutes ?? 5;
          setAlarmTasks((prev) => {
            const task = prev.find((t) => t.id === taskId) || { id: taskId, title: "Task" };
            hookSnooze(task, mins);
            return prev.filter((t) => t.id !== taskId);
          });
        }
        if (event.data?.type === "DISMISS_REMINDER") {
          const taskId = event.data.taskId;
          hookDismiss(taskId);
          setAlarmTasks((prev) => prev.filter((t) => t.id !== taskId));
        }
      };

      navigator.serviceWorker.addEventListener("message", messageHandler);
      return () => navigator.serviceWorker.removeEventListener("message", messageHandler);
    }
  }, [hookSnooze, hookDismiss]);

  // Listen for in-app alarm events from the polling hook
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AlarmEventDetail>).detail;
      setAlarmTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newTasks = detail.tasks.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newTasks];
      });
    };
    window.addEventListener(ALARM_EVENT, handler);
    return () => window.removeEventListener(ALARM_EVENT, handler);
  }, []);

  const handleDismiss = useCallback((taskId: string) => {
    hookDismiss(taskId);
    setAlarmTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, [hookDismiss]);

  const handleDismissAll = useCallback(() => {
    alarmTasks.forEach((t) => hookDismiss(t.id));
    setAlarmTasks([]);
  }, [alarmTasks, hookDismiss]);

  const handleSnooze = useCallback((task: AlarmTask, minutes: number) => {
    hookSnooze(task, minutes);
    setAlarmTasks((prev) => prev.filter((t) => t.id !== task.id));
  }, [hookSnooze]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // Alarm overlay — rendered at root level so it appears above everything
  const alarmOverlay = alarmTasks.length > 0 ? (
    <AlarmOverlay
      tasks={alarmTasks}
      onDismiss={handleDismiss}
      onDismissAll={handleDismissAll}
      onSnooze={handleSnooze}
    />
  ) : null;

  // If viewing admin routes, bypass user workspace layout completely
  if (isAdminRoute) {
    return (
      <div className="h-screen w-screen overflow-hidden flex bg-[#050507]">
        {alarmOverlay}
        <main className="flex-1 min-w-0 h-screen overflow-hidden">
          <Outlet />
        </main>
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#050507]">
      {alarmOverlay}
      <SidebarProvider
        className="h-screen w-screen overflow-hidden flex"
        style={{ "--sidebar-width": "240px", "--sidebar-width-icon": "56px" } as React.CSSProperties}
      >
        {/* Sidebar — collapses to an off-canvas drawer on mobile */}
        <AppSidebar />

        {/* Main Area occupying remaining viewport space */}
        <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden bg-[#050507]">

          {/* Top Bar — h-16 aligns with Sidebar Header */}
          <header className="app-shell-header h-16 flex items-center justify-between border-b border-border px-3 sm:px-4 lg:px-6 shrink-0 bg-[#FCFBF8]/90 dark:bg-[#050507]/90 backdrop-blur-md z-20 text-[#18181B] dark:text-[#E5C185]">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger className="hover:bg-[#141624] text-[#A0A5B5] hover:text-[#E5C185] shrink-0" />

              {/* Search Command Input — opens Command Palette (Ctrl+K) */}
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="relative hidden md:flex items-center justify-between pl-9 pr-3 py-1.5 rounded-xl bg-[#0F111A] border border-[#1F2336] text-xs text-[#6C7180] hover:border-[#D4AF37]/50 hover:text-[#A0A5B5] w-56 lg:w-80 transition-colors text-left"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A8F9E]" />
                <span className="truncate">Search command or ask Ziri...</span>
                <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-[#141624] border border-[#1F2336] rounded text-[#8A8F9E]">
                  Ctrl K
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="md:hidden p-2 rounded-xl text-[#8A8F9E] hover:text-white"
                aria-label="Search or ask Ziri"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>

            {/* Top Bar Actions */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Theme Toggle */}
              <ThemeToggle />

              <button
                type="button"
                onClick={notifPermission !== "granted" ? requestNotifPermission : undefined}
                className="p-2 rounded-xl transition-colors relative"
                title={
                  notifPermission === "granted"
                    ? "Notifications enabled"
                    : notifPermission === "denied"
                    ? "Notifications blocked — enable in browser settings"
                    : "Click to enable notifications"
                }
                aria-label="Notifications"
              >
                <Bell
                  className={`h-4 w-4 ${
                    notifPermission === "granted"
                      ? "text-[#D4AF37]"
                      : "text-[#8A8F9E] hover:text-white"
                  }`}
                />
                {notifPermission === "granted" && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D4AF37]" />
                )}
                {notifPermission === "default" && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
                {notifPermission === "denied" && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>

              {/* Avatar — hidden on very small screens to save space */}
              <div className="hidden xs:flex h-8 w-8 rounded-full bg-[#141624] border border-[#1F2336] items-center justify-center text-xs text-white font-bold">
                <User className="h-4 w-4 text-[#D4AF37]" />
              </div>

              {/* Primary ASK ZIRI CTA */}
              <Button
                onClick={() => newChat.mutate(undefined)}
                disabled={newChat.isPending}
                className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-2.5 sm:px-4 py-2 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:scale-105 transition-all gap-1 sm:gap-1.5 shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ask Ziri</span>
              </Button>
            </div>
          </header>

          {/* Command Palette Modal */}
          <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
            <CommandInput
              placeholder="Search tasks, habits, pages, or type a question for Coach Ziri…"
              value={cmdQuery}
              onValueChange={setCmdQuery}
            />
            <CommandList>
              <CommandEmpty>
                {cmdQuery.trim() ? (
                  <button
                    type="button"
                    onClick={() => newChat.mutate(cmdQuery.trim())}
                    className="mx-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Ask Coach Ziri: "{cmdQuery.trim()}"
                  </button>
                ) : (
                  "No matching results."
                )}
              </CommandEmpty>

              {cmdQuery.trim().length > 0 && (
                <CommandGroup heading="AI Coach">
                  <CommandItem
                    value={`ask ziri ${cmdQuery}`}
                    onSelect={() => newChat.mutate(cmdQuery.trim())}
                  >
                    <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                    <span>Ask Coach Ziri: "{cmdQuery.trim()}"</span>
                  </CommandItem>
                </CommandGroup>
              )}

              <CommandGroup heading="Workspace Navigation">
                {[
                  { label: "Overview Dashboard", to: "/dashboard", icon: LayoutDashboard },
                  { label: "My Day Focus", to: "/my-day", icon: Sun },
                  { label: "Tasks Workspace", to: "/tasks", icon: CheckSquare },
                  { label: "Goals & Milestones", to: "/goals", icon: Target },
                  { label: "Calendar Agenda", to: "/calendar", icon: Calendar },
                  { label: "Habits Tracker", to: "/habits", icon: Activity },
                  { label: "AI Coach Chat", to: "/chat", icon: Bot },
                  { label: "Intelligence Insights", to: "/insights", icon: TrendingUp },
                  { label: "AI Automations", to: "/automations", icon: Zap },
                  { label: "Settings & Integrations", to: "/settings", icon: Settings },
                ].map((nav) => (
                  <CommandItem
                    key={nav.to}
                    value={`go to ${nav.label}`}
                    onSelect={() => {
                      setCmdOpen(false);
                      navigate({ to: nav.to });
                    }}
                  >
                    <nav.icon className="h-4 w-4 text-[#D4AF37]" />
                    <span>{nav.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>

              {cmdTasks.filter((t) => t.status === "todo").length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Open Tasks">
                    {cmdTasks
                      .filter((t) => t.status === "todo")
                      .slice(0, 8)
                      .map((t) => (
                        <CommandItem
                          key={t.id}
                          value={`task ${t.title} ${t.priority}`}
                          onSelect={() => {
                            setCmdOpen(false);
                            navigate({ to: "/tasks" });
                          }}
                        >
                          <CheckSquare className="h-4 w-4 text-emerald-400" />
                          <span className="truncate">{t.title}</span>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </>
              )}

              {cmdHabits.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Habits">
                    {cmdHabits.slice(0, 6).map((h) => (
                      <CommandItem
                        key={h.id}
                        value={`habit ${h.title}`}
                        onSelect={() => {
                          setCmdOpen(false);
                          navigate({ to: "/habits" });
                        }}
                      >
                        <Activity className="h-4 w-4 text-[#D4AF37]" />
                        <span className="truncate">{h.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {cmdThreads.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Recent Conversations">
                    {cmdThreads.slice(0, 5).map((th) => (
                      <CommandItem
                        key={th.id}
                        value={`chat thread ${th.title}`}
                        onSelect={() => {
                          setCmdOpen(false);
                          navigate({ to: "/chat/$threadId", params: { threadId: th.id } });
                        }}
                      >
                        <MessageSquare className="h-4 w-4 text-[#E5C185]" />
                        <span className="truncate">{th.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </CommandDialog>

          {/* Notification permission banner */}
          {notifPermission === "default" && !bannerDismissed && (
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-[#1A1810] border-b border-[#D4AF37]/20 text-xs">
              <div className="flex items-center gap-2 text-[#C8A84B]">
                <Bell className="h-3.5 w-3.5 shrink-0" />
                <span>Enable notifications so Ziri can alert you when task reminders are due — even in the background.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={requestNotifPermission}
                  className="px-3 py-1 rounded-lg bg-[#D4AF37] text-[#050507] font-semibold hover:bg-[#E5C158] transition-colors"
                >
                  Enable
                </button>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="px-2 py-1 rounded-lg text-[#8A8F9E] hover:text-white transition-colors"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Independently Scrollable Main Content */}
          <main className="flex-1 overflow-y-auto min-w-0 bg-[#050507]">
            <Outlet />
          </main>

        </div>
        <Toaster position="top-right" />
      </SidebarProvider>
    </div>
  );
}
