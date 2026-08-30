import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-6 lg:px-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <Button variant="ghost" asChild className="-ml-4 mb-4">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
        </Button>
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p>
            Welcome to Okikes Coach ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.
            This Privacy Policy explains how we collect, use, and share your information when you use our website and application.
          </p>

          <h2 className="text-2xl font-bold mt-8">1. Information We Collect</h2>
          <p>We collect information that you provide to us directly, including:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account Information:</strong> When you register, we collect your name, email address, and authentication credentials.</li>
            <li><strong>Tasks and Chat Data:</strong> We store the tasks you create, your chat history with the AI assistant, and your notes to provide our service.</li>
            <li><strong>Google User Data:</strong> If you authorize Google Workspace Integrations, we securely access data via Google APIs (Gmail & Google Calendar) as detailed below.</li>
          </ul>

          {/* Highlighted Google Limited Use Disclosure for Google OAuth Verification */}
          <div className="my-8 p-6 border border-blue-500/30 bg-blue-500/5 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-lg">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              Google API Services User Data Policy & Limited Use Disclosure
            </div>
            <p className="text-sm">
              Okikes Coach's use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="text-primary font-medium underline"
              >
                Google API Services User Data Policy
              </a>
              , including the <strong>Limited Use</strong> requirements.
            </p>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>
                <strong>Calendar Access:</strong> We read, create, update, and delete calendar events strictly on your primary Google Calendar to help you manage your personal schedule and fulfill your direct chat commands.
              </li>
              <li>
                <strong>Gmail Access:</strong> We read email headers/snippets, full message threads, send emails, and reply to messages strictly when you explicitly instruct the AI assistant to perform these actions.
              </li>
              <li>
                <strong>No Targeted Advertising:</strong> Your Google User Data is never used for serving advertisements, marketing, or retargeting purposes.
              </li>
              <li>
                <strong>No AI Model Training:</strong> Your Google User Data is strictly used to fulfill real-time user requests and is <strong>never</strong> used to train, retrain, or improve generalized AI/ML models.
              </li>
              <li>
                <strong>No Sale of Data:</strong> We do not sell, transfer, or distribute your Google User Data to any third parties under any circumstances.
              </li>
            </ul>
          </div>

          <h2 className="text-2xl font-bold mt-8">2. Data Retention & Deletion</h2>
          <p>
            Your Google OAuth refresh tokens are stored securely in our encrypted database isolated via Row Level Security (RLS). We do not permanently store your email contents on our servers; email contents and calendar events are fetched in real-time on demand during active sessions.
          </p>
          <p>
            You can revoke Okikes Coach's access at any time directly through your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Google Account Permissions
            </a>{" "}
            or by clicking "Disconnect Google Account" in your in-app Settings. Revoking access immediately deletes our stored refresh tokens.
          </p>

          <h2 className="text-2xl font-bold mt-8">3. How We Use Your Information</h2>
          <p>We use your information strictly to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide, operate, and maintain our task management application.</li>
            <li>Process and execute direct commands you give the AI assistant (e.g. creating meetings, checking schedule availability, reading or sending emails).</li>
            <li>Send requested daily task digests and notifications.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8">4. Security of Your Information</h2>
          <p>
            We implement industry-standard technical and organizational security measures to protect your personal data. All data transmissions occur over encrypted HTTPS/TLS, and user data is strictly isolated using Supabase Row Level Security (RLS).
          </p>

          <h2 className="text-2xl font-bold mt-8">5. Contact Us</h2>
          <p>
            If you have questions or comments about this Privacy Policy or our Google data practices, please contact us at:{" "}
            <strong>okikeenterprises@gmail.com</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
