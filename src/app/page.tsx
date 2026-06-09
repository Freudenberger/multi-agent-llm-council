"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import type {
  CouncilModeId,
  RunCouncilResult,
  AgentResponse,
  FinalReport,
  CustomAgent,
} from "@/core/types";
import type { ConversationSummary } from "@/storage/types";
import { Markdown } from "./components/Markdown";
import { AgentCustomizer } from "./components/AgentCustomizer";
import { UserMenu } from "./components/UserMenu";
import { HistorySidebar } from "./components/HistorySidebar";
import { getModeAgents, getAllAgentTemplates } from "./agentData";

const MODES: {
  id: CouncilModeId;
  name: string;
  description: string;
  agents: { name: string; role: string }[];
  bestFor: string[];
}[] = [
  {
    id: "decision",
    name: "Decision Council",
    description: "Analyze a decision from multiple perspectives",
    agents: [
      { name: "Optimist", role: "Finds opportunities and positive outcomes" },
      { name: "Sceptic", role: "Challenges assumptions and prevents poor advice" },
      { name: "Risk Analyst", role: "Evaluates practical risks and downsides" },
      { name: "Pragmatist", role: "Focuses on realistic next actions" },
      { name: "Final Judge", role: "Synthesizes into a final recommendation" },
    ],
    bestFor: [
      "Should I do X or Y?",
      "Evaluating a major life or career choice",
      "Weighing pros and cons of a decision",
    ],
  },
  {
    id: "idea",
    name: "Idea Council",
    description: "Evaluate an idea's potential and feasibility",
    agents: [
      { name: "Creative Thinker", role: "Explores creative possibilities" },
      { name: "Market Analyst", role: "Evaluates audience and demand" },
      { name: "Technical Feasibility", role: "Assesses implementation complexity" },
      { name: "User Perspective", role: "Represents end-user needs" },
      { name: "Final Synthesizer", role: "Synthesizes into a clear recommendation" },
    ],
    bestFor: [
      "Is this idea worth pursuing?",
      "Evaluating a product or business idea",
      "Assessing creative or strategic concepts",
    ],
  },
  {
    id: "criticalReview",
    name: "Critical Review",
    description: "Review text, arguments, or proposals",
    agents: [
      { name: "Logic Reviewer", role: "Checks logical structure and reasoning" },
      { name: "Clarity Reviewer", role: "Evaluates readability and clarity" },
      { name: "Evidence Reviewer", role: "Assesses quality of evidence and sources" },
      { name: "Sceptic", role: "Challenges weak points and assumptions" },
      { name: "Final Editor", role: "Produces an overall quality assessment" },
    ],
    bestFor: [
      "Reviewing an essay, article, or proposal",
      "Checking argument quality and logic",
      "Getting feedback on written work",
    ],
  },
  {
    id: "learning",
    name: "Learning Council",
    description: "Get educational explanations",
    agents: [
      { name: "Teacher", role: "Explains concepts step by step" },
      { name: "Beginner", role: "Asks clarifying questions" },
      { name: "Examiner", role: "Tests understanding with key questions" },
      { name: "Example Generator", role: "Provides practical examples" },
      { name: "Final Explainer", role: "Synthesizes a comprehensive summary" },
    ],
    bestFor: [
      "Learning a new concept or topic",
      "Understanding complex subjects",
      "Getting study guidance and examples",
    ],
  },
  {
    id: "technical",
    name: "Technical Council",
    description: "Evaluate technical topics and architecture",
    agents: [
      { name: "Software Architect", role: "Evaluates architecture and design" },
      { name: "Security Reviewer", role: "Identifies security concerns" },
      { name: "Performance Reviewer", role: "Assesses performance implications" },
      { name: "Maintainability Reviewer", role: "Evaluates long-term maintainability" },
      { name: "Final Recommender", role: "Synthesizes technical recommendations" },
    ],
    bestFor: [
      "Evaluating a technical design or architecture",
      "Code or system review",
      "Technical decision-making",
    ],
  },
  {
    id: "answer",
    name: "Answer Council",
    description: "Get a direct answer with supporting analysis",
    agents: [
      { name: "Subject Matter Expert", role: "Provides domain expertise" },
      { name: "Contrarian", role: "Challenges the consensus view" },
      { name: "Contextualizer", role: "Adds relevant context and nuance" },
      { name: "Synthesizer", role: "Combines perspectives into a coherent answer" },
      { name: "Final Summarizer", role: "Produces a clear, direct answer" },
    ],
    bestFor: [
      "Getting a well-reasoned answer to a complex question",
      "Understanding multiple viewpoints on a topic",
      "Fact-checking and balanced analysis",
    ],
  },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<CouncilModeId>("decision");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunCouncilResult | null>(null);
  const [error, setError] = useState<{
    title: string;
    message: string;
    type: string;
    retryable: boolean;
  } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customAgents, setCustomAgents] = useState<Record<string, CustomAgent>>({});
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [showCustomEditor, setShowCustomEditor] = useState(true);
  const [history, setHistory] = useState<ConversationSummary[]>([]);

  const { data: session } = useSession();

  // Load a saved conversation into the main view
  const handleLoadConversation = useCallback((conversation: RunCouncilResult) => {
    setResult(conversation);
    setInput(conversation.userInput);
    setMode(conversation.modeId);
    setError(null);
  }, []);

  // Fetch free models from OpenRouter on mount
  useEffect(() => {
    let cancelled = false;
    const fetchModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const res = await fetch("/api/models");
        const data = await res.json();
        if (!cancelled) {
          setAvailableModels(data.models || []);
          if (data.models?.length === 0) {
            setModelsError("No free models available. Using default model.");
          }
        }
      } catch {
        if (!cancelled) setModelsError("Failed to fetch models. Using default model.");
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    };
    fetchModels();
    return () => { cancelled = true; };
  }, []);

  // Load conversation history when user logs in
  useEffect(() => {
    if (!session?.user?.id) {
      setHistory([]);
      return;
    }
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // Inline validation
  const validateInput = useCallback((value: string): string | null => {
    if (!value.trim()) return "Please enter a question or problem to analyze.";
    if (value.trim().length < 3) return "Please enter at least 3 characters.";
    if (value.length > 10000) return "Input is too long (max 10 000 characters).";
    return null;
  }, []);

  const runAnalysis = useCallback(async () => {
    // Client-side validation
    const validationError = validateInput(input);
    if (validationError) {
      setInputError(validationError);
      return;
    }
    setInputError(null);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, unknown> = { input: input.trim(), mode };
      if (Object.keys(customAgents).length > 0) {
        body.customAgents = customAgents;
      }
      const response = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError({
          title: data.error || "Error",
          message: data.message || "Something went wrong.",
          type: data.type || "unknown",
          retryable: data.retryable ?? false,
        });
        return;
      }

      setResult(data);

      // Refresh history (backend auto-saves when authenticated)
      if (session?.user?.id) {
        const historyRes = await fetch("/api/conversations");
        if (historyRes.ok) {
          setHistory(await historyRes.json());
        }
      }
    } catch {
      // Network or parse error
      setError({
        title: "Connection error",
        message:
          "Unable to reach the server. Please check your connection and try again.",
        type: "network",
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [input, mode, customAgents, validateInput, session]);

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
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="LLM Council" className="w-12 h-12 rounded-md" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Multi-Agent LLM Council</h1>
              <p className="text-sm text-zinc-400">
                Multi-perspective analysis using specialized AI agents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HistorySidebar onLoad={handleLoadConversation} currentResultId={result?.id ?? null} />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Input Section — two column layout */}
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Left column: input + mode selector + run */}
            <div className="space-y-4 min-w-0">
              <div>
                <label htmlFor="council-input" className="block text-sm font-medium mb-2">
                  Your Question, Problem, or Idea
                </label>
                <textarea
                  id="council-input"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  placeholder="Enter your question, problem, idea, or text for analysis..."
                  className={`w-full h-32 px-4 py-3 bg-zinc-900 border rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                    inputError ? "border-amber-500/50" : "border-zinc-700"
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      runAnalysis();
                    }
                  }}
                />
                {inputError && (
                  <p className="mt-1.5 text-sm text-amber-400 flex items-center gap-1.5">
                    <span>⚠</span> {inputError}
                  </p>
                )}
              </div>

              {/* Mode Selection — compact buttons */}
              <div>
                <label className="block text-sm font-medium mb-2">Analysis Mode</label>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-all ${
                        mode === m.id
                          ? "border-blue-500 bg-blue-500/10 text-blue-300 ring-1 ring-blue-500"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Customizer */}
              <AgentCustomizer
                defaultAgents={getModeAgents(mode)}
                allTemplates={getAllAgentTemplates()}
                onChange={setCustomAgents}
                availableModels={availableModels}
              />

              {/* Run Button */}
              <button
                onClick={runAnalysis}
                disabled={loading || !input.trim()}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  "🏛️ Run Council Analysis"
                )}
              </button>
              <p className="text-xs text-zinc-500">
                Press Ctrl+Enter to run. Analysis may take 10-30 seconds.
              </p>
            </div>

            {/* Right column: mode details panel */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <ModeDetailsPanel mode={MODES.find((m) => m.id === mode)!} />
            </div>
          </section>

          {/* Error */}
          {error && (
            <div
              className={`p-4 rounded-lg border ${
                error.type === "validation"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : error.type === "timeout"
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold">{error.title}</p>
                  <p className="text-sm mt-1 opacity-80">{error.message}</p>
                </div>
                {error.retryable && (
                  <button
                    onClick={runAnalysis}
                    disabled={loading}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-md transition-colors disabled:opacity-50"
                  >
                    ↻ Retry
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="border border-zinc-700 rounded-lg overflow-hidden">
              <div className="p-8 bg-zinc-900 flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-zinc-700 border-t-blue-500 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-zinc-200 font-medium">Council in Session</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Specialist agents are analyzing your input...
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
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

function ModeDetailsPanel({ mode }: { mode: (typeof MODES)[number] }) {
  return (
    <div className="border border-zinc-700 rounded-lg bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="font-semibold text-sm text-zinc-100">{mode.name}</h3>
        <p className="text-xs text-zinc-400 mt-1">{mode.description}</p>
      </div>

      {/* Agents */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Agents ({mode.agents.length})
        </p>
        <div className="space-y-2">
          {mode.agents.map((agent, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-blue-400 text-xs mt-0.5 shrink-0">•</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-200">{agent.name}</div>
                <div className="text-xs text-zinc-500 leading-relaxed">{agent.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Best for */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Best for
        </p>
        <ul className="space-y-1.5">
          {mode.bestFor.map((useCase, i) => (
            <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
              <span className="text-green-400 shrink-0">✓</span>
              <span className="leading-relaxed">{useCase}</span>
            </li>
          ))}
        </ul>
      </div>
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
        <div className="px-4 py-3 bg-zinc-950/50 text-sm text-zinc-300">
          <Markdown content={response.content} />
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
            <div className="text-zinc-200" id="summary">
              <Markdown content={report.summary} />
            </div>
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
