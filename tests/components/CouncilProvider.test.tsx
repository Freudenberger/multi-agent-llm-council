// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CouncilProvider, useCouncil } from "@/app/CouncilProvider";

function wrapper({ children }: { children: React.ReactNode }) {
  return <CouncilProvider>{children}</CouncilProvider>;
}

describe("CouncilProvider", () => {
  it("throws when useCouncil is used outside the provider", () => {
    // renderHook surfaces the thrown error rather than crashing the suite.
    expect(() => renderHook(() => useCouncil())).toThrow(
      /must be used within a CouncilProvider/,
    );
  });

  it("exposes sane defaults", () => {
    const { result } = renderHook(() => useCouncil(), { wrapper });
    expect(result.current.input).toBe("");
    expect(result.current.mode).toBe("decision");
    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it("updates input and mode via the setters", () => {
    const { result } = renderHook(() => useCouncil(), { wrapper });
    act(() => {
      result.current.setInput("Should we ship?");
      result.current.setMode("swot");
    });
    expect(result.current.input).toBe("Should we ship?");
    expect(result.current.mode).toBe("swot");
  });

  it("rejects empty input without starting a run", async () => {
    const { result } = renderHook(() => useCouncil(), { wrapper });
    await act(async () => {
      await result.current.runAnalysis();
    });
    // Validation short-circuits: an error is set and no run is in flight.
    expect(result.current.inputError).toBeTruthy();
    expect(result.current.loading).toBe(false);
  });
});
