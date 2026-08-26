import type { SupabaseClient, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
  createAuthenticatedClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabasePublicServerClient: mocks.createPublicClient,
  createSupabaseAuthenticatedServerClient: mocks.createAuthenticatedClient,
}));

import {
  ResourceCatalogError,
  searchResources,
} from "../../lib/services/resource-catalog";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "resource-one",
  type: "book",
  title: "Resource One",
  creators: ["Author"],
  published_year: 2026,
  languages: ["zh", "en"],
  summary: "A sufficiently detailed summary for resource catalog testing.",
  cover_url: null,
  availability: "online",
  tags: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "设计",
      slug: "design",
      category: "theme",
    },
  ],
  total_count: 7,
};

type ClientOptions = {
  authenticated?: boolean;
  complete?: boolean;
  searchError?: boolean;
};

function createClient({
  authenticated = true,
  complete = true,
  searchError = false,
}: ClientOptions = {}) {
  const authGetUser = vi.fn().mockResolvedValue(
    authenticated
      ? {
          data: {
            user: {
              id: "99999999-9999-4999-8999-999999999999",
            } as User,
          },
          error: null,
        }
      : { data: { user: null }, error: new Error("invalid token") },
  );
  const rpc = vi.fn((name: string) => {
    if (name === "reader_profile_is_complete") {
      return Promise.resolve({ data: complete, error: null });
    }
    if (
      name === "search_resource_catalog_v2" ||
      name === "search_resource_catalog_personalized_v2"
    ) {
      return Promise.resolve({
        data: searchError ? null : [row],
        error: searchError ? { message: "private database detail" } : null,
      });
    }
    throw new Error(`Unexpected RPC: ${name}`);
  });
  const client = {
    auth: { getUser: authGetUser },
    rpc,
  } as unknown as SupabaseClient;
  return { client, authGetUser, rpc };
}

const query = {
  q: "design",
  tag: "city",
  languages: ["zh", "en"] as const,
  yearFrom: 1000,
  yearTo: 2100,
  types: ["book", "paper"] as const,
  availabilities: ["online", "available"] as const,
  sort: "personalized" as const,
  limit: 3,
};

describe("resource catalog service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls catalog v2 with frozen parameters and maps the response", async () => {
    const publicClient = createClient();
    mocks.createPublicClient.mockReturnValue(publicClient.client);

    const result = await searchResources({ ...query, sort: "catalog" });

    expect(publicClient.rpc).toHaveBeenCalledWith(
      "search_resource_catalog_v2",
      {
        p_q: "design",
        p_tag: "city",
        p_year_from: 1000,
        p_year_to: 2100,
        p_languages: ["zh", "en"],
        p_types: ["book", "paper"],
        p_availabilities: ["online", "available"],
        p_limit: 3,
      },
    );
    expect(result).toEqual({
      items: [
        {
          id: row.id,
          slug: row.slug,
          type: "book",
          title: row.title,
          creators: ["Author"],
          publishedYear: 2026,
          languages: ["zh", "en"],
          summary: row.summary,
          coverUrl: null,
          availability: "online",
          tags: row.tags,
        },
      ],
      total: 7,
      appliedFilters: {
        q: "design",
        tag: "city",
        languages: ["zh", "en"],
        yearFrom: 1000,
        yearTo: 2100,
        types: ["book", "paper"],
        availabilities: ["online", "available"],
      },
      appliedSort: "catalog",
      personalization: "catalog",
    });
  });

  it("falls back to catalog when a personalized request has no Bearer", async () => {
    const publicClient = createClient();
    mocks.createPublicClient.mockReturnValue(publicClient.client);

    const result = await searchResources(query);

    expect(mocks.createAuthenticatedClient).not.toHaveBeenCalled();
    expect(publicClient.rpc).toHaveBeenCalledWith(
      "search_resource_catalog_v2",
      expect.any(Object),
    );
    expect(result).toMatchObject({
      appliedSort: "catalog",
      personalization: "catalog",
    });
  });

  it("falls back to catalog when the Bearer is invalid", async () => {
    const publicClient = createClient();
    const authenticatedClient = createClient({ authenticated: false });
    mocks.createPublicClient.mockReturnValue(publicClient.client);
    mocks.createAuthenticatedClient.mockReturnValue(authenticatedClient.client);

    const result = await searchResources(query, "invalid-token");

    expect(authenticatedClient.authGetUser).toHaveBeenCalledOnce();
    expect(publicClient.rpc).toHaveBeenCalledWith(
      "search_resource_catalog_v2",
      expect.any(Object),
    );
    expect(result.appliedSort).toBe("catalog");
  });

  it("falls back to catalog when the authenticated profile is incomplete", async () => {
    const publicClient = createClient();
    const authenticatedClient = createClient({ complete: false });
    mocks.createPublicClient.mockReturnValue(publicClient.client);
    mocks.createAuthenticatedClient.mockReturnValue(authenticatedClient.client);

    const result = await searchResources(query, "valid-token");

    expect(authenticatedClient.rpc).toHaveBeenCalledWith(
      "reader_profile_is_complete",
    );
    expect(publicClient.rpc).toHaveBeenCalledWith(
      "search_resource_catalog_v2",
      expect.any(Object),
    );
    expect(result.personalization).toBe("catalog");
  });

  it("uses personalized v2 only for a verified user with a complete profile", async () => {
    const publicClient = createClient();
    const authenticatedClient = createClient();
    mocks.createPublicClient.mockReturnValue(publicClient.client);
    mocks.createAuthenticatedClient.mockReturnValue(authenticatedClient.client);

    const result = await searchResources(query, "valid-token");

    expect(mocks.createAuthenticatedClient).toHaveBeenCalledWith("valid-token");
    expect(authenticatedClient.rpc).toHaveBeenNthCalledWith(
      2,
      "search_resource_catalog_personalized_v2",
      {
        p_q: "design",
        p_tag: "city",
        p_year_from: 1000,
        p_year_to: 2100,
        p_languages: ["zh", "en"],
        p_types: ["book", "paper"],
        p_availabilities: ["online", "available"],
        p_limit: 3,
      },
    );
    expect(publicClient.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      appliedSort: "personalized",
      personalization: "profile",
    });
  });

  it("hides catalog RPC failures", async () => {
    const publicClient = createClient({ searchError: true });
    mocks.createPublicClient.mockReturnValue(publicClient.client);

    await expect(
      searchResources({ ...query, sort: "catalog" }),
    ).rejects.toMatchObject({
      code: "SUPABASE_UNAVAILABLE",
      message: "无法搜索资源目录。",
    } satisfies Partial<ResourceCatalogError>);
  });
});
