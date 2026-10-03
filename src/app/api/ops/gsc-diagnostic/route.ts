import { NextRequest, NextResponse } from "next/server";
import { fetchSearchConsoleData } from "@/lib/search-console";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expected = process.env.GSC_DIAGNOSTIC_SECRET;
  const provided = request.headers.get("x-gsc-diagnostic-secret");
  if (!expected || !provided || provided !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const data = await fetchSearchConsoleData();
  return NextResponse.json({
    configured: data.configured,
    error: data.error ?? null,
    current7d: data.current7d
      ? {
          clicks: data.current7d.clicks,
          impressions: data.current7d.impressions,
          ctr: data.current7d.ctr,
          position: data.current7d.position,
        }
      : null,
    queryCount: data.current7d?.topQueries?.length ?? 0,
    pageCount: data.current7d?.topPages?.length ?? 0,
  }, { headers: { "Cache-Control": "no-store" } });
}
