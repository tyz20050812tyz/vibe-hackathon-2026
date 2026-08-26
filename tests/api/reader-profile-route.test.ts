import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReadingProfileData } from "../../lib/types/resources";

const mocks = vi.hoisted(() => {
  class MockReadingProfileError extends Error {
    constructor(
      public readonly code:
        | "CONFIGURATION_ERROR"
        | "SUPABASE_UNAVAILABLE"
        | "UNAUTHORIZED"
        | "VALIDATION_ERROR"
        | "INTERNAL_ERROR",
      message: string,
    ) {
      super(message);
    }
  }

  return {
    getReadingProfile: vi.fn(),
    replaceReadingProfile: vi.fn(),
    clearReadingProfile: vi.fn(),
    ReadingProfileError: MockReadingProfileError,
  };
});

vi.mock("@/lib/services/reader-profile", () => ({
  getReadingProfile: mocks.getReadingProfile,
  replaceReadingProfile: mocks.replaceReadingProfile,
  clearReadingProfile: mocks.clearReadingProfile,
  ReadingProfileError: mocks.ReadingProfileError,
}));

import { DELETE, GET, PUT } from "../../app/api/reader-profile/route";

const token = "verified-access-token";
const tagIds = Array.from(
  { length: 9 },
  (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);
const incomplete: ReadingProfileData = {
  status: "incomplete",
  preferences: null,
};
const complete: ReadingProfileData = {
  status: "complete",
  preferences: {
    explorationLevel: "balanced",
    interestTags: [],
    favoriteBooks: [],
    onboardingCompletedAt: "2026-08-26T05:00:00.000Z",
  },
};

function request(method: "GET" | "PUT" | "DELETE", body?: string) {
  return new Request("http://localhost/api/reader-profile", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body,
  });
}

const validPutBody = {
  interestTagIds: tagIds.slice(0, 3),
  explorationLevel: "balanced",
  consent: true,
};

describe("reader profile API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getReadingProfile.mockResolvedValue(incomplete);
    mocks.replaceReadingProfile.mockResolvedValue(complete);
    mocks.clearReadingProfile.mockResolvedValue({ cleared: true });
  });

  it("requires Bearer authentication for GET", async () => {
    const response = await GET(
      new Request("http://localhost/api/reader-profile"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      data: null,
      error: { code: "UNAUTHORIZED" },
      requestId: expect.any(String),
    });
    expect(mocks.getReadingProfile).not.toHaveBeenCalled();
  });

  it("maps an invalid Bearer token to UNAUTHORIZED", async () => {
    mocks.getReadingProfile.mockRejectedValue(
      new mocks.ReadingProfileError("UNAUTHORIZED", "登录已失效，请重新登录。"),
    );

    const response = await GET(request("GET"));
    const body = await response.json();

    expect(mocks.getReadingProfile).toHaveBeenCalledWith(token);
    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.requestId).toEqual(expect.any(String));
  });

  it.each([
    ["incomplete", incomplete],
    ["complete", complete],
  ])("returns the %s profile in the unified no-store envelope", async (_name, data) => {
    mocks.getReadingProfile.mockResolvedValue(data);

    const response = await GET(request("GET"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data,
      requestId: expect.any(String),
    });
  });

  it("rejects invalid JSON before calling the service", async () => {
    const response = await PUT(request("PUT", "{"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_JSON");
    expect(mocks.replaceReadingProfile).not.toHaveBeenCalled();
  });

  it.each([
    ["missing consent", { ...validPutBody, consent: undefined }],
    ["duplicate tags", { ...validPutBody, interestTagIds: [tagIds[0], tagIds[1], tagIds[0]] }],
    ["two tags", { ...validPutBody, interestTagIds: tagIds.slice(0, 2) }],
    ["nine tags", { ...validPutBody, interestTagIds: tagIds }],
    [
      "four favorite books",
      {
        ...validPutBody,
        favoriteBooks: Array.from({ length: 4 }, (_, index) => ({
          title: `Book ${index}`,
        })),
      },
    ],
  ])("rejects %s with VALIDATION_ERROR", async (_name, payload) => {
    const response = await PUT(request("PUT", JSON.stringify(payload)));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.requestId).toEqual(expect.any(String));
    expect(mocks.replaceReadingProfile).not.toHaveBeenCalled();
  });

  it("normalizes a blank author and calls the replace RPC service boundary", async () => {
    const response = await PUT(
      request(
        "PUT",
        JSON.stringify({
          ...validPutBody,
          favoriteBooks: [{ title: "Book", author: "   " }],
        }),
      ),
    );

    expect(mocks.replaceReadingProfile).toHaveBeenCalledWith(token, {
      ...validPutBody,
      favoriteBooks: [{ title: "Book", author: null }],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("clears the profile through the service and returns the frozen response", async () => {
    const response = await DELETE(request("DELETE"));

    expect(mocks.clearReadingProfile).toHaveBeenCalledWith(token);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { cleared: true },
      requestId: expect.any(String),
    });
  });
});
