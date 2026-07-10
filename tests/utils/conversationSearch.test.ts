import { describe, expect, it } from "vitest";
import {
  buildTitleSearchClause,
  filterByTitle,
} from "../../src/utils/conversationSearch";

describe("buildTitleSearchClause", () => {
  it("parameterizes the search term instead of interpolating it", () => {
    const { clause, params } = buildTitleSearchClause("hello");
    expect(clause).toBe("title LIKE $1");
    expect(params).toEqual(["%hello%"]);
  });

  it("keeps SQL-injection payloads inside a bound parameter, not the clause", () => {
    const payload = "'; DROP TABLE conversations; --";
    const { clause, params } = buildTitleSearchClause(payload);
    expect(clause).toBe("title LIKE $1");
    expect(clause).not.toContain("DROP TABLE");
    expect(params).toEqual([`%${payload}%`]);
  });
});

describe("filterByTitle", () => {
  it("returns only rows whose title contains the term", () => {
    const rows = [
      { id: "1", title: "Budget review" },
      { id: "2", title: "Lunch plans" },
    ];
    expect(filterByTitle(rows, "review")).toEqual([
      { id: "1", title: "Budget review" },
    ]);
  });
});
