"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STARTER_PROMPTS = [
  "What's my win rate this year?",
  "Any leads I haven't followed up on?",
  "How much revenue is outstanding?",
  "What are my top pizza flavors?",
  "Compare this July to last July",
];

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)]">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-2xl font-bold text-neutral-800">Chat</h1>
        <span className="text-xs text-neutral-400">Ask ad hoc questions about your leads, sales, and revenue</span>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-neutral-200 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
            <span className="w-10 h-10 rounded-full bg-crust/10 text-crust flex items-center justify-center">
              <Sparkles size={20} />
            </span>
            <p className="text-sm text-neutral-500 max-w-sm">
              Ask a question about your CRM data -- I&apos;ll pull real numbers from your leads and sales to answer.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 hover:border-crust/40 hover:text-crust transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span
              className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
                m.role === "user" ? "bg-neutral-200 text-neutral-600" : "bg-crust/10 text-crust"
              }`}
            >
              {m.role === "user" ? <User size={14} /> : <Sparkles size={14} />}
            </span>
            <div
              className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-crust text-white" : "bg-neutral-100 text-neutral-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <span className="w-7 h-7 shrink-0 rounded-full bg-crust/10 text-crust flex items-center justify-center">
              <Sparkles size={14} />
            </span>
            <div className="bg-neutral-100 rounded-xl px-3.5 py-2.5 text-sm text-neutral-400">Thinking...</div>
          </div>
        )}

        {error && (
          <div className="bg-sauce/10 text-sauce text-sm rounded-xl px-3.5 py-2.5">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask about your leads, sales, or revenue..."
          className="flex-1 resize-none rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-crust/30 focus:border-crust/40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-10 h-10 shrink-0 rounded-xl bg-crust text-white flex items-center justify-center disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
