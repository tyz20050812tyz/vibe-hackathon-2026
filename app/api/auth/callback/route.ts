import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { authCallbackSchema } from "@/lib/schemas/auth";

function response(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!sameOrigin(request)) {
    return response({ data: null, error: { code: "FORBIDDEN", message: "不允许跨站建立登录会话。" }, requestId }, 403);
  }

  let payload: unknown;
  try { payload = await request.json(); } catch { return response({ data: null, error: { code: "INVALID_JSON", message: "请求内容必须是 JSON。" }, requestId }, 400); }
  const parsed = authCallbackSchema.safeParse(payload);
  if (!parsed.success) return response({ data: null, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "确认会话不合法。" }, requestId }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return response({ data: null, error: { code: "CONFIGURATION_ERROR", message: "登录服务尚未配置。" }, requestId }, 503);

  const result = response({ data: { authenticated: true }, requestId });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => result.cookies.set(name, value, options)),
    },
  });
  const { error: sessionError } = await supabase.auth.setSession({ access_token: parsed.data.accessToken, refresh_token: parsed.data.refreshToken });
  if (sessionError) return response({ data: null, error: { code: "AUTHENTICATION_FAILED", message: "邮箱确认会话已失效，请重新注册。" }, requestId }, 401);
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return response({ data: null, error: { code: "AUTHENTICATION_FAILED", message: "无法确认登录状态，请重新登录。" }, requestId }, 401);
  return result;
}
