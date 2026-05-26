"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, Bot, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import { authClient } from "@/lib/auth-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { type: string; heading: string }[];
}

export const ChatWidget: React.FC = () => {
  const { data: session } = authClient.useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [filter, setFilter] = useState("all");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!session) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          session_id: sessionId,
          filters: { source_type: filter },
        }),
      });

      if (!response.ok) throw new Error("Failed to connect to assistant");

      const assistantMessageId = uuidv4();
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "").trim();
              if (dataStr === "[DONE]") continue;

              try {
                const data = JSON.parse(dataStr);
                if (data.token) {
                  fullContent += data.token;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: fullContent }
                        : msg,
                    ),
                  );
                } else if (data.sources) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, sources: data.sources }
                        : msg,
                    ),
                  );
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "assistant",
          content:
            "I encountered an error. Please check your API keys or try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
              scale: 0.9,
              transformOrigin: "bottom right",
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 flex h-[600px] max-h-[80vh] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl transition-colors duration-300 dark:bg-card/90"
          >
            {/* Header */}
            <div className="relative flex items-center justify-between bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-5 text-primary-foreground shadow-lg">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    Contract Assistant
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      Online
                    </span>
                  </div>
                </div>
              </div>
              <div className="relative flex items-center gap-2">
                <Select
                  value={filter}
                  onValueChange={(val) => setFilter(val ?? "all")}
                >
                  <SelectTrigger className="h-8 w-[100px] border-none bg-white/10 text-[10px] font-bold text-white hover:bg-white/20 focus:ring-0">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="library">Library</SelectItem>
                    <SelectItem value="contract">Contracts</SelectItem>
                    <SelectItem value="rule">Rules</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-2 transition-all hover:bg-white/10 hover:rotate-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto bg-transparent p-5 scrollbar-thin scrollbar-thumb-primary/20"
            >
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center space-y-6 text-center">
                  <div className="relative">
                    <div className="absolute -inset-4 rounded-full bg-primary/10 blur-xl animate-pulse"></div>
                    <div className="relative rounded-full bg-primary/5 p-8 ring-1 ring-primary/10">
                      <Sparkles className="h-12 w-12 text-primary/40" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-bold tracking-tight text-foreground">
                      How can I assist you?
                    </p>
                    <p className="mx-auto max-w-[240px] text-xs font-medium leading-relaxed text-muted-foreground/80">
                      I can help you analyze clauses, compare contracts, or
                      verify compliance rules.
                    </p>
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-6 flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-4 text-sm shadow-sm transition-all ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none shadow-primary/20"
                        : "bg-muted/50 border border-border/40 text-foreground rounded-bl-none dark:bg-secondary/40"
                    }`}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 first:prose-p:mt-0 last:prose-p:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 border-t border-border/30 pt-3">
                        <p className="mb-2 text-[9px] font-semibold uppercase tracking-tighter text-muted-foreground/60">
                          Sources
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((s, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary ring-1 ring-inset ring-primary/20 transition-colors hover:bg-primary/20"
                            >
                              {s.type}: {s.heading}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-3 rounded-2xl bg-muted/40 border border-border/30 px-5 py-3 text-xs font-medium text-muted-foreground shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Analyzing Wordings...
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border/30 bg-card/80 p-5 backdrop-blur-md">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-3 rounded-2xl bg-background/50 p-1.5 pr-2.5 ring-1 ring-border/50 transition-all focus-within:ring-2 focus-within:ring-primary/40 dark:bg-secondary/20"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your assistant..."
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm font-medium outline-none placeholder:text-muted-foreground/40"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </form>
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="h-px w-8 bg-border/40"></div>
                <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
                  Wordings AI Precision
                </p>
                <div className="h-px w-8 bg-border/40"></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-2xl transition-all duration-300 ${
          isOpen
            ? "bg-card text-foreground ring-1 ring-border rotate-90"
            : "bg-primary text-primary-foreground shadow-primary/40"
        }`}
      >
        {isOpen ? (
          <X className="h-8 w-8" />
        ) : (
          <MessageSquare className="h-8 w-8" />
        )}
      </motion.button>
    </div>
  );
};
