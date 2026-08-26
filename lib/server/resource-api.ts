import { headers } from "next/headers";

import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { SearchResourcesData, SearchResourcesQuery } from "@/lib/types/resources";

type CatalogResponse = ApiSuccess<SearchResourcesData> | ApiFailure;

async function apiOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "");
  if (!host) throw new Error("无法确定资源 API 地址。");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${protocol}://${host}`;
}

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
    return { data: body.data, error: null };
  } catch {
    return { data: null, error: "资源目录暂时无法读取，请稍后重试。" };
  }
}
