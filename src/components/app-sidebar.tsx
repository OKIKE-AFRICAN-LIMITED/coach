import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, ListChecks, MessageCircle, Settings, LogOut, Plus, Trash2, ShieldCheck, Activity } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listThreads, createThread, deleteThread } from "@/lib/threads.functions";
import { toast } from "sonner";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Tasks", url: "/tasks", icon: ListChecks },
  { title: "Habits", url: "/habits", icon: Activity },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const del = useServerFn(deleteThread);

  const threadsQ = useQuery({ queryKey: ["threads"], queryFn: () => list() });

  const adminQ = useQuery({
    queryKey: ["is_admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      return data?.is_admin ?? false;
    }
  });

  const createM = useMutation({
    mutationFn: async () => create({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });
  const delM = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1">
          <img src="/logo.png" alt="Coach" width={28} height={28} className="h-7 w-7 object-contain" />
          <span className="font-semibold text-base group-data-[collapsible=icon]:hidden">Coach</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {adminQ.data && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"}>
                    <Link to="/admin" className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Chats</span>
            <button
              type="button"
              onClick={() => createM.mutate()}
              disabled={createM.isPending}
              className="p-1 rounded hover:bg-sidebar-accent disabled:opacity-50"
              aria-label="New chat"
            >
              {createM.isPending ? (
                <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-r-transparent" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {threadsQ.data?.length === 0 && (
                <p className="text-xs text-sidebar-foreground/60 px-2 py-1 group-data-[collapsible=icon]:hidden">
                  No chats yet
                </p>
              )}
              {threadsQ.data?.map((t) => {
                const active = pathname === `/chat/${t.id}`;
                return (
                  <SidebarMenuItem key={t.id}>
                    <div className="flex items-center w-full group/thread">
                      <SidebarMenuButton asChild isActive={active} className="flex-1">
                        <Link
                          to="/chat/$threadId"
                          params={{ threadId: t.id }}
                          className="flex items-center gap-2 min-w-0"
                        >
                          <MessageCircle className="h-4 w-4 shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <button
                        type="button"
                        aria-label="Delete chat"
                        onClick={() => {
                          if (confirm("Delete this chat?")) delM.mutate(t.id);
                        }}
                        className="opacity-0 group-hover/thread:opacity-100 p-1 mr-1 rounded hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:hidden"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start gap-2">
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
