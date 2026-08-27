import { apiFailure, apiSuccess } from "@/lib/api-response";
import {
  CONSTELLATION_DEPTH_NOT_ENABLED_MESSAGE,
  enabledConstellationDepthSchema,
  parseConstellationQuery,
} from "@/lib/schemas/constellation";
import { resourceSlugParamsSchema } from "@/lib/schemas/resources";
import {
  getResourceConstellation,
  ResourceConstellationError,
} from "@/lib/services/resource-constellation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const requestId = crypto.randomUUID();
  const parsedParams = resourceSlugParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return apiFailure(
      "VALIDATION_ERROR",
      parsedParams.error.issues[0]?.message ?? "资源 slug 不合法。",
      requestId,
    );
  }

  let depth: 1 | 2;
  try {
    depth = parseConstellationQuery(new URL(request.url).searchParams).depth;
  } catch (error) {
    return apiFailure(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "星图查询参数不合法。",
      requestId,
    );
  }

  if (!enabledConstellationDepthSchema.safeParse(depth).success) {
    return apiFailure(
      "VALIDATION_ERROR",
      CONSTELLATION_DEPTH_NOT_ENABLED_MESSAGE,
      requestId,
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7) || undefined
    : undefined;

  try {
    return apiSuccess(
      await getResourceConstellation(parsedParams.data.slug, token),
      requestId,
    );
  } catch (error) {
    if (error instanceof ResourceConstellationError) {
      return apiFailure(error.code, error.message, requestId);
    }
    return apiFailure("INTERNAL_ERROR", "读取资源星图失败。", requestId);
  }
}
