import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockAuthServiceError extends Error {
    constructor(
      public readonly code:
        | "CONFIGURATION_ERROR"
        | "AUTHENTICATION_FAILED"
        | "SUPABASE_UNAVAILABLE",
      message: string,
    ) {
      super(message);
    }
  }

  return {
    client: {},
    createSupabaseServerClient: vi.fn(),
    signUp: vi.fn(),
    AuthServiceError: MockAuthServiceError,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/services/auth", () => ({
  signUp: mocks.signUp,
  AuthServiceError: mocks.AuthServiceError,
}));

import { POST } from "../../app/api/auth/sign-up/route";

const validPayload = {
  email: "reader@example.com",
  password: "password123!",
};

function request(origin = "http://request-origin.example") {
  return new Request(`${origin}/api/auth/sign-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validPayload),
  });
}

describe("sign-up confirmation site URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    mocks.createSupabaseServerClient.mockReturnValue(mocks.client);
    mocks.signUp.mockResolvedValue({ status: "confirmation_required" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["missing", undefined],
    ["invalid", "not-an-absolute-url"],
    ["non-http", "ftp://example.com"],
  ])(
    "returns 503 before creating auth dependencies when the site URL is %s",
    async (_label, configuredUrl) => {
      if (configuredUrl === undefined) {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
      } else {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", configuredUrl);
      }

      const response = await POST(request());
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(body).toMatchObject({
        data: null,
        error: { code: "CONFIGURATION_ERROR" },
        requestId: expect.any(String),
      });
      expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
      expect(mocks.signUp).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["http://localhost:3000", "http://localhost:3000/auth/confirmed"],
    ["https://library.example", "https://library.example/auth/confirmed"],
  ])(
    "uses the configured canonical site URL %s",
    async (configuredUrl, expectedRedirect) => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", configuredUrl);

      const response = await POST(request("https://untrusted-origin.example"));

      expect(response.status).toBe(200);
      expect(mocks.createSupabaseServerClient).toHaveBeenCalledOnce();
      expect(mocks.signUp).toHaveBeenCalledWith(
        mocks.client,
        validPayload,
        expectedRedirect,
      );
    },
  );

  it("does not fall back to the request Origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    const response = await POST(request("https://request-origin.example"));

    expect(response.status).toBe(503);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});
