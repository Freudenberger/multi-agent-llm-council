import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/openapi/route";
import pkg from "../../package.json";
import spec from "../../openapi.json";

describe("GET /api/openapi", () => {
  it("returns the OpenAPI spec with the live package version", async () => {
    const body = await GET().json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.version).toBe(pkg.version);
    expect(body.paths["/api/openapi"]).toBeDefined();
  });

  // Drift guard: the route overrides info.version at serve time, but the static
  // openapi.json literal must still be bumped on release. This fails CI if a
  // version bump forgets the spec, so the file never silently rots.
  it("keeps the static openapi.json version in sync with package.json", () => {
    expect(spec.info.version).toBe(pkg.version);
  });
});
