import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchResourcesData } from "../../lib/types/resources";

const mocks = vi.hoisted(() => {
  class MockResourceCatalogError extends Error {
    constructor(
      public readonly code:
        | "CONFIGURATION_ERROR"
        | "SUPABASE_UNAVAILABLE"
        | "INTERNAL_ERROR",
      message: string,
    ) {
      super(message);
    }
  }

  return {
    searchResources: vi.fn(),
    ResourceCatalogError: MockResourceCatalogError,
  };
});

vi.mock("@/lib/services/resource-catalog", () => ({
  searchResources: mocks.searchResources,
  ResourceCatalogError: mocks.ResourceCatalogError,
}));

import { GET } from "../../app/api/resources/route";

const data: SearchResourcesData = {
  items: [],
  total: 0,
  appliedFilters: {
    q: "",
    tag: null,
    languages: [],
    yearFrom: null,
    yearTo: null,
    types: [],
    availabilities: [],
  },
  appliedSort: "catalog",
  personalization: "catalog",
};

describe("resource catalog API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchResources.mockResolvedValue(data);
  });

  it("passes repeated filters and optional Bearer token to the service", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/resources?language=zh&language=en&type=book&type=paper&availability=online&availability=available&tag=city&yearFrom=1000&yearTo=2100&sort=personalized&limit=50",
        { headers: { Authorization: "Bearer access-token" } },
      ),
    );
    const body = await response.json();

    expect(mocks.searchResources).toHaveBeenCalledWith(
      {
        q: undefined,
        tag: "city",
        languages: ["zh", "en"],
        yearFrom: 1000,
        yearTo: 2100,
        types: ["book", "paper"],
        availabilities: ["online", "available"],
        sort: "personalized",
        limit: 50,
      },
      "access-token",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ data, requestId: expect.any(String) });
  });

  it.each([
    "language=en&language=en",
    "q=one&q=two",
    "unknown=value",
    "yearFrom=2026&yearTo=2000",
    "limit=51",
  ])("returns VALIDATION_ERROR for %s", async (query) => {
    const response = await GET(
      new NextRequest(`http://localhost/api/resources?${query}`),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      data: null,
      error: { code: "VALIDATION_ERROR" },
      requestId: expect.any(String),
    });
    expect(mocks.searchResources).not.toHaveBeenCalled();
  });

  it.each([
    ["CONFIGURATION_ERROR", 503],
    ["SUPABASE_UNAVAILABLE", 503],
    ["INTERNAL_ERROR", 500],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    mocks.searchResources.mockRejectedValue(
      new mocks.ResourceCatalogError(code, "目录读取失败。"),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/resources"),
    );
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body).toMatchObject({
      data: null,
      error: { code, message: "目录读取失败。" },
      requestId: expect.any(String),
    });
  });
});
