import type { SupabaseClient, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAuthenticatedServerClient: mocks.createClient,
}));

import {
  clearReadingProfile,
  getReadingProfile,
  ReadingProfileError,
  replaceReadingProfile,
} from "../../lib/services/reader-profile";

const token = "verified-access-token";
const user = {
  id: "99999999-9999-4999-8999-999999999999",
} as User;
const tagId = "11111111-1111-4111-8111-111111111111";

type ClientOptions = {
  authenticated?: boolean;
  complete?: boolean;
  replaceError?: string;
  clearError?: string;
};

function createClient({
  authenticated = true,
  complete = true,
  replaceError,
  clearError,
}: ClientOptions = {}) {
  const authGetUser = vi.fn().mockResolvedValue(
    authenticated
      ? { data: { user }, error: null }
      : { data: { user: null }, error: new Error("invalid token") },
  );
  const rpc = vi.fn((name: string) => {
    if (name === "reader_profile_is_complete") {
      return Promise.resolve({ data: complete, error: null });
    }
    if (name === "replace_reader_profile") {
      return Promise.resolve({
        data: null,
        error: replaceError ? { message: replaceError } : null,
      });
    }
    if (name === "clear_reader_profile") {
      return Promise.resolve({
        data: null,
        error: clearError ? { message: clearError } : null,
      });
    }
    throw new Error(`Unexpected RPC: ${name}`);
  });
  const from = vi.fn((table: string) => {
    if (table === "reader_profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                exploration_level: "balanced",
                onboarding_completed_at: "2026-08-26T05:00:00.000Z",
              },
              error: null,
            }),
          })),
        })),
      };
    }
    if (table === "reader_profile_tags") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                tag: {
                  id: tagId,
                  name: "设计",
                  slug: "design",
                  category: "theme",
                },
              },
            ],
            error: null,
          }),
        })),
      };
    }
    if (table === "reader_profile_favorite_books") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [{ id: "book-1", title: "Book", author: null }],
              error: null,
            }),
          })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  const client = {
    auth: { getUser: authGetUser },
    rpc,
    from,
  } as unknown as SupabaseClient;

  return { client, authGetUser, rpc, from };
}

describe("reader profile service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses only the Bearer-authenticated user and returns incomplete without profile reads", async () => {
    const { client, authGetUser, from } = createClient({ complete: false });
    mocks.createClient.mockReturnValue(client);

    await expect(getReadingProfile(token)).resolves.toEqual({
      status: "incomplete",
      preferences: null,
    });
    expect(mocks.createClient).toHaveBeenCalledWith(token);
    expect(authGetUser).toHaveBeenCalledOnce();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an invalid Bearer user before reading profile tables", async () => {
    const { client, from } = createClient({ authenticated: false });
    mocks.createClient.mockReturnValue(client);

    await expect(getReadingProfile(token)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<ReadingProfileError>);
    expect(from).not.toHaveBeenCalled();
  });

  it("maps the complete profile, tags, books, and onboarding timestamp", async () => {
    const { client } = createClient();
    mocks.createClient.mockReturnValue(client);

    await expect(getReadingProfile(token)).resolves.toEqual({
      status: "complete",
      preferences: {
        explorationLevel: "balanced",
        onboardingCompletedAt: "2026-08-26T05:00:00.000Z",
        interestTags: [
          { id: tagId, name: "设计", slug: "design", category: "theme" },
        ],
        favoriteBooks: [{ id: "book-1", title: "Book", author: null }],
      },
    });
  });

  it("passes only frozen RPC parameters when replacing the profile", async () => {
    const { client, rpc } = createClient();
    mocks.createClient.mockReturnValue(client);
    const input = {
      interestTagIds: [tagId, "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"],
      explorationLevel: "bold" as const,
      favoriteBooks: [{ title: "Book", author: null }],
      consent: true as const,
    };

    await replaceReadingProfile(token, input);

    expect(rpc).toHaveBeenCalledWith("replace_reader_profile", {
      p_interest_tag_ids: input.interestTagIds,
      p_exploration_level: "bold",
      p_favorite_books: input.favoriteBooks,
      p_consent: true,
    });
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("userId");
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_user_id");
  });

  it("hides Supabase replacement errors behind a validation error", async () => {
    const { client } = createClient({
      replaceError: "DUPLICATE_INTEREST_TAGS: private database detail",
    });
    mocks.createClient.mockReturnValue(client);

    const operation = replaceReadingProfile(token, {
      interestTagIds: [tagId, tagId, tagId],
      explorationLevel: "gentle",
      consent: true,
    });

    await expect(operation).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "阅读偏好内容不合法。",
    } satisfies Partial<ReadingProfileError>);
  });

  it("calls only clear_reader_profile and returns the frozen clear result", async () => {
    const { client, rpc } = createClient();
    mocks.createClient.mockReturnValue(client);

    await expect(clearReadingProfile(token)).resolves.toEqual({ cleared: true });
    expect(rpc).toHaveBeenCalledWith("clear_reader_profile");
    expect(rpc).not.toHaveBeenCalledWith("replace_reader_profile", expect.anything());
  });

  it("hides Supabase clear failures", async () => {
    const { client } = createClient({ clearError: "private database detail" });
    mocks.createClient.mockReturnValue(client);

    await expect(clearReadingProfile(token)).rejects.toMatchObject({
      code: "SUPABASE_UNAVAILABLE",
      message: "无法清空阅读偏好。",
    } satisfies Partial<ReadingProfileError>);
  });
});
