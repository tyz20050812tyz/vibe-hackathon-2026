import { apiFailure, apiSuccess } from "@/lib/api-response";
import { signOut } from "@/lib/services/auth";
import { createSupabaseCookieServerClient } from "@/lib/supabase/server";

export async function POST() {
  const requestId = crypto.randomUUID();
  try {
    await signOut(await createSupabaseCookieServerClient());
    return apiSuccess({ signedOut: true }, requestId);
  } catch {
    return apiFailure("CONFIGURATION_ERROR", "登录服务尚未配置。", requestId);
  }
}
