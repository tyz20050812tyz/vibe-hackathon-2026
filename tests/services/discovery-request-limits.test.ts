import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: { rpc: vi.fn() },
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import {
  claimDiscoveryRequest,
  requesterIdentity,
} from "../../lib/services/discovery-request-limits";

describe("discovery request entry limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DISCOVERY_LIMIT_HASH_SALT", "test-salt");
    vi.stubEnv("TRUST_PROXY", "false");
    mocks.createSupabaseServerClient.mockReturnValue(mocks.client);
    mocks.client.rpc.mockResolvedValue({
      data: [{ permitted: true, retry_after_seconds: 0 }],
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores only a salted identity hash in the RPC claim", async () => {
    await expect(claimDiscoveryRequest("ip:203.0.113.9", 321)).resolves.toEqual({
      status: "permitted",
    });

    const expectedHash = createHash("sha256")
      .update("test-salt:ip:203.0.113.9")
      .digest("hex");
    expect(mocks.client.rpc).toHaveBeenCalledWith("claim_discovery_request", {
      p_identity_hash: expectedHash,
      p_request_bytes: 321,
      p_request_limit: 30,
      p_byte_limit: 128 * 1024,
      p_window_seconds: 60,
    });
    expect(JSON.stringify(mocks.client.rpc.mock.calls)).not.toContain("203.0.113.9");
  });

  it("maps a denied claim and its fixed-window retry delay", async () => {
    mocks.client.rpc.mockResolvedValue({
      data: [{ permitted: false, retry_after_seconds: 42 }],
      error: null,
    });

    await expect(claimDiscoveryRequest("anonymous", 100)).resolves.toEqual({
      status: "rate_limited",
      retryAfterSeconds: 42,
    });
  });

  it.each([
    { data: null, error: new Error("unavailable") },
    { data: [{ permitted: false, retry_after_seconds: 0 }], error: null },
  ])("fails open as unavailable for invalid limiter results", async (result) => {
    mocks.client.rpc.mockResolvedValue(result);
    await expect(claimDiscoveryRequest("anonymous", 100)).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("does not create a server client when the shared hash salt is missing", async () => {
    vi.stubEnv("DISCOVERY_LIMIT_HASH_SALT", "");
    await expect(claimDiscoveryRequest("anonymous", 100)).resolves.toEqual({
      status: "unavailable",
    });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("ignores forwarded headers unless the proxy is trusted", () => {
    const request = new Request("http://localhost", {
      headers: { "X-Forwarded-For": "203.0.113.9" },
    });
    expect(requesterIdentity(request)).toBe("anonymous");
  });

  it("uses and normalizes only the first valid IP from a trusted proxy", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const request = new Request("http://localhost", {
      headers: {
        "X-Forwarded-For": "2001:0db8:0:0:0:0:0:1, 198.51.100.2",
      },
    });
    expect(requesterIdentity(request)).toBe("ip:2001:db8::1");
  });

  it("falls back to the shared anonymous identity for invalid forwarded data", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const request = new Request("http://localhost", {
      headers: { "X-Forwarded-For": "not-an-ip" },
    });
    expect(requesterIdentity(request)).toBe("anonymous");
  });
});
