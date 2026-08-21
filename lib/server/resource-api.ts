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
    if (query.type) params.set("type", query.type);
    if (query.limit) params.set("limit", String(query.limit));
    const response = await fetch(`${await apiOrigin()}/api/resources?${params.toString()}`, { cache: "no-store" });
    const body = await response.json() as CatalogResponse;
    if (!response.ok || !body.data) {
      return { data: null, error: "error" in body && body.error ? body.error.message : "资源目录暂时无法读取。" };
    }
    return { data: body.data, error: null };
  } catch {
    return { data: null, error: "资源目录暂时无法读取，请稍后重试。" };
  }
}
