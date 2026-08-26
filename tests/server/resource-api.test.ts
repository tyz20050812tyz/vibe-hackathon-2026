import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchResources: vi.fn(),
  getSession: vi.fn(),
  createCookieClient: vi.fn(),
}));

vi.mock("@/lib/services/resource-catalog", () => ({ searchResources: mocks.searchResources }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseCookieServerClient: mocks.createCookieClient }));

import { searchResourceCatalog } from "@/lib/server/resource-api";

describe("searchResourceCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "cookie-access-token" } } });
    mocks.createCookieClient.mockResolvedValue({ auth: { getSession: mocks.getSession } });
    mocks.searchResources.mockResolvedValue({ items: [], total: 0 });
  });

  it("uses the HTTP-only cookie session only for an explicit personalized search", async () => {
    await searchResourceCatalog({ sort: "personalized" });

    expect(mocks.createCookieClient).toHaveBeenCalledOnce();
    expect(mocks.getSession).toHaveBeenCalledOnce();
    expect(mocks.searchResources).toHaveBeenCalledWith(expect.objectContaining({ sort: "personalized" }), "cookie-access-token");
  });

  it("keeps a catalog search public and does not read the session", async () => {
    await searchResourceCatalog({ sort: "catalog" });

    expect(mocks.createCookieClient).not.toHaveBeenCalled();
    expect(mocks.searchResources).toHaveBeenCalledWith(expect.objectContaining({ sort: "catalog" }), undefined);
  });
});
