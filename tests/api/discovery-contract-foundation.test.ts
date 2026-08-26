import { describe, expect, it } from "vitest";

import { apiFailure } from "../../lib/api-response";
import {
  DISCOVERY_CONTEXT_TTL_MS,
  discoveryContextPayloadSchema,
  discoveryModeSchema,
  explorationLevelSchema,
  replaceReadingProfileSchema,
  searchResourcesQuerySchema,
} from "../../lib/schemas/resources";
import {
  clearSearchFilters,
  parseSearchFilters,
} from "../../lib/catalog-filters";

const tagIds = Array.from(
  { length: 8 },
  (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);

const profileInput = {
  interestTagIds: tagIds.slice(0, 3),
  explorationLevel: "balanced",
  consent: true,
} as const;

describe("discovery contract foundation", () => {
  it("accepts the 3 and 8 reading-profile tag boundaries", () => {
    expect(replaceReadingProfileSchema.safeParse(profileInput).success).toBe(true);
    expect(
      replaceReadingProfileSchema.safeParse({
        ...profileInput,
        interestTagIds: tagIds,
      }).success,
    ).toBe(true);
    expect(
      replaceReadingProfileSchema.safeParse({
        ...profileInput,
        interestTagIds: tagIds.slice(0, 2),
      }).success,
    ).toBe(false);
    expect(
      replaceReadingProfileSchema.safeParse({
        ...profileInput,
        interestTagIds: [...tagIds, "00000000-0000-4000-8000-999999999999"],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate tags and consent values other than true", () => {
    expect(
      replaceReadingProfileSchema.safeParse({
        ...profileInput,
        interestTagIds: [tagIds[0], tagIds[1], tagIds[0]],
      }).success,
    ).toBe(false);
    expect(
      replaceReadingProfileSchema.safeParse({ ...profileInput, consent: false })
        .success,
    ).toBe(false);
  });

  it("accepts zero to three favorite books, rejects more, and normalizes blank authors", () => {
    for (let count = 0; count <= 3; count += 1) {
      expect(
        replaceReadingProfileSchema.safeParse({
          ...profileInput,
          favoriteBooks: Array.from({ length: count }, (_, index) => ({
            title: `Book ${index}`,
          })),
        }).success,
      ).toBe(true);
    }
    expect(
      replaceReadingProfileSchema.safeParse({
        ...profileInput,
        favoriteBooks: Array.from({ length: 4 }, (_, index) => ({
          title: `Book ${index}`,
        })),
      }).success,
    ).toBe(false);
    expect(
      replaceReadingProfileSchema.parse({
        ...profileInput,
        favoriteBooks: [{ title: "Book", author: "   " }],
      }).favoriteBooks,
    ).toEqual([{ title: "Book", author: null }]);
  });

  it("enforces year boundaries and rejects reversed ranges", () => {
    expect(
      searchResourcesQuerySchema.safeParse({ yearFrom: 1000, yearTo: 2100 })
        .success,
    ).toBe(true);
    expect(searchResourcesQuerySchema.safeParse({ yearFrom: 999 }).success).toBe(false);
    expect(searchResourcesQuerySchema.safeParse({ yearTo: 2101 }).success).toBe(false);
    expect(
      searchResourcesQuerySchema.safeParse({ yearFrom: 2026, yearTo: 2000 })
        .success,
    ).toBe(false);
  });

  it("enforces multi-value limits and rejects duplicate filter values", () => {
    expect(
      searchResourcesQuerySchema.safeParse({ languages: ["zh", "en", "other"] })
        .success,
    ).toBe(true);
    expect(
      searchResourcesQuerySchema.safeParse({
        types: ["book", "paper", "talk", "collection", "book"],
      }).success,
    ).toBe(false);
    expect(
      searchResourcesQuerySchema.safeParse({
        availabilities: ["online", "available", "reference_only", "check_library"],
      }).success,
    ).toBe(true);
    expect(
      searchResourcesQuerySchema.safeParse({ languages: ["zh", "zh"] }).success,
    ).toBe(false);
  });

  it("rejects unknown and repeated URL query values", () => {
    expect(() => parseSearchFilters(new URLSearchParams("unknown=value"))).toThrow();
    expect(() =>
      parseSearchFilters(new URLSearchParams("language=zh&language=zh")),
    ).toThrow();
  });

  it("clears structured filters while retaining only q and sort", () => {
    expect(
      clearSearchFilters({
        q: "design",
        tag: "city",
        languages: ["en"],
        types: ["book"],
        sort: "personalized",
        limit: 50,
      }),
    ).toEqual({ q: "design", sort: "personalized" });
  });

  it("accepts only frozen discovery modes and exploration levels", () => {
    for (const mode of ["extend", "challenge", "context", "surprise"]) {
      expect(discoveryModeSchema.safeParse(mode).success).toBe(true);
    }
    for (const level of ["gentle", "balanced", "bold"]) {
      expect(explorationLevelSchema.safeParse(level).success).toBe(true);
    }
    expect(discoveryModeSchema.safeParse("random").success).toBe(false);
    expect(explorationLevelSchema.safeParse("extreme").success).toBe(false);
  });

  it("allows only the frozen discovery-context payload for exactly five minutes", () => {
    const issuedAt = 1_800_000_000_000;
    const payload = {
      version: 1,
      originSlug: "the-creative-act",
      filters: { languages: ["en"] },
      issuedAt,
      expiresAt: issuedAt + DISCOVERY_CONTEXT_TTL_MS,
    };
    expect(discoveryContextPayloadSchema.safeParse(payload).success).toBe(true);
    for (const forbidden of [
      "q",
      "userId",
      "email",
      "readingProfile",
      "bearerToken",
      "favoriteBooks",
    ]) {
      expect(
        discoveryContextPayloadSchema.safeParse({ ...payload, [forbidden]: "secret" })
          .success,
      ).toBe(false);
    }
    expect(
      discoveryContextPayloadSchema.safeParse({
        ...payload,
        expiresAt: issuedAt + DISCOVERY_CONTEXT_TTL_MS + 1,
      }).success,
    ).toBe(false);
    expect(
      discoveryContextPayloadSchema.safeParse({ ...payload, filters: {} }).success,
    ).toBe(false);
  });

  it("maps the two frozen error codes to HTTP 400 and 429", () => {
    expect(apiFailure("INVALID_DISCOVERY_CONTEXT", "invalid", "request").status)
      .toBe(400);
    expect(apiFailure("RATE_LIMITED", "limited", "request").status).toBe(429);
  });
});
