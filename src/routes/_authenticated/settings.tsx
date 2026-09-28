import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getGoogleIntegrationStatus, disconnectGoogleIntegration } from "@/lib/google.functions";
import { Mail, Calendar, CheckCircle2, XCircle, ShieldCheck, Loader2, Settings, User, Bell } from "lucide-react";
import { format } from "date-fns";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const getStatusFn = useServerFn(getGoogleIntegrationStatus);
  const disconnectFn = useServerFn(disconnectGoogleIntegration);

  const [displayName, setDisplayName] = useState("");
  const [pushTime, setPushTime] = useState("08:00");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [pushPerm, setPushPerm] = useState<NotificationPermission>("default");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const { data: googleStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["googleIntegrationStatus"],
    queryFn: () => getStatusFn(),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => disconnectFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["googleIntegrationStatus"] });
      qc.invalidateQueries({ queryKey: ["upcomingEvents"] });
      qc.invalidateQueries({ queryKey: ["recentEmails"] });
      toast.success("Google Workspace disconnected");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to disconnect Google Workspace");
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      if (prof) {
        setDisplayName(prof.display_name ?? "");
        setPushTime(prof.push_time);
        setEmailEnabled(prof.email_enabled);
      }
    });
    if (typeof Notification !== "undefined") setPushPerm(Notification.permission);

    // Handle redirect back from Google OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "1") {
      qc.invalidateQueries({ queryKey: ["googleIntegrationStatus"] });
      qc.invalidateQueries({ queryKey: ["upcomingEvents"] });
      qc.invalidateQueries({ queryKey: ["recentEmails"] });
      toast.success("Google Workspace connected — Ziri can now access Gmail & Calendar");
      // Clean up the query param
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("google_warning") === "no_refresh_token") {
      toast.warning("Connected but no refresh token received. Try disconnecting and reconnecting to force a new consent screen.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("google_error")) {
      toast.error(`Google connection failed: ${params.get("google_error")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [qc]);

  async function save() {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: u.user.id, display_name: displayName, push_time: pushTime, email_enabled: emailEnabled });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  }

  async function requestPush() {
    if (typeof Notification === "undefined") {
      toast.error("Notifications not supported in this browser");
      return;
    }
    const p = await Notification.requestPermission();
    setPushPerm(p);
    if (p === "granted") {
      new Notification("Coach Ziri is ready", { body: "I'll nudge you about tasks here." });
    }
  }

  async function connectGoogle() {
    setConnecting(true);
    try {
      // Get the current user's session token to pass in state so the callback
      // can identify which user to save the refresh token for
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.access_token ?? "";

      const clientId = GOOGLE_CLIENT_ID ?? import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        toast.error("Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to .env");
        setConnecting(false);
        return;
      }

      const state = btoa(JSON.stringify({
        token: userToken,
        redirect: `${window.location.origin}/settings`,
      }));

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${window.location.origin}/api/google-callback`,
        response_type: "code",
        scope: [
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/userinfo.email",
        ].join(" "),
        access_type: "offline",
        prompt: "consent",
        state,
      });

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate Google sign-in");
      setConnecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3]">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="pb-6 border-b border-[#1F2336]">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Settings className="h-6 w-6 text-[#D4AF37]" />
            Settings & Preferences
          </h1>
          <p className="text-sm text-[#8A8F9E] mt-1">Manage profile, integrations, and AI nudge preferences.</p>
        </div>

        {/* Profile Card */}
        <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#1F2336] pb-3">
            <User className="h-4 w-4 text-[#D4AF37]" />
            <span>Profile Identity</span>
          </div>

          <div className="space-y-1.5 max-w-md">
            <Label className="text-xs text-[#A0A5B5]">Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Ziri"
              className="bg-[#141624] border-[#1F2336] text-xs text-white"
            />
          </div>
        </div>

        {/* Google Workspace Card */}
        <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2336] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
                Google Workspace Integration
              </h2>
              <p className="text-xs text-[#8A8F9E] mt-0.5">
                Connect Gmail & Google Calendar for automated schedule syncing and email digests.
              </p>
            </div>

            {statusLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
            ) : googleStatus?.connected ? (
              <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </div>
            ) : (
              <div className="px-2.5 py-0.5 rounded-full bg-[#1F2336] text-[#8A8F9E] text-[10px] font-semibold flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Not Connected
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#141624] border border-[#1F2336]">
              <Calendar className="h-4 w-4 text-[#D4AF37] shrink-0" />
              <div>
                <p className="font-semibold text-white">Google Calendar</p>
                <p className="text-[11px] text-[#8A8F9E]">Auto sync meetings & focus blocks</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#141624] border border-[#1F2336]">
              <Mail className="h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">Gmail Inbox</p>
                <p className="text-[11px] text-[#8A8F9E]">Digest unread priority threads</p>
              </div>
            </div>
          </div>

          {googleStatus?.connected ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs text-[#8A8F9E] bg-[#141624] p-3 rounded-xl border border-[#1F2336]">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <ShieldCheck className="h-4 w-4" /> Authorized OAuth 2.0 connection
                </span>
                {googleStatus.updatedAt && (
                  <span>Connected {format(new Date(googleStatus.updatedAt), "MMM d, yyyy")}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={connectGoogle}
                  disabled={connecting}
                  size="sm"
                  className="rounded-xl bg-[#141624] border border-[#D4AF37]/30 text-[#E5C185] hover:bg-[#1E2236] text-xs"
                >
                  {connecting ? "Reconnecting..." : "Reconnect Account"}
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="rounded-xl text-xs"
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect Google Account"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <Button onClick={connectGoogle} disabled={connecting} className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs">
                {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Mail className="h-3.5 w-3.5 mr-1.5" />}
                Connect Google Account
              </Button>
            </div>
          )}
        </div>

        {/* Notifications Card */}
        <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#1F2336] pb-3">
            <Bell className="h-4 w-4 text-[#D4AF37]" />
            <span>Notifications & AI Nudge</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5 max-w-md">
              <Label className="text-xs text-[#A0A5B5]">Daily Nudge Time</Label>
              <Input
                type="time"
                value={pushTime}
                onChange={(e) => setPushTime(e.target.value)}
                className="bg-[#141624] border-[#1F2336] text-xs text-white"
              />
              <p className="text-[11px] text-[#8A8F9E]">
                Coach Ziri will deliver your priority briefing at this time.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#1F2336]">
              <div>
                <Label className="text-xs text-white font-medium">Browser Notifications</Label>
                <p className="text-[11px] text-[#8A8F9E]">Permission status: {pushPerm}</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={requestPush}
                disabled={pushPerm === "granted"}
                className="rounded-xl border-[#1F2336] text-xs text-[#E5C185]"
              >
                {pushPerm === "granted" ? "Enabled" : "Enable"}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#1F2336]">
              <div>
                <Label className="text-xs text-white font-medium">Email Reminders</Label>
                <p className="text-[11px] text-[#8A8F9E]">Daily priority digest delivered to your inbox.</p>
              </div>

              <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-xs px-6 py-2.5 hover:scale-105 transition-all"
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>

      </div>
    </div>
  );
}
