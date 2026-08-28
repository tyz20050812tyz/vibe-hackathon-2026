import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockDiscoveryError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
    }
  }
  return {
    claimDiscoveryRequest: vi.fn(),
    discover: vi.fn(),
    DiscoveryError: MockDiscoveryError,
  };
});

vi.mock("@/lib/services/discovery", () => ({
  discover: mocks.discover,
  DiscoveryError: mocks.DiscoveryError,
}));
vi.mock("@/lib/services/discovery-request-limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/services/discovery-request-limits")>()),
  claimDiscoveryRequest: mocks.claimDiscoveryRequest,
}));

import { POST } from "../../app/api/discoveries/route";

const originResourceId = "00000000-0000-4000-8000-000000000001";
const result = {
  originResourceId,
  selectedMode: "surprise",
  usedRelationType: null,
  constrainedBySourceFilters: false,
  personalization: "catalog",
  recommendation: null,
};

function request(body: string, token?: string) {
  return new Request("http://localhost/api/discoveries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
}

describe("POST /api/discoveries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DISCOVERY_LIMIT_HASH_SALT", "test-salt");
    vi.stubEnv("TRUST_PROXY", "false");
    mocks.claimDiscoveryRequest.mockResolvedValue({ status: "permitted" });
    mocks.discover.mockResolvedValue(result);
  });

  it("rejects invalid JSON and invalid payloads", async () => {
    const invalidJson = await POST(request("{"));
    expect(invalidJson.status).toBe(400);
    expect((await invalidJson.json()).error.code).toBe("INVALID_JSON");

    const invalidPayload = await POST(request(JSON.stringify({ originResourceId: "nope" })));
    expect(invalidPayload.status).toBe(400);
    expect((await invalidPayload.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.discover).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads before invoking the discovery service", async () => {
    const response = await POST(request(JSON.stringify({ originResourceId, padding: "x".repeat(8 * 1024) })));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.claimDiscoveryRequest).not.toHaveBeenCalled();
    expect(mocks.discover).not.toHaveBeenCalled();
  });

  it("claims the entry limit before parsing JSON or validating Zod", async () => {
    mocks.claimDiscoveryRequest.mockResolvedValue({
      status: "rate_limited",
      retryAfterSeconds: 27,
    });

    const invalidJson = await POST(request("{"));
    const invalidPayload = await POST(request(JSON.stringify({ originResourceId: "nope" })));

    for (const response of [invalidJson, invalidPayload]) {
      expect(response.status).toBe(429);
      expect((await response.json()).error.code).toBe("RATE_LIMITED");
    }
    expect(mocks.claimDiscoveryRequest).toHaveBeenCalledTimes(2);
    expect(mocks.discover).not.toHaveBeenCalled();
  });

  it("returns the frozen private 429 response before discovery", async () => {
    mocks.claimDiscoveryRequest.mockResolvedValue({
      status: "rate_limited",
      retryAfterSeconds: 19,
    });

    const response = await POST(request(JSON.stringify({ originResourceId })));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("19");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("same-origin");
    expect(response.headers.has("X-RateLimit-Limit")).toBe(false);
    expect(body).toMatchObject({
      data: null,
      error: { code: "RATE_LIMITED" },
      requestId: expect.any(String),
    });
    expect(mocks.discover).not.toHaveBeenCalled();
  });

  it("allows anonymous use and passes a Bearer token when present", async () => {
    await POST(request(JSON.stringify({ originResourceId })));
    expect(mocks.discover).toHaveBeenLastCalledWith({ originResourceId, mode: "surprise" }, undefined, "anonymous", true);

    await POST(request(JSON.stringify({ originResourceId }), "access-token"));
    expect(mocks.discover).toHaveBeenLastCalledWith({ originResourceId, mode: "surprise" }, "access-token", "anonymous", true);
  });

  it("accepts a forwarded IP only when the deployment explicitly trusts its proxy", async () => {
    process.env.TRUST_PROXY = "true";
    try {
      await POST(new Request("http://localhost/api/discoveries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9, 10.0.0.1" },
        body: JSON.stringify({ originResourceId }),
      }));
      expect(mocks.discover).toHaveBeenLastCalledWith(
        { originResourceId, mode: "surprise" },
        undefined,
        "ip:203.0.113.9",
        true,
      );
    } finally {
      delete process.env.TRUST_PROXY;
    }
  });

  it("ignores forged forwarded IPs unless TRUST_PROXY is enabled", async () => {
    await POST(new Request("http://localhost/api/discoveries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.9",
      },
      body: JSON.stringify({ originResourceId }),
    }));

    expect(mocks.claimDiscoveryRequest).toHaveBeenCalledWith(
      "anonymous",
      expect.any(Number),
    );
    expect(mocks.discover).toHaveBeenCalledWith(
      { originResourceId, mode: "surprise" },
      undefined,
      "anonymous",
      true,
    );
  });

  it("keeps template discovery available when the entry limiter is unavailable", async () => {
    mocks.claimDiscoveryRequest.mockResolvedValue({ status: "unavailable" });

    const response = await POST(request(JSON.stringify({ originResourceId })));

    expect(response.status).toBe(200);
    expect(mocks.discover).toHaveBeenCalledWith(
      { originResourceId, mode: "surprise" },
      undefined,
      "anonymous",
      false,
    );
  });

  it("does not turn an invalid optional Bearer into a route-level 401", async () => {
    const response = await POST(request(JSON.stringify({ originResourceId }), "invalid"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.personalization).toBe("catalog");
  });

  it.each([
    ["no candidate", result],
    ["recommendation", { ...result, recommendation: { resource: { id: "target" }, relationExplanation: "why", narration: "why", narrationSource: "template" } }],
  ])("returns %s in the unified envelope", async (_name, data) => {
    mocks.discover.mockResolvedValue(data);
    const response = await POST(request(JSON.stringify({ originResourceId })));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ data, requestId: expect.any(String) });
  });

  it("uses private no-store and same-origin headers whenever context is present", async () => {
    const response = await POST(request(JSON.stringify({ originResourceId, discoveryContext: "token" })));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("same-origin");
  });

  it("maps an invalid discovery context without leaking it", async () => {
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    mocks.discover.mockRejectedValue(new mocks.DiscoveryError("INVALID_DISCOVERY_CONTEXT", "上下文无效。"));
    const response = await POST(request(JSON.stringify({ originResourceId, discoveryContext: "secret-token" })));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_DISCOVERY_CONTEXT");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it.each([
    ["SUPABASE_UNAVAILABLE", 503],
    ["CONFIGURATION_ERROR", 503],
  ])("maps %s service errors", async (code, status) => {
    mocks.discover.mockRejectedValue(new mocks.DiscoveryError(code, "服务不可用。"));
    const response = await POST(request(JSON.stringify({ originResourceId })));
    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(code);
  });

  it("maps unknown failures to INTERNAL_ERROR", async () => {
    mocks.discover.mockRejectedValue(new Error("private detail"));
    const response = await POST(request(JSON.stringify({ originResourceId })));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toEqual({ code: "INTERNAL_ERROR", message: "无法生成下一条阅读线索。" });
    expect(body.requestId).toEqual(expect.any(String));
  });
});
