"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { ConversationSummary } from "@/storage/types";
import type { RunCouncilResult } from "@/core/types";
import { Markdown } from "./Markdown";

interface HistorySidebarProps {
  onLoad: (conversation: RunCouncilResult) => void;
  currentResultId: string | null;
}

export function HistorySidebar({ onLoad, currentResultId }: HistorySidebarProps) {
  const { data: session } = useSession();
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullConversation, setFullConversation] = useState<RunCouncilResult | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDeleteId(null);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const loadConversation = useCallback(async (id: string) => {
    if (loadingId) return;
    setLoadingId(id);
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data: RunCouncilResult = await res.json();
        setFullConversation(data);
        setExpandedId(id);
      }
    } catch {
      // silent
    } finally {
      setLoadingId(null);
      setLoading(false);
    }
  }, [loadingId]);

  const requestDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDeleteId(id);
  }, []);

  const confirmDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId) return;
    setDeletingId(id);
    setConfirmingDeleteId(null);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistory((prev) => prev.filter((c) => c.id !== id));
        if (expandedId === id) {
          setExpandedId(null);
          setFullConversation(null);
        }
      }
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, expandedId]);

  const cancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDeleteId(null);
  }, []);

  const exportJSON = useCallback((conversation: RunCouncilResult) => {
    const blob = new Blob([JSON.stringify(conversation, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `council-${conversation.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportMarkdown = useCallback((conversation: RunCouncilResult) => {
    const r = conversation.finalReport;
    const lines = [
      `# Council Analysis Report`,
      ``,
      `**Mode:** ${conversation.modeId}`,
      `**Date:** ${new Date(conversation.createdAt).toLocaleString()}`,
      `**ID:** ${conversation.id}`,
      ``,
      `## Input`,
      conversation.userInput,
      ``,
      `---`,
      ``,
      `## Agent Responses`,
      ``,
    ];
    for (const agent of conversation.agentResponses) {
      lines.push(`### ${agent.agentName}`);
      lines.push(agent.content);
      lines.push(``);
    }
    if (conversation.judgeResponse) {
      lines.push(`### Judge: ${conversation.judgeResponse.agentName}`);
      lines.push(conversation.judgeResponse.content);
      lines.push(``);
    }
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Final Report`);
    lines.push(``);
    lines.push(r.summary);
    lines.push(``);
    if (r.keyConclusions.length > 0) {
      lines.push(`### Key Conclusions`);
      r.keyConclusions.forEach((c) => lines.push(`- ${c}`));
      lines.push(``);
    }
    if (r.agreements.length > 0) {
      lines.push(`### Areas of Agreement`);
      r.agreements.forEach((a) => lines.push(`- ${a}`));
      lines.push(``);
    }
    if (r.disagreements.length > 0) {
      lines.push(`### Areas of Disagreement`);
      r.disagreements.forEach((d) => lines.push(`- ${d}`));
      lines.push(``);
    }
    if (r.risks.length > 0) {
      lines.push(`### Risks & Limitations`);
      r.risks.forEach((risk) => lines.push(`- ${risk}`));
      lines.push(``);
    }
    if (r.recommendations.length > 0) {
      lines.push(`### Recommendations`);
      r.recommendations.forEach((rec, i) => lines.push(`${i + 1}. ${rec}`));
      lines.push(``);
    }
    lines.push(`**Confidence:** ${r.confidence}/5`);

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `council-${conversation.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!session?.user) return null;

  return (
    <div ref={sidebarRef} className="relative">
      {/* Toggle button */}
      <button
        onClick={() => { setOpen(!open); setConfirmingDeleteId(null); if (!open) setRefreshKey((k) => k + 1); }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
        title="Saved sessions"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        History
        {history.length > 0 && (
          <span className="text-xs bg-zinc-700 px-1.5 py-0.5 rounded-full">{history.length}</span>
        )}
      </button>

      {/* Sidebar panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Saved Sessions</h3>
            <span className="text-xs text-zinc-500">Max 3 · Newest first</span>
          </div>

          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No saved sessions yet.
              <br />
              <span className="text-xs">Run a council analysis while logged in to save.</span>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-800">
              {history.map((conv) => (
                <div
                  key={conv.id}
                  className={`group ${expandedId === conv.id ? "bg-zinc-800/50" : ""}`}
                >
                  {/* Summary row */}
                  <div
                    className="px-4 py-3 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                    onClick={() => {
                      if (expandedId === conv.id) {
                        setExpandedId(null);
                        setFullConversation(null);
                      } else {
                        loadConversation(conv.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200 truncate">{conv.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {conv.modeId}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {new Date(conv.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {loadingId === conv.id && (
                          <span className="w-3 h-3 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                        )}
                        {confirmingDeleteId === conv.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => confirmDelete(conv.id, e)}
                              disabled={deletingId === conv.id}
                              className="px-1.5 py-0.5 text-[10px] font-medium bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
                              title="Confirm delete"
                            >
                              Delete?
                            </button>
                            <button
                              onClick={cancelDelete}
                              className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                              title="Cancel"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => requestDelete(conv.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-400 transition-all"
                            title="Delete session"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                        <span className="text-zinc-600 text-xs">
                          {expandedId === conv.id ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === conv.id && fullConversation && (
                    <div className="border-t border-zinc-800">
                      {/* Actions bar */}
                      <div className="px-4 py-2 flex items-center gap-2 border-b border-zinc-800/50">
                        <button
                          onClick={() => onLoad(fullConversation)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                          Load Session
                        </button>
                        <button
                          onClick={() => exportJSON(fullConversation)}
                          className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors text-zinc-300"
                          title="Export as JSON"
                        >
                          JSON
                        </button>
                        <button
                          onClick={() => exportMarkdown(fullConversation)}
                          className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors text-zinc-300"
                          title="Export as Markdown"
                        >
                          MD
                        </button>
                      </div>

                      {/* Conversation preview */}
                      <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
                        <div>
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Input</p>
                          <p className="text-xs text-zinc-400 line-clamp-3">{fullConversation.userInput}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                            Agents ({fullConversation.agentResponses.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {fullConversation.agentResponses.map((r) => (
                              <span key={r.agentId} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                {r.agentName}
                              </span>
                            ))}
                          </div>
                        </div>
                        {fullConversation.finalReport.summary && (
                          <div>
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Summary</p>
                            <div className="text-xs text-zinc-400 line-clamp-3">
                              <Markdown content={fullConversation.finalReport.summary} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
