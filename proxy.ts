import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PRIVATE_CONTEXT_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "same-origin",
};

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (request.nextUrl.searchParams.has("discoveryContext")) {
    Object.entries(PRIVATE_CONTEXT_HEADERS).forEach(([name, value]) => {
      response.headers.set(name, value);
    });
  }
  return response;
}

export const config = {
  matcher: "/resources/:path*",
};
