"use client";

import { useState } from "react";
import { TypeInfo, TYPE_COLORS } from "../_lib/data";
import { trackEvent } from "../_lib/analytics";
import {
  getArticlesForType,
  naruArticleUrl,
  NARU_TOP_URL,
  SURVEY_URL,
  YUMECAREER_TYPE_IDS,
  YUMECAREER_URL,
  AFFILIATE_DISCLOSURE,
} from "../_lib/cta-data";

const SITE_URL = "https://naru-career.com";

async function fetchShareImage(slug: string, format: "instagram" | "ogp") {
  const res = await fetch(
    `/shindan/result/${slug}/share-image?format=${format}`
  );
  if (!res.ok) throw new Error("Failed to fetch share image");
  const blob = await res.blob();
  return blob;
}

async function handleImageShare(slug: string, typeName: string) {
  const blob = await fetchShareImage(slug, "instagram");
  const file = new File([blob], `shindan-${slug}.png`, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: `適職診断結果: ${typeName}`,
        text: `私の適職タイプは【${typeName}】でした！ #適職診断 #転職`,
      });
      trackEvent("share_native", { type: slug });
      return "shared";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shindan-${slug}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  trackEvent("share_image_download", { type: slug });
  return "downloaded";
}

export default function ResultContent({
  typeId,
  typeInfo,
  onRetry,
}: {
  typeId: number;
  typeInfo: TypeInfo;
  onRetry?: () => void;
}) {
  const accentColor = TYPE_COLORS[typeId] || "#b06a1c";
  const shareText = `私の適職タイプは【${typeInfo.name}】でした！\n#適職診断 #転職`;
  const shareUrl = `${SITE_URL}/shindan/result/${typeInfo.slug}`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const articles = getArticlesForType(typeId);
  const showYumecareer = YUMECAREER_TYPE_IDS.has(typeId);
  const [imageShareState, setImageShareState] = useState<
    "idle" | "loading" | "done"
  >("idle");

  return (
    <div className="result-inner">
      <div
        className="result-page"
        style={{ "--accent": accentColor } as React.CSSProperties}
      >
        {/* ── ヘッダー ── */}
        <div className="result-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="result-char"
            src={`/shindan/types/type${typeId}.png`}
            alt={typeInfo.name}
          />
          <div className="result-hero-text">
            <span className="result-lead">あなたの適職タイプは…</span>
            <h1 className="result-title">{typeInfo.name}</h1>
            <p className="result-desc">{typeInfo.desc}</p>
          </div>
        </div>

        {/* ── シェアボタン ── */}
        <div className="share-section">
          <a
            className="share-btn-x"
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("share_x", { type: typeInfo.slug })}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            結果をXでシェア
          </a>
          <button
            className="share-btn-image"
            disabled={imageShareState === "loading"}
            onClick={async () => {
              setImageShareState("loading");
              try {
                await handleImageShare(typeInfo.slug, typeInfo.name);
              } catch {
                // Silently handle errors
              }
              setImageShareState("done");
              setTimeout(() => setImageShareState("idle"), 3000);
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {imageShareState === "loading"
              ? "画像を生成中…"
              : imageShareState === "done"
                ? "保存しました！"
                : "画像を保存してシェア"}
          </button>
        </div>
        {imageShareState === "done" && (
          <p className="share-hint">
            ダウンロードした画像をInstagram等に手動でアップロードしてください
          </p>
        )}

        {/* ── 向いている環境 ── */}
        <h2 className="sec-title sec-good-env">向いている環境</h2>
        <p>{typeInfo.goodEnv}</p>

        {/* ── 消耗しやすい環境 ── */}
        <h2 className="sec-title sec-bad-env">消耗しやすい環境</h2>
        <p>{typeInfo.badEnv}</p>

        {/* ── 第二新卒×IT/Webの狙い目 ── */}
        <h2 className="sec-title sec-career">第二新卒×IT/Webの狙い目</h2>
        <p>{typeInfo.careerTip}</p>

        {/* ── プロフィール ── */}
        <h2 className="sec-title sec-profile">あなたのプロフィール</h2>
        <ul className="result-profile">
          <li>
            <span className="k">適職タイプ</span>
            <span className="v">{typeInfo.name}（{typeInfo.en}）</span>
          </li>
          <li>
            <span className="k">おすすめ職種</span>
            <span className="v">{typeInfo.strength}</span>
          </li>
          <li>
            <span className="k">診断日</span>
            <span className="v">{new Date().toLocaleDateString("ja-JP")}</span>
          </li>
        </ul>

        {/* ══════ CTA ブロック ══════ */}
        <div className="cta-slot">
          {/* ── 著者の一言 ── */}
          <div className="cta-author">
            <p className="cta-author-text">
              この診断を作った磯貝アルトです。僕自身、飲食業界からIT/Web業界へ第二新卒で転職しました（応募30社・内定2社）。そのリアルな記録をNARUというメディアに書いています。
            </p>
            <a
              className="cta-author-link"
              href={NARU_TOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("to_naru_article", { link: "author_top" })}
            >
              NARUを見る →
            </a>
          </div>

          {/* ── タイプ別おすすめ記事 ── */}
          <h2 className="sec-title sec-articles">
            {typeInfo.name.split("（")[0]}タイプのあなたにおすすめの記事
          </h2>
          <div className="articles-grid">
            {articles.map((a) => (
              <a
                key={a.slug}
                className="article-card"
                href={naruArticleUrl(a.slug)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("to_naru_article", { article: a.slug })}
              >
                <div className="article-card-title">{a.title}</div>
                <div className="article-card-desc">{a.desc}</div>
              </a>
            ))}
          </div>

          {/* ── 調査フォーム ── */}
          <div className="cta-survey">
            <p className="cta-survey-text">
              診断結果は当たっていましたか？第二新卒の転職に関するアンケートを実施中です（3分で回答できます）
            </p>
            <a
              className="cta-survey-link"
              href={SURVEY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("to_survey")}
            >
              アンケートに回答する →
            </a>
          </div>

          {/* ── ユメキャリCTA(営業系タイプのみ) ── */}
          {showYumecareer && (
            <div className="cta-yumecareer">
              <div className="cta-yumecareer-body">
                <div className="cta-yumecareer-badge">PR</div>
                <h3 className="cta-yumecareer-title">ユメキャリ</h3>
                <p className="cta-yumecareer-desc">
                  人事経験者の運営を掲げる、20〜30代向けの転職エージェントです（厚生労働大臣許可事業者）
                </p>
                <a
                  className="cta-yumecareer-btn"
                  href={YUMECAREER_URL}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  onClick={() => trackEvent("cta_yumecareer")}
                >
                  詳細を見る
                </a>
              </div>
              <p className="cta-affiliate-disclosure">{AFFILIATE_DISCLOSURE}</p>
            </div>
          )}
        </div>

        {/* ── もう一度診断する ── */}
        <div className="result-foot">
          {onRetry ? (
            <button className="retry-link" onClick={onRetry}>
              もう一度診断する
            </button>
          ) : (
            <a className="retry-link" href="/shindan">
              もう一度診断する
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
