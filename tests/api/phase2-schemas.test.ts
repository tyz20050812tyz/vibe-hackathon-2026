import { describe, expect, it } from "vitest";

import { discoverQuerySchema } from "../../lib/schemas/discovery";
import { profileUpdateSchema } from "../../lib/schemas/profile";

describe("phase two API input schemas", () => {
  it("normalizes a valid profile display name", () => {
    expect(profileUpdateSchema.parse({ displayName: "  杨思涵  " })).toEqual({
      displayName: "杨思涵",
    });
  });

  it("rejects empty profile display names", () => {
    expect(profileUpdateSchema.safeParse({ displayName: "   " }).success).toBe(
      false,
    );
  });

  it("accepts an optional valid discovery source UUID", () => {
    expect(discoverQuerySchema.parse({})).toEqual({});
    expect(
      discoverQuerySchema.parse({
        sourceResourceId: "123e4567-e89b-42d3-a456-426614174000",
      }),
    ).toEqual({
      sourceResourceId: "123e4567-e89b-42d3-a456-426614174000",
    });
  });

  it("rejects an invalid discovery source UUID", () => {
    expect(
      discoverQuerySchema.safeParse({ sourceResourceId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
