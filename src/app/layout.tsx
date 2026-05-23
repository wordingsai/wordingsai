import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/global.css";
import { ViewTransitions } from "next-view-transitions";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstrumentationClient } from "@/instrumentation-client";
import { ChatWidget } from "@/components/ChatWidget";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s - WordingsAI",
    default: "WordingsAI",
  },
  description:
    "WordingsAI is an advanced AI-powered platform for contract analysis, risk assessment, and document management. Streamline your contract workflows with intelligent clause extraction and automated compliance checks.",
  openGraph: {
    title: "WordingsAI",
    description:
      "Advanced AI-powered contract analysis and management platform.",
    url: "https://wordings.ai",
    siteName: "WordingsAI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WordingsAI",
    description:
      "Advanced AI-powered contract analysis and management platform.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <InstrumentationClient />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <ViewTransitions>
            <TooltipProvider>{children}</TooltipProvider>
            {/* <ChatWidget /> */}
          </ViewTransitions>
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
