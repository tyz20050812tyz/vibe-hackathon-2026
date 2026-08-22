import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscoveryData } from "../../lib/types/discovery";

const mocks = vi.hoisted(() => {
  class MockDiscoveryServiceError extends Error {
    constructor(
      public readonly code:
        | "UNAUTHORIZED"
        | "RESOURCE_NOT_FOUND"
        | "SUPABASE_UNAVAILABLE"
        | "INTERNAL_ERROR",
      message: string,
    ) {
      super(message);
    }
  }

  return {
    publicClient: { kind: "public" },
    cookieClient: { kind: "cookie" },
    createPublicClient: vi.fn(),
    createCookieClient: vi.fn(),
    getDiscovery: vi.fn(),
    DiscoveryServiceError: MockDiscoveryServiceError,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabasePublicServerClient: mocks.createPublicClient,
  createSupabaseCookieServerClient: mocks.createCookieClient,
}));

vi.mock("@/lib/services/discovery", () => ({
  getDiscovery: mocks.getDiscovery,
  DiscoveryServiceError: mocks.DiscoveryServiceError,
}));

import { GET } from "../../app/api/discover/route";

const sourceId = "11111111-1111-4111-8111-111111111111";
const emptyDiscovery: DiscoveryData = {
  source: null,
  items: [],
  mode: "empty",
};

describe("discovery API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPublicClient.mockReturnValue(mocks.publicClient);
    mocks.createCookieClient.mockResolvedValue(mocks.cookieClient);
    mocks.getDiscovery.mockResolvedValue(emptyDiscovery);
  });

  it("uses the public client for an explicit source and returns the unified envelope", async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/discover?sourceResourceId=${sourceId}`,
      ),
    );
    const body = await response.json();

    expect(mocks.createPublicClient).toHaveBeenCalledOnce();
    expect(mocks.createCookieClient).not.toHaveBeenCalled();
    expect(mocks.getDiscovery).toHaveBeenCalledWith(mocks.publicClient, {
      sourceResourceId: sourceId,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      data: emptyDiscovery,
      requestId: expect.any(String),
    });
  });

  it("rejects an invalid source UUID before creating a client", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/discover?sourceResourceId=not-a-uuid",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.requestId).toEqual(expect.any(String));
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(mocks.createCookieClient).not.toHaveBeenCalled();
  });

  it("uses the cookie client and returns 401 when an implicit request is unauthenticated", async () => {
    mocks.getDiscovery.mockRejectedValue(
      new mocks.DiscoveryServiceError("UNAUTHORIZED", "请先登录。"),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/discover"),
    );
    const body = await response.json();

    expect(mocks.createCookieClient).toHaveBeenCalledOnce();
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "UNAUTHORIZED" },
      requestId: expect.any(String),
    });
  });

  it("maps a missing source to RESOURCE_NOT_FOUND", async () => {
    mocks.getDiscovery.mockRejectedValue(
      new mocks.DiscoveryServiceError(
        "RESOURCE_NOT_FOUND",
        "探索起点资源不存在。",
      ),
    );

    const response = await GET(
      new NextRequest(
        `http://localhost/api/discover?sourceResourceId=${sourceId}`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("RESOURCE_NOT_FOUND");
  });
});
