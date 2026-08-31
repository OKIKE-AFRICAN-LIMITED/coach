import { Link, useRouterState } from "@tanstack/react-router";
import {
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
  ShieldCheck,
  LogOut,
  User,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const workspaceItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Day", url: "/my-day", icon: Sun },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Habits", url: "/habits", icon: Activity },
];

const intelligenceItems = [
  { title: "AI Coach", url: "/chat", icon: Bot },
  { title: "Insights", url: "/insights", icon: TrendingUp },
  { title: "Automations", url: "/automations", icon: Zap },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();

  const userQ = useQuery({
    queryKey: ["user_session"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const adminQ = useQuery({
    queryKey: ["is_admin"],
    queryFn: async () => {
      const user = userQ.data;
      if (!user) return false;
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      return data?.is_admin ?? false;
    },
    enabled: !!userQ.data,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-[#D4AF37]/15 bg-[#050507] text-[#F3F4F6] h-screen shrink-0 rounded-none border-l-0 border-t-0 border-b-0">
      {/* Brand Header - Exactly h-16 (64px) to align with TopBar */}
      <SidebarHeader className="h-16 border-b border-[#D4AF37]/15 px-4 flex items-center justify-between shrink-0 bg-[#050507] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Link to="/dashboard" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Coach Ziri"
            className="h-9 w-auto object-contain drop-shadow-[0_0_12px_rgba(212,175,55,0.35)] group-data-[collapsible=icon]:hidden"
          />
          {/* Compact Gold Emblem Badge for Collapsed Sidebar */}
          <div className="hidden group-data-[collapsible=icon]:flex h-9 w-9 rounded-xl bg-[#1A1810] border border-[#D4AF37]/40 items-center justify-center text-[#D4AF37] font-bold shadow-sm">
            <span className="text-sm font-serif tracking-tighter">Z</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 space-y-4 overflow-y-auto group-data-[collapsible=icon]:px-1">
        {/* WORKSPACE GROUP */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#6C7180] px-2 mb-1 group-data-[collapsible=icon]:hidden">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="rounded-xl transition-all hover:bg-[#141624] hover:text-[#E5C185] data-[active=true]:bg-[#1A1810] data-[active=true]:text-[#F5E0A3] data-[active=true]:border data-[active=true]:border-[#D4AF37]/30 group-data-[collapsible=icon]:justify-center"
                    >
                      <Link to={item.url} className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium">
                        <item.icon className="h-4 w-4 shrink-0 text-[#9CA3AF] group-data-[active=true]:text-[#D4AF37]" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* INTELLIGENCE GROUP */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#6C7180] px-2 mb-1 group-data-[collapsible=icon]:hidden">
            Intelligence
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {intelligenceItems.map((item) => {
                const isActive = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="rounded-xl transition-all hover:bg-[#141624] hover:text-[#E5C185] data-[active=true]:bg-[#1A1810] data-[active=true]:text-[#F5E0A3] data-[active=true]:border data-[active=true]:border-[#D4AF37]/30 group-data-[collapsible=icon]:justify-center"
                    >
                      <Link to={item.url} className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium">
                        <item.icon className="h-4 w-4 shrink-0 text-[#9CA3AF] group-data-[active=true]:text-[#D4AF37]" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SYSTEM GROUP */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#6C7180] px-2 mb-1 group-data-[collapsible=icon]:hidden">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/settings"}
                  tooltip="Settings"
                  className="rounded-xl transition-all hover:bg-[#141624] hover:text-[#E5C185] data-[active=true]:bg-[#1A1810] data-[active=true]:text-[#F5E0A3] data-[active=true]:border data-[active=true]:border-[#D4AF37]/30 group-data-[collapsible=icon]:justify-center"
                >
                  <Link to="/settings" className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium">
                    <Settings className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                    <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {adminQ.data && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin")}
                    tooltip="Admin Portal"
                    className="rounded-xl transition-all hover:bg-[#141624] hover:text-[#E5C185] data-[active=true]:bg-[#1A1810] data-[active=true]:text-[#F5E0A3] data-[active=true]:border data-[active=true]:border-[#D4AF37]/30 group-data-[collapsible=icon]:justify-center"
                  >
                    <Link to="/admin" className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                      <span className="group-data-[collapsible=icon]:hidden">Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="border-t border-[#1A1D2B]/60 p-3 space-y-2 shrink-0 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-2">
        {/* Expanded Profile Card */}
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#0E101A] border border-[#1F2336] group-data-[collapsible=icon]:hidden">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-black font-bold flex items-center justify-center text-xs shrink-0">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#F3F4F6] truncate">
              {userQ.data?.email?.split("@")[0] ?? "Member"}
            </p>
            <span className="text-[9px] font-semibold text-[#D4AF37] tracking-wider uppercase block">
              Pro Intelligence
            </span>
          </div>
        </div>

        {/* Collapsed Avatar Icon */}
        <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center p-1">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-black font-bold flex items-center justify-center text-xs shrink-0 shadow-sm" title={userQ.data?.email ?? "User"}>
            <User className="h-4 w-4" />
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          title="Sign out"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#8A8F9E] hover:text-red-400 hover:bg-[#181216] transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden font-medium">Sign out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
