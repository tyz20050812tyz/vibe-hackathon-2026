import { describe, expect, it } from "vitest";

import { parseSearchFilters } from "../../lib/catalog-filters";

describe("catalog filter parsing", () => {
  it("maps repeated URL keys to distinct filter arrays", () => {
    expect(
      parseSearchFilters(
        new URLSearchParams(
          "language=zh&language=en&type=book&type=paper&availability=online&availability=available",
        ),
      ),
    ).toMatchObject({
      languages: ["zh", "en"],
      types: ["book", "paper"],
      availabilities: ["online", "available"],
      sort: "catalog",
      limit: 20,
    });
  });

  it.each([
    "language=en&language=en",
    "type=book&type=book",
    "availability=online&availability=online",
  ])("rejects a repeated value: %s", (query) => {
    expect(() => parseSearchFilters(new URLSearchParams(query))).toThrow();
  });

  it.each([
    "q=a&q=b",
    "tag=city&tag=design",
    "yearFrom=2000&yearFrom=2001",
    "yearTo=2020&yearTo=2021",
    "sort=catalog&sort=personalized",
    "limit=20&limit=30",
  ])("rejects a repeated scalar key: %s", (query) => {
    expect(() => parseSearchFilters(new URLSearchParams(query))).toThrow();
  });

  it("rejects unknown query keys", () => {
    expect(() =>
      parseSearchFilters(new URLSearchParams("page=2")),
    ).toThrow("包含不支持的查询参数。");
  });

  it("accepts the frozen year and limit boundaries", () => {
    expect(
      parseSearchFilters(
        new URLSearchParams("yearFrom=1000&yearTo=2100&limit=1"),
      ),
    ).toMatchObject({ yearFrom: 1000, yearTo: 2100, limit: 1 });
    expect(parseSearchFilters(new URLSearchParams("limit=50")).limit).toBe(50);
    expect(parseSearchFilters(new URLSearchParams()).limit).toBe(20);
  });

  it.each([
    "yearFrom=999",
    "yearTo=2101",
    "yearFrom=2026&yearTo=2000",
    "limit=0",
    "limit=51",
  ])("rejects an out-of-contract boundary: %s", (query) => {
    expect(() => parseSearchFilters(new URLSearchParams(query))).toThrow();
  });
});
