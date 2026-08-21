import { createSavedResourceSchema } from "@/lib/schemas/resources";
import { listSavedResources, PersonalLibraryError, saveResource } from "@/lib/services/personal-library";
import { createSupabaseCookieServerClient } from "@/lib/supabase/server";
import { apiFailure, apiSuccess } from "@/lib/api-response";
import type { SavedResource } from "@/lib/types/resources";

function libraryFailure(error: unknown, requestId: string) {
  if (error instanceof PersonalLibraryError) {
    return apiFailure(error.code, error.message, requestId);
  }
  return apiFailure("INTERNAL_ERROR", "个人书架服务暂时不可用。", requestId);
}

export async function GET() {
  const requestId = crypto.randomUUID();
  try { return apiSuccess<SavedResource[]>(await listSavedResources(await createSupabaseCookieServerClient()), requestId); } catch (error) { return libraryFailure(error, requestId); }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let payload: unknown;
  try { payload = await request.json(); } catch { return apiFailure("INVALID_JSON", "请求内容必须是 JSON。", requestId); }
  const parsed = createSavedResourceSchema.safeParse(payload);
  if (!parsed.success) return apiFailure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "请求参数不合法。", requestId);
  try { return apiSuccess(await saveResource(await createSupabaseCookieServerClient(), parsed.data), requestId); } catch (error) { return libraryFailure(error, requestId); }
}
