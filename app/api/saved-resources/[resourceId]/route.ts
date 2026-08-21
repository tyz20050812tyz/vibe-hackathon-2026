import { savedResourceParamsSchema } from "@/lib/schemas/resources";
import { PersonalLibraryError, removeSavedResource } from "@/lib/services/personal-library";
import { apiFailure, apiSuccess } from "@/lib/api-response";
import { createSupabaseCookieServerClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const requestId = crypto.randomUUID();
  const parsed = savedResourceParamsSchema.safeParse(await params);
  if (!parsed.success) return apiFailure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "资源标识不合法。", requestId);
  try { const data = await removeSavedResource(await createSupabaseCookieServerClient(), parsed.data.resourceId); return apiSuccess(data, requestId); } catch (error) {
    if (error instanceof PersonalLibraryError) {
      return apiFailure(error.code, error.message, requestId);
    }
    return apiFailure("INTERNAL_ERROR", "无法从个人书架移除资源。", requestId);
  }
}
