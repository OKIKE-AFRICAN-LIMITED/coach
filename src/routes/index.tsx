import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { 
  Bot, 
  Calendar, 
  Mail, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });

    // Listen for auth state changes (catches OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        if (session.provider_refresh_token) {
          await supabase.rpc('set_google_refresh_token', { 
            token: session.provider_refresh_token 
          });
        }
        navigate({ to: "/dashboard", replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#050507] text-[#F3F4F6] font-sans overflow-hidden selection:bg-[#D4AF37]/30 selection:text-[#F5E0A3] relative">
      
      {/* Dynamic Gold Background Ambient Lighting */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[60%] h-[50%] rounded-full bg-[#D4AF37]/5 blur-[180px]" />
        <div className="absolute bottom-[-20%] right-[10%] w-[50%] h-[50%] rounded-full bg-[#B8860B]/5 blur-[160px]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 h-16 border-b border-[#1F2336] bg-[#0A0C14]/80 backdrop-blur-xl z-50 px-6 lg:px-12 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Coach Ziri Logo" className="h-9 w-auto object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]" />
        </div>
        <div className="flex items-center gap-6 text-xs font-semibold">
          <a href="#how-it-works" className="text-[#8A8F9E] hover:text-white transition-colors hidden sm:block">
            How it works
          </a>
          <a href="#features" className="text-[#8A8F9E] hover:text-white transition-colors hidden sm:block">
            Features
          </a>
          <Link to="/auth" className="text-[#8A8F9E] hover:text-white transition-colors">
            Sign In
          </Link>
          <Button asChild size="sm" className="rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold px-5 py-2 hover:scale-105 transition-all">
            <Link to="/auth">Get Started</Link>
          </Button>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="relative pt-36 pb-20 lg:pt-48 lg:pb-32 px-4 flex flex-col items-center text-center max-w-5xl mx-auto">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0F111A] border border-[#D4AF37]/30 shadow-md text-xs font-bold mb-8 text-[#E5C185]"
          >
            <Sparkles className="h-4 w-4 text-[#D4AF37]" />
            <span className="uppercase tracking-widest">2026 AI Productivity Intelligence</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] text-white"
          >
            Your personal AI coach that <br className="hidden sm:inline" />
            <span className="text-[#E5C185]">understands, prioritizes, and executes.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-base sm:text-lg text-[#8A8F9E] max-w-2xl font-normal leading-relaxed"
          >
            Coach Ziri coordinates your tasks, calendar, emails, and focus goals in one intelligent 2026 SaaS command center.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Button asChild size="lg" className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#050507] font-bold text-sm px-8 py-3.5 shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-105 transition-all">
              <Link to="/auth">
                Enter Command Center
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </section>

        {/* Feature Cards Grid */}
        <section id="features" className="py-20 px-6 max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-[#D4AF37]">INTELLIGENCE LAYER</span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Built for High Performers</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-6 space-y-3 hover:border-[#D4AF37]/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">AI Coach & Briefing</h3>
              <p className="text-xs text-[#8A8F9E] leading-relaxed">
                Daily natural language briefings that summarize priorities, focus blocks, and meeting agendas automatically.
              </p>
            </div>

            <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-6 space-y-3 hover:border-[#D4AF37]/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Google Workspace Sync</h3>
              <p className="text-xs text-[#8A8F9E] leading-relaxed">
                Seamless OAuth integration with Google Calendar and Gmail to manage meetings and unread email digests.
              </p>
            </div>

            <div className="bg-[#0F111A] border border-[#1F2336] rounded-xl p-6 space-y-3 hover:border-[#D4AF37]/40 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Proactive Recommendations</h3>
              <p className="text-xs text-[#8A8F9E] leading-relaxed">
                Coach Ziri detects neglected goals and scheduling conflicts to proactively recommend focus sessions.
              </p>
            </div>

          </div>
        </section>

      </main>

      <footer className="border-t border-[#1F2336] py-8 text-center text-xs text-[#8A8F9E]">
        <p>© {new Date().getFullYear()} Coach Ziri. Premium AI Intelligence Platform.</p>
      </footer>
    </div>
  );
}
