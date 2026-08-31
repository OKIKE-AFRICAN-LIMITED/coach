import { createFileRoute, Outlet, redirect, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { createThread } from "@/lib/threads.functions";
import { Search, Bell, Sparkles, User } from "lucide-react";

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

  const createT = useServerFn(createThread);

  const newChat = useMutation({
    mutationFn: async () => createT({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // If viewing admin routes, bypass user workspace layout completely
  if (isAdminRoute) {
    return (
      <div className="h-screen w-screen overflow-hidden flex bg-[#050507]">
        <main className="flex-1 min-w-0 h-screen overflow-hidden">
          <Outlet />
        </main>
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#050507]">
      <SidebarProvider className="h-screen w-screen overflow-hidden flex">
        {/* Fixed Full-Height Sidebar */}
        <AppSidebar />

        {/* Main Area occupying remaining viewport space */}
        <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden bg-[#050507]">
          
          {/* Top Bar - Exactly h-16 (64px) aligning with Sidebar Header */}
          <header className="h-16 flex items-center justify-between border-b border-[#D4AF37]/15 px-4 lg:px-6 shrink-0 bg-[#050507]/90 backdrop-blur-md z-20 text-[#E5C185]">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hover:bg-[#141624] text-[#A0A5B5] hover:text-[#E5C185]" />
              
              {/* Search Command Input */}
              <div className="relative hidden md:flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A8F9E]" />
                <input
                  type="text"
                  placeholder="Search command or ask Ziri..."
                  className="pl-9 pr-4 py-1.5 rounded-xl bg-[#0F111A] border border-[#1F2336] text-xs text-white placeholder:text-[#6C7180] focus:border-[#D4AF37] focus:outline-none w-64 lg:w-80 transition-colors"
                />
              </div>
            </div>

            {/* Top Bar Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="p-2 rounded-xl text-[#8A8F9E] hover:text-white hover:bg-[#141624] transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D4AF37]" />
              </button>

              <div className="h-8 w-8 rounded-full bg-[#141624] border border-[#1F2336] flex items-center justify-center text-xs text-white font-bold">
                <User className="h-4 w-4 text-[#D4AF37]" />
              </div>

              {/* Primary ASK ZIRI CTA */}
              <Button
                onClick={() => newChat.mutate()}
                disabled={newChat.isPending}
                className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-4 py-2 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:scale-105 transition-all gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ask Ziri</span>
              </Button>
            </div>
          </header>

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
