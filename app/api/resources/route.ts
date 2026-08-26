import type { NextRequest } from "next/server";

import { apiFailure, apiSuccess } from "@/lib/api-response";
import { parseSearchFilters } from "@/lib/catalog-filters";
import {
  ResourceCatalogError,
  searchResources,
} from "@/lib/services/resource-catalog";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  let parsed: ReturnType<typeof parseSearchFilters>;
  try { parsed = parseSearchFilters(request.nextUrl.searchParams); }
  catch (error) { return apiFailure("VALIDATION_ERROR", error instanceof Error ? error.message : "查询参数不合法。", requestId); }

  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    return apiSuccess(await searchResources(parsed, token), requestId);
  } catch (error) {
    if (error instanceof ResourceCatalogError) {
      return apiFailure(error.code, error.message, requestId);
    }

    return apiFailure("INTERNAL_ERROR", "搜索资源失败。", requestId);
  }
}
