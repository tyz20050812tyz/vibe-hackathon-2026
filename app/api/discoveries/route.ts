import { apiFailure, apiSuccess } from "@/lib/api-response";
import { discoverRequestSchema } from "@/lib/schemas/resources";
import { discover, DiscoveryError } from "@/lib/services/discovery";

function requesterIdentity(request: Request) {
  // Forwarded headers are meaningful only behind the explicitly configured proxy.
  if (process.env.TRUST_PROXY !== "true") return "anonymous";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? `ip:${forwarded}` : "anonymous";
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let payload: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 8 * 1024) {
      return apiFailure("VALIDATION_ERROR", "发现请求不能超过 8 KB。", requestId);
    }
    payload = JSON.parse(body);
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
    return apiSuccess(await discover(parsed.data, token, requesterIdentity(request)), requestId, responseOptions);
  } catch (error) {
    if (error instanceof DiscoveryError) {
      return apiFailure(error.code, error.message, requestId, responseOptions);
    }

    return apiFailure("INTERNAL_ERROR", "无法生成下一条阅读线索。", requestId, responseOptions);
  }
}
