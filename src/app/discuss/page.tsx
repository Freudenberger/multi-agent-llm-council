"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Markdown } from "../components/Markdown";
import { ThemeToggle } from "../components/ThemeToggle";
import { UserMenu } from "../components/UserMenu";
import {
  getDiscussionPersonas,
  getSummarizerPersonas,
} from "@/agents/defaultAgents";
import {
  DISCUSSION_MIN_AGENTS,
  DISCUSSION_MAX_AGENTS,
  DISCUSSION_MIN_ROUNDS,
  DISCUSSION_MAX_ROUNDS,
  type DiscussionTurn,
  type DiscussionSummary,
  type DiscussionProgressEvent,
  type RunDiscussionResult,
  type CouncilAgentMeta,
} from "@/core/types";

// Per-participant accent colors, assigned by position in the panel.
const ACCENTS = [
  "border-blue-500/60 bg-blue-500/10 text-blue-300",
  "border-purple-500/60 bg-purple-500/10 text-purple-300",
  "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
  "border-amber-500/60 bg-amber-500/10 text-amber-300",
];

type Phase = "idle" | "running" | "done" | "cancelled" | "error";

type UiError = { title: string; message: string };

/** Distinct model ids used across the turns (and summary), in first-seen order. */
function distinctModels(
  turns: DiscussionTurn[],
  summary: DiscussionSummary | null,
): string[] {
  const seen: string[] = [];
  for (const t of [...turns, ...(summary ? [summary] : [])]) {
    if (t.model && !seen.includes(t.model)) seen.push(t.model);
  }
  return seen;
}

/** Renders the current discussion (partial or complete) as a Markdown document. */
function buildMarkdown(
  topic: string,
  participants: CouncilAgentMeta[],
  rounds: number,
  turns: DiscussionTurn[],
  summary: DiscussionSummary | null,
): string {
  const lines: string[] = ["# Agent Roundtable", ""];
  lines.push(`**Topic:** ${topic}`, "");
  if (participants.length > 0) {
    lines.push(`**Participants:** ${participants.map((p) => p.name).join(", ")}`);
  }
  lines.push(`**Rounds:** ${rounds}`);
  const models = distinctModels(turns, summary);
  if (models.length > 0) lines.push(`**Models used:** ${models.join(", ")}`);
  lines.push("", "---", "");

  let currentRound = 0;
  for (const t of turns) {
    if (t.round !== currentRound) {
      currentRound = t.round;
      lines.push(`## Round ${t.round}`, "");
    }
    lines.push(`### ${t.agentName} _(${t.model})_`, "", t.content, "");
  }

  if (summary) {
    lines.push(
      "---",
      "",
      `## Summary — ${summary.agentName} _(${summary.model})_`,
      "",
      summary.content,
      "",
    );
  }
  return lines.join("\n");
}

/** Lowercase-kebab slug for the download filename, derived from the topic. */
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "discussion"
  );
}

