"use client";

import { useState } from "react";

interface BrowserSession {
  id: string;
  agentId: string;
  agentName: string;
  url: string;
  status: "active" | "completed" | "error";
  screenshot?: string;
  startedAt: string;
  lastActivity?: string;
}

interface BrowserSessionViewerProps {
  sessions: BrowserSession[];
  onRefreshSession?: (sessionId: string) => Promise<void>;
  onEndSession?: (sessionId: string) => Promise<void>;
  onViewRecording?: (sessionId: string) => void;
}

export default function BrowserSessionViewer({
  sessions,
  onRefreshSession,
  onEndSession,
  onViewRecording,
}: BrowserSessionViewerProps) {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);

  const handleRefresh = async (sessionId: string) => {
    setIsRefreshing(sessionId);
    try {
      await onRefreshSession?.(sessionId);
    } finally {
      setIsRefreshing(null);
    }
  };

  const activeSession = sessions.find((s) => s.id === selectedSession);

  if (sessions.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No Browser Sessions</h3>
        <p className="text-zinc-400 text-sm">
          Spawn an agent with browser capabilities to see live sessions
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">Browser Sessions</h3>
            <p className="text-xs text-zinc-400">
              {sessions.filter((s) => s.status === "active").length} active via Browserbase
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-1 glass rounded-full text-xs text-cyan-400">
            Powered by Stagehand
          </span>
        </div>
      </div>

      {/* Session tabs */}
      <div className="flex overflow-x-auto border-b border-white/10">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setSelectedSession(session.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap transition-colors ${
              selectedSession === session.id
                ? "text-white bg-white/5 border-b-2 border-cyan-500"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                session.status === "active"
                  ? "bg-green-500 animate-pulse"
                  : session.status === "error"
                  ? "bg-red-500"
                  : "bg-zinc-500"
              }`}
            />
            {session.agentName}
          </button>
        ))}
      </div>

      {/* Session viewer */}
      {activeSession ? (
        <div className="p-4">
          {/* URL bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 flex items-center gap-2 px-4 py-2 glass rounded-lg">
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm text-zinc-300 truncate">{activeSession.url}</span>
            </div>
            <button
              onClick={() => handleRefresh(activeSession.id)}
              disabled={isRefreshing === activeSession.id}
              className="p-2 glass rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-zinc-400 ${isRefreshing === activeSession.id ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Screenshot area */}
          <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden mb-4">
            {activeSession.screenshot ? (
              <img
                src={activeSession.screenshot}
                alt="Browser session"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <svg className="w-12 h-12 text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-zinc-500 text-sm">No screenshot available</p>
                <p className="text-zinc-600 text-xs mt-1">Session is initializing...</p>
              </div>
            )}

            {/* Live indicator */}
            {activeSession.status === "active" && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 glass rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-medium text-white">LIVE</span>
              </div>
            )}
          </div>

          {/* Session info & actions */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-400">
              <span>Started: {activeSession.startedAt}</span>
              {activeSession.lastActivity && (
                <span className="ml-4">Last activity: {activeSession.lastActivity}</span>
              )}
            </div>

            <div className="flex gap-2">
              {onViewRecording && (
                <button
                  onClick={() => onViewRecording(activeSession.id)}
                  className="px-4 py-2 glass rounded-lg text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Recording
                </button>
              )}
              {activeSession.status === "active" && onEndSession && (
                <button
                  onClick={() => onEndSession(activeSession.id)}
                  className="px-4 py-2 glass rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  End Session
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center">
          <p className="text-zinc-400">Select a session to view</p>
        </div>
      )}
    </div>
  );
}
