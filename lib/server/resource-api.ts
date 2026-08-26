import { searchResources } from "@/lib/services/resource-catalog";
import { searchResourcesQuerySchema } from "@/lib/schemas/resources";
import type { SearchResourcesQuery } from "@/lib/types/resources";

export async function searchResourceCatalog(query: SearchResourcesQuery = {}) {
  try {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.tag) params.set("tag", query.tag);
    query.languages?.forEach((value) => params.append("language", value));
    if (query.yearFrom) params.set("yearFrom", String(query.yearFrom));
    if (query.yearTo) params.set("yearTo", String(query.yearTo));
    query.types?.forEach((value) => params.append("type", value));
    query.availabilities?.forEach((value) => params.append("availability", value));
    if (query.sort) params.set("sort", query.sort);
    if (query.limit) params.set("limit", String(query.limit));
    const requestHeaders = await headers();
    const authorization = requestHeaders.get("authorization");
    const response = await fetch(`${await apiOrigin()}/api/resources?${params.toString()}`, {
      cache: "no-store",
      headers: authorization ? { Authorization: authorization } : undefined,
    });
    const body = await response.json() as CatalogResponse;
    if (!response.ok || !body.data) {
      return { data: null, error: "error" in body && body.error ? body.error.message : "资源目录暂时无法读取。" };
    }
    return { data: await searchResources(parsed.data), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "资源目录暂时无法读取，请稍后重试。",
    };
  }
}
