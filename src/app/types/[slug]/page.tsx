import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TYPES16, TYPE_COLORS, SLUG_TO_ID, ALL_SLUGS } from "../../shindan/_lib/data";
import { getHubArticles } from "../type-hub-data";
import "../../shindan/shindan.css";

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
    <div className="shindan-wrapper">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* レイヤー1: RPG背景(bg.png) */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "url(/shindan/bg.png) center / cover fixed" }} />

      {/* レイヤー2: タイプ別背景(share-bg) */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/images/shindan/share-bg/${slug}.png`}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.25 }}
        />
      </div>

      {/* レイヤー3: 羊皮紙カード+コンテンツ */}
      <div id="result-screen" className="screen" style={{ position: "fixed" }}>
        <div className="result-inner">
          <div className="result-page" style={{ "--accent": color } as React.CSSProperties}>

            {/* ヘッダー */}
            <div className="result-hero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="result-char" src={`/shindan/types/type${id}.png`} alt={t.name} />
              <div className="result-hero-text">
                <span className="result-lead">{typeName}タイプの特徴</span>
                <h1 className="result-title">{t.name}</h1>
                <p className="result-desc">{t.desc}</p>
              </div>
            </div>

            {/* おすすめ職種 */}
            <h2 className="sec-title sec-career">おすすめ職種</h2>
            <p>{t.strength}</p>

            {/* 向いている環境 */}
            <h2 className="sec-title sec-good-env">向いている環境</h2>
            <p>{t.goodEnv}</p>

            {/* 消耗しやすい環境 */}
            <h2 className="sec-title sec-bad-env">消耗しやすい環境</h2>
            <p>{t.badEnv}</p>

            {/* 第二新卒×IT/Webの狙い目 */}
            <h2 className="sec-title" style={{ borderLeftColor: "#e0842f", color: "#b25c14" }}>第二新卒×IT/Webの狙い目</h2>
            <p>{t.careerTip}</p>

            {/* おすすめ記事 */}
            <h2 className="sec-title sec-articles">{typeName}タイプにおすすめの記事</h2>
            <div className="articles-grid">
              {articles.map((a) => (
                <a key={a.slug} className="article-card" href={`/articles/${a.slug}`}>
                  <div className="article-card-title">{a.title}</div>
                </a>
              ))}
            </div>

            {/* FAQ */}
            <h2 className="sec-title sec-profile">よくある質問</h2>
            {faq.map((f, i) => (
              <details key={i} style={{ marginBottom: "8px", border: "1px solid rgba(120,90,40,0.3)", borderRadius: "6px", overflow: "hidden" }}>
                <summary style={{ padding: "12px 14px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", color: "#3a2a12" }}>{f.q}</summary>
                <div style={{ padding: "0 14px 12px", fontSize: "13.5px", color: "#5a4524", lineHeight: 1.7 }}>{f.a}</div>
              </details>
            ))}

            {/* 他のタイプ */}
            <div style={{ marginTop: "30px", textAlign: "center" }}>
              <p style={{ fontFamily: "Reggae One, sans-serif", fontSize: "16px", color: "#5a3a14", marginBottom: "12px" }}>他のタイプを見る</p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px" }}>
                {Object.entries(TYPES16).map(([tid, tt]) => (
                  <a
                    key={tid}
                    href={`/types/${tt.slug}`}
                    style={{
                      fontSize: "11px", padding: "4px 10px", borderRadius: "20px", textDecoration: "none",
                      border: tt.slug === slug ? `2px solid ${color}` : "1px solid rgba(120,90,40,0.3)",
                      background: tt.slug === slug ? color : "rgba(255,252,240,0.5)",
                      color: tt.slug === slug ? "#fff" : "#5a4524",
                    }}
                  >
                    {tt.name.split("（")[0]}
                  </a>
                ))}
              </div>
            </div>

            {/* 診断ボタン */}
            <div className="result-foot">
              <a className="retry-link" href="/shindan">診断を受けてみる</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
