import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/terms-of-service")({
  component: TermsOfService,
});

function TermsOfService() {
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
            <FileText className="h-3.5 w-3.5 text-[#B8860B] dark:text-[#D4AF37]" />
            User Agreement
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif text-[#18181B] dark:text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#8A8F9E]">
            Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-white dark:bg-[#090A10] border border-[#E4E1D8] dark:border-[#1F2336] shadow-xl dark:shadow-none space-y-6 text-sm text-[#27272A] dark:text-[#D1D5DB] leading-relaxed">
          <p>
            Please read these terms of service ("Terms", "Terms of Service") carefully before using the <strong>Coach Ziri</strong> platform (operated by <strong>Okikes Enterprises</strong>, "us", "we", or "our").
          </p>

          <h2 className="text-xl font-bold text-[#18181B] dark:text-white pt-4">1. Acceptance of Terms</h2>
          <p>
            By accessing or creating an account on our platform, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the Service.
          </p>

          <h2 className="text-xl font-bold text-[#18181B] dark:text-white pt-4">2. Description of Service</h2>
          <p>
            Coach Ziri provides AI-powered task prioritization, voice-enabled assistant coaching, Google Calendar &amp; Gmail integrations, focus time defense, and automated productivity tracking.
          </p>

          <h2 className="text-xl font-bold text-[#18181B] dark:text-white pt-4">3. Google API Integration &amp; Permissions</h2>
          <p>
            Our Service provides optional integrations with Google Workspace APIs. By authorizing Google Workspace connections:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm text-[#52525B] dark:text-[#A0A5B5]">
            <li>You grant Coach Ziri permission to access your Google account data strictly as described in our <Link to="/privacy-policy" className="text-[#B8860B] dark:text-[#D4AF37] underline font-medium">Privacy Policy</Link>.</li>
            <li>You acknowledge that our access adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-[#B8860B] dark:text-[#D4AF37] underline font-medium">Google API Services User Data Policy</a>.</li>
            <li>You can revoke access at any time through your in-app Settings or Google Account security controls.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#18181B] dark:text-white pt-4">4. Intellectual Property</h2>
          <p>
            The Coach Ziri application, including AI orchestration models, algorithms, branding, and interfaces, remains the exclusive property of Okikes Enterprises and its licensors.
          </p>

          <h2 className="text-xl font-bold text-[#18181B] dark:text-white pt-4">5. Contact &amp; Support</h2>
          <p>
            If you have questions regarding these Terms, please contact us at:{" "}
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
