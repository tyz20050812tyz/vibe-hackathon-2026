import type { SupabaseClient, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getProfileOverview,
  ProfileServiceError,
  updateProfile,
} from "../../lib/services/profile";

const user = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  email: "reader@example.com",
  created_at: "2026-08-22T08:00:00.000Z",
} as User;

type SavedRow = {
  resource_id: string;
  note: string | null;
  saved_at: string;
};

function createClient({
  profileDisplayName = "reader",
  savedRows = [],
  tagRows = [],
}: {
  profileDisplayName?: string | null;
  savedRows?: SavedRow[];
  tagRows?: Array<{ tag_id: string }>;
} = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const conditionalIs = vi.fn().mockResolvedValue({ error: null });
  const updateEq = vi.fn((field: string, value: string) => ({
    is: conditionalIs,
    select: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: value, display_name: lastUpdate?.display_name ?? null },
        error: null,
      }),
    })),
  }));
  let lastUpdate: { display_name: string } | null = null;
  const update = vi.fn((values: { display_name: string }) => {
    lastUpdate = values;
    return { eq: updateEq };
  });
  const profileSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: user.id, display_name: profileDisplayName },
        error: null,
      }),
    })),
  }));
  const savedSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      order: vi.fn().mockResolvedValue({ data: savedRows, error: null }),
    })),
  }));
  const tagSelect = vi.fn(() => ({
    in: vi.fn().mockResolvedValue({ data: tagRows, error: null }),
  }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return { upsert, update, select: profileSelect };
    }
    if (table === "saved_resources") {
      return { select: savedSelect };
    }
    if (table === "resource_tags") {
      return { select: tagSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from,
  } as unknown as SupabaseClient;

  return { client, upsert, update, updateEq, conditionalIs };
}

describe("profile service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes through a null-only default-name update without overwriting a custom name", async () => {
    const { client, upsert, update, updateEq, conditionalIs } = createClient({
      profileDisplayName: "自定义名称",
    });

    const result = await getProfileOverview(client);

    expect(upsert).toHaveBeenCalledWith(
      { id: user.id },
      { onConflict: "id", ignoreDuplicates: true },
    );
    expect(update).toHaveBeenCalledWith({ display_name: "reader" });
    expect(updateEq).toHaveBeenCalledWith("id", user.id);
    expect(conditionalIs).toHaveBeenCalledWith("display_name", null);
    expect(result.profile).toEqual({
      id: user.id,
      displayName: "自定义名称",
      email: user.email,
      joinedAt: user.created_at,
    });
  });

  it("returns zeroed stats for an empty library", async () => {
    const { client } = createClient();

    await expect(getProfileOverview(client)).resolves.toMatchObject({
      stats: {
        savedCount: 0,
        notedCount: 0,
        topicCount: 0,
        latestSavedAt: null,
      },
    });
  });

  it("calculates saved, noted, topic, and latest-saved statistics", async () => {
    const { client } = createClient({
      savedRows: [
        {
          resource_id: "223e4567-e89b-42d3-a456-426614174000",
          note: "重点阅读",
          saved_at: "2026-08-22T10:00:00.000Z",
        },
        {
          resource_id: "323e4567-e89b-42d3-a456-426614174000",
          note: "   ",
          saved_at: "2026-08-21T10:00:00.000Z",
        },
      ],
      tagRows: [{ tag_id: "tag-a" }, { tag_id: "tag-a" }, { tag_id: "tag-b" }],
    });

    await expect(getProfileOverview(client)).resolves.toMatchObject({
      stats: {
        savedCount: 2,
        notedCount: 1,
        topicCount: 2,
        latestSavedAt: "2026-08-22T10:00:00.000Z",
      },
    });
  });

  it("updates only the authenticated user's display name", async () => {
    const { client, update } = createClient();

    const result = await updateProfile(client, { displayName: "新名称" });

    expect(update).toHaveBeenLastCalledWith({ display_name: "新名称" });
    expect(result.profile.displayName).toBe("新名称");
  });

  it("rejects requests without a verified user", async () => {
    const { client } = createClient();
    vi.mocked(client.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as never);

    await expect(getProfileOverview(client)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<ProfileServiceError>);
  });
});
