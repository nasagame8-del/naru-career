import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TYPES16, TYPE_COLORS, SLUG_TO_ID, ALL_SLUGS } from "../../_lib/data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = SLUG_TO_ID[slug] ?? 1;
  const t = TYPES16[id];
  const color = TYPE_COLORS[id] || "#b06a1c";

  const imgPath = join(
    process.cwd(),
    "public",
    "shindan",
    "types",
    `type${id}.png`
  );
  const imgBuf = await readFile(imgPath);
  const imgSrc = `data:image/png;base64,${imgBuf.toString("base64")}`;

  const fontPath = join(
    process.cwd(),
    "public",
    "shindan",
    "fonts",
    "ReggaeOne-Regular.ttf"
  );
  const fontData = await readFile(fontPath);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, #1a2330 0%, #2a3a50 100%)`,
          fontFamily: "Reggae One",
          position: "relative",
        }}
      >
        {/* decorative border */}
        <div
          style={{
            position: "absolute",
            inset: "16px",
            border: `3px solid ${color}40`,
            borderRadius: "20px",
            display: "flex",
          }}
        />

        {/* character image */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "340px",
            height: "340px",
            marginLeft: "60px",
            borderRadius: "20px",
            background: `${color}22`,
            border: `4px solid ${color}`,
            boxShadow: `0 0 40px ${color}40`,
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            width={300}
            height={300}
            alt=""
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: "50px",
            flex: 1,
            paddingRight: "60px",
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
              color: "#c0c8d8",
              lineHeight: 1.5,
            }}
          >
            {t.strength}
          </div>
          <div
            style={{
              marginTop: "24px",
              fontSize: "18px",
              color: "#8a9ab0",
              letterSpacing: "0.05em",
            }}
          >
            RPG適職診断
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
