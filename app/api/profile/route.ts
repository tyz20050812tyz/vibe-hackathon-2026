import { apiFailure, apiSuccess } from "@/lib/api-response";
import { profileUpdateSchema } from "@/lib/schemas/profile";
import {
  getProfileOverview,
  ProfileServiceError,
  updateProfile,
} from "@/lib/services/profile";
import { createSupabaseCookieServerClient } from "@/lib/supabase/server";

function profileFailure(error: unknown, requestId: string) {
  if (error instanceof ProfileServiceError) {
    return apiFailure(error.code, error.message, requestId);
  }
  return apiFailure("INTERNAL_ERROR", "个人资料服务暂时不可用。", requestId);
}

async function profileClient(requestId: string) {
  try {
    return { client: await createSupabaseCookieServerClient(), failure: null };
  } catch {
    return {
      client: null,
      failure: apiFailure(
        "CONFIGURATION_ERROR",
        "个人资料服务尚未配置。",
        requestId,
      ),
    };
  }
}

export async function GET() {
  const requestId = crypto.randomUUID();
  const { client, failure } = await profileClient(requestId);
  if (!client) return failure;

  try {
    return apiSuccess(await getProfileOverview(client), requestId);
  } catch (error) {
    return profileFailure(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = crypto.randomUUID();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiFailure(
      "INVALID_JSON",
      "请求内容必须是 JSON。",
      requestId,
    );
  }

  const parsed = profileUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return apiFailure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "请求参数不合法。",
      requestId,
    );
  }

  const { client, failure } = await profileClient(requestId);
  if (!client) return failure;

  try {
    return apiSuccess(await updateProfile(client, parsed.data), requestId);
  } catch (error) {
    return profileFailure(error, requestId);
  }
}
