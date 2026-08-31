import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, toggleUserAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ShieldOff, Search, Loader2, Users, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const getListUsersFn = useServerFn(listUsers);
  const toggleAdminFn = useServerFn(toggleUserAdmin);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getListUsersFn(),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: (userId: string) => toggleAdminFn({ data: { userId } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(res.newStatus ? "User promoted to admin" : "Admin privileges revoked");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update user role");
    },
  });

  const filteredUsers = users?.filter((u) =>
    (u.display_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.id.includes(searchTerm))
  ) || [];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-[#1F2336]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="h-6 w-6 text-[#D4AF37]" />
            User Control & Permissions
          </h1>
          <p className="text-xs text-[#8A8F9E] mt-0.5">Manage user access levels and administrative privileges across the platform.</p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A8F9E]" />
          <Input
            placeholder="Search by name or user ID..."
            className="pl-9 bg-[#0F111A] border-[#1F2336] text-xs text-white placeholder:text-[#6C7180] focus:border-[#D4AF37]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 shadow-xl space-y-4">
        
        <div className="flex items-center justify-between border-b border-[#1F2336] pb-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">REGISTERED PLATFORM ACCOUNTS</h2>
          <span className="text-[11px] font-mono text-[#D4AF37]">{filteredUsers.length} users listed</span>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-xs text-[#8A8F9E] space-y-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
            <p>Loading user directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8A8F9E]">
            No users found matching your search.
          </div>
        ) : (
          <div className="rounded-xl border border-[#1F2336] overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#141624] border-b border-[#1F2336] text-[#8A8F9E]">
                <tr>
                  <th className="px-4 py-3 font-semibold">User Name</th>
                  <th className="px-4 py-3 font-semibold">User ID</th>
                  <th className="px-4 py-3 font-semibold">Joined Date</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2336]">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#141624]/60 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-white">
                      {user.display_name || "Member User"}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[#8A8F9E]">
                      {user.id}
                    </td>
                    <td className="px-4 py-3.5 text-[#D1D5DB]">
                      {format(new Date(user.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3.5">
                      {user.is_admin ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#E5C185] border border-[#D4AF37]/30 text-[10px] font-extrabold uppercase tracking-wider">
                          Admin
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#141624] text-[#8A8F9E] border border-[#1F2336] text-[10px] font-semibold uppercase tracking-wider">
                          User
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Are you sure you want to ${user.is_admin ? 'revoke' : 'grant'} admin privileges for ${user.display_name || 'this user'}?`)) {
                            toggleAdminMutation.mutate(user.id);
                          }
                        }}
                        disabled={toggleAdminMutation.isPending && toggleAdminMutation.variables === user.id}
                        className="rounded-xl hover:bg-[#1C2030] text-xs font-semibold"
                      >
                        {user.is_admin ? (
                          <span className="text-rose-400 flex items-center gap-1.5">
                            <ShieldOff className="h-3.5 w-3.5" /> Revoke Admin
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5" /> Make Admin
                          </span>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
