import { apiFailure, apiSuccess } from "@/lib/api-response";
import { signInSchema } from "@/lib/schemas/auth";
import { AuthServiceError, signIn } from "@/lib/services/auth";
import { createSupabaseCookieServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let payload: unknown;
  try { payload = await request.json(); } catch { return apiFailure("INVALID_JSON", "请求内容必须是 JSON。", requestId); }
  const parsed = signInSchema.safeParse(payload);
  if (!parsed.success) return apiFailure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "请求参数不合法。", requestId);
  try {
    return apiSuccess(await signIn(await createSupabaseCookieServerClient(), parsed.data), requestId);
  } catch (error) {
    if (error instanceof AuthServiceError) return apiFailure(error.code, error.message, requestId);
    return apiFailure("CONFIGURATION_ERROR", "登录服务尚未配置。", requestId);
  }
}
