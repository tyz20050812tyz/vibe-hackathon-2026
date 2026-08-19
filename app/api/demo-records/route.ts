import { z } from "zod";

import {
  createDemoRecord,
  listDemoRecords,
} from "@/lib/services/demo-records";
import type {
  ApiErrorCode,
  ApiFailure,
  ApiSuccess,
  CreateDemoRecordRequest,
  DemoRecord,
} from "@/lib/types/api";

export const dynamic = "force-dynamic";

const createDemoRecordSchema = z.object({
  content: z.string().trim().min(1, "请输入内容。").max(500, "内容不能超过 500 个字符。"),
});

function requestId() {
  return crypto.randomUUID();
}

function success<T>(data: T, id: string): Response {
  const body: ApiSuccess<T> = { data, requestId: id };
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

function failure(
  code: ApiErrorCode,
  message: string,
  status: number,
  id: string,
): Response {
  const body: ApiFailure = {
    data: null,
    error: { code, message },
    requestId: id,
  };

  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const id = requestId();

  try {
    return success(await listDemoRecords(), id);
  } catch {
    return failure("INTERNAL_ERROR", "读取演练记录失败。", 500, id);
  }
}

export async function POST(request: Request) {
  const id = requestId();
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return failure("INVALID_JSON", "请求内容必须是 JSON。", 400, id);
  }

  const parsed = createDemoRecordSchema.safeParse(payload);
  if (!parsed.success) {
    return failure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "请求参数不合法。",
      400,
      id,
    );
  }

  try {
    const record = await createDemoRecord(
      (parsed.data as CreateDemoRecordRequest).content,
    );
    return success<DemoRecord>(record, id);
  } catch {
    return failure("INTERNAL_ERROR", "保存演练记录失败。", 500, id);
  }
}
