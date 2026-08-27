import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConstellationData } from "../../lib/types/constellation";

const mocks = vi.hoisted(() => {
  class MockResourceConstellationError extends Error {
    constructor(
      public readonly code:
        | "CONFIGURATION_ERROR"
        | "RESOURCE_NOT_FOUND"
        | "SUPABASE_UNAVAILABLE"
        | "INTERNAL_ERROR",
      message: string,
    ) {
      super(message);
    }
  }
  return {
    getResourceConstellation: vi.fn(),
    ResourceConstellationError: MockResourceConstellationError,
  };
});

vi.mock("@/lib/services/resource-constellation", () => ({
  getResourceConstellation: mocks.getResourceConstellation,
  ResourceConstellationError: mocks.ResourceConstellationError,
}));

import { GET } from "../../app/api/resources/[slug]/constellation/route";

const data: ConstellationData = {
  centerResourceId: "10000000-0000-4000-8000-000000000001",
  nodes: [],
  edges: [],
  hasMoreSecondHop: false,
  personalization: "catalog",
};

function call(url: string, headers?: HeadersInit, slug = "center") {
  return GET(new Request(url, { headers }), { params: Promise.resolve({ slug }) });
}

describe("resource constellation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResourceConstellation.mockResolvedValue(data);
  });

  it("defaults to depth one and returns the unified no-store envelope", async () => {
    const response = await call("http://localhost/api/resources/center/constellation");
    const body = await response.json();

    expect(mocks.getResourceConstellation).toHaveBeenCalledWith("center", undefined);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ data, requestId: expect.any(String) });
  });

  it("passes an optional Bearer token without adding Cookie auth", async () => {
    await call(
      "http://localhost/api/resources/center/constellation?depth=1",
      { Authorization: "Bearer access-token", Cookie: "session=ignored" },
    );
    expect(mocks.getResourceConstellation)
      .toHaveBeenCalledWith("center", "access-token");
  });

  it("rejects depth two with the frozen transition message", async () => {
    const response = await call(
      "http://localhost/api/resources/center/constellation?depth=2",
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "二跳星图尚未启用，请使用 depth=1。",
      },
      requestId: expect.any(String),
    });
    expect(mocks.getResourceConstellation).not.toHaveBeenCalled();
  });

  it.each([
    "unknown=value",
    "depth=1&depth=1",
    "depth=1&depth=2",
    "depth=3",
  ])("rejects invalid query %s", async (query) => {
    const response = await call(
      `http://localhost/api/resources/center/constellation?${query}`,
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      data: null,
      error: { code: "VALIDATION_ERROR" },
      requestId: expect.any(String),
    });
    expect(mocks.getResourceConstellation).not.toHaveBeenCalled();
  });

  it.each([
    ["RESOURCE_NOT_FOUND", 404],
    ["CONFIGURATION_ERROR", 503],
    ["SUPABASE_UNAVAILABLE", 503],
    ["INTERNAL_ERROR", 500],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    mocks.getResourceConstellation.mockRejectedValue(
      new mocks.ResourceConstellationError(code, "星图读取失败。"),
    );
    const response = await call("http://localhost/api/resources/center/constellation");
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(body).toMatchObject({
      data: null,
      error: { code, message: "星图读取失败。" },
      requestId: expect.any(String),
    });
  });

  it("maps unknown errors and rejects an invalid slug", async () => {
    mocks.getResourceConstellation.mockRejectedValue(new Error("private detail"));
    const unknown = await call("http://localhost/api/resources/center/constellation");
    expect(unknown.status).toBe(500);
    expect(await unknown.json()).toMatchObject({
      error: { code: "INTERNAL_ERROR", message: "读取资源星图失败。" },
    });

    vi.clearAllMocks();
    const invalid = await call(
      "http://localhost/api/resources/INVALID/constellation",
      undefined,
      "INVALID",
    );
    expect(invalid.status).toBe(400);
    expect(mocks.getResourceConstellation).not.toHaveBeenCalled();
  });
});
