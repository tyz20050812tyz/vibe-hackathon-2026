import { describe, expect, it } from "vitest";

import type { DiscoveryData } from "../../lib/types/discovery";
import type { ProfileOverview, ProfileUpdate } from "../../lib/types/profile";

describe("phase two service contracts", () => {
  it("supports an empty profile overview", () => {
    const overview: ProfileOverview = {
      profile: {
        id: "123e4567-e89b-42d3-a456-426614174000",
        displayName: null,
        email: "reader@example.com",
        joinedAt: null,
      },
      stats: {
        savedCount: 0,
        notedCount: 0,
        topicCount: 0,
        latestSavedAt: null,
      },
    };
    const update: ProfileUpdate = { displayName: "读者" };

    expect(overview.stats.savedCount).toBe(0);
    expect(update.displayName).toBe("读者");
  });

  it("supports the empty discovery mode", () => {
    const discovery: DiscoveryData = {
      source: null,
      items: [],
      mode: "empty",
    };

    expect(discovery).toEqual({ source: null, items: [], mode: "empty" });
  });
});
