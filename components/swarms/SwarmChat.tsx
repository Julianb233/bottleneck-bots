"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  agentName?: string;
  agentId?: string;
  timestamp: string;
  type?: "text" | "task" | "result" | "error";
}

interface SwarmChatProps {
  swarmId: string;
  messages: Message[];
  onSendMessage: (message: string, targetAgentId?: string) => Promise<void>;
  agents?: { id: string; name: string; status: string }[];
  isLoading?: boolean;
}

export default function SwarmChat({
  swarmId,
  messages,
  onSendMessage,
  agents = [],
  isLoading = false,
}: SwarmChatProps) {
  const [input, setInput] = useState("");
  const [targetAgent, setTargetAgent] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(input.trim(), targetAgent || undefined);
      setInput("");
      setTargetAgent(null);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getMessageStyle = (message: Message) => {
    if (message.role === "user") {
      return "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30 ml-12";
    }
    if (message.role === "system") {
      return "bg-zinc-800/50 border-zinc-700/50 mx-8 text-center";
    }
    if (message.type === "error") {
      return "bg-red-500/10 border-red-500/30 mr-12";
    }
    if (message.type === "result") {
      return "bg-green-500/10 border-green-500/30 mr-12";
    }
    return "bg-zinc-800/50 border-zinc-700/50 mr-12";
  };

  return (
    <div className="glass-card flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">Swarm Chat</h3>
            <p className="text-xs text-zinc-400">{agents.filter(a => a.status === "active").length} agents active</p>
          </div>
        </div>

        {/* Agent filter */}
        {agents.length > 0 && (
          <select
            value={targetAgent || ""}
            onChange={(e) => setTargetAgent(e.target.value || null)}
            className="glass px-3 py-2 rounded-lg text-sm text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="" className="bg-zinc-900">All Agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id} className="bg-zinc-900">
                {agent.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">💬</div>
            <h4 className="text-lg font-medium text-white mb-2">Start the Conversation</h4>
            <p className="text-zinc-400 text-sm max-w-sm">
              Send a message to your agents. They'll work together to complete your tasks.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`${getMessageStyle(message)} p-4 rounded-xl border`}>
              {/* Message header */}
              {message.role !== "system" && (
                <div className="flex items-center gap-2 mb-2">
                  {message.role === "agent" && (
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs">
                      🤖
                    </span>
                  )}
                  {message.role === "user" && (
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs">
                      👤
                    </span>
                  )}
                  <span className="text-sm font-medium text-white">
                    {message.role === "user" ? "You" : message.agentName || "Agent"}
                  </span>
                  <span className="text-xs text-zinc-500">{message.timestamp}</span>
                  {message.type && message.type !== "text" && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        message.type === "task"
                          ? "bg-blue-500/20 text-blue-400"
                          : message.type === "result"
                          ? "bg-green-500/20 text-green-400"
                          : message.type === "error"
                          ? "bg-red-500/20 text-red-400"
                          : ""
                      }`}
                    >
                      {message.type}
                    </span>
                  )}
                </div>
              )}

              {/* Message content */}
              <div className={`text-sm ${message.role === "system" ? "text-zinc-400 italic" : "text-zinc-200"}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-3 p-4 glass rounded-xl mr-12">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-sm text-zinc-400">Agents are thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        {targetAgent && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-400">Sending to:</span>
            <span className="text-xs px-2 py-1 glass rounded-full text-cyan-400">
              {agents.find((a) => a.id === targetAgent)?.name}
            </span>
            <button
              onClick={() => setTargetAgent(null)}
              className="text-xs text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message to your agents..."
            rows={1}
            className="flex-1 px-4 py-3 glass rounded-xl text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="px-6 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
          >
            {isSending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
