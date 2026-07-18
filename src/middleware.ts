import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/internal")) {
    return NextResponse.next();
  }

  const user = process.env.DASHBOARD_USER || "admin";
  const pass = process.env.DASHBOARD_PASSWORD || "naru2026";

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [u, p] = decoded.split(":");
      if (u === user && p === pass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
  });
}

export const config = {
  matcher: "/internal/:path*",
};
