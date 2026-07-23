import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TYPES16, TYPE_COLORS, SLUG_TO_ID, ALL_SLUGS } from "../../shindan/_lib/data";
import { getHubArticles } from "../type-hub-data";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const id = SLUG_TO_ID[slug];
  if (id === undefined) return {};
  const t = TYPES16[id];
  return {
    title: `${t.name}の特徴・向いている仕事・おすすめ記事 | RPG適職診断`,
    description: `${t.desc} 向いている環境や第二新卒×IT/Webの狙い目、おすすめ記事をまとめています。`,
  };
}

export default async function TypeHubPage({ params }: Props) {
  const { slug } = await params;
  const id = SLUG_TO_ID[slug];
  if (id === undefined) notFound();

  const t = TYPES16[id];
  const color = TYPE_COLORS[id] || "#b06a1c";
  const articles = getHubArticles(id);
  const typeName = t.name.split("（")[0];

  const faq = [
    { q: `${typeName}タイプはどんな仕事に向いていますか？`, a: `${t.strength}が向いています。${t.goodEnv}` },
    { q: `${typeName}タイプが避けた方がいい環境は？`, a: t.badEnv },
    { q: `第二新卒で${typeName}タイプにおすすめの職種は？`, a: t.careerTip },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${t.name}の特徴・向いている仕事`,
    description: t.desc,
    url: `https://naru-career.com/types/${slug}`,
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: "#1a2330" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* タイプ別背景カード：画面に収まるサイズ、中でスクロール */}
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: "480px",
        height: "calc(100vh - 48px)",
        borderRadius: "16px",
        overflow: "hidden",
      }}>
        {/* 背景画像（そのまま表示、透過なし） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/images/shindan/share-bg/${slug}.png`}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />

        {/* スクロール可能なコンテンツエリア */}
        <div style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          overflowY: "auto",
          padding: "32px 24px 40px",
          color: "#333",
        }}>

          {/* ヘッダー */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/shindan/types/type${id}.png`}
              alt={t.name}
              style={{ width: "120px", height: "120px", objectFit: "contain", margin: "0 auto 12px", display: "block", filter: `drop-shadow(0 4px 12px rgba(0,0,0,0.3))` }}
            />
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: color, marginBottom: "8px" }}>
              {t.name}
            </h1>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7 }}>
              {t.desc}
            </p>
          </div>

          {/* おすすめ職種 */}
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "bold", color: "#333", marginBottom: "6px", paddingLeft: "10px", borderLeft: `4px solid ${color}` }}>
              おすすめ職種
            </h2>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7 }}>{t.strength}</p>
          </div>

          {/* 向いている環境 */}
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "bold", color: "#333", marginBottom: "6px", paddingLeft: "10px", borderLeft: "4px solid #3f9e57" }}>
              向いている環境
            </h2>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7 }}>{t.goodEnv}</p>
          </div>

          {/* 消耗しやすい環境 */}
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "bold", color: "#333", marginBottom: "6px", paddingLeft: "10px", borderLeft: "4px solid #d65a5a" }}>
              消耗しやすい環境
            </h2>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7 }}>{t.badEnv}</p>
          </div>

          {/* 第二新卒×IT/Webの狙い目 */}
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "bold", color: "#333", marginBottom: "6px", paddingLeft: "10px", borderLeft: "4px solid #e0842f" }}>
              第二新卒×IT/Webの狙い目
            </h2>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7 }}>{t.careerTip}</p>
          </div>

          {/* おすすめ記事 */}
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "bold", color: "#333", marginBottom: "10px", paddingLeft: "10px", borderLeft: `4px solid ${color}` }}>
              {typeName}タイプにおすすめの記事
            </h2>
            <div style={{ display: "grid", gap: "6px" }}>
              {articles.map((a) => (
                <a
                  key={a.slug}
                  href={`/articles/${a.slug}`}
                  style={{
                    display: "block", padding: "10px 12px",
                    background: "rgba(255,255,255,0.75)", borderRadius: "6px",
                    border: "1px solid rgba(0,0,0,0.08)",
                    fontSize: "12px", fontWeight: 500, color: "#333", textDecoration: "none",
                  }}
                >
                  {a.title}
                </a>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "bold", color: "#333", marginBottom: "10px", paddingLeft: "10px", borderLeft: "4px solid #c79a2f" }}>
              よくある質問
            </h2>
            {faq.map((f, i) => (
              <details key={i} style={{ marginBottom: "6px", background: "rgba(255,255,255,0.7)", borderRadius: "6px", overflow: "hidden" }}>
                <summary style={{ padding: "10px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", color: "#333" }}>{f.q}</summary>
                <div style={{ padding: "0 12px 10px", fontSize: "12px", color: "#555", lineHeight: 1.7 }}>{f.a}</div>
              </details>
            ))}
          </div>

          {/* 他のタイプ */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <p style={{ fontSize: "14px", fontWeight: "bold", color: "#333", marginBottom: "10px" }}>他のタイプを見る</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "5px" }}>
              {Object.entries(TYPES16).map(([tid, tt]) => (
                <a
                  key={tid}
                  href={`/types/${tt.slug}`}
                  style={{
                    fontSize: "10px", padding: "3px 8px", borderRadius: "16px", textDecoration: "none",
                    border: tt.slug === slug ? `2px solid ${color}` : "1px solid rgba(0,0,0,0.15)",
                    background: tt.slug === slug ? color : "rgba(255,255,255,0.6)",
                    color: tt.slug === slug ? "#fff" : "#555",
                  }}
                >
                  {tt.name.split("（")[0]}
                </a>
              ))}
            </div>
          </div>

          {/* 診断ボタン */}
          <div style={{ textAlign: "center" }}>
            <a
              href="/shindan"
              style={{
                display: "inline-block", padding: "12px 36px",
                background: color, color: "#fff", borderRadius: "8px",
                fontWeight: "bold", fontSize: "14px", textDecoration: "none",
              }}
            >
              診断を受けてみる
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
