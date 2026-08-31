import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "motion/react";
import { 
  Play, 
  Pause,
  Volume2,
  VolumeX,
  Network, 
  Clock, 
  TrendingUp,
  Bot,
  Calendar,
  Sparkles,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"voice" | "day" | "auto" | "insights">("voice");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

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
    <div className="h-screen w-screen overflow-y-auto overflow-x-hidden bg-[#F7F6F2] dark:bg-[#050507] text-[#18181B] dark:text-[#F3F4F6] font-sans selection:bg-[#D4AF37]/30 selection:text-[#B8860B] dark:selection:text-[#F5E0A3] relative flex flex-col justify-between transition-colors duration-300">
      
      {/* Background Subtle Radial Ambient Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[50%] -translate-x-1/2 w-[70vw] h-[40vh] rounded-full bg-[#D4AF37]/10 dark:bg-[#D4AF37]/5 blur-[160px]" />
        <div className="absolute top-[45%] right-[-10%] w-[50vw] h-[40vh] rounded-full bg-[#B8860B]/8 dark:bg-[#B8860B]/4 blur-[180px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[50vw] h-[40vh] rounded-full bg-[#D4AF37]/8 dark:bg-[#D4AF37]/4 blur-[180px]" />
      </div>

      {/* ─── 1. TOP NAVIGATION BAR ────────────────────────────────────────── */}
      <header className="relative z-50 w-full px-6 lg:px-16 pt-6 pb-4 flex items-center justify-between max-w-7xl mx-auto bg-transparent border-0">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/logo.png"
            alt="Coach Ziri Logo"
            className="h-10 w-auto object-contain drop-shadow-[0_0_18px_rgba(212,175,55,0.4)] group-hover:scale-105 transition-transform"
          />
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-[#52525B] dark:text-[#A0A5B5] tracking-wider">
          <a href="#features" className="hover:text-[#B8860B] dark:hover:text-[#F5E0A3] transition-colors">Features</a>
          <a href="#intelligence" className="hover:text-[#B8860B] dark:hover:text-[#F5E0A3] transition-colors">Intelligence</a>
          <a href="#capabilities" className="hover:text-[#B8860B] dark:hover:text-[#F5E0A3] transition-colors">Capabilities</a>
          <a href="#security" className="hover:text-[#B8860B] dark:hover:text-[#F5E0A3] transition-colors">Security</a>
        </nav>

        {/* Right Auth Actions & Theme Toggle */}
        <div className="flex items-center gap-4 sm:gap-5">
          <ThemeToggle />
          <Link
            to="/auth"
            className="text-xs font-medium text-[#52525B] dark:text-[#A0A5B5] hover:text-[#18181B] dark:hover:text-white transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/auth"
            className="px-4 py-1.5 rounded-lg border border-[#D4AF37]/40 bg-white/80 dark:bg-[#0F111A]/80 text-[#B8860B] dark:text-[#F5E0A3] text-xs font-semibold hover:border-[#D4AF37] hover:bg-[#D4AF37]/15 transition-all shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ─── 2. MAIN HERO & SHOWCASE SECTION ──────────────────────────────── */}
      <main className="relative z-10 px-4 sm:px-6 lg:px-8 pt-8 pb-16 max-w-6xl mx-auto w-full flex-1 flex flex-col justify-center">
        
        {/* Hero Headings */}
        <div className="text-center space-y-4 max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-6xl md:text-7xl font-serif tracking-tight text-[#18181B] dark:text-white leading-[1.08]"
          >
            Lead with Clarity.<br />
            Automate your Daily Tasks.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[11px] sm:text-xs uppercase tracking-[0.2em] font-sans font-semibold text-[#52525B] dark:text-[#8A8F9E] max-w-2xl mx-auto"
          >
            COACH ZIRI. The premium AI SaaS for streamlined operations.
          </motion.p>

          {/* Primary Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="pt-2 flex justify-center"
          >
            <Link
              to="/auth"
              className="px-8 py-2.5 rounded-xl bg-gradient-to-b from-[#E6C670] via-[#D4AF37] to-[#A07C18] text-[#050507] font-bold text-xs tracking-wider uppercase shadow-[0_0_30px_rgba(212,175,55,0.35)] hover:scale-105 hover:shadow-[0_0_45px_rgba(212,175,55,0.5)] transition-all border border-[#FFF0B3]/40"
            >
              Get Started
            </Link>
          </motion.div>
        </div>

        {/* ─── 3. BRAND FILM SHOWCASE FRAME (WITH HOME.MP4 VIDEO) ──────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="relative mt-10 w-full rounded-2xl p-[1px] bg-gradient-to-b from-[#D4AF37]/60 via-[#D4AF37]/20 to-[#E4E1D8] dark:to-[#1F2336]/50 shadow-[0_25px_70px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden group"
        >
          {/* Subtle Top Gold Horizon Beam */}
          <div className="absolute top-0 inset-x-16 h-[2px] bg-gradient-to-r from-transparent via-[#FFF1B5] to-transparent blur-[1px] z-20" />

          <div className="relative rounded-2xl bg-black overflow-hidden flex items-center justify-center aspect-video sm:max-h-[520px] w-full">
            {/* HTML5 Video */}
            <video
              ref={videoRef}
              src="/home.mp4"
              poster="/brand-film-showcase.jpg"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full h-full object-cover cursor-pointer"
              onClick={togglePlay}
            />

            {/* Ambient vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

            {/* Video Controls Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 flex items-center justify-between z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/20 hover:bg-[#D4AF37] backdrop-blur-md border border-white/30 hover:border-[#D4AF37] flex items-center justify-center text-white hover:text-black transition-all shadow-lg cursor-pointer"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm cursor-pointer"
                  aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-[#F5E0A3]" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] sm:text-xs font-sans tracking-wide text-white/90 font-semibold drop-shadow-md">
                  [ Brand Film: The Future of Automation ]
                </span>
              </div>
            </div>

            {/* Center Big Play Button when paused */}
            {!isPlaying && (
              <div 
                onClick={togglePlay}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer"
              >
                <div className="h-20 w-20 rounded-full bg-[#D4AF37]/90 text-black border border-[#FFF0B3] flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.6)] hover:scale-110 transition-transform">
                  <Play className="h-8 w-8 fill-black ml-1" />
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── 4. THREE FEATURE CARDS ROW ─────────────────────────────────── */}
        <motion.div
          id="features"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-6 w-full"
        >
          {/* Card 1: Neural Organization */}
          <div className="bg-white dark:bg-[#0B0D16]/90 border border-[#E4E1D8] dark:border-[#1F2336] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D4AF37]/40 transition-all shadow-md dark:shadow-xl group">
            <div className="h-14 w-14 rounded-xl bg-[#FAF8F5] dark:bg-[#141624] border border-[#D4AF37]/30 flex items-center justify-center shrink-0 shadow-inner group-hover:border-[#D4AF37]/60 group-hover:bg-[#F5E0A3]/20 dark:group-hover:bg-[#1A1810] transition-all">
              <Network className="h-7 w-7 text-[#B8860B] dark:text-[#D4AF37]" />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-bold text-[#18181B] dark:text-white group-hover:text-[#B8860B] dark:group-hover:text-[#F5E0A3] transition-colors">
                Neural Organization
              </h3>
              <p className="text-xs text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                Intelligently structure and connect your business data.
              </p>
            </div>
          </div>

          {/* Card 2: Automated Tasks */}
          <div className="bg-white dark:bg-[#0B0D16]/90 border border-[#E4E1D8] dark:border-[#1F2336] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D4AF37]/40 transition-all shadow-md dark:shadow-xl group">
            <div className="h-14 w-14 rounded-xl bg-[#FAF8F5] dark:bg-[#141624] border border-[#D4AF37]/30 flex items-center justify-center shrink-0 shadow-inner group-hover:border-[#D4AF37]/60 group-hover:bg-[#F5E0A3]/20 dark:group-hover:bg-[#1A1810] transition-all">
              <Clock className="h-7 w-7 text-[#B8860B] dark:text-[#D4AF37]" />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-bold text-[#18181B] dark:text-white group-hover:text-[#B8860B] dark:group-hover:text-[#F5E0A3] transition-colors">
                Automated Tasks
              </h3>
              <p className="text-xs text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                Delegate repetitive workflows to smart automation engines.
              </p>
            </div>
          </div>

          {/* Card 3: AI Insights */}
          <div className="bg-white dark:bg-[#0B0D16]/90 border border-[#E4E1D8] dark:border-[#1F2336] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-[#D4AF37]/40 transition-all shadow-md dark:shadow-xl group">
            <div className="h-14 w-14 rounded-xl bg-[#FAF8F5] dark:bg-[#141624] border border-[#D4AF37]/30 flex items-center justify-center shrink-0 shadow-inner group-hover:border-[#D4AF37]/60 group-hover:bg-[#F5E0A3]/20 dark:group-hover:bg-[#1A1810] transition-all">
              <TrendingUp className="h-7 w-7 text-[#B8860B] dark:text-[#D4AF37]" />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-bold text-[#18181B] dark:text-white group-hover:text-[#B8860B] dark:group-hover:text-[#F5E0A3] transition-colors">
                AI Insights
              </h3>
              <p className="text-xs text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                Unlock predictive analysis and strategic foresight.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ─── 5. SECTION: THE AI INTELLIGENCE ARCHITECTURE ───────────────── */}
        <section id="intelligence" className="mt-28 space-y-12 w-full">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-[#141624] border border-[#D4AF37]/30 text-[11px] font-bold text-[#B8860B] dark:text-[#E5C185] uppercase tracking-widest shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#B8860B] dark:text-[#D4AF37]" />
              Continuous Intelligence Engine
            </div>
            <h2 className="text-3xl sm:text-5xl font-serif text-[#18181B] dark:text-white tracking-tight">
              How Coach Ziri Elevates Your Velocity
            </h2>
            <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
              Moving beyond static task management. Coach Ziri executes a closed-loop intelligence cycle that understands context, defends focus time, and completes actions autonomously.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#090A10] border border-[#E4E1D8] dark:border-[#1F2336] space-y-4 hover:border-[#D4AF37]/40 transition-all relative overflow-hidden shadow-md dark:shadow-none group">
              <div className="text-3xl font-serif font-bold text-[#D4AF37]/40 group-hover:text-[#B8860B] dark:group-hover:text-[#D4AF37] transition-colors">01</div>
              <h3 className="text-base font-bold text-[#18181B] dark:text-white">Continuous Workspace Ingestion</h3>
              <p className="text-xs text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                Seamless bi-directional sync with Google Calendar, Gmail, task backlogs, and daily habit routines to establish single-source ground truth.
              </p>
              <div className="pt-2 flex items-center gap-2 text-[11px] text-[#B8860B] dark:text-[#E5C185] font-semibold">
                <Calendar className="h-3.5 w-3.5" /> Two-Way Sync Active
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#090A10] border border-[#E4E1D8] dark:border-[#1F2336] space-y-4 hover:border-[#D4AF37]/40 transition-all relative overflow-hidden shadow-md dark:shadow-none group">
              <div className="text-3xl font-serif font-bold text-[#D4AF37]/40 group-hover:text-[#B8860B] dark:group-hover:text-[#D4AF37] transition-colors">02</div>
              <h3 className="text-base font-bold text-[#18181B] dark:text-white">Dynamic Cognitive Prioritization</h3>
              <p className="text-xs text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                Algorithmic urgency modeling that factors in cognitive load, deadline proximity, and meeting congestion to calculate optimal execution order.
              </p>
              <div className="pt-2 flex items-center gap-2 text-[11px] text-[#B8860B] dark:text-[#E5C185] font-semibold">
                <SlidersHorizontal className="h-3.5 w-3.5" /> 92% Focus Score Target
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#090A10] border border-[#E4E1D8] dark:border-[#1F2336] space-y-4 hover:border-[#D4AF37]/40 transition-all relative overflow-hidden shadow-md dark:shadow-none group">
              <div className="text-3xl font-serif font-bold text-[#D4AF37]/40 group-hover:text-[#B8860B] dark:group-hover:text-[#D4AF37] transition-colors">03</div>
              <h3 className="text-base font-bold text-[#18181B] dark:text-white">Voice & Tool Autonomous Action</h3>
              <p className="text-xs text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                Hands-free voice coach powered by Gemini 3 Flash. Ziri dispatches calendar blocks, creates high-priority tasks, and performs real-time research.
              </p>
              <div className="pt-2 flex items-center gap-2 text-[11px] text-[#B8860B] dark:text-[#E5C185] font-semibold">
                <Bot className="h-3.5 w-3.5" /> Gemini 3 Ultra-Low Latency
              </div>
            </div>
          </div>
        </section>

        {/* ─── 6. SECTION: CORE CAPABILITY PILLARS ─────────────────────────── */}
        <section id="capabilities" className="mt-28 space-y-10 w-full">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-[#B8860B] dark:text-[#D4AF37]">
              ENTERPRISE-GRADE CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-5xl font-serif text-[#18181B] dark:text-white tracking-tight">
              An All-in-One Command Center
            </h2>
          </div>

          {/* Interactive Feature Tabs */}
          <div className="flex justify-center gap-2 flex-wrap">
            {[
              { id: "voice", label: "Voice AI Coach", icon: Bot },
              { id: "day", label: "My Day & Focus Defense", icon: Clock },
              { id: "auto", label: "Automations Engine", icon: Zap },
              { id: "insights", label: "Telemetry & Insights", icon: TrendingUp },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                    : "bg-white dark:bg-[#0E101A] border border-[#E4E1D8] dark:border-[#1F2336] text-[#52525B] dark:text-[#A0A5B5] hover:text-[#18181B] dark:hover:text-white hover:border-[#D4AF37]/30 shadow-sm"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content Display Card */}
          <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-[#090A10] border border-[#E4E1D8] dark:border-[#1F2336] relative overflow-hidden shadow-xl dark:shadow-2xl">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />

            {activeTab === "voice" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="text-[11px] font-mono text-[#B8860B] dark:text-[#D4AF37] uppercase tracking-widest font-semibold">Natural Voice Telephony</span>
                  <h3 className="text-2xl sm:text-3xl font-serif text-[#18181B] dark:text-white">Speak Naturally. Coach Ziri Executes.</h3>
                  <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                    Tired of manual typing and complex menus? Start a hands-free conversational voice session with Coach Ziri. Get your morning briefing aloud while driving, preparing for meetings, or planning your day.
                  </p>
                  <ul className="space-y-2 pt-2 text-xs text-[#27272A] dark:text-[#C8CBD9]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Low latency speech-to-speech with natural vocal pacing
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Tool dispatching for instant task and schedule updates
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Real-time waveform audio equalizer visualizer
                    </li>
                  </ul>
                </div>
                <div className="p-6 rounded-xl bg-[#F7F6F2] dark:bg-[#050507] border border-[#E4E1D8] dark:border-[#1F2336] space-y-4 font-mono text-xs shadow-inner">
                  <div className="flex items-center justify-between border-b border-[#E4E1D8] dark:border-[#1F2336] pb-3 text-[#52525B] dark:text-[#8A8F9E]">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> LIVE AUDIO STREAM
                    </span>
                    <span>GEMINI-3-FLASH</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-[#0F111A] text-[#B8860B] dark:text-[#F5E0A3] border border-[#D4AF37]/30 shadow-sm">
                    "Good morning. You have 3 high priorities today and a 90-minute focus window at 2 PM. Would you like me to reserve it?"
                  </div>
                  <div className="flex justify-end">
                    <div className="p-3 rounded-lg bg-white dark:bg-[#141624] text-[#18181B] dark:text-white border border-[#E4E1D8] dark:border-[#1F2336] max-w-[80%] shadow-sm">
                      "Yes Ziri, lock that focus block and schedule the project review for 4 PM."
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "day" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="text-[11px] font-mono text-[#B8860B] dark:text-[#D4AF37] uppercase tracking-widest font-semibold">Time Defense & Focus Orchestration</span>
                  <h3 className="text-2xl sm:text-3xl font-serif text-[#18181B] dark:text-white">Defend Your Peak Cognitive Windows</h3>
                  <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                    Most productivity apps just list tasks. Coach Ziri actively protects your calendar from meeting bloat, identifies fragmented time slots, and creates uninterrupted deep-work sessions.
                  </p>
                  <ul className="space-y-2 pt-2 text-xs text-[#27272A] dark:text-[#C8CBD9]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Automated morning briefing and evening recap
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Proactive conflict resolution before meetings collide
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Habit streaks tied directly to calendar milestones
                    </li>
                  </ul>
                </div>
                <div className="p-6 rounded-xl bg-[#F7F6F2] dark:bg-[#050507] border border-[#E4E1D8] dark:border-[#1F2336] space-y-3 text-xs shadow-inner">
                  <div className="flex items-center justify-between text-xs font-bold text-[#18181B] dark:text-white pb-2 border-b border-[#E4E1D8] dark:border-[#1F2336]">
                    <span>MY DAY ORCHESTRATION</span>
                    <span className="text-[#B8860B] dark:text-[#D4AF37]">92% FOCUS RATING</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-[#141624] border border-[#D4AF37]/40 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="font-semibold text-[#18181B] dark:text-white">Deep Work: Architecture Design</p>
                      <p className="text-[10px] text-[#52525B] dark:text-[#8A8F9E]">09:00 AM – 10:30 AM (90 mins)</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">COMPLETED</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-[#0F111A] border border-[#E4E1D8] dark:border-[#1F2336] flex items-center justify-between shadow-sm">
                    <div>
                      <p className="font-semibold text-[#18181B] dark:text-white">Executive Stakeholder Sync</p>
                      <p className="text-[10px] text-[#52525B] dark:text-[#8A8F9E]">11:00 AM – 11:45 AM (Google Meet)</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">NEXT UP</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "auto" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="text-[11px] font-mono text-[#B8860B] dark:text-[#D4AF37] uppercase tracking-widest font-semibold">Trigger-Action Automation Engine</span>
                  <h3 className="text-2xl sm:text-3xl font-serif text-[#18181B] dark:text-white">Automate Repetitive Routines</h3>
                  <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                    Create event-driven workflows that eliminate manual maintenance. When deadlines shift or priorities emerge, Coach Ziri triggers actions across your workspace automatically.
                  </p>
                  <ul className="space-y-2 pt-2 text-xs text-[#27272A] dark:text-[#C8CBD9]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Auto-reschedule neglected tasks to next available focus block
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Morning email digest synthesizers with high-priority flagging
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Habit check-in reminders based on location and time triggers
                    </li>
                  </ul>
                </div>
                <div className="p-6 rounded-xl bg-[#F7F6F2] dark:bg-[#050507] border border-[#E4E1D8] dark:border-[#1F2336] space-y-3 text-xs shadow-inner">
                  <div className="text-xs font-bold text-[#18181B] dark:text-white pb-2 border-b border-[#E4E1D8] dark:border-[#1F2336]">ACTIVE WORKFLOW RULES</div>
                  <div className="p-3 rounded-lg bg-white dark:bg-[#141624] border border-[#E4E1D8] dark:border-[#1F2336] space-y-1 shadow-sm">
                    <p className="font-semibold text-[#B8860B] dark:text-[#E5C185]">Auto-Reschedule Overdue Tasks</p>
                    <p className="text-[11px] text-[#52525B] dark:text-[#8A8F9E]">Trigger: Task overdue &gt; 24h → Action: Move to tomorrow's focus window</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-[#141624] border border-[#E4E1D8] dark:border-[#1F2336] space-y-1 shadow-sm">
                    <p className="font-semibold text-[#B8860B] dark:text-[#E5C185]">Google Calendar Buffer Defense</p>
                    <p className="text-[11px] text-[#52525B] dark:text-[#8A8F9E]">Trigger: Back-to-back meetings → Action: Insert 15min cognitive buffer</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "insights" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <span className="text-[11px] font-mono text-[#B8860B] dark:text-[#D4AF37] uppercase tracking-widest font-semibold">Predictive Productivity Analytics</span>
                  <h3 className="text-2xl sm:text-3xl font-serif text-[#18181B] dark:text-white">Actionable Insights, Not Vanity Charts</h3>
                  <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                    Track your cognitive throughput over time. Coach Ziri analyzes task completion velocity, energy depletion patterns, and goal achievement rates to give you strategic foresight.
                  </p>
                  <ul className="space-y-2 pt-2 text-xs text-[#27272A] dark:text-[#C8CBD9]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Weekly Velocity &amp; Task Completion Ratios
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Goal milestone progress tracking with predictive ETAs
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#B8860B] dark:text-[#D4AF37]" /> Peak performance hour identification for deep work
                    </li>
                  </ul>
                </div>
                <div className="p-6 rounded-xl bg-[#F7F6F2] dark:bg-[#050507] border border-[#E4E1D8] dark:border-[#1F2336] space-y-4 text-xs shadow-inner">
                  <div className="flex items-center justify-between text-xs font-bold text-[#18181B] dark:text-white pb-2 border-b border-[#E4E1D8] dark:border-[#1F2336]">
                    <span>WEEKLY PERFORMANCE MATRIX</span>
                    <span className="text-emerald-600 dark:text-emerald-400">+14% EFFICIENCY</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 rounded-lg bg-white dark:bg-[#0F111A] border border-[#E4E1D8] dark:border-[#1F2336] shadow-sm">
                      <span className="text-[10px] text-[#52525B] dark:text-[#8A8F9E] block">FOCUS TIME</span>
                      <span className="text-lg font-bold text-[#18181B] dark:text-white">24.5 hrs</span>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-[#0F111A] border border-[#E4E1D8] dark:border-[#1F2336] shadow-sm">
                      <span className="text-[10px] text-[#52525B] dark:text-[#8A8F9E] block">TASKS DONE</span>
                      <span className="text-lg font-bold text-[#B8860B] dark:text-[#E5C185]">48</span>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-[#0F111A] border border-[#E4E1D8] dark:border-[#1F2336] shadow-sm">
                      <span className="text-[10px] text-[#52525B] dark:text-[#8A8F9E] block">GOAL ON-TRACK</span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">100%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>

        {/* ─── 7. SECTION: ENTERPRISE SECURITY & PRIVACY ──────────────────── */}
        <section id="security" className="mt-28 p-8 sm:p-12 rounded-2xl bg-white dark:bg-[#090A10] border border-[#E4E1D8] dark:border-[#1F2336] relative overflow-hidden shadow-xl dark:shadow-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF8F5] dark:bg-[#141624] border border-[#D4AF37]/30 text-[10px] font-bold text-[#B8860B] dark:text-[#E5C185] uppercase tracking-widest shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-[#B8860B] dark:text-[#D4AF37]" />
                Zero Compromise Security
              </div>
              <h2 className="text-2xl sm:text-4xl font-serif text-[#18181B] dark:text-white tracking-tight">
                Enterprise Privacy &amp; Encrypted Sovereignty
              </h2>
              <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#8A8F9E] leading-relaxed">
                Your private workspace data, personal calendar schedules, and AI conversations are protected with enterprise-grade encryption. Your personal data is never used to train public models.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                <div className="flex items-center gap-2 text-[#27272A] dark:text-[#C8CBD9]">
                  <Lock className="h-3.5 w-3.5 text-[#B8860B] dark:text-[#D4AF37]" /> AES-256 Row-Level Security
                </div>
                <div className="flex items-center gap-2 text-[#27272A] dark:text-[#C8CBD9]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#B8860B] dark:text-[#D4AF37]" /> OAuth 2.0 Google Verified
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-[#F7F6F2] dark:bg-[#050507] border border-[#E4E1D8] dark:border-[#1F2336] space-y-3 font-mono text-xs shadow-inner">
              <div className="text-[#52525B] dark:text-[#8A8F9E] flex items-center justify-between border-b border-[#E4E1D8] dark:border-[#1F2336] pb-2">
                <span>SECURITY PROTOCOLS</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">ACTIVE &amp; VERIFIED</span>
              </div>
              <p className="text-[#27272A] dark:text-[#A0A5B5] leading-relaxed">
                ✓ Supabase PostgreSQL with Row Level Security (RLS)<br />
                ✓ End-to-End OAuth Token Refresh Storage<br />
                ✓ Sandboxed Gemini 3 API Architecture<br />
                ✓ Zero Third-Party Telemetry Leaks
              </p>
            </div>
          </div>
        </section>

        {/* ─── 8. FINAL CALL TO ACTION ────────────────────────────────────── */}
        <section className="mt-28 py-16 px-6 text-center space-y-6 max-w-4xl mx-auto rounded-3xl bg-white dark:bg-[#090A10] border border-[#D4AF37]/35 shadow-[0_15px_45px_rgba(0,0,0,0.06)] dark:shadow-[0_0_50px_rgba(212,175,55,0.15)] relative overflow-hidden transition-colors">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          
          <h2 className="text-3xl sm:text-5xl font-serif text-[#18181B] dark:text-white tracking-tight">
            Step Into The Future of AI Productivity.
          </h2>
          <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#8A8F9E] max-w-xl mx-auto leading-relaxed">
            Join visionary executives and high-performers operating at peak cognitive velocity with Coach Ziri.
          </p>
          <div className="pt-2 flex justify-center">
            <Link
              to="/auth"
              className="px-10 py-3 rounded-xl bg-gradient-to-b from-[#E6C670] via-[#D4AF37] to-[#A07C18] text-[#050507] font-bold text-xs tracking-wider uppercase shadow-[0_0_35px_rgba(212,175,55,0.4)] hover:scale-105 transition-all flex items-center gap-2 border border-[#FFF0B3]/40"
            >
              <span>Launch Command Center</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

      </main>

      {/* ─── 9. LUXURY FOOTER WITH POWERED BY OKIKE ──────────────────────── */}
      <footer className="relative z-10 w-full border-t border-[#E4E1D8] dark:border-[#1F2336]/60 pt-12 pb-8 px-6 lg:px-16 max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Brand */}
          <div className="space-y-3 md:col-span-2">
            <img
              src="/logo.png"
              alt="Coach Ziri Logo"
              className="h-9 w-auto object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]"
            />
            <p className="text-xs text-[#52525B] dark:text-[#8A8F9E] max-w-sm leading-relaxed">
              Coach Ziri is an AI-powered personal productivity and intelligence platform designed to understand, prioritize, and orchestrate high-performance operations.
            </p>
          </div>

          {/* Col 2: Platform Links */}
          <div className="space-y-2 text-xs">
            <p className="font-bold text-[#18181B] dark:text-white uppercase tracking-wider text-[10px]">Platform</p>
            <ul className="space-y-1.5 text-[#52525B] dark:text-[#8A8F9E]">
              <li><Link to="/auth" className="hover:text-[#B8860B] dark:hover:text-[#D4AF37] transition-colors">Command Center</Link></li>
              <li><Link to="/auth" className="hover:text-[#B8860B] dark:hover:text-[#D4AF37] transition-colors">AI Voice Coach</Link></li>
              <li><Link to="/auth" className="hover:text-[#B8860B] dark:hover:text-[#D4AF37] transition-colors">My Day Orchestrator</Link></li>
              <li><Link to="/auth" className="hover:text-[#B8860B] dark:hover:text-[#D4AF37] transition-colors">Automations Engine</Link></li>
              <li><Link to="/auth" className="hover:text-[#B8860B] dark:hover:text-[#D4AF37] transition-colors">Telemetry &amp; Insights</Link></li>
            </ul>
          </div>

          {/* Col 3: Legal, Security & Contact */}
          <div className="space-y-2 text-xs">
            <p className="font-bold text-[#18181B] dark:text-white uppercase tracking-wider text-[10px]">Legal &amp; Security</p>
            <ul className="space-y-1.5 text-[#52525B] dark:text-[#8A8F9E]">
              <li><Link to="/privacy-policy" className="hover:text-[#B8860B] dark:hover:text-[#D4AF37] transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-[#B8860B] dark:hover:text-[#D4AF37] transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-[#B8860B] dark:hover:text-[#D4AF37] transition-colors">Google Limited Use</Link></li>
              <li><a href="mailto:okikeenterprises@gmail.com" className="hover:text-[#B8860B] dark:hover:text-[#D4AF37] transition-colors">Contact Support</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Row with Powered by OKIKE */}
        <div className="border-t border-[#E4E1D8] dark:border-[#1F2336]/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#52525B] dark:text-[#6C7180]">
          <p>© 2026 Coach Ziri. All rights reserved.</p>

          {/* Powered by OKIKE Sponsor Emblem */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-white text-black shadow-md border border-[#E4E1D8] dark:border-white/20">
              <span className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold">
                Powered by
              </span>
              <img
                src="/sponsor/Asset 41.png"
                alt="OKIKE"
                className="h-4 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
