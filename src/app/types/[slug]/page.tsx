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

  const S: Record<string, React.CSSProperties> = {
    page: { position: "relative", minHeight: "100vh" },
    bg: { position: "fixed", inset: 0, zIndex: 0 },
    bgImg: { position: "absolute" as const, inset: 0, width: "100%", height: "100%", objectFit: "cover" as const },
    content: { position: "relative", zIndex: 1, maxWidth: "600px", margin: "0 auto", padding: "40px 20px 60px" },
    header: { textAlign: "center" as const, marginBottom: "36px" },
    charImg: { width: "140px", height: "140px", objectFit: "contain" as const, margin: "0 auto 16px", display: "block", filter: `drop-shadow(0 4px 16px ${color}80)` },
    title: { fontSize: "28px", fontWeight: "bold", color: color, marginBottom: "8px" },
    desc: { fontSize: "14px", color: "#444", lineHeight: 1.7 },
    section: { marginBottom: "28px" },
    sectionTitle: { fontSize: "16px", fontWeight: "bold", color: "#333", marginBottom: "8px", paddingLeft: "12px", borderLeft: "4px solid" },
    text: { fontSize: "14px", color: "#555", lineHeight: 1.7 },
    articleLink: { display: "block", padding: "12px 14px", marginBottom: "6px", background: "rgba(255,255,255,0.75)", borderRadius: "8px", border: `1px solid ${color}30`, fontSize: "13px", fontWeight: 500, color: "#333", textDecoration: "none" },
    faqBox: { marginBottom: "6px", background: "rgba(255,255,255,0.7)", borderRadius: "8px", overflow: "hidden" },
    faqSummary: { padding: "12px 14px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", color: "#333" },
    faqAnswer: { padding: "0 14px 12px", fontSize: "13px", color: "#555", lineHeight: 1.7 },
    typeNav: { display: "flex", flexWrap: "wrap" as const, justifyContent: "center", gap: "6px", marginTop: "12px" },
    typeTag: { fontSize: "11px", padding: "4px 10px", borderRadius: "20px", textDecoration: "none" },
    cta: { display: "block", textAlign: "center" as const, marginTop: "32px", padding: "14px", background: color, color: "#fff", borderRadius: "10px", fontWeight: "bold", fontSize: "15px", textDecoration: "none" },
  };

  return (
    <div style={S.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 背景 */}
      <div style={S.bg}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/images/shindan/share-bg/${slug}.png`} alt="" style={S.bgImg} />
      </div>

      {/* コンテンツ */}
      <div style={S.content}>

        {/* ヘッダー */}
        <div style={S.header}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/shindan/types/type${id}.png`} alt={t.name} style={S.charImg} />
          <h1 style={S.title}>{t.name}</h1>
          <p style={S.desc}>{t.desc}</p>
        </div>

        {/* おすすめ職種 */}
        <div style={S.section}>
          <h2 style={{ ...S.sectionTitle, borderLeftColor: color }}>{typeName}タイプのおすすめ職種</h2>
          <p style={S.text}>{t.strength}</p>
        </div>

        {/* 向いている環境 */}
        <div style={S.section}>
          <h2 style={{ ...S.sectionTitle, borderLeftColor: "#3f9e57" }}>向いている環境</h2>
          <p style={S.text}>{t.goodEnv}</p>
        </div>

        {/* 消耗しやすい環境 */}
        <div style={S.section}>
          <h2 style={{ ...S.sectionTitle, borderLeftColor: "#d65a5a" }}>消耗しやすい環境</h2>
          <p style={S.text}>{t.badEnv}</p>
        </div>

        {/* 第二新卒×IT/Webの狙い目 */}
        <div style={S.section}>
          <h2 style={{ ...S.sectionTitle, borderLeftColor: "#e0842f" }}>第二新卒×IT/Webの狙い目</h2>
          <p style={S.text}>{t.careerTip}</p>
        </div>

        {/* おすすめ記事 */}
        <div style={S.section}>
          <h2 style={{ ...S.sectionTitle, borderLeftColor: color }}>{typeName}タイプにおすすめの記事</h2>
          {articles.map((a) => (
            <a key={a.slug} href={`/articles/${a.slug}`} style={S.articleLink}>
              {a.title}
            </a>
          ))}
        </div>

        {/* FAQ */}
        <div style={S.section}>
          <h2 style={{ ...S.sectionTitle, borderLeftColor: "#c79a2f" }}>よくある質問</h2>
          {faq.map((f, i) => (
            <details key={i} style={S.faqBox}>
              <summary style={S.faqSummary}>{f.q}</summary>
              <div style={S.faqAnswer}>{f.a}</div>
            </details>
          ))}
        </div>

        {/* 他のタイプ */}
        <div style={{ ...S.section, textAlign: "center" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "bold", color: "#333", marginBottom: "8px" }}>他のタイプを見る</h2>
          <div style={S.typeNav}>
            {Object.entries(TYPES16).map(([tid, tt]) => (
              <a
                key={tid}
                href={`/types/${tt.slug}`}
                style={{
                  ...S.typeTag,
                  border: tt.slug === slug ? `2px solid ${color}` : "1px solid rgba(0,0,0,0.15)",
                  background: tt.slug === slug ? color : "rgba(255,255,255,0.7)",
                  color: tt.slug === slug ? "#fff" : "#555",
                }}
              >
                {tt.name.split("（")[0]}
              </a>
            ))}
          </div>
        </div>

        {/* 診断ボタン */}
        <a href="/shindan" style={S.cta}>診断を受けてみる</a>
      </div>
    </div>
  );
}
