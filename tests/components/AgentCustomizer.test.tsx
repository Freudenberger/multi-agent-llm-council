// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentCustomizer } from "@/app/components/AgentCustomizer";
import type { CouncilAgent } from "@/core/types";

const AGENTS: CouncilAgent[] = [
  { id: "optimist", name: "Optimist", role: "Finds upside", systemPrompt: "..." },
  { id: "skeptic", name: "Skeptic", role: "Finds risk", systemPrompt: "..." },
];

function renderCustomizer(onChange = vi.fn()) {
  render(
    <AgentCustomizer
      defaultAgents={AGENTS}
      allTemplates={[]}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("AgentCustomizer", () => {
  it("is collapsed until the header is clicked", () => {
    renderCustomizer();
    expect(screen.getByText("Customize Agents")).toBeTruthy();
    // Agent rows are hidden while collapsed.
    expect(screen.queryByText("Optimist")).toBeNull();
  });

  it("reveals the mode's agents when expanded", () => {
    renderCustomizer();
    fireEvent.click(screen.getByText("Customize Agents"));
    expect(screen.getByText("Optimist")).toBeTruthy();
    expect(screen.getByText("Skeptic")).toBeTruthy();
  });

  it("fires onChange marking an agent disabled when toggled off", () => {
    const onChange = renderCustomizer();
    fireEvent.click(screen.getByText("Customize Agents"));
    // Each agent row has a "Disable agent" toggle button.
    fireEvent.click(screen.getAllByTitle("Disable agent")[0]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        optimist: expect.objectContaining({ disabled: true }),
      }),
    );
  });
});
