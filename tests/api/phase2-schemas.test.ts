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

  it("accepts 50-character display names and rejects longer values", () => {
    expect(
      profileUpdateSchema.safeParse({ displayName: "a".repeat(50) }).success,
    ).toBe(true);
    expect(
      profileUpdateSchema.safeParse({ displayName: "a".repeat(51) }).success,
    ).toBe(false);
  });

  it("rejects extra profile fields", () => {
    expect(
      profileUpdateSchema.safeParse({
        displayName: "读者",
        email: "changed@example.com",
      }).success,
    ).toBe(false);
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

  it("rejects empty discovery source IDs and extra query fields", () => {
    expect(
      discoverQuerySchema.safeParse({ sourceResourceId: "" }).success,
    ).toBe(false);
    expect(
      discoverQuerySchema.safeParse({
        sourceResourceId: "123e4567-e89b-42d3-a456-426614174000",
        limit: "3",
      }).success,
    ).toBe(false);
  });
});
