import { NextRequest, NextResponse } from "next/server";

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "2003cb052959140ea85c5b24d1d78f2a";
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://naru-career.com";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export async function POST(req: NextRequest) {
  // Simple auth: require a secret to prevent abuse
  const secret = req.headers.get("x-indexnow-secret");
  if (secret !== process.env.INDEXNOW_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const urls: string[] = body.urls;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "urls array required" }, { status: 400 });
  }

  // Normalize URLs to absolute
  const absoluteUrls = urls.map((u) =>
    u.startsWith("http") ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`
  );

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: absoluteUrls,
      }),
    });

    const status = res.status;
    const text = await res.text().catch(() => "");

    return NextResponse.json({
      success: status >= 200 && status < 300,
      indexnowStatus: status,
      message: text || "OK",
      submitted: absoluteUrls,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `IndexNow request failed: ${e}` },
      { status: 500 }
    );
  }
}
