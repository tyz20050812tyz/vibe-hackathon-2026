import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockDiscoveryError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
    }
  }
  return { discover: vi.fn(), DiscoveryError: MockDiscoveryError };
});

vi.mock("@/lib/services/discovery", () => ({
  discover: mocks.discover,
  DiscoveryError: mocks.DiscoveryError,
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

  it("allows anonymous use and passes a Bearer token when present", async () => {
    await POST(request(JSON.stringify({ originResourceId })));
    expect(mocks.discover).toHaveBeenLastCalledWith({ originResourceId, mode: "surprise" }, undefined);

    await POST(request(JSON.stringify({ originResourceId }), "access-token"));
    expect(mocks.discover).toHaveBeenLastCalledWith({ originResourceId, mode: "surprise" }, "access-token");
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
