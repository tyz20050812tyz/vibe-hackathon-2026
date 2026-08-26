import { apiFailure, apiSuccess } from "@/lib/api-response";
import { discoverRequestSchema } from "@/lib/schemas/resources";
import { discover, DiscoveryError } from "@/lib/services/discovery";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiFailure("INVALID_JSON", "请求内容必须是 JSON。", requestId);
  }

  const hasDiscoveryContext = Boolean(
    payload
    && typeof payload === "object"
    && "discoveryContext" in payload,
  );
  const parsed = discoverRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return apiFailure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "发现请求不合法。",
      requestId,
      { privateContext: hasDiscoveryContext },
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const responseOptions = { privateContext: hasDiscoveryContext };

  try {
    return apiSuccess(await discover(parsed.data, token), requestId, responseOptions);
  } catch (error) {
    if (error instanceof DiscoveryError) {
      return apiFailure(error.code, error.message, requestId, responseOptions);
    }

    return apiFailure("INTERNAL_ERROR", "无法生成下一条阅读线索。", requestId, responseOptions);
  }
}
