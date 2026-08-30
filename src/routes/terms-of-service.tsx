import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/terms-of-service")({
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-6 lg:px-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <Button variant="ghost" asChild className="-ml-4 mb-4">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
        </Button>
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p>
            Please read these terms of service ("Terms", "Terms of Service") carefully before using the Okikes Coach application (the "Service") operated by Okikes Enterprises ("us", "we", or "our").
          </p>

          <h2 className="text-2xl font-bold mt-8">1. Acceptance of Terms</h2>
          <p>
            By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of the terms then you may not access the Service.
          </p>

          <h2 className="text-2xl font-bold mt-8">2. Description of Service</h2>
          <p>
            Okikes Coach is an AI-powered personal task management and productivity application. We provide tools to help users organize tasks, track daily habits, manage schedules via Google Calendar integration, interact with Gmail, and converse with an intelligent AI coach.
          </p>

          <h2 className="text-2xl font-bold mt-8">3. Accounts & Security</h2>
          <p>
            When you create an account with us, you must provide accurate and complete information. You are responsible for safeguarding your credentials and for all activities that occur under your account.
          </p>

          <h2 className="text-2xl font-bold mt-8">4. Google API Integration & Permissions</h2>
          <p>
            Our Service allows optional integration with Google APIs (Gmail and Google Calendar). By authorizing this integration:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You grant Okikes Coach permission to access your Google account data strictly as described in our <Link to="/privacy-policy" className="text-primary underline font-medium">Privacy Policy</Link>.</li>
            <li>You acknowledge that our access is subject to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-primary underline">Google API Services User Data Policy</a>.</li>
            <li>You can revoke access at any time through your in-app Settings or your Google Account security settings.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8">5. User Conduct & Acceptable Use</h2>
          <p>
            You agree not to misuse the Service, send spam via email integrations, perform automated scraping, or attempt unauthorized access to other users' accounts or data.
          </p>

          <h2 className="text-2xl font-bold mt-8">6. Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are and will remain the exclusive property of Okikes Enterprises and its licensors.
          </p>

          <h2 className="text-2xl font-bold mt-8">7. Limitation of Liability</h2>
          <p>
            In no event shall Okikes Enterprises, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages resulting from your access to or use of or inability to access or use the Service.
          </p>

          <h2 className="text-2xl font-bold mt-8">8. Changes to Terms</h2>
          <p>
            We reserve the right to modify or replace these Terms at any time. Continued use of the Service following changes constitutes acceptance of the new Terms.
          </p>

          <h2 className="text-2xl font-bold mt-8">9. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at: <strong>okikeenterprises@gmail.com</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
