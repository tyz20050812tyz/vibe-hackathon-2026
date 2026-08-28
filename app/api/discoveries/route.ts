import { apiFailure, apiSuccess } from "@/lib/api-response";
import { discoverRequestSchema } from "@/lib/schemas/resources";
import { discover, DiscoveryError } from "@/lib/services/discovery";
import {
  claimDiscoveryRequest,
  requesterIdentity,
} from "@/lib/services/discovery-request-limits";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let body: string;
  try {
    body = await request.text();
  } catch {
    return apiFailure("INVALID_JSON", "请求内容必须是 JSON。", requestId);
  }
  const requestBytes = new TextEncoder().encode(body).byteLength;
  if (requestBytes > 8 * 1024) {
    return apiFailure("VALIDATION_ERROR", "发现请求不能超过 8 KB。", requestId);
  }

  const identity = requesterIdentity(request);
  const claim = await claimDiscoveryRequest(identity, requestBytes);
  if (claim.status === "rate_limited") {
    const response = apiFailure(
      "RATE_LIMITED",
      "发现请求过于频繁，请稍后重试。",
      requestId,
      { privateContext: true },
    );
    response.headers.set("Retry-After", String(claim.retryAfterSeconds));
    return response;
  }

  let payload: unknown;
  try {
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
    return apiSuccess(
      await discover(parsed.data, token, identity, claim.status === "permitted"),
      requestId,
      responseOptions,
    );
  } catch (error) {
    if (error instanceof DiscoveryError) {
      return apiFailure(error.code, error.message, requestId, responseOptions);
    }

    return apiFailure("INTERNAL_ERROR", "无法生成下一条阅读线索。", requestId, responseOptions);
  }
}
