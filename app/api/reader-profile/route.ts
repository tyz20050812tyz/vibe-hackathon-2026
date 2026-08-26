import { apiFailure, apiSuccess } from "@/lib/api-response";
import { replaceReadingProfileSchema } from "@/lib/schemas/resources";
import {
  clearReadingProfile,
  getReadingProfile,
  ReadingProfileError,
  replaceReadingProfile,
} from "@/lib/services/reader-profile";

function tokenFrom(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

function hasUnexpectedQuery(request: Request) {
  return [...new URL(request.url).searchParams.keys()].length > 0;
}

function failure(error: unknown, requestId: string) {
  if (error instanceof ReadingProfileError) return apiFailure(error.code, error.message, requestId);
  return apiFailure("INTERNAL_ERROR", "阅读偏好服务暂时不可用。", requestId);
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  if (hasUnexpectedQuery(request)) return apiFailure("VALIDATION_ERROR", "该接口不接受查询参数。", requestId);
  const token = tokenFrom(request);
  if (!token) return apiFailure("UNAUTHORIZED", "请先登录后查看阅读偏好。", requestId);
  try { return apiSuccess(await getReadingProfile(token), requestId); } catch (error) { return failure(error, requestId); }
}

export async function PUT(request: Request) {
  const requestId = crypto.randomUUID();
  if (hasUnexpectedQuery(request)) return apiFailure("VALIDATION_ERROR", "该接口不接受查询参数。", requestId);
  const token = tokenFrom(request);
  if (!token) return apiFailure("UNAUTHORIZED", "请先登录后保存阅读偏好。", requestId);
  let payload: unknown;
  try { payload = await request.json(); } catch { return apiFailure("INVALID_JSON", "请求内容必须是 JSON。", requestId); }
  const parsed = replaceReadingProfileSchema.safeParse(payload);
  if (!parsed.success) return apiFailure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "阅读偏好不合法。", requestId);
  try { return apiSuccess(await replaceReadingProfile(token, parsed.data), requestId); } catch (error) { return failure(error, requestId); }
}

export async function DELETE(request: Request) {
  const requestId = crypto.randomUUID();
  if (hasUnexpectedQuery(request)) return apiFailure("VALIDATION_ERROR", "该接口不接受查询参数。", requestId);
  const token = tokenFrom(request);
  if (!token) return apiFailure("UNAUTHORIZED", "请先登录后清空阅读偏好。", requestId);
  try { return apiSuccess(await clearReadingProfile(token), requestId); } catch (error) { return failure(error, requestId); }
}
