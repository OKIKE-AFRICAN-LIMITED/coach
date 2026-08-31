import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Coach Ziri" },
      { name: "description", content: "Sign in to your Coach Ziri AI intelligence command center." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.provider_refresh_token) {
        await supabase.rpc('set_google_refresh_token', { 
          token: session.provider_refresh_token 
        });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Welcome to Coach Ziri!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    if (error) {
      toast.error(error.message ?? "Google sign-in failed");
      return;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050507] text-[#F3F4F6] px-4 font-sans selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3] relative overflow-hidden">
      
      {/* Background Ambient Radial Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-[160px] pointer-events-none" />

      <div className="w-full max-w-md p-8 space-y-6 bg-[#0F111A] border border-[#D4AF37]/25 rounded-2xl shadow-[0_0_60px_rgba(212,175,55,0.06)] relative z-10">
        
        <div className="flex flex-col items-center text-center space-y-3">
          <img src="/logo.png" alt="Coach Ziri Logo" className="h-12 w-auto object-contain mb-1 drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]" />
          <h1 className="text-xl font-bold tracking-tight text-white">
            {mode === "signin" ? "Welcome Back" : "Create Intelligence Portal Account"}
          </h1>
          <p className="text-xs text-[#8A8F9E] font-medium">
            Sign in to access your personal AI productivity command center.
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full rounded-xl border-[#1F2336] bg-[#141624] hover:bg-[#1E2236] hover:border-[#D4AF37]/40 text-xs font-semibold text-white py-2.5 flex items-center justify-center gap-2"
          onClick={google}
          type="button"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.4-.4-2.2s.2-1.5.4-2.2L1.9 7.5C.7 9.9 0 12.6 0 15.5s.7 5.6 1.9 8l3.7-2.9c-.8-1.7-1.3-3.7-1.3-5.8z" />
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#1F2336]" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
            <span className="bg-[#0F111A] px-3 text-[#6C7180] font-semibold">or with email</span>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-[#A0A5B5]">Email Address</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@company.com"
              className="bg-[#141624] border-[#1F2336] text-xs text-white placeholder:text-[#6C7180] focus:border-[#D4AF37]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-[#A0A5B5]">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-[#141624] border-[#1F2336] text-xs text-white placeholder:text-[#6C7180] focus:border-[#D4AF37]"
            />
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] text-xs font-bold py-2.5 hover:scale-[1.02] transition-all"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-xs text-[#8A8F9E]">
          {mode === "signin" ? "New to Coach Ziri?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="text-[#E5C185] hover:underline font-semibold ml-1"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create Account" : "Sign In"}
          </button>
        </p>

        <p className="text-center text-xs text-[#6C7180] pt-2">
          <Link to="/" className="hover:text-white flex items-center justify-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Return to Homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
