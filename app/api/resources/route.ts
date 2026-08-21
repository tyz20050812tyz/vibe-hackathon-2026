import type { NextRequest } from "next/server";

import { apiFailure, apiSuccess } from "@/lib/api-response";
import {
  ResourceCatalogError,
  searchResources,
} from "@/lib/services/resource-catalog";
import { searchResourcesQuerySchema } from "@/lib/schemas/resources";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const parsed = searchResourcesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return apiFailure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "查询参数不合法。",
      requestId,
    );
  }

  try {
    return apiSuccess(await searchResources(parsed.data), requestId);
  } catch (error) {
    if (error instanceof ResourceCatalogError) {
      return apiFailure(error.code, error.message, requestId);
    }

    return apiFailure("INTERNAL_ERROR", "搜索资源失败。", requestId);
  }
}
