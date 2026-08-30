import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getGoogleIntegrationStatus, disconnectGoogleIntegration } from "@/lib/google.functions";
import { Mail, Calendar, CheckCircle2, XCircle, ShieldCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
  }, []);

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
      new Notification("Coach is ready", { body: "I'll nudge you about tasks here." });
    }
  }

  async function connectGoogle() {
    setConnecting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/settings`,
          scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate Google sign-in");
      setConnecting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage profile, integrations, and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal identification in Coach.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Google Workspace Integration
              </CardTitle>
              <CardDescription className="mt-1">
                Connect your Gmail & Google Calendar to allow AI task management, schedule syncing, and email digests.
              </CardDescription>
            </div>
            {statusLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : googleStatus?.connected ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
                <XCircle className="h-3.5 w-3.5" /> Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2.5 p-3 rounded-lg border bg-card/50">
              <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
              <div>
                <p className="font-medium text-xs">Google Calendar</p>
                <p className="text-[11px] text-muted-foreground">List, schedule & manage meetings</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-lg border bg-card/50">
              <Mail className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="font-medium text-xs">Gmail Inbox</p>
                <p className="text-[11px] text-muted-foreground">Search emails & send responses</p>
              </div>
            </div>
          </div>

          {googleStatus?.connected ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Authorized OAuth 2.0 connection
                </span>
                {googleStatus.updatedAt && (
                  <span>Connected {format(new Date(googleStatus.updatedAt), "MMM d, yyyy")}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={connectGoogle} disabled={connecting} size="sm">
                  {connecting ? "Reconnecting..." : "Reconnect Account"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect Google Account"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <Button onClick={connectGoogle} disabled={connecting} className="gap-2">
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Connect Google Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Configure reminders and nudge preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Daily nudge time</Label>
            <Input type="time" value={pushTime} onChange={(e) => setPushTime(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              While Coach is open in this browser, you'll get a notification at this time with your day's summary.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div>
              <Label>Browser notifications</Label>
              <p className="text-xs text-muted-foreground">Permission: {pushPerm}</p>
            </div>
            <Button variant="outline" onClick={requestPush} disabled={pushPerm === "granted"}>
              {pushPerm === "granted" ? "Enabled" : "Enable"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Email reminders</Label>
              <p className="text-xs text-muted-foreground">Daily task digest sent directly to your connected email inbox.</p>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
    </div>
  );
}
