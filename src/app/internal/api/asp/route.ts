import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/seo-editor/auth";
import aspStatus from "../../../../../data/asp-status.json";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="NARU Dashboard"' },
    });
  }
  return NextResponse.json(aspStatus, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
