import {
  getResourceBySlug,
  ResourceCatalogError,
} from "@/lib/services/resource-catalog";
import { resourceSlugParamsSchema } from "@/lib/schemas/resources";
import type {
  ApiErrorCode,
  ApiFailure,
  ApiSuccess,
} from "@/lib/types/api";
import type { GetResourceData } from "@/lib/types/resources";

function success(data: GetResourceData, requestId: string): Response {
  const body: ApiSuccess<GetResourceData> = { data, requestId };
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const requestId = crypto.randomUUID();
  const parsed = resourceSlugParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return failure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "资源 slug 不合法。",
      400,
      requestId,
    );
  }

  try {
    const data = await getResourceBySlug(parsed.data.slug);
    if (!data) {
      return failure(
        "RESOURCE_NOT_FOUND",
        "资源不存在。",
        404,
        requestId,
      );
    }

    return success(data, requestId);
  } catch (error) {
    if (error instanceof ResourceCatalogError) {
      const status = error.code === "INTERNAL_ERROR" ? 500 : 503;
      return failure(error.code, error.message, status, requestId);
    }

    return failure("INTERNAL_ERROR", "读取资源详情失败。", 500, requestId);
  }
}
