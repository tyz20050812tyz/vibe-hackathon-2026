import type { ApiErrorCode, ApiFailure, ApiSuccess } from "@/lib/types/api";

const HTTP_STATUS_BY_ERROR_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_JSON: 400,
  AUTHENTICATION_FAILED: 401,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  ALREADY_SAVED: 409,
  CONFIGURATION_ERROR: 503,
  SUPABASE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export function apiSuccess<T>(data: T, requestId: string): Response {
  const body: ApiSuccess<T> = { data, requestId };
  return Response.json(body, { headers: NO_STORE_HEADERS });
}

export function apiFailure(
  code: ApiErrorCode,
  message: string,
  requestId: string,
): Response {
  const body: ApiFailure = {
    data: null,
    error: { code, message },
    requestId,
  };

  return Response.json(body, {
    status: HTTP_STATUS_BY_ERROR_CODE[code],
    headers: NO_STORE_HEADERS,
  });
}
