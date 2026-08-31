import { createFileRoute, Outlet, Link, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, BarChart3, ArrowLeft, LogOut, Cpu, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth" });
    
    const profile = await context.queryClient.ensureQueryData({
      queryKey: ["admin-profile", user.id],
      queryFn: async () => {
        const { data } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();
        return data;
      },
      staleTime: 1000 * 60 * 5,
    });

    if (!profile?.is_admin) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userQ = useQuery({
    queryKey: ["admin_user_session"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Admin signed out");
  }

  const adminNav = [
    { label: "Overview & Telemetry", url: "/admin", icon: BarChart3, exact: true },
    { label: "User Control", url: "/admin/users", icon: Users, exact: false },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#050507] text-[#F3F4F6] font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Standalone Admin Sidebar - Fixed on Desktop, Drawer on Mobile */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 h-screen bg-[#FCFBF8] dark:bg-[#07080C] border-r border-border flex flex-col shrink-0 overflow-y-auto transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        
        {/* Admin Brand Header - Exactly h-16 (64px) to align with TopBar */}
        <div className="h-16 border-b border-border px-4 flex items-center justify-between shrink-0 bg-[#FCFBF8] dark:bg-[#050507]">
          <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
            <img src="/logo.png" alt="Coach Ziri Logo" className="h-9 w-auto object-contain drop-shadow-[0_0_12px_rgba(212,175,55,0.4)]" />
            <span className="px-2 py-0.5 rounded-md bg-[#1A1810] border border-[#D4AF37]/40 text-[#F5E0A3] text-[9px] font-extrabold uppercase tracking-widest">
              Admin
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#8A8F9E] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#6C7180] px-3 mb-2 block">
            System Admin Controls
          </span>

          {adminNav.map((item) => {
            const isActive = item.exact ? pathname === item.url : pathname.startsWith(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#1A1810] border border-[#D4AF37]/50 text-[#F5E0A3] shadow-md"
                    : "text-[#8A8F9E] hover:text-white hover:bg-[#141624]"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-[#D4AF37]" : "text-[#8A8F9E]"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#1F2336] space-y-2 shrink-0">
          <div className="p-3 rounded-xl bg-[#0F111A] border border-[#1F2336] space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#8A8F9E]">
              <span>ADMIN CLEARANCE</span>
              <span className="text-[#D4AF37] font-bold">LEVEL 1</span>
            </div>
            <p className="text-xs font-semibold text-white truncate">
              {userQ.data?.email ?? "Administrator"}
            </p>
          </div>

          <Link
            to="/dashboard"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#141624] border border-[#1F2336] text-[#E5C185] hover:bg-[#1F2336] hover:border-[#D4AF37]/30 transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to User App</span>
          </Link>

          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#8A8F9E] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

      </aside>

      {/* Main Admin Content Area occupying remaining viewport space */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden bg-[#050507]">
        
        {/* Top Header Bar for Admin - Exactly h-16 (64px) aligning with Admin Sidebar Header */}
        <header className="app-shell-header h-16 border-b border-border bg-[#FCFBF8]/90 dark:bg-[#050507]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-20 text-[#18181B] dark:text-[#E5C185]">
          <div className="flex items-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-[#8A8F9E] hover:text-white"
              aria-label="Open Admin Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-bold text-white truncate max-w-[140px] sm:max-w-none">Admin Control Center</span>
            <span className="text-[#8A8F9E] hidden sm:inline">•</span>
            <span className="text-[#D4AF37] font-semibold hidden sm:flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5" /> Telemetry Connected
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeToggle />
            <div className="px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden xs:inline sm:inline">Platform Online</span>
            </div>
          </div>
        </header>

        {/* Independently Scrollable Main Admin Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto bg-[#050507]">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
