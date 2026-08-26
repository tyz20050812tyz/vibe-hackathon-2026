import { apiFailure, apiSuccess } from "@/lib/api-response";
import { signUpSchema } from "@/lib/schemas/auth";
import { AuthServiceError, signUp } from "@/lib/services/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function confirmationRedirectUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = configuredUrl ?? new URL(request.url).origin;
  return new URL("/auth/confirmed", origin).toString();
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let payload: unknown;
  try { payload = await request.json(); } catch { return apiFailure("INVALID_JSON", "请求内容必须是 JSON。", requestId); }
  const parsed = signUpSchema.safeParse(payload);
  if (!parsed.success) return apiFailure("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "请求参数不合法。", requestId);
  try {
    return apiSuccess(await signUp(createSupabaseServerClient(), parsed.data, confirmationRedirectUrl(request)), requestId);
  } catch (error) {
    if (error instanceof AuthServiceError) return apiFailure(error.code, error.message, requestId);
    return apiFailure("CONFIGURATION_ERROR", "登录服务尚未配置。", requestId);
  }
}
