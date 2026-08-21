import { savedResourceParamsSchema } from "@/lib/schemas/resources";
import { PersonalLibraryError, removeSavedResource } from "@/lib/services/personal-library";
import type { ApiErrorCode, ApiFailure, ApiSuccess } from "@/lib/types/api";

const failure = (code: ApiErrorCode, message: string, status: number, requestId: string) => Response.json({ data: null, error: { code, message }, requestId } satisfies ApiFailure, { status, headers: { "Cache-Control": "no-store" } });
const success = (resourceId: string, requestId: string) => Response.json({ data: { resourceId }, requestId } satisfies ApiSuccess<{ resourceId: string }>, { headers: { "Cache-Control": "no-store" } });

export async function DELETE(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const requestId = crypto.randomUUID();
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return failure("UNAUTHORIZED", "请先登录后管理个人书架。", 401, requestId);
  const parsed = savedResourceParamsSchema.safeParse(await params);
  if (!parsed.success) return failure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "资源标识不合法。", 400, requestId);
  try { const data = await removeSavedResource(token, parsed.data.resourceId); return success(data.resourceId, requestId); } catch (error) {
    if (error instanceof PersonalLibraryError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : error.code === "INTERNAL_ERROR" ? 500 : 503;
      return failure(error.code, error.message, status, requestId);
    }
    return failure("INTERNAL_ERROR", "无法从个人书架移除资源。", 500, requestId);
  }
}
