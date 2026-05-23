import React from "react";
import { ChatWidget } from "@/components/ChatWidget";
import { Bot, Info } from "lucide-react";

export const metadata = {
  title: "AI Chatbot",
  description: "Chat with WordingsAI to analyze contracts and clauses.",
};

export default function ChatbotPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Contract Analysis AI</h1>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-2xl text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-primary/10 p-6">
              <Bot className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h2 className="mb-4 text-3xl font-bold">
            Welcome to your Contract AI Assistant
          </h2>
          <p className="mb-8 text-muted-foreground">
            I can help you navigate through your library of clauses, analyze
            uploaded contracts, and verify compliance against your workspace
            rules.
          </p>

          <div className="grid gap-4 text-left sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">Clause Library</h3>
              <p className="text-sm text-muted-foreground">
                "Find standard exclusion clauses for cyber risks."
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">Contract Review</h3>
              <p className="text-sm text-muted-foreground">
                "Summarize the termination rights in the ACME contract."
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">Rule Verification</h3>
              <p className="text-sm text-muted-foreground">
                "Does the latest contract comply with our ESG guidelines?"
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold">Analytical Insights</h3>
              <p className="text-sm text-muted-foreground">
                "What are the most common favorability ratings in our library?"
              </p>
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <p>
              The AI Assistant is currently being recalibrated for better
              performance.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
