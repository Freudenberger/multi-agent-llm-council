import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/openapi/route";
import pkg from "../../package.json";

describe("GET /api/openapi", () => {
  it("returns the OpenAPI spec with the live package version", async () => {
    const body = await GET().json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.version).toBe(pkg.version);
    expect(body.paths["/api/openapi"]).toBeDefined();
  });
});
