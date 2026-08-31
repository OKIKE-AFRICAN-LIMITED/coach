import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="h-screen w-screen overflow-y-auto overflow-x-hidden bg-[#F7F6F2] dark:bg-[#050507] text-[#18181B] dark:text-[#F3F4F6] font-sans selection:bg-[#D4AF37]/30 selection:text-[#B8860B] dark:selection:text-[#F5E0A3] flex flex-col justify-between transition-colors duration-300">
      
      {/* Background Subtle Radial Ambient Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[50%] -translate-x-1/2 w-[70vw] h-[40vh] rounded-full bg-[#D4AF37]/10 dark:bg-[#D4AF37]/5 blur-[160px]" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-50 w-full px-6 lg:px-16 py-6 flex items-center justify-between max-w-7xl mx-auto border-b border-[#E4E1D8] dark:border-[#1F2336]/60">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Coach Ziri Logo"
            className="h-9 w-auto object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]"
          />
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button variant="ghost" asChild size="sm" className="text-xs font-semibold">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 space-y-8 flex-1 w-full">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-[#141624] border border-[#D4AF37]/30 text-[10px] font-bold text-[#B8860B] dark:text-[#E5C185] uppercase tracking-widest shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-[#B8860B] dark:text-[#D4AF37]" />
            Data Protection &amp; Sovereignty
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif text-[#18181B] dark:text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#8A8F9E]">
            Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-white dark:bg-[#090A10] border border-[#E4E1D8] dark:border-[#1F2336] shadow-xl dark:shadow-none space-y-6 text-sm text-[#27272A] dark:text-[#D1D5DB] leading-relaxed">
          <p>
            Welcome to <strong>Coach Ziri</strong> (operated by <strong>Okikes Enterprises</strong>, "we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our website, mobile interface, and AI coaching services.
          </p>

          {/* Highlighted Google Limited Use Disclosure for Google OAuth Verification */}
          <div className="my-6 p-6 border border-[#D4AF37]/40 bg-[#FAF8F5] dark:bg-[#141624]/60 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-[#B8860B] dark:text-[#F5E0A3] font-bold text-base">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#D4AF37]" />
              Google API Services User Data Policy &amp; Limited Use Disclosure
            </div>
            <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#A0A5B5] leading-relaxed">
              Coach Ziri's use and transfer to any other app of information received from Google APIs will strictly adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="text-[#B8860B] dark:text-[#D4AF37] font-semibold underline"
              >
                Google API Services User Data Policy
              </a>
              , including the <strong>Limited Use</strong> requirements.
            </p>
            <ul className="list-disc pl-5 text-xs sm:text-sm space-y-2 text-[#52525B] dark:text-[#C8CBD9]">
              <li>
                <strong>Google Calendar Access:</strong> We read, create, and organize calendar events strictly on your primary Google Calendar to defend your focus blocks and fulfill your direct voice or chat commands.
              </li>
              <li>
                <strong>Gmail Access:</strong> We read email summaries, headers, and draft/send replies strictly when you explicitly instruct Coach Ziri to process them.
              </li>
              <li>
                <strong>No Targeted Advertising:</strong> Your Google Workspace Data is never used for serving ads, marketing, or retargeting campaigns.
              </li>
              <li>
                <strong>No AI Model Training:</strong> Your Google User Data is strictly used to fulfill real-time user requests and is <strong>never</strong> used to train, retrain, or improve generalized AI/ML models.
              </li>
              <li>
                <strong>No Sale of Data:</strong> We never sell, rent, or distribute your private Google User Data to any third party.
              </li>
            </ul>
          </div>

          <h2 className="text-xl font-bold text-[#18181B] dark:text-white pt-4">1. Information We Collect</h2>
          <p>We collect information you provide directly to provide our services:</p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm text-[#52525B] dark:text-[#A0A5B5]">
            <li><strong>Account Credentials:</strong> Name, email address, profile avatar, and authentication identifiers.</li>
            <li><strong>Productivity Data:</strong> Tasks, priorities, habit trackers, goal milestones, and conversational AI session history.</li>
            <li><strong>Connected Integrations:</strong> OAuth access tokens for Google Calendar and Gmail when enabled.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#18181B] dark:text-white pt-4">2. Data Retention &amp; Revocation</h2>
          <p>
            OAuth refresh tokens are encrypted in our PostgreSQL database protected with Row-Level Security (RLS). You can revoke access at any time through your in-app Settings or via your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-[#B8860B] dark:text-[#D4AF37] underline font-medium"
            >
              Google Account Permissions
            </a>
            . Revoking access permanently terminates stored tokens.
          </p>

          <h2 className="text-xl font-bold text-[#18181B] dark:text-white pt-4">3. Security Standards</h2>
          <p>
            All network communication is encrypted using TLS 1.3/HTTPS. Database entries are secured using PostgreSQL Row-Level Security policies ensuring no cross-tenant data leakage.
          </p>

          <h2 className="text-xl font-bold text-[#18181B] dark:text-white pt-4">4. Contact &amp; Inquiries</h2>
          <p>
            If you have questions regarding this Privacy Policy or our security practices, contact us at:{" "}
            <strong className="text-[#B8860B] dark:text-[#E5C185]">okikeenterprises@gmail.com</strong>.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-[#E4E1D8] dark:border-[#1F2336]/60 py-6 px-6 lg:px-16 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#52525B] dark:text-[#6C7180]">
        <p>© 2026 Coach Ziri. All rights reserved.</p>
        <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-xl bg-white text-black shadow-sm border border-[#E4E1D8] dark:border-white/20">
          <span className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold">Powered by</span>
          <img src="/sponsor/Asset 41.png" alt="OKIKE" className="h-4 w-auto object-contain" />
        </div>
      </footer>

    </div>
  );
}
