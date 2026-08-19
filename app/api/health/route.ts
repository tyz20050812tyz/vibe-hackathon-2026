export const dynamic = "force-dynamic";

const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export async function GET() {
  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable],
  );

  if (missingVariables.length > 0) {
    return Response.json(
      {
        data: null,
        error: {
          code: "CONFIGURATION_ERROR",
          message: "Supabase 环境变量未配置完整。",
        },
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return Response.json(
        {
          data: null,
          error: {
            code: "SUPABASE_UNAVAILABLE",
            message: "无法连接 Supabase，请检查 URL 和服务端密钥。",
          },
        },
        { status: 503 },
      );
    }

    return Response.json({
      data: {
        supabase: "connected",
      },
    });
  } catch {
    return Response.json(
      {
        data: null,
        error: {
          code: "SUPABASE_UNAVAILABLE",
          message: "无法连接 Supabase，请检查网络与项目状态。",
        },
      },
      { status: 503 },
    );
  }
}
