"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import type {
  CouncilModeId,
  RunCouncilResult,
  CustomAgent,
  CouncilAgentMeta,
  CouncilProgressEvent,
} from "@/core/types";

export type CouncilError = {
  title: string;
  message: string;
  type: string;
  retryable: boolean;
};

/** Live state of a single agent during a run. */
export type AgentRunState = "pending" | "running" | "done" | "error";

export type AgentStatus = CouncilAgentMeta & {
  state: AgentRunState;
  durationMs?: number;
};

/** Coarse phase of the overall run, for the status header. */
export type CouncilPhase =
  | "idle"
  | "specialists"
  | "judge"
  | "done"
  | "cancelled";

type CouncilContextValue = {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  mode: CouncilModeId;
  setMode: Dispatch<SetStateAction<CouncilModeId>>;
  loading: boolean;
  result: RunCouncilResult | null;
  error: CouncilError | null;
  setError: Dispatch<SetStateAction<CouncilError | null>>;
  inputError: string | null;
  setInputError: Dispatch<SetStateAction<string | null>>;
  customAgents: Record<string, CustomAgent>;
  setCustomAgents: Dispatch<SetStateAction<Record<string, CustomAgent>>>;
  /** Live per-agent status for the current/most-recent run. */
  agentStatuses: AgentStatus[];
  /** Current run phase. */
  phase: CouncilPhase;
  runAnalysis: () => Promise<void>;
  /** Cancel the in-flight run (aborts the request and stops the server). */
  cancelAnalysis: () => void;
  loadConversation: (conversation: RunCouncilResult) => void;
};

const CouncilContext = createContext<CouncilContextValue | null>(null);

/** Access the shared council-run state. Must be used under <CouncilProvider>. */
export function useCouncil(): CouncilContextValue {
  const ctx = useContext(CouncilContext);
  if (!ctx) {
    throw new Error("useCouncil must be used within a CouncilProvider");
  }
  return ctx;
}

function validateInput(value: string): string | null {
  if (!value.trim()) return "Please enter a question or problem to analyze.";
  if (value.trim().length < 3) return "Please enter at least 3 characters.";
  if (value.length > 10000) return "Input is too long (max 10 000 characters).";
  return null;
}

/** Fold a single progress event into the running agent-status list. */
function reduceAgentStatuses(
  prev: AgentStatus[],
  event: CouncilProgressEvent,
): AgentStatus[] {
  switch (event.type) {
    case "run_started": {
      const specialists: AgentStatus[] = event.specialists.map((a) => ({
        ...a,
        state: "pending",
      }));
      const judge: AgentStatus[] = event.judge
        ? [{ ...event.judge, state: "pending" }]
        : [];
      return [...specialists, ...judge];
    }
    case "agent_started":
      return prev.map((a) =>
        a.id === event.agentId ? { ...a, state: "running" } : a,
      );
    case "agent_completed":
      return prev.map((a) =>
        a.id === event.agentId
          ? {
              ...a,
              state: event.ok ? "done" : "error",
              durationMs: event.durationMs,
            }
          : a,
      );
    default:
      return prev;
  }
}

/**
 * Holds the council-run state (input, mode, result, live agent status, in-flight
 * request) above the route tree so it survives client navigation. The main view
 * and the settings page are separate routes; without this provider, navigating
 * to settings unmounts the page and discards a running council and its result.
 * Mounted in the root layout, which does not remount across navigation.
 */
export function CouncilProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<CouncilModeId>("decision");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunCouncilResult | null>(null);
  const [error, setError] = useState<CouncilError | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [customAgents, setCustomAgents] = useState<Record<string, CustomAgent>>(
    {},
  );
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [phase, setPhase] = useState<CouncilPhase>("idle");

  // The in-flight request's abort controller, so cancelAnalysis can stop it.
  const abortRef = useRef<AbortController | null>(null);

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runAnalysis = useCallback(async () => {
    const validationError = validateInput(input);
    if (validationError) {
      setInputError(validationError);
      return;
    }
    setInputError(null);
    setLoading(true);
    setError(null);
    setResult(null);
    setAgentStatuses([]);
    setPhase("idle");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, unknown> = { input: input.trim(), mode };
      if (Object.keys(customAgents).length > 0) {
        body.customAgents = customAgents;
      }

      const response = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Pre-stream errors (validation/auth) come back as a plain JSON body.
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setError({
          title: data.error || "Error",
          message: data.message || "Something went wrong.",
          type: data.type || "unknown",
          retryable: data.retryable ?? false,
        });
        return;
      }

      // Consume the NDJSON stream line by line.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let msg: {
          kind: "progress" | "result" | "error";
          event?: CouncilProgressEvent;
          result?: RunCouncilResult;
          error?: {
            error?: string;
            message?: string;
            type?: string;
            retryable?: boolean;
          };
        };
        try {
          msg = JSON.parse(trimmed);
        } catch {
          return;
        }

        if (msg.kind === "progress" && msg.event) {
          const event = msg.event;
          setAgentStatuses((prev) => reduceAgentStatuses(prev, event));
          if (event.type === "phase_started") setPhase(event.phase);
        } else if (msg.kind === "result" && msg.result) {
          setResult(msg.result);
          setPhase("done");
        } else if (msg.kind === "error" && msg.error) {
          setError({
            title: msg.error.error || "Error",
            message: msg.error.message || "Something went wrong.",
            type: msg.error.type || "unknown",
            retryable: msg.error.retryable ?? false,
          });
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          handleLine(buffer.slice(0, newlineIndex));
          buffer = buffer.slice(newlineIndex + 1);
        }
      }
      // Flush any trailing line without a newline.
      handleLine(buffer);
    } catch (err) {
      // An abort (user cancelled) is not an error — show a cancelled state.
      if (err instanceof DOMException && err.name === "AbortError") {
        setPhase("cancelled");
      } else if (controller.signal.aborted) {
        setPhase("cancelled");
      } else {
        setError({
          title: "Connection error",
          message:
            "Unable to reach the server. Please check your connection and try again.",
          type: "network",
          retryable: true,
        });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [input, mode, customAgents]);

  // Load a saved conversation into the main view
  const loadConversation = useCallback((conversation: RunCouncilResult) => {
    setResult(conversation);
    setInput(conversation.userInput);
    setMode(conversation.modeId);
    setError(null);
    setAgentStatuses([]);
    setPhase("idle");
  }, []);

  return (
    <CouncilContext.Provider
      value={{
        input,
        setInput,
        mode,
        setMode,
        loading,
        result,
        error,
        setError,
        inputError,
        setInputError,
        customAgents,
        setCustomAgents,
        agentStatuses,
        phase,
        runAnalysis,
        cancelAnalysis,
        loadConversation,
      }}
    >
      {children}
    </CouncilContext.Provider>
  );
}
