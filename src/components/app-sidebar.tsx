import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
  Plus,
  Trash2,
  Ghost,
  MessageSquare,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listThreads, createThread, deleteThread } from "@/lib/threads.functions";
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
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const listThreadsFn = useServerFn(listThreads);
  const createThreadFn = useServerFn(createThread);
  const deleteThreadFn = useServerFn(deleteThread);

  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => listThreadsFn(),
  });

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

  async function handleCreateNewChat(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const t = await createThreadFn({ data: { title: "New chat" } });
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
      toast.success("New conversation started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create chat");
    }
  }

  async function handleDeleteThread(e: React.MouseEvent, id: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await deleteThreadFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["threads"] });
      toast.success("Conversation deleted");
      if (pathname.includes(id)) {
        navigate({ to: "/chat" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete chat");
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen shrink-0 rounded-none border-l-0 border-t-0 border-b-0">
      {/* Brand Header - Exactly h-16 (64px) to align with TopBar */}
      <SidebarHeader className="h-16 border-b border-sidebar-border px-4 flex items-center justify-between shrink-0 bg-sidebar group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
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
          <div className="flex items-center justify-between px-2 mb-1 group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#6C7180] p-0">
              Intelligence
            </SidebarGroupLabel>
            <button
              type="button"
              onClick={handleCreateNewChat}
              className="text-[#8A8F9E] hover:text-[#D4AF37] p-1 rounded-md hover:bg-[#141624] transition-colors"
              title="Start a new chat thread"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* AI Coach (Main saved chat link) */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/chat") && pathname !== "/chat/temp"}
                  tooltip="AI Coach"
                  className="rounded-xl transition-all hover:bg-[#141624] hover:text-[#E5C185] data-[active=true]:bg-[#1A1810] data-[active=true]:text-[#F5E0A3] data-[active=true]:border data-[active=true]:border-[#D4AF37]/30 group-data-[collapsible=icon]:justify-center"
                >
                  <Link to="/chat" className="flex items-center justify-between px-3 py-2 text-xs font-medium w-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Bot className="h-4 w-4 shrink-0 text-[#9CA3AF] group-data-[active=true]:text-[#D4AF37]" />
                      <span className="group-data-[collapsible=icon]:hidden">AI Coach</span>
                    </div>
                    <span
                      onClick={handleCreateNewChat}
                      className="hidden group-hover:flex items-center justify-center h-4 w-4 rounded hover:bg-[#2A2E44] text-[#A0A5B5] hover:text-[#D4AF37] transition-all group-data-[collapsible=icon]:hidden"
                      title="New chat"
                    >
                      <Plus className="h-3 w-3" />
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Temporary Chat (Private, unsaved session) */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/chat/temp"}
                  tooltip="Temporary Chat (Unsaved)"
                  className="rounded-xl transition-all hover:bg-[#1A1810] hover:text-amber-200 data-[active=true]:bg-amber-500/15 data-[active=true]:text-amber-300 data-[active=true]:border data-[active=true]:border-amber-500/30 group-data-[collapsible=icon]:justify-center"
                >
                  <Link to="/chat/$threadId" params={{ threadId: "temp" }} className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium">
                    <Ghost className="h-4 w-4 shrink-0 text-amber-400 group-data-[active=true]:animate-pulse" />
                    <div className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
                      <span>Temporary Chat</span>
                      <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                        Incognito
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Saved Chat Threads List (Collapsible / Compact) */}
              {threadsQ.data && threadsQ.data.length > 0 && (
                <div className="pl-6 pr-1 pt-1 pb-2 space-y-0.5 group-data-[collapsible=icon]:hidden max-h-44 overflow-y-auto">
                  <div className="text-[9px] uppercase tracking-wider text-[#5A5F70] font-semibold px-2 py-0.5">
                    Recent
                  </div>
                  {threadsQ.data.slice(0, 5).map((t) => {
                    const isCurrent = pathname === `/chat/${t.id}`;
                    return (
                      <div
                        key={t.id}
                        className={`group/thread flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? "bg-[#1A1810] text-[#F5E0A3] font-medium border border-[#D4AF37]/30"
                            : "text-[#8A8F9E] hover:bg-[#141624] hover:text-[#E5C185]"
                        }`}
                        onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: t.id } })}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MessageSquare className="h-3 w-3 shrink-0 text-[#6C7180] group-hover/thread:text-[#D4AF37]" />
                          <span className="truncate max-w-[130px] text-[11px]">{t.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteThread(e, t.id, t.title)}
                          className="opacity-0 group-hover/thread:opacity-100 p-0.5 text-[#6C7180] hover:text-red-400 transition-opacity"
                          title="Delete chat"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Remaining Intelligence Items: Insights, Automations */}
              {intelligenceItems.slice(1).map((item) => {
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
