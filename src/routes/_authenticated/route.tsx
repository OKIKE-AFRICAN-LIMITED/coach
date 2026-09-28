import { createFileRoute, Outlet, redirect, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { createThread } from "@/lib/threads.functions";
import { Search, Bell, Sparkles, User } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTaskReminders, ALARM_EVENT, snoozeReminder } from "@/hooks/use-task-reminders";
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

  // Start background task reminder polling
  useTaskReminders();

  const createT = useServerFn(createThread);

  const newChat = useMutation({
    mutationFn: async () => createT({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
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
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    localStorage.setItem("ziri_notif_banner_dismissed", "1");
  }, []);

  // Register Service Worker for PWA background notifications
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      // Listen for SW messages (e.g. snooze triggered from notification action)
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SNOOZE_REMINDER") {
          snoozeReminder(event.data.taskId, event.data.minutes ?? 5);
          setAlarmTasks((prev) => prev.filter((t) => t.id !== event.data.taskId));
        }
      });
    }
  }, []);

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
    setAlarmTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const handleDismissAll = useCallback(() => {
    setAlarmTasks([]);
  }, []);

  const handleSnooze = useCallback((taskId: string, minutes: number) => {
    snoozeReminder(taskId, minutes);
    setAlarmTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

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

              {/* Search Command Input — hidden on mobile */}
              <div className="relative hidden md:flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A8F9E]" />
                <input
                  type="text"
                  placeholder="Search command or ask Ziri..."
                  className="pl-9 pr-4 py-1.5 rounded-xl bg-[#0F111A] border border-[#1F2336] text-xs text-white placeholder:text-[#6C7180] focus:border-[#D4AF37] focus:outline-none w-52 lg:w-80 transition-colors"
                />
              </div>
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
                onClick={() => newChat.mutate()}
                disabled={newChat.isPending}
                className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-2.5 sm:px-4 py-2 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:scale-105 transition-all gap-1 sm:gap-1.5 shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ask Ziri</span>
              </Button>
            </div>
          </header>

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
