import { ImageResponse } from "next/og.js";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const fontData = await readFile(
  join(root, "node_modules", "@next", "font", "dist", "google", "index.js")
).catch(() => null);

// Reggae One font from tekishoku-shindan if available, otherwise use system
let font;
try {
  font = await readFile(
    join(dirname(root), "tekishoku-shindan", "public", "assets", "fonts", "ReggaeOne-Regular.ttf")
  );
} catch {
  // fallback: try local
  font = await readFile(join(root, "public", "assets", "fonts", "ReggaeOne-Regular.ttf")).catch(() => null);
}

const title = "入社3ヶ月で\n「辞めたい」と思うのは\n異常なのか";
const subtitle = "新卒の3割が3年以内に辞めている事実";

const response = new ImageResponse(
  {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        fontFamily: font ? "Reggae One" : "sans-serif",
        padding: "60px",
        position: "relative",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              inset: "20px",
              border: "3px solid rgba(255, 200, 100, 0.3)",
              borderRadius: "20px",
              display: "flex",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: "22px",
              color: "#ffcc66",
              letterSpacing: "0.15em",
              marginBottom: "24px",
            },
            children: "賛否両論",
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: "56px",
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.3,
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
              whiteSpace: "pre-line",
            },
            children: title,
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: "22px",
              color: "#aab8cc",
              marginTop: "28px",
              letterSpacing: "0.05em",
            },
            children: subtitle,
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              bottom: "36px",
              right: "48px",
              fontSize: "18px",
              color: "#667788",
            },
            children: "磯貝アルト / NARU",
          },
        },
      ],
    },
  },
  {
    width: 1280,
    height: 670,
    fonts: font
      ? [{ name: "Reggae One", data: font, style: "normal", weight: 400 }]
      : [],
  }
);

const buf = Buffer.from(await response.arrayBuffer());
const outPath = join(root, "note-drafts", "thumb-quit-3months.png");
await writeFile(outPath, buf);
console.log("Generated:", outPath);
