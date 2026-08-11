import { NextRequest, NextResponse } from "next/server";

function checkBasicAuth(
  request: NextRequest,
  user: string,
  pass: string,
  realm: string
): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [u, p] = decoded.split(":");
      if (u === user && p === pass) {
        return null; // auth OK
      }
    }
  }
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${realm}"` },
  });
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/internal")) {
    const user = process.env.DASHBOARD_USER || "admin";
    const pass = process.env.DASHBOARD_PASSWORD || "naru2026";
    return checkBasicAuth(request, user, pass, "NARU Dashboard") ?? NextResponse.next();
  }

  if (path.startsWith("/members")) {
    const user = process.env.MEMBERS_USER || "member";
    const pass = process.env.MEMBERS_PASSWORD || "";
    if (!pass) {
      return new NextResponse("Members area not configured", { status: 503 });
    }
    return checkBasicAuth(request, user, pass, "NARU Members") ?? NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/internal/:path*", "/members/:path*"],
};
