import type { NextRequest } from "next/server";

import { apiFailure, apiSuccess } from "@/lib/api-response";
import { discoverQuerySchema } from "@/lib/schemas/discovery";
import {
  DiscoveryServiceError,
  getDiscovery,
} from "@/lib/services/discovery";
import {
  createSupabaseCookieServerClient,
  createSupabasePublicServerClient,
} from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const parsed = discoverQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return apiFailure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "查询参数不合法。",
      requestId,
    );
  }

  let client;
  try {
    client = parsed.data.sourceResourceId
      ? createSupabasePublicServerClient()
      : await createSupabaseCookieServerClient();
  } catch {
    return apiFailure(
      "CONFIGURATION_ERROR",
      "资源发现服务尚未配置。",
      requestId,
    );
  }

  try {
    return apiSuccess(await getDiscovery(client, parsed.data), requestId);
  } catch (error) {
    if (error instanceof DiscoveryServiceError) {
      return apiFailure(error.code, error.message, requestId);
    }
    return apiFailure("INTERNAL_ERROR", "资源发现服务暂时不可用。", requestId);
  }
}
