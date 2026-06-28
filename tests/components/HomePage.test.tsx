// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CouncilProvider } from "@/app/CouncilProvider";
import Home from "@/app/page";

// The page reads the session and fetches /api/models + /api/user/settings on
// mount. Stub both so the smoke render is deterministic and offline.
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 200 })),
  );
});

describe("Home page", () => {
  it("renders the council UI without crashing", () => {
    render(
      <CouncilProvider>
        <Home />
      </CouncilProvider>,
    );
    expect(screen.getByText("Multi-Agent LLM Council")).toBeTruthy();
    expect(
      screen.getByPlaceholderText(/Enter your question, problem, idea/),
    ).toBeTruthy();
  });
});
