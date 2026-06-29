import type { TokenUsage } from "@/providers/types";

const numberFormatter = new Intl.NumberFormat();

export function formatTokenUsage(usage: TokenUsage): string | null {
  const parts: string[] = [];

  if (usage.totalTokens !== undefined) {
    parts.push(`${numberFormatter.format(usage.totalTokens)} total`);
  }
  if (usage.inputTokens !== undefined) {
    parts.push(`${numberFormatter.format(usage.inputTokens)} in`);
  }
  if (usage.outputTokens !== undefined) {
    parts.push(`${numberFormatter.format(usage.outputTokens)} out`);
  }

  return parts.length > 0 ? `Tokens used: ${parts.join(" · ")}` : null;
}

export function TokenUsageNote({
  usage,
  className,
}: {
  usage?: TokenUsage;
  className?: string;
}) {
  if (!usage) return null;

  const text = formatTokenUsage(usage);
  if (!text) return null;

  return (
    <p
      className={[
        "text-[11px] text-zinc-500 dark:text-zinc-400",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={
        usage.costUsd !== undefined
          ? `Provider-reported usage · estimated cost $${usage.costUsd.toFixed(4)}`
          : "Provider-reported token usage"
      }
    >
      {text}
    </p>
  );
}
