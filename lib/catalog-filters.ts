import { searchResourcesQuerySchema } from "@/lib/schemas/resources";
import type { SearchResourcesQueryInput } from "@/lib/schemas/resources";
import type { SearchResourcesQuery, Tag } from "@/lib/types/resources";

export const popularTags: Tag[] = [
  { id: "tag-artificial-intelligence", name: "人工智能", slug: "artificial-intelligence", category: "discipline" },
  { id: "tag-psychology", name: "心理学", slug: "psychology", category: "discipline" },
  { id: "tag-literature", name: "文学", slug: "literature", category: "discipline" },
  { id: "tag-design", name: "设计", slug: "design", category: "discipline" },
  { id: "tag-city", name: "城市", slug: "city", category: "discipline" },
  { id: "tag-sociology", name: "社会学", slug: "sociology", category: "discipline" },
];

const allowedNames = new Set(["q", "tag", "yearFrom", "yearTo", "sort", "limit", "language", "type", "availability"]);

/** Parses the public URL shape into the service-ready query with defaults applied. */
export function parseSearchFilters(searchParams: URLSearchParams): SearchResourcesQueryInput {
  if ([...searchParams.keys()].some((name) => !allowedNames.has(name))) throw new Error("包含不支持的查询参数。");
  if (["q", "tag", "yearFrom", "yearTo", "sort", "limit"].some((name) => searchParams.getAll(name).length > 1)) throw new Error("标量筛选参数不能重复。");
  const parsed = searchResourcesQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
    yearFrom: searchParams.get("yearFrom") ?? undefined,
    yearTo: searchParams.get("yearTo") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    languages: searchParams.getAll("language"),
    types: searchParams.getAll("type"),
    availabilities: searchParams.getAll("availability"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "筛选参数不合法。");
  return parsed.data;
}

export function serializeSearchFilters(filters: SearchResourcesQuery): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tag) params.set("tag", filters.tag);
  filters.languages?.forEach((value) => params.append("language", value));
  if (filters.yearFrom !== undefined) params.set("yearFrom", String(filters.yearFrom));
  if (filters.yearTo !== undefined) params.set("yearTo", String(filters.yearTo));
  filters.types?.forEach((value) => params.append("type", value));
  filters.availabilities?.forEach((value) => params.append("availability", value));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  return params.toString();
}

export function removeSearchFilter(filters: SearchResourcesQuery, filter: { field: "tag" | "language" | "type" | "availability"; value?: string }): SearchResourcesQuery {
  const next = { ...filters };
  if (filter.field === "tag") delete next.tag;
  if (filter.field === "language") next.languages = filters.languages?.filter((value) => value !== filter.value);
  if (filter.field === "type") next.types = filters.types?.filter((value) => value !== filter.value);
  if (filter.field === "availability") next.availabilities = filters.availabilities?.filter((value) => value !== filter.value);
  return next;
}

export function clearSearchFilters(filters: SearchResourcesQuery): SearchResourcesQuery {
  return { q: filters.q, sort: filters.sort, limit: filters.limit };
}
