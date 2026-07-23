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
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 背景: RPG背景 + タイプ別背景 */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shindan/bg.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/images/shindan/share-bg/${slug}.png`} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }} />
      </div>

      {/* コンテンツ（羊皮紙なし、背景の上に直接） */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "620px", margin: "0 auto", padding: "40px 20px 60px", color: "#fff" }}>

        {/* ヘッダー */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/shindan/types/type${id}.png`}
            alt={t.name}
            style={{ width: "150px", height: "150px", objectFit: "contain", margin: "0 auto 16px", display: "block", filter: `drop-shadow(0 4px 20px ${color}80)` }}
          />
          <h1 style={{ fontSize: "30px", fontWeight: "bold", color: "#fff", textShadow: `0 2px 16px ${color}80`, marginBottom: "10px" }}>
            {t.name}
          </h1>
          <p style={{ fontSize: "15px", color: "#d0d8e8", lineHeight: 1.7, maxWidth: "500px", margin: "0 auto" }}>
            {t.desc}
          </p>
        </div>

        {/* おすすめ職種 */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "bold", color: "#ffe6a8", marginBottom: "8px", paddingLeft: "12px", borderLeft: `4px solid ${color}` }}>
            おすすめ職種
          </h2>
          <p style={{ fontSize: "14px", color: "#c8d0e0", lineHeight: 1.7 }}>{t.strength}</p>
        </div>

        {/* 向いている環境 */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "bold", color: "#ffe6a8", marginBottom: "8px", paddingLeft: "12px", borderLeft: "4px solid #3f9e57" }}>
            向いている環境
          </h2>
          <p style={{ fontSize: "14px", color: "#c8d0e0", lineHeight: 1.7 }}>{t.goodEnv}</p>
        </div>

        {/* 消耗しやすい環境 */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "bold", color: "#ffe6a8", marginBottom: "8px", paddingLeft: "12px", borderLeft: "4px solid #d65a5a" }}>
            消耗しやすい環境
          </h2>
          <p style={{ fontSize: "14px", color: "#c8d0e0", lineHeight: 1.7 }}>{t.badEnv}</p>
        </div>

        {/* 第二新卒×IT/Webの狙い目 */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "bold", color: "#ffe6a8", marginBottom: "8px", paddingLeft: "12px", borderLeft: "4px solid #e0842f" }}>
            第二新卒×IT/Webの狙い目
          </h2>
          <p style={{ fontSize: "14px", color: "#c8d0e0", lineHeight: 1.7 }}>{t.careerTip}</p>
        </div>

        {/* おすすめ記事 */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "bold", color: "#ffe6a8", marginBottom: "12px", paddingLeft: "12px", borderLeft: `4px solid ${color}` }}>
            {typeName}タイプにおすすめの記事
          </h2>
          <div style={{ display: "grid", gap: "8px" }}>
            {articles.map((a) => (
              <a
                key={a.slug}
                href={`/articles/${a.slug}`}
                style={{
                  display: "block",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#e0e8f0",
                  textDecoration: "none",
                }}
              >
                {a.title}
              </a>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "bold", color: "#ffe6a8", marginBottom: "12px", paddingLeft: "12px", borderLeft: "4px solid #c79a2f" }}>
            よくある質問
          </h2>
          {faq.map((f, i) => (
            <details key={i} style={{ marginBottom: "6px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", overflow: "hidden" }}>
              <summary style={{ padding: "12px 14px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", color: "#e0e8f0" }}>{f.q}</summary>
              <div style={{ padding: "0 14px 12px", fontSize: "13px", color: "#a0b0c8", lineHeight: 1.7 }}>{f.a}</div>
            </details>
          ))}
        </div>

        {/* 他のタイプ */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <p style={{ fontSize: "15px", fontWeight: "bold", color: "#ffe6a8", marginBottom: "12px" }}>他のタイプを見る</p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px" }}>
            {Object.entries(TYPES16).map(([tid, tt]) => (
              <a
                key={tid}
                href={`/types/${tt.slug}`}
                style={{
                  fontSize: "11px", padding: "4px 10px", borderRadius: "20px", textDecoration: "none",
                  border: tt.slug === slug ? `2px solid ${color}` : "1px solid rgba(255,255,255,0.2)",
                  background: tt.slug === slug ? color : "rgba(255,255,255,0.08)",
                  color: tt.slug === slug ? "#fff" : "#c0c8d8",
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
              display: "inline-block",
              padding: "14px 40px",
              background: color,
              color: "#fff",
              borderRadius: "10px",
              fontWeight: "bold",
              fontSize: "15px",
              textDecoration: "none",
              boxShadow: `0 4px 16px ${color}60`,
            }}
          >
            診断を受けてみる
          </a>
        </div>
      </div>
    </div>
  );
}
