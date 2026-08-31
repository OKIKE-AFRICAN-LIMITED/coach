import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats } from "@/lib/admin.functions";
import { Users, Activity, CheckCircle, MessageSquare, ShieldAlert, Cpu, Server, Database, Lock, Loader2, UserCheck, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const getStatsFn = useServerFn(getAdminStats);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getStatsFn(),
  });

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-xs text-[#8A8F9E] space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
        <p>Initializing Admin Control Center Telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
        <ShieldAlert className="h-12 w-12 text-rose-500" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-xs text-[#8A8F9E]">
          You do not have administrative clearance to access this control node.
        </p>
      </div>
    );
  }

  const completionPct = data.total_tasks > 0 ? Math.round((data.completed_tasks / data.total_tasks) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="pb-4 border-b border-[#1F2336] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#D4AF37]" />
            System Telemetry & Platform Overview
          </h1>
          <p className="text-xs text-[#8A8F9E] mt-0.5">Real-time stats, user activity throughput, and database state.</p>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Total Registered Users"
          value={data.total_users}
          subtitle={`+${data.new_users_7d} new in last 7 days`}
          icon={<Users className="h-4 w-4 text-[#D4AF37]" />}
        />
        <AdminStatCard
          title="System Tasks Tracked"
          value={data.total_tasks}
          subtitle={`${data.completed_tasks} completed (${completionPct}%)`}
          icon={<Activity className="h-4 w-4 text-amber-400" />}
        />
        <AdminStatCard
          title="AI Coach Interactions"
          value={data.total_chat_messages}
          subtitle="Total prompts & completions"
          icon={<MessageSquare className="h-4 w-4 text-emerald-400" />}
        />
        <AdminStatCard
          title="Task Execution Rate"
          value={`${completionPct}%`}
          subtitle="System-wide completion velocity"
          icon={<CheckCircle className="h-4 w-4 text-[#E5C185]" />}
        />
      </div>

      {/* Platform Services & Recent Users Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Platform Services Status (5 cols) */}
        <div className="lg:col-span-5 bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
            <h2 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-[#D4AF37]" />
              Platform Infrastructure Status
            </h2>
            <span className="text-[10px] text-[#8A8F9E] font-mono">Live</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#141624] border border-[#1F2336]">
              <div className="flex items-center gap-2.5">
                <Database className="h-4 w-4 text-[#D4AF37]" />
                <div>
                  <p className="font-semibold text-white">Supabase PostgreSQL</p>
                  <p className="text-[10px] text-[#8A8F9E]">RLS Policies Active</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                Healthy
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#141624] border border-[#1F2336]">
              <div className="flex items-center gap-2.5">
                <Lock className="h-4 w-4 text-amber-400" />
                <div>
                  <p className="font-semibold text-white">Google OAuth 2.0 API</p>
                  <p className="text-[10px] text-[#8A8F9E]">Calendar & Gmail Scopes</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#141624] border border-[#1F2336]">
              <div className="flex items-center gap-2.5">
                <Cpu className="h-4 w-4 text-[#E5C185]" />
                <div>
                  <p className="font-semibold text-white">Coach Ziri AI Engine</p>
                  <p className="text-[10px] text-[#8A8F9E]">Voice & Text Synthesizer</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                Operational
              </span>
            </div>
          </div>
        </div>

        {/* Right: Recent Registrations (7 cols) */}
        <div className="lg:col-span-7 bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
            <h2 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-[#D4AF37]" />
              Recent User Registrations
            </h2>
            <span className="text-[10px] text-[#8A8F9E] font-mono">{data.recent_users.length} accounts</span>
          </div>

          {data.recent_users.length === 0 ? (
            <p className="text-xs text-[#8A8F9E] py-8 text-center">No recent user registrations found.</p>
          ) : (
            <div className="space-y-2.5">
              {data.recent_users.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-[#141624] border border-[#1F2336] hover:border-[#D4AF37]/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{u.display_name || "Member"}</p>
                    <p className="text-[10px] font-mono text-[#8A8F9E] truncate">ID: {u.id}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-[10px] text-[#8A8F9E]">
                      {format(new Date(u.created_at), "MMM d, yyyy")}
                    </span>

                    {u.is_admin ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#E5C185] border border-[#D4AF37]/30 text-[9px] font-extrabold uppercase">
                        Admin
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#1F2336] text-[#8A8F9E] text-[9px] font-semibold uppercase">
                        User
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

function AdminStatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 space-y-2 shadow-xl hover:border-[#D4AF37]/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#8A8F9E] font-medium">{title}</span>
        <div className="h-7 w-7 rounded-lg bg-[#141624] border border-[#1F2336] flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <p className="text-[11px] text-[#8A8F9E] pt-1 border-t border-[#1F2336]">{subtitle}</p>
    </div>
  );
}
