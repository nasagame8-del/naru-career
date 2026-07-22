import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { TYPES16, TYPE_COLORS, SLUG_TO_ID } from "../../../_lib/data";

const INSTA_SIZE = { width: 1080, height: 1920 };
const OGP_SIZE = { width: 1200, height: 630 };

// Vercel Serverless Functionからは自分自身のoriginへfetchできないため、
// 固定の外部URLを使う
const ASSET_BASE = "https://naru-career.com";

const GOOGLE_FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Reggae+One&display=swap";

async function loadGoogleFont(): Promise<ArrayBuffer> {
  const cssRes = await fetch(GOOGLE_FONT_CSS, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Next.js ImageResponse)" },
  });
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match) throw new Error("Font URL not found");
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

async function loadImage(path: string): Promise<string> {
  const res = await fetch(`${ASSET_BASE}${path}`);
  if (!res.ok) throw new Error(`Asset load failed: ${path}`);
  const buf = await res.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const id = SLUG_TO_ID[slug];
  if (id === undefined) {
    return new Response("Not found", { status: 404 });
  }

  const t = TYPES16[id];
  const color = TYPE_COLORS[id] || "#b06a1c";
  const format = _req.nextUrl.searchParams.get("format");
  const isInsta = format === "instagram";
  const size = isInsta ? INSTA_SIZE : OGP_SIZE;

  let fontData: ArrayBuffer;
  let charSrc: string;

  try {
    [fontData, charSrc] = await Promise.all([
      loadGoogleFont(),
      loadImage(`/shindan/types/type${id}.png`),
    ]);
  } catch (e) {
    console.error("Asset loading error:", e);
    return new Response(`Asset loading failed: ${e}`, { status: 500 });
  }

  const sentences = t.desc.split("。").filter(Boolean);
  const catchphrase =
    sentences.length >= 2
      ? sentences[0] + "。" + sentences[1] + "。"
      : t.desc;

  if (isInsta) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Reggae One",
            position: "relative",
            background: `linear-gradient(180deg, #1a2330 0%, #2a3a50 50%, #1a2330 100%)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "16px",
              border: `3px solid ${color}40`,
              borderRadius: "20px",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: "40px",
              color: "#ffe6a8",
              letterSpacing: "0.12em",
              marginBottom: "40px",
            }}
          >
            あなたの適職タイプは…
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={charSrc}
            width={520}
            height={520}
            alt=""
            style={{ objectFit: "contain", marginBottom: "48px" }}
          />
          <div
            style={{
              fontSize: "76px",
              color: "#fff",
              textShadow: `0 3px 30px ${color}80`,
              marginBottom: "32px",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {t.name}
          </div>
          <div
            style={{
              fontSize: "32px",
              color: "#e0e4ee",
              lineHeight: 1.7,
              textAlign: "center",
              maxWidth: "920px",
              marginBottom: "40px",
            }}
          >
            {catchphrase}
          </div>
          <div
            style={{
              fontSize: "30px",
              color: "#ffe6a8",
              marginBottom: "60px",
              textAlign: "center",
            }}
          >
            おすすめ職種：{t.strength}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "absolute",
              bottom: "80px",
            }}
          >
            <div
              style={{ fontSize: "32px", color: "#fff", letterSpacing: "0.08em", marginBottom: "14px" }}
            >
              RPG適職診断 by NARU
            </div>
            <div style={{ fontSize: "22px", color: "#8a9ab0" }}>
              naru-career.com/shindan
            </div>
          </div>
        </div>
      ),
      {
        ...size,
        fonts: [{ name: "Reggae One", data: fontData, style: "normal" as const, weight: 400 as const }],
      }
    );
  }

  // OGP format
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Reggae One",
          position: "relative",
          background: `linear-gradient(135deg, #1a2330 0%, #2a3a50 100%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "16px",
            border: `3px solid ${color}40`,
            borderRadius: "20px",
            display: "flex",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={charSrc}
          width={400}
          height={400}
          alt=""
          style={{ objectFit: "contain", marginLeft: "50px", position: "relative" }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: "40px",
            flex: 1,
            paddingRight: "50px",
            position: "relative",
          }}
        >
          <div style={{ fontSize: "24px", color: "#ffe6a8", letterSpacing: "0.1em", marginBottom: "12px" }}>
            あなたの適職タイプは…
          </div>
          <div
            style={{
              fontSize: "52px",
              color: "#fff",
              lineHeight: 1.2,
              textShadow: `0 2px 20px ${color}80`,
              marginBottom: "16px",
            }}
          >
            {t.name}
          </div>
          <div style={{ fontSize: "20px", color: "#d0d4de", lineHeight: 1.6, marginBottom: "14px" }}>
            {catchphrase}
          </div>
          <div style={{ fontSize: "16px", color: "#fff" }}>RPG適職診断 by NARU</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Reggae One", data: fontData, style: "normal" as const, weight: 400 as const }],
    }
  );
}
