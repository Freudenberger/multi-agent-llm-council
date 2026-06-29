import type { TokenUsage } from "./types";

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function firstDefinedNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = asFiniteNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

/** Best-effort normalization of provider usage/cost fields into one shared shape. */
export function extractTokenUsage(payload: unknown): TokenUsage | undefined {
  const usage =
    payload && typeof payload === "object" && "usage" in payload
      ? (payload as { usage?: Record<string, unknown> }).usage
      : undefined;

  if (!usage || typeof usage !== "object") return undefined;

  const inputTokens = firstDefinedNumber(
    usage.inputTokens,
    usage.input_tokens,
    usage.promptTokens,
    usage.prompt_tokens,
  );
  const outputTokens = firstDefinedNumber(
    usage.outputTokens,
    usage.output_tokens,
    usage.completionTokens,
    usage.completion_tokens,
  );
  const explicitTotal = firstDefinedNumber(
    usage.totalTokens,
    usage.total_tokens,
  );
  const costUsd = firstDefinedNumber(
    usage.cost,
    usage.totalCost,
    usage.total_cost,
  );
  const totalTokens =
    explicitTotal ??
    (inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined);

  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined &&
    costUsd === undefined
  ) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
  };
}

/** Rough token estimate for mock/demo paths where no provider-reported usage exists. */
export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
}

/**
 * Approximate usage for synthetic/mock responses. This keeps UI/test behaviour
 * deterministic while making it obvious these are estimates rather than billed values.
 */
export function estimateTokenUsage(input: {
  systemPrompt?: string;
  userMessage?: string;
  content: string;
}): TokenUsage {
  const inputTokens =
    estimateTokenCount(input.systemPrompt ?? "") +
    estimateTokenCount(input.userMessage ?? "");
  const outputTokens = estimateTokenCount(input.content);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}
