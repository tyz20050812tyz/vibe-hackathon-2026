import { createSavedResourceSchema } from "@/lib/schemas/resources";
import { listSavedResources, PersonalLibraryError, saveResource } from "@/lib/services/personal-library";
import type { ApiErrorCode, ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { SavedResource } from "@/lib/types/resources";

const failure = (code: ApiErrorCode, message: string, status: number, requestId: string) => Response.json({ data: null, error: { code, message }, requestId } satisfies ApiFailure, { status, headers: { "Cache-Control": "no-store" } });
const success = <T,>(data: T, requestId: string) => Response.json({ data, requestId } satisfies ApiSuccess<T>, { headers: { "Cache-Control": "no-store" } });

function accessToken(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

function libraryFailure(error: unknown, requestId: string) {
  if (error instanceof PersonalLibraryError) {
    const status = error.code === "UNAUTHORIZED" ? 401 : error.code === "RESOURCE_NOT_FOUND" ? 404 : error.code === "ALREADY_SAVED" ? 409 : error.code === "INTERNAL_ERROR" ? 500 : 503;
    return failure(error.code, error.message, status, requestId);
  }
  return failure("INTERNAL_ERROR", "个人书架服务暂时不可用。", 500, requestId);
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const token = accessToken(request);
  if (!token) return failure("UNAUTHORIZED", "请先登录后查看个人书架。", 401, requestId);
  try { return success<SavedResource[]>(await listSavedResources(token), requestId); } catch (error) { return libraryFailure(error, requestId); }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const token = accessToken(request);
  if (!token) return failure("UNAUTHORIZED", "请先登录后收藏资源。", 401, requestId);
  let payload: unknown;
  try { payload = await request.json(); } catch { return failure("INVALID_JSON", "请求内容必须是 JSON。", 400, requestId); }
  const parsed = createSavedResourceSchema.safeParse(payload);
  if (!parsed.success) return failure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "请求参数不合法。", 400, requestId);
  try { return success(await saveResource(token, parsed.data), requestId); } catch (error) { return libraryFailure(error, requestId); }
}
