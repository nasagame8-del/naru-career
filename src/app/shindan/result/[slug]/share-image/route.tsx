import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { TYPES16, TYPE_COLORS, SLUG_TO_ID } from "../../../_lib/data";

const OGP_SIZE = { width: 1200, height: 630 };
const INSTA_SIZE = { width: 1080, height: 1920 };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const id = SLUG_TO_ID[slug];
  if (id === undefined) {
    return new Response("Not found", { status: 404 });
  }

  const t = TYPES16[id];
  const color = TYPE_COLORS[id] || "#b06a1c";
  const format = req.nextUrl.searchParams.get("format");
  const isInsta = format === "instagram";
  const size = isInsta ? INSTA_SIZE : OGP_SIZE;

  // Load font
  const fontPath = join(
    process.cwd(),
    "public",
    "shindan",
    "fonts",
    "ReggaeOne-Regular.ttf"
  );
  const fontData = await readFile(fontPath);

  // Load background image (type-specific share bg)
  let bgSrc: string | null = null;
  try {
    const bgPath = join(
      process.cwd(),
      "public",
      "images",
      "shindan",
      "share-bg",
      `${slug}.png`
    );
    const bgBuf = await readFile(bgPath);
    bgSrc = `data:image/png;base64,${bgBuf.toString("base64")}`;
  } catch {
    // Background image not yet provided — use gradient fallback
  }

  // Load character image
  let charSrc: string | null = null;
  try {
    const charPath = join(
      process.cwd(),
      "public",
      "shindan",
      "types",
      `type${id}.png`
    );
    const charBuf = await readFile(charPath);
    charSrc = `data:image/png;base64,${charBuf.toString("base64")}`;
  } catch {
    // Character image not found
  }

  // Use full desc (2 sentences) for richer content
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
          {/* Background image */}
          {bgSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bgSrc}
              alt=""
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}

          {/* Overlay for readability */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: bgSrc ? "rgba(0,0,0,0.3)" : "transparent",
              display: "flex",
            }}
          />

          {/* Content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              padding: "100px 60px",
              width: "100%",
              height: "100%",
            }}
          >
            {/* Lead text */}
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

            {/* Character — large, no border */}
            {charSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={charSrc}
                width={520}
                height={520}
                alt=""
                style={{
                  objectFit: "contain",
                  marginBottom: "48px",
                  filter: `drop-shadow(0 4px 24px ${color}60)`,
                }}
              />
            )}

            {/* Type name */}
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

            {/* Catchphrase — full desc */}
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

            {/* Strength */}
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

            {/* Credit & URL */}
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
                style={{
                  fontSize: "32px",
                  color: "#fff",
                  letterSpacing: "0.08em",
                  marginBottom: "14px",
                }}
              >
                RPG適職診断 by NARU
              </div>
              <div
                style={{
                  fontSize: "22px",
                  color: "#8a9ab0",
                }}
              >
                naru-career.com/shindan
              </div>
            </div>
          </div>
        </div>
      ),
      {
        ...size,
        fonts: [
          {
            name: "Reggae One",
            data: fontData,
            style: "normal",
            weight: 400,
          },
        ],
      }
    );
  }

  // OGP format (1200x630) - horizontal layout
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
        {/* Background image */}
        {bgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgSrc}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: bgSrc ? "rgba(0,0,0,0.35)" : "transparent",
            display: "flex",
          }}
        />

        {/* Character — large, no border */}
        {charSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={charSrc}
            width={400}
            height={400}
            alt=""
            style={{
              objectFit: "contain",
              marginLeft: "50px",
              position: "relative",
              filter: `drop-shadow(0 4px 20px ${color}60)`,
            }}
          />
        )}

        {/* Text */}
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
          <div
            style={{
              fontSize: "24px",
              color: "#ffe6a8",
              letterSpacing: "0.1em",
              marginBottom: "12px",
            }}
          >
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
          <div
            style={{
              fontSize: "20px",
              color: "#d0d4de",
              lineHeight: 1.6,
              marginBottom: "14px",
            }}
          >
            {catchphrase}
          </div>
          <div
            style={{
              fontSize: "18px",
              color: "#ffe6a8",
              marginBottom: "16px",
            }}
          >
            おすすめ：{t.strength}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginTop: "auto",
            }}
          >
            <div style={{ fontSize: "16px", color: "#fff" }}>
              RPG適職診断 by NARU
            </div>
            <div style={{ fontSize: "14px", color: "#8a9ab0" }}>
              naru-career.com/shindan
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Reggae One",
          data: fontData,
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
}
