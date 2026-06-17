"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type {
  CouncilModeId,
  AgentResponse,
  FinalReport,
} from "@/core/types";
import { useCouncil } from "./CouncilProvider";
import type { AgentStatus, AgentRunState, CouncilPhase } from "./CouncilProvider";
import { Markdown, InlineMarkdown } from "./components/Markdown";
import { AgentCustomizer } from "./components/AgentCustomizer";
import { UserMenu } from "./components/UserMenu";
import { HistorySidebar } from "./components/HistorySidebar";
import { ThemeToggle } from "./components/ThemeToggle";
import { getModeAgents, getAllAgentTemplates } from "./agentData";

const MODES: {
  id: CouncilModeId;
  name: string;
  fullName?: string;
  description: string;
  agents: { name: string; role: string }[];
  bestFor: string[];
}[] = [
  {
    id: "decision",
    name: "Decision",
    fullName: "Decision Council",
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
    name: "Idea",
    fullName: "Idea Council",
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
    name: "Critical",
    fullName: "Critical Review Council",
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
    name: "Learning",
    fullName: "Learning Council",
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
    name: "Technical",
    fullName: "Technical Council",
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
    name: "Answer",
    fullName: "Answer Council",
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
  {
    id: "swot",
    name: "SWOT",
    fullName: "SWOT Council",
    description: "Analyze strengths, weaknesses, opportunities, and threats",
    agents: [
      { name: "Strengths Analyst", role: "Identifies internal strengths and advantages" },
      { name: "Weaknesses Analyst", role: "Identifies internal weaknesses and limitations" },
      { name: "Opportunities Analyst", role: "Identifies external opportunities and trends" },
      { name: "Threats Analyst", role: "Identifies external threats and risks" },
      { name: "SWOT Strategist", role: "Synthesizes the quadrants into a strategy" },
    ],
    bestFor: [
      "Evaluating a business, product, or project strategically",
      "Assessing a plan before committing to it",
      "Mapping competitive position and risks",
    ],
  },
];

export default function Home() {
  // Council-run state lives in CouncilProvider (root layout) so it survives
  // navigating away to /settings and back — see CouncilProvider.tsx.
  const {
    input,
    setInput,
    mode,
    setMode,
    loading,
    result,
    error,
    inputError,
    setInputError,
    setCustomAgents,
    agentStatuses,
    phase,
    peerReviewRun,
    runAnalysis,
    cancelAnalysis,
    loadConversation: handleLoadConversation,
  } = useCouncil();

  const [copied, setCopied] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [preferredModels, setPreferredModels] = useState<string[]>([]);

  const { data: session } = useSession();

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

  // Load the user's preferred models so the customizer dropdown can be
  // restricted to them (and the default-for-all behaviour is reflected).
  useEffect(() => {
    let cancelled = false;
    const loadPreferredModels = async () => {
      if (!session?.user?.id) {
        if (!cancelled) setPreferredModels([]);
        return;
      }
      try {
        const res = await fetch("/api/user/settings");
        const data: { preferredModels?: string[] } = await res.json();
        if (!cancelled) setPreferredModels(data.preferredModels ?? []);
      } catch {
        if (!cancelled) setPreferredModels([]);
      }
    };
    loadPreferredModels();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // When the user has chosen preferred models, restrict the per-agent dropdown
  // to that allow-list; otherwise expose every available model.
  const customizerModels = useMemo(() => {
    if (preferredModels.length === 0) return availableModels;
    const allowed = new Set(preferredModels);
    return availableModels.filter((m) => allowed.has(m.id));
  }, [availableModels, preferredModels]);

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

  // PDF export (SR-13): hand off to the browser's print pipeline. The print
  // stylesheet + `print:hidden` chrome leave only the report on the page, so
  // the user's "Save as PDF" produces a clean document.
  const exportPdf = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip link — first focusable element, visible only when focused (SR-10) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="" className="w-12 h-12 rounded-md" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Multi-Agent LLM Council</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Multi-perspective analysis using specialized AI agents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {session?.user && (
              <Link
                href="/discuss"
                className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                title="Open the live Agent Roundtable"
              >
                💬 Roundtable
              </Link>
            )}
            <ThemeToggle />
            <HistorySidebar onLoad={handleLoadConversation} currentResultId={result?.id ?? null} />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="flex-1 px-6 py-8 focus:outline-none">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Input Section — two column layout */}
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 print:hidden">
            {/* Left column: input + mode selector + run */}
            <div className="space-y-4 min-w-0">
              <div>
                <label htmlFor="council-input" className="block text-sm font-medium mb-2">
                  Your Question, Problem, or Idea
                </label>
                <textarea
                  id="council-input"
                  value={input}
                  aria-describedby="council-input-hint"
                  aria-invalid={inputError ? true : undefined}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  placeholder="Enter your question, problem, idea, or text for analysis..."
                  className={`w-full h-32 px-4 py-3 bg-white dark:bg-zinc-900 border rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                    inputError ? "border-amber-500/50" : "border-zinc-300 dark:border-zinc-700"
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      runAnalysis();
                    }
                  }}
                />
                {inputError && (
                  <p role="alert" className="mt-1.5 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span aria-hidden="true">⚠</span> {inputError}
                  </p>
                )}
              </div>

              {/* Mode Selection — compact buttons */}
              <div>
                <label id="mode-label" className="block text-sm font-medium mb-2">Analysis Mode</label>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="mode-label">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      aria-pressed={mode === m.id}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-all ${
                        mode === m.id
                          ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500"
                          : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
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
                availableModels={customizerModels}
              />

              {/* Run Buttons: standard two-phase, or the opt-in three-phase
                  peer-review analysis (specialists → peer ranking → judge). */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => runAnalysis()}
                  disabled={loading || !input.trim()}
                  aria-busy={loading}
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </span>
                  ) : (
                    "🏛️ Run Council Analysis"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => runAnalysis({ peerReview: true })}
                  disabled={loading || !input.trim()}
                  aria-busy={loading}
                  title="Specialists also review and rank each other's anonymized responses before the judge synthesizes."
                  className="w-full sm:w-auto px-8 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-blue-700 dark:text-blue-300 font-medium rounded-lg border border-blue-600 dark:border-blue-500/50 transition-colors"
                >
                  🔍 Run with Peer Review
                </button>
              </div>
              <p id="council-input-hint" className="text-xs text-zinc-500">
                Press Ctrl+Enter to run. Peer Review adds an anonymized ranking
                round before the final synthesis. Analysis may take 10-30 seconds.
              </p>
            </div>

            {/* Right column: mode details panel */}
            <div className="hidden md:block lg:sticky lg:top-8 lg:self-start" id="mode-details">
              <ModeDetailsPanel mode={MODES.find((m) => m.id === mode)!} />
            </div>
          </section>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className={`p-4 rounded-lg border print:hidden ${
                error.type === "validation"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                  : error.type === "timeout"
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300"
                    : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold">{error.title}</p>
                  <p className="text-sm mt-1 opacity-80">{error.message}</p>
                </div>
                {error.retryable && (
                  <button
                    type="button"
                    onClick={() => runAnalysis()}
                    disabled={loading}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md transition-colors disabled:opacity-50"
                  >
                    ↻ Retry
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading State — live council/agent status */}
          {loading && (
            <CouncilStatus
              agentStatuses={agentStatuses}
              phase={phase}
              peerReviewRun={peerReviewRun}
              onCancel={cancelAnalysis}
            />
          )}

          {/* Cancelled notice (after a cancel, once loading stops and no result) */}
          {!loading && phase === "cancelled" && !result && (
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 px-4 py-3 print:hidden">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                <span aria-hidden="true">⏹</span>
                Council session cancelled. Run again when you&apos;re ready.
              </p>
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

              {/* Peer Review & Ranking (only present for peer-review runs) */}
              {result.peerReviews && result.peerReviews.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-1">Peer Review &amp; Ranking</h2>
                  <p className="text-sm text-zinc-500 mb-4">
                    Each specialist independently evaluated and ranked the
                    anonymized responses before the final synthesis.
                  </p>
                  <div className="grid gap-4">
                    {result.peerReviews.map((review: AgentResponse) => (
                      <AgentResponseCard key={`peer-${review.agentId}`} response={review} />
                    ))}
                  </div>
                </section>
              )}

              {/* Final Report */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Final Synthesis Report</h2>
                  <div className="flex items-center gap-2 print:hidden">
                    <button
                      type="button"
                      onClick={exportPdf}
                      className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 rounded-lg transition-colors"
                    >
                      🖨️ Export PDF
                    </button>
                    <button
                      type="button"
                      onClick={copyResult}
                      className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 rounded-lg transition-colors"
                    >
                      {copied ? "✓ Copied!" : "📋 Copy Report"}
                    </button>
                  </div>
                </div>
                <FinalReportCard report={result.finalReport} />
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 text-center text-xs text-zinc-500 print:hidden">
        Multi-Agent LLM Council - Supports analysis by showing multiple perspectives.
        Does not guarantee correctness. Created by <a href="https://github.com/Freudenberger" className="text-blue-500 hover:underline">Freudenberger</a>.
      </footer>
    </div>
  );
}

function CouncilStatus({
  agentStatuses,
  phase,
  peerReviewRun,
  onCancel,
}: {
  agentStatuses: AgentStatus[];
  phase: CouncilPhase;
  peerReviewRun: boolean;
  onCancel: () => void;
}) {
  const specialists = agentStatuses.filter((a) => !a.isFinalJudge);
  const judge = agentStatuses.find((a) => a.isFinalJudge) ?? null;
  const doneCount = specialists.filter(
    (a) => a.state === "done" || a.state === "error",
  ).length;
  const specialistsDone = specialists.length > 0 && doneCount === specialists.length;
  // Peer review runs once all specialists finish; it's done once synthesis begins.
  const peerReviewState: AgentRunState =
    phase === "peer-review"
      ? "running"
      : phase === "judge" || phase === "done"
        ? "done"
        : "pending";
  const synthLabel = peerReviewRun ? "Phase 3 · Synthesis" : "Phase 2 · Synthesis";

  return (
    <div
      role="status"
      aria-live="polite"
      className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden print:hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 min-w-0">
          <div id="council-status-spinner" className="relative w-9 h-9 shrink-0" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={specialists.length > 0 ? Math.round((doneCount / specialists.length) * 100) : 0} aria-label={`Council progress: ${specialists.length > 0 ? `${doneCount} of ${specialists.length} specialists done` : "starting"}`}>
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-200 dark:text-zinc-700" />
              <circle
                cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeDasharray={`${specialists.length > 0 ? (doneCount / specialists.length) * 97.4 : 0} 97.4`}
                strokeLinecap="round"
                className="text-blue-500 transition-all duration-500 ease-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
              {specialists.length > 0 ? `${doneCount}/${specialists.length}` : "…"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Council in session
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {phase === "judge"
                ? "Synthesizing the final report…"
                : phase === "peer-review"
                  ? "Peer review — specialists ranking each other's responses…"
                  : agentStatuses.length > 0
                    ? `Specialists analyzing… ${doneCount}/${specialists.length} done`
                    : "Starting…"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Agent list */}
      {agentStatuses.length === 0 ? (
        <div aria-hidden="true" className="flex gap-2 px-4 py-6 justify-center">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {/* Phase 1: Specialists */}
          <div className="px-4 py-2">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              Phase 1 · Specialists
            </p>
            <div className="space-y-1">
              {specialists.map((a) => (
                <AgentStatusRow key={a.id} agent={a} />
              ))}
            </div>
          </div>

          {/* Phase 2: Peer review (only for peer-review runs) */}
          {peerReviewRun && (
            <div className="px-4 py-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                Phase 2 · Peer Review
              </p>
              <PhaseStatusRow
                label={
                  peerReviewState === "done"
                    ? "Specialists ranked the anonymized responses"
                    : peerReviewState === "running"
                      ? "Specialists ranking the anonymized responses…"
                      : "Waiting for specialists to finish…"
                }
                state={
                  peerReviewState === "pending" && specialistsDone
                    ? "running"
                    : peerReviewState
                }
              />
            </div>
          )}

          {/* Synthesis (Phase 2, or Phase 3 when peer review ran) */}
          {judge && (
            <div className="px-4 py-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                {synthLabel}
              </p>
              <AgentStatusRow agent={judge} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentStatusRow({ agent }: { agent: AgentStatus }) {
  const icon: Record<AgentStatus["state"], string> = {
    pending: "○",
    running: "⟳",
    done: "✓",
    error: "⚠",
  };
  const color: Record<AgentStatus["state"], string> = {
    pending: "text-zinc-400 dark:text-zinc-600",
    running: "text-blue-500 dark:text-blue-400",
    done: "text-green-600 dark:text-green-400",
    error: "text-amber-600 dark:text-amber-400",
  };
  const label: Record<AgentStatus["state"], string> = {
    pending: "pending",
    running: "running…",
    done: "done",
    error: "failed",
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`w-4 text-center shrink-0 ${color[agent.state]} ${agent.state === "running" ? "animate-spin inline-block" : ""}`}
      >
        {icon[agent.state]}
      </span>
      <span className="text-zinc-700 dark:text-zinc-300 truncate">{agent.name}</span>
      <span className="text-zinc-400 dark:text-zinc-600 text-xs truncate hidden sm:inline">
        · {agent.role}
      </span>
      <span className="ml-auto shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
        {agent.state === "done" && agent.durationMs != null
          ? `${(agent.durationMs / 1000).toFixed(1)}s`
          : label[agent.state]}
      </span>
    </div>
  );
}

/** A single status row for a whole phase (no per-agent breakdown), e.g. peer review. */
function PhaseStatusRow({
  label,
  state,
}: {
  label: string;
  state: AgentRunState;
}) {
  const icon: Record<AgentRunState, string> = {
    pending: "○",
    running: "⟳",
    done: "✓",
    error: "⚠",
  };
  const color: Record<AgentRunState, string> = {
    pending: "text-zinc-400 dark:text-zinc-600",
    running: "text-blue-500 dark:text-blue-400",
    done: "text-green-600 dark:text-green-400",
    error: "text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`w-4 text-center shrink-0 ${color[state]} ${state === "running" ? "animate-spin inline-block" : ""}`}
      >
        {icon[state]}
      </span>
      <span className="text-zinc-700 dark:text-zinc-300 truncate">{label}</span>
    </div>
  );
}

function ModeDetailsPanel({ mode }: { mode: (typeof MODES)[number] }) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{mode.fullName || mode.name}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{mode.description}</p>
      </div>

      {/* Agents */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
          Agents ({mode.agents.length})
        </p>
        <div className="space-y-1">
          {mode.agents.map((agent, i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <span aria-hidden="true" className="text-blue-500 dark:text-blue-400 text-[10px] shrink-0">•</span>
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{agent.name}</span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-600">— {agent.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Best for */}
      <div className="px-3 py-2">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
          Best for
        </p>
        <ul className="space-y-0.5">
          {mode.bestFor.map((useCase, i) => (
            <li key={i} className="text-[11px] text-zinc-500 flex items-baseline gap-1.5">
              <span aria-hidden="true" className="text-green-600 dark:text-green-500 shrink-0">✓</span>
              <span className="leading-snug">{useCase}</span>
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
  const panelId = `agent-panel-${response.agentId}`;

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        isError ? "border-red-500/30" : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-lg">🤖</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{response.agentName}</span>
              {response.model && (
                <span
                  className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] text-purple-600 dark:text-purple-300"
                  title="Model used for this response"
                >
                  {response.model}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              <span aria-hidden="true">Confidence: {"⭐".repeat(response.confidence)}</span>
              <span className="sr-only">Confidence: {response.confidence} of 5</span>
            </div>
          </div>
        </div>
        <span aria-hidden="true" className="text-zinc-500 dark:text-zinc-400">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div id={panelId} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-700 dark:text-zinc-300">
          <Markdown content={response.content} />
        </div>
      )}
    </div>
  );
}

function FinalReportCard({ report }: { report: FinalReport }) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <div className="p-6 bg-white dark:bg-zinc-900 space-y-6">
        {/* Summary */}
        {report.summary && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Summary
            </h3>
            <div className="text-zinc-800 dark:text-zinc-200" id="summary">
              <Markdown content={report.summary} />
            </div>
          </div>
        )}

        {/* Key Conclusions */}
        {report.keyConclusions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Key Conclusions
            </h3>
            <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300">
              {report.keyConclusions.map((c: string, i: number) => (
                <li key={i}>
                  <InlineMarkdown content={c} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Agreements & Disagreements side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {report.agreements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">
                ✓ Agreements
              </h3>
              <ul className="space-y-1 text-zinc-700 dark:text-zinc-300">
                {report.agreements.map((a: string, i: number) => (
                  <li key={i} className="text-sm">
                    • <InlineMarkdown content={a} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.disagreements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                ✗ Disagreements
              </h3>
              <ul className="space-y-1 text-zinc-700 dark:text-zinc-300">
                {report.disagreements.map((d: string, i: number) => (
                  <li key={i} className="text-sm">
                    • <InlineMarkdown content={d} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Risks */}
        {report.risks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
              ⚠ Risks &amp; Limitations
            </h3>
            <ul className="space-y-1 text-zinc-700 dark:text-zinc-300">
              {report.risks.map((r: string, i: number) => (
                <li key={i} className="text-sm">
                  • <InlineMarkdown content={r} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
              Recommendations
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-zinc-700 dark:text-zinc-300">
              {report.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-sm">
                  <InlineMarkdown content={r} />
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Confidence Score */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Confidence Score:</span>
            <div className="flex gap-1" role="img" aria-label={`Confidence ${report.confidence} of 5`}>
              {[1, 2, 3, 4, 5].map((level) => (
                <span
                  key={level}
                  aria-hidden="true"
                  className={`text-lg ${
                    level <= report.confidence ? "text-yellow-400" : "text-zinc-300 dark:text-zinc-700"
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">({report.confidence}/5)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
