// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TokenUsageNote,
  formatTokenUsage,
} from "@/app/components/TokenUsageNote";

describe("TokenUsageNote", () => {
  it("formats total, input, and output token counts", () => {
    expect(
      formatTokenUsage({ inputTokens: 120, outputTokens: 45, totalTokens: 165 }),
    ).toBe("Tokens used: 165 total · 120 in · 45 out");
  });

  it("renders nothing when usage is missing", () => {
    const { container } = render(<TokenUsageNote />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a compact usage note", () => {
    render(
      <TokenUsageNote
        usage={{ inputTokens: 120, outputTokens: 45, totalTokens: 165 }}
      />,
    );

    expect(screen.getByText("Tokens used: 165 total · 120 in · 45 out")).toBeTruthy();
  });
});
