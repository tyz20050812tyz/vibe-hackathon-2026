import type { NextRequest } from "next/server";

import {
  ResourceCatalogError,
  searchResources,
} from "@/lib/services/resource-catalog";
import { searchResourcesQuerySchema } from "@/lib/schemas/resources";
import type {
  ApiErrorCode,
  ApiFailure,
  ApiSuccess,
} from "@/lib/types/api";
import type { SearchResourcesData } from "@/lib/types/resources";

function success(data: SearchResourcesData, requestId: string): Response {
  const body: ApiSuccess<SearchResourcesData> = { data, requestId };
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

function failure(
  code: ApiErrorCode,
  message: string,
  status: number,
  requestId: string,
): Response {
  const body: ApiFailure = {
    data: null,
    error: { code, message },
    requestId,
  };
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const parsed = searchResourcesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return failure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "查询参数不合法。",
      400,
      requestId,
    );
  }

  try {
    return success(await searchResources(parsed.data), requestId);
  } catch (error) {
    if (error instanceof ResourceCatalogError) {
      const status = error.code === "INTERNAL_ERROR" ? 500 : 503;
      return failure(error.code, error.message, status, requestId);
    }

    return failure("INTERNAL_ERROR", "搜索资源失败。", 500, requestId);
  }
}
