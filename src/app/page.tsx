"use client";

import { useState, useCallback } from "react";
import type {
  CouncilModeId,
  RunCouncilResult,
  AgentResponse,
  FinalReport,
} from "@/core/types";

const MODES: { id: CouncilModeId; name: string; description: string }[] = [
  {
    id: "decision",
    name: "Decision Council",
    description: "Analyze a decision from multiple perspectives",
  },
  {
    id: "idea",
    name: "Idea Council",
    description: "Evaluate an idea's potential and feasibility",
  },
  {
    id: "criticalReview",
    name: "Critical Review",
    description: "Review text, arguments, or proposals",
  },
  {
    id: "learning",
    name: "Learning Council",
    description: "Get educational explanations",
  },
  {
    id: "technical",
    name: "Technical Council",
    description: "Evaluate technical topics and architecture",
  },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<CouncilModeId>("decision");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunCouncilResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runAnalysis = useCallback(async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim(), mode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [input, mode]);

  const copyResult = useCallback(() => {
    if (!result) return;

    const report = result.finalReport;
    const text = [
      `# Council Analysis Report`,
      `**Mode:** ${result.modeId}`,
      `**Date:** ${new Date(result.createdAt).toLocaleString()}`,
      ``,
      `## Input`,
      result.userInput,
      ``,
      `## Summary`,
      report.summary,
      ``,
      `## Key Conclusions`,
      ...report.keyConclusions.map((c: string) => `- ${c}`),
      ``,
      `## Areas of Agreement`,
      ...report.agreements.map((a: string) => `- ${a}`),
      ``,
      `## Areas of Disagreement`,
      ...report.disagreements.map((d: string) => `- ${d}`),
      ``,
      `## Risks and Limitations`,
      ...report.risks.map((r: string) => `- ${r}`),
      ``,
      `## Recommendations`,
      ...report.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`),
      ``,
      `## Confidence Score: ${report.confidence}/5`,
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <span className="text-2xl">🏛️</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Multi-Agent LLM Council</h1>
            <p className="text-sm text-zinc-400">
              Multi-perspective analysis using specialized AI agents
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Input Section */}
          <section className="space-y-4">
            <div>
              <label htmlFor="council-input" className="block text-sm font-medium mb-2">
                Your Question, Problem, or Idea
              </label>
              <textarea
                id="council-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your question, problem, idea, or text for analysis..."
                className="w-full h-32 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    runAnalysis();
                  }
                }}
              />
            </div>

            {/* Mode Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Analysis Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`text-left px-4 py-3 rounded-lg border transition-all ${
                      mode === m.id
                        ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-medium text-sm">{m.name}</div>
                    <div className="text-xs text-zinc-400 mt-1">{m.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={runAnalysis}
              disabled={loading || !input.trim()}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Running Council Analysis...
                </span>
              ) : (
                "🏛️ Run Council Analysis"
              )}
            </button>
            <p className="text-xs text-zinc-500">
              Press Ctrl+Enter to run. Analysis may take 10-30 seconds.
            </p>
          </section>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-8">
              {/* Agent Responses */}
              <section>
                <h2 className="text-lg font-semibold mb-4">Individual Agent Responses</h2>
                <div className="grid gap-4">
                  {result.agentResponses.map((response: AgentResponse) => (
                    <AgentResponseCard key={response.agentId} response={response} />
                  ))}
                </div>
              </section>

              {/* Final Report */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Final Synthesis Report</h2>
                  <button
                    onClick={copyResult}
                    className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                  >
                    {copied ? "✓ Copied!" : "📋 Copy Report"}
                  </button>
                </div>
                <FinalReportCard report={result.finalReport} />
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-4 text-center text-xs text-zinc-500">
        Multi-Agent LLM Council — This tool supports analysis by showing multiple perspectives.
        It does not guarantee correctness.
      </footer>
    </div>
  );
}

function AgentResponseCard({ response }: { response: AgentResponse }) {
  const [expanded, setExpanded] = useState(false);
  const isError = response.content.startsWith("[Error:");

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        isError ? "border-red-500/30" : "border-zinc-700"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🤖</span>
          <div>
            <div className="font-medium text-sm">{response.agentName}</div>
            <div className="text-xs text-zinc-400">
              Confidence: {"⭐".repeat(response.confidence)}
            </div>
          </div>
        </div>
        <span className="text-zinc-400">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-4 py-3 bg-zinc-950/50 text-sm text-zinc-300 whitespace-pre-wrap">
          {response.content}
        </div>
      )}
    </div>
  );
}

function FinalReportCard({ report }: { report: FinalReport }) {
  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      <div className="p-6 bg-zinc-900 space-y-6">
        {/* Summary */}
        {report.summary && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Summary
            </h3>
            <p className="text-zinc-200">{report.summary}</p>
          </div>
        )}

        {/* Key Conclusions */}
        {report.keyConclusions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Key Conclusions
            </h3>
            <ul className="list-disc list-inside space-y-1 text-zinc-300">
              {report.keyConclusions.map((c: string, i: number) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Agreements & Disagreements side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {report.agreements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-2">
                ✓ Agreements
              </h3>
              <ul className="space-y-1 text-zinc-300">
                {report.agreements.map((a: string, i: number) => (
                  <li key={i} className="text-sm">
                    • {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.disagreements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2">
                ✗ Disagreements
              </h3>
              <ul className="space-y-1 text-zinc-300">
                {report.disagreements.map((d: string, i: number) => (
                  <li key={i} className="text-sm">
                    • {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Risks */}
        {report.risks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">
              ⚠ Risks &amp; Limitations
            </h3>
            <ul className="space-y-1 text-zinc-300">
              {report.risks.map((r: string, i: number) => (
                <li key={i} className="text-sm">
                  • {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-2">
              Recommendations
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-zinc-300">
              {report.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-sm">
                  {r}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Confidence Score */}
        <div className="pt-4 border-t border-zinc-700">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-400">Confidence Score:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <span
                  key={level}
                  className={`text-lg ${
                    level <= report.confidence ? "text-yellow-400" : "text-zinc-700"
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-sm text-zinc-400">({report.confidence}/5)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
