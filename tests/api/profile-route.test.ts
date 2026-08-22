import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfileOverview } from "../../lib/types/profile";

const mocks = vi.hoisted(() => {
  class MockProfileServiceError extends Error {
    constructor(
      public readonly code:
        | "UNAUTHORIZED"
        | "SUPABASE_UNAVAILABLE"
        | "INTERNAL_ERROR",
      message: string,
    ) {
      super(message);
    }
  }

  return {
    client: {},
    createClient: vi.fn(),
    getProfileOverview: vi.fn(),
    updateProfile: vi.fn(),
    ProfileServiceError: MockProfileServiceError,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseCookieServerClient: mocks.createClient,
}));

vi.mock("@/lib/services/profile", () => ({
  getProfileOverview: mocks.getProfileOverview,
  updateProfile: mocks.updateProfile,
  ProfileServiceError: mocks.ProfileServiceError,
}));

import { GET, PATCH } from "../../app/api/profile/route";

const overview: ProfileOverview = {
  profile: {
    id: "123e4567-e89b-42d3-a456-426614174000",
    displayName: "reader",
    email: "reader@example.com",
    joinedAt: "2026-08-22T08:00:00.000Z",
  },
  stats: {
    savedCount: 0,
    notedCount: 0,
    topicCount: 0,
    latestSavedAt: null,
  },
};

describe("profile API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue(mocks.client);
    mocks.getProfileOverview.mockResolvedValue(overview);
    mocks.updateProfile.mockResolvedValue(overview);
  });

  it("returns the authenticated profile overview in the unified envelope", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.data).toEqual(overview);
    expect(body.requestId).toEqual(expect.any(String));
  });

  it("maps an unauthenticated profile request to 401", async () => {
    mocks.getProfileOverview.mockRejectedValue(
      new mocks.ProfileServiceError("UNAUTHORIZED", "请先登录。"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "UNAUTHORIZED", message: "请先登录。" },
      requestId: expect.any(String),
    });
  });

  it("normalizes and passes a valid display-name update to the service", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "  新名称  " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateProfile).toHaveBeenCalledWith(mocks.client, {
      displayName: "新名称",
    });
  });

  it("rejects invalid JSON without calling the service", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        body: "{",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_JSON");
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects fields other than displayName", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: "新名称",
          email: "changed@example.com",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });
});