export default function DiscussPage() {
  const { status } = useSession();
  const router = useRouter();

  // The roundtable is for signed-in users only — bounce anyone else to login.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const personas = useMemo(() => getDiscussionPersonas(), []);
  const summarizers = useMemo(() => getSummarizerPersonas(), []);

  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(2);
  const [agentIds, setAgentIds] = useState<string[]>(() =>
    personas.slice(0, 2).map((p) => p.id),
  );
  const [rounds, setRounds] = useState(2);
  // Empty string = no summarizer; otherwise an agent-template id.
  const [summarizerId, setSummarizerId] = useState<string>(
    () => summarizers[0]?.id ?? "",
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [participants, setParticipants] = useState<CouncilAgentMeta[]>([]);
  const [runRounds, setRunRounds] = useState(0);
  const [turns, setTurns] = useState<DiscussionTurn[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<DiscussionSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  // Turn indices whose body is collapsed; summary collapse is tracked separately.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const running = phase === "running";

  // Map agent id → accent index (its position in the panel) for coloring.
  const accentFor = useCallback(
    (agentId: string) => {
      const i = participants.findIndex((p) => p.id === agentId);
      return ACCENTS[(i < 0 ? 0 : i) % ACCENTS.length];
    },
    [participants],
  );

  const setCountAndAgents = useCallback(
    (next: number) => {
      setCount(next);
      setAgentIds((prev) => {
        const ids = [...prev];
        if (next < ids.length) return ids.slice(0, next);
        // Extend with personas not already chosen.
        for (const p of personas) {
          if (ids.length >= next) break;
          if (!ids.includes(p.id)) ids.push(p.id);
        }
        return ids;
      });
    },
    [personas],
  );

  const setAgentAt = useCallback((index: number, id: string) => {
    setAgentIds((prev) => prev.map((cur, i) => (i === index ? id : cur)));
  }, []);

  const toggleTurn = useCallback((index: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setCollapsed((prev) => {
      const everyCollapsed =
        turns.length > 0 && turns.every((t) => prev.has(t.index));
      return everyCollapsed ? new Set() : new Set(turns.map((t) => t.index));
    });
  }, [turns]);

  const downloadMarkdown = useCallback(() => {
    const md = buildMarkdown(topic.trim(), participants, runRounds, turns, summary);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roundtable-${slugify(topic)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [topic, participants, runRounds, turns, summary]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const start = useCallback(async () => {
    if (!topic.trim()) {
      setInputError("Please enter a topic for the agents to discuss.");
      return;
    }
    if (new Set(agentIds).size !== agentIds.length) {
      setInputError("Each agent can only be selected once — pick distinct agents.");
      return;
    }
    setInputError(null);
    setError(null);
    setTurns([]);
    setParticipants([]);
    setRunRounds(rounds);
    setSpeakingId(null);
    setSummary(null);
    setSummarizing(false);
    setCollapsed(new Set());
    setSummaryCollapsed(false);
    setPhase("running");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          agentIds,
          rounds,
          ...(summarizerId ? { summarizerId } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setError({
          title: data.error || "Error",
          message: data.message || "Something went wrong.",
        });
        setPhase("error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let msg: {
          kind: "progress" | "result" | "error";
          event?: DiscussionProgressEvent;
          result?: RunDiscussionResult;
          error?: { error?: string; message?: string };
        };
        try {
          msg = JSON.parse(trimmed);
        } catch {
          return;
        }

        if (msg.kind === "progress" && msg.event) {
          const event = msg.event;
          switch (event.type) {
            case "discussion_started":
              setParticipants(event.participants);
              setRunRounds(event.rounds);
              break;
            case "turn_started":
              setSpeakingId(event.agentId);
              break;
            case "turn_completed":
              setTurns((prev) => [...prev, event.turn]);
              setSpeakingId(null);
              break;
            case "summary_started":
              setSpeakingId(null);
              setSummarizing(true);
              break;
            case "summary_completed":
              setSummary(event.summary);
              setSummarizing(false);
              break;
          }
        } else if (msg.kind === "result" && msg.result) {
          setParticipants(msg.result.participants);
          setRunRounds(msg.result.rounds);
          setTurns(msg.result.turns);
          setSummary(msg.result.summary ?? null);
          setSpeakingId(null);
          setSummarizing(false);
          setPhase("done");
        } else if (msg.kind === "error" && msg.error) {
          setError({
            title: msg.error.error || "Error",
            message: msg.error.message || "Something went wrong.",
          });
          setPhase("error");
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          handleLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
      handleLine(buffer);
      setPhase((p) => (p === "running" ? "done" : p));
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        controller.signal.aborted
      ) {
        setSpeakingId(null);
        setSummarizing(false);
        setPhase("cancelled");
      } else {
        setError({
          title: "Connection error",
          message: "Unable to reach the server. Please try again.",
        });
        setPhase("error");
      }
    } finally {
      abortRef.current = null;
    }
  }, [topic, agentIds, rounds, summarizerId]);

  const speakingName =
    participants.find((p) => p.id === speakingId)?.name ?? null;

  // Discussion progress: total turns = panel size × rounds.
  const expectedTurns = participants.length * runRounds;
  const completedTurns = turns.length;
  const progressPct =
    expectedTurns > 0
      ? Math.min(100, Math.round((completedTurns / expectedTurns) * 100))
      : 0;
  // The round currently in flight (or the last one completed when idle).
  const displayRound =
    participants.length > 0
      ? speakingName
        ? Math.min(runRounds, Math.floor(completedTurns / participants.length) + 1)
        : completedTurns > 0
          ? turns[turns.length - 1].round
          : 0
      : 0;
  const allCollapsed =
    turns.length > 0 && turns.every((t) => collapsed.has(t.index));
  const modelsUsed = distinctModels(turns, summary);

  // Don't render the roundtable to logged-out users — the effect above
  // redirects them; show a neutral placeholder until the session resolves.
  if (status !== "authenticated") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-neutral-400">
        {status === "loading" ? "Loading…" : "Redirecting to sign in…"}
      </main>
    );
  }

  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="" className="w-12 h-12 rounded-md" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Agent Roundtable
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Watch a panel of AI agents debate your topic, live
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title="Back to the Council"
            >
              ← Council
            </Link>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="mb-4 text-sm text-neutral-400">
          Pick a panel of agents and watch them debate your topic
          back-and-forth, live. The conversation runs for a fixed number of
          rounds, then an optional summarizer wraps it up.
        </p>

        <section className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Topic</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={running}
            rows={3}
            placeholder="e.g. Should our startup adopt a 4-day work week?"
            className="w-full resize-y rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Number of agents
            </label>
            <select
              value={count}
              onChange={(e) => setCountAndAgents(Number(e.target.value))}
              disabled={running}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
            >
              {Array.from(
                { length: DISCUSSION_MAX_AGENTS - DISCUSSION_MIN_AGENTS + 1 },
                (_, i) => DISCUSSION_MIN_AGENTS + i,
              ).map((n) => (
                <option key={n} value={n}>
                  {n} agents
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Rounds (turns each)
            </label>
            <select
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              disabled={running}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
            >
              {Array.from(
                { length: DISCUSSION_MAX_ROUNDS - DISCUSSION_MIN_ROUNDS + 1 },
                (_, i) => DISCUSSION_MIN_ROUNDS + i,
              ).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "round" : "rounds"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Summarizer
            </label>
            <select
              value={summarizerId}
              onChange={(e) => setSummarizerId(e.target.value)}
              disabled={running}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
            >
              <option value="">No summary</option>
              {summarizers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Panel</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {agentIds.map((id, index) => (
              <select
                key={index}
                value={id}
                onChange={(e) => setAgentAt(index, e.target.value)}
                disabled={running}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.role}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </div>

        {inputError && (
          <p className="text-sm text-red-400">{inputError}</p>
        )}

        <div className="flex items-center gap-3">
          {!running ? (
            <button
              onClick={start}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Start discussion
            </button>
          ) : (
            <button
              onClick={cancel}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Stop
            </button>
          )}
          {phase === "cancelled" && (
            <span className="text-sm text-amber-400">Discussion stopped.</span>
          )}
          {phase === "done" && turns.length > 0 && (
            <span className="text-sm text-emerald-400">Discussion complete.</span>
          )}
        </div>
      </section>

      {expectedTurns > 0 && (
        <section className="mt-6">
          <div className="mb-1 flex items-center justify-between text-xs text-neutral-400">
            <span>
              {phase === "cancelled"
                ? "Stopped"
                : phase === "done"
                  ? "Discussion complete"
                  : summarizing
                    ? "Summarizing the discussion…"
                    : `Round ${displayRound} of ${runRounds}`}
            </span>
            <span>
              {completedTurns} / {expectedTurns} turns
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-neutral-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            aria-label={`Discussion progress: ${completedTurns} of ${expectedTurns} turns`}
          >
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </section>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-800 bg-red-950/40 p-3 text-sm">
          <p className="font-medium text-red-300">{error.title}</p>
          <p className="text-red-200/80">{error.message}</p>
        </div>
      )}

      {(turns.length > 0 || speakingName) && (
        <section className="mt-6 space-y-3">
          {turns.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-sm font-semibold text-neutral-300">
                  Conversation
                </h2>
                {modelsUsed.length > 0 && (
                  <span className="text-[11px] text-neutral-500">
                    Models: {modelsUsed.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadMarkdown}
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  ↓ Download .md
                </button>
                <button
                  onClick={toggleAll}
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  {allCollapsed ? "Expand all" : "Collapse all"}
                </button>
              </div>
            </div>
          )}

          {turns.map((turn) => {
            const isCollapsed = collapsed.has(turn.index);
            return (
              <div
                key={turn.index}
                className={`rounded-lg border p-3 ${accentFor(turn.agentId)}`}
              >
                <button
                  type="button"
                  onClick={() => toggleTurn(turn.index)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-500">
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {turn.agentName}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] text-purple-300"
                      title="Model used for this turn"
                    >
                      {turn.model}
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Round {turn.round}
                    </span>
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="markdown-content mt-1 text-sm text-neutral-200">
                    {turn.ok ? (
                      <Markdown content={turn.content} />
                    ) : (
                      <em className="text-neutral-400">{turn.content}</em>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {speakingName && (
            <div className="flex items-center gap-2 px-2 text-sm text-neutral-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
              {speakingName} is thinking…
            </div>
          )}
        </section>
      )}

      {summarizing && (
        <div className="mt-4 flex items-center gap-2 px-2 text-sm text-neutral-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neutral-300" />
          Summarizing the discussion…
        </div>
      )}

      {summary && (
        <section className="mt-6 rounded-lg border border-neutral-700 bg-neutral-900/60 p-4">
          <button
            type="button"
            onClick={() => setSummaryCollapsed((c) => !c)}
            aria-expanded={!summaryCollapsed}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
                Summary · {summary.agentName}
              </span>
              <span
                className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] text-purple-300"
                title="Model used for the summary"
              >
                {summary.model}
              </span>
            </span>
            <span className="text-[11px] text-neutral-500">
              {summaryCollapsed ? "▸" : "▾"}
            </span>
          </button>
          {!summaryCollapsed && (
            <div className="markdown-content mt-2 text-sm text-neutral-200">
              {summary.ok ? (
                <Markdown content={summary.content} />
              ) : (
                <em className="text-neutral-400">{summary.content}</em>
              )}
            </div>
          )}
        </section>
      )}
      </main>
    </>
  );
}
