import { apiFailure, apiSuccess } from "@/lib/api-response";
import {
  getResourceBySlug,
  ResourceCatalogError,
} from "@/lib/services/resource-catalog";
import { resourceSlugParamsSchema } from "@/lib/schemas/resources";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const requestId = crypto.randomUUID();
  const parsed = resourceSlugParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return apiFailure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "资源 slug 不合法。",
      requestId,
    );
  }

  try {
    const data = await getResourceBySlug(parsed.data.slug);
    if (!data) {
      return apiFailure("RESOURCE_NOT_FOUND", "资源不存在。", requestId);
    }

    return apiSuccess(data, requestId);
  } catch (error) {
    if (error instanceof ResourceCatalogError) {
      return apiFailure(error.code, error.message, requestId);
    }

    return apiFailure("INTERNAL_ERROR", "读取资源详情失败。", requestId);
  }
}
