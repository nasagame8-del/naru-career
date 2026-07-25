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

async function handleInstagramShare(
  slug: string,
  typeName: string
): Promise<"shared" | "downloaded" | "cancelled"> {
  const res = await fetch(`/shindan/share/${slug}.png`);
  if (!res.ok) throw new Error(`Share image load failed: ${res.status}`);
  const blob = await res.blob();
  const file = new File([blob], `shindan-${slug}.png`, { type: "image/png" });

  // Mobile: Web Share API (shows Instagram in the share sheet)
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

  // Desktop fallback: download the image
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
  const [instaState, setInstaState] = useState<
    "idle" | "loading" | "shared" | "downloaded" | "error"
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
            className="share-btn share-btn-x"
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("share_x", { type: typeInfo.slug })}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Xでシェア
          </a>
          <button
            className="share-btn share-btn-insta"
            disabled={instaState === "loading"}
            onClick={async () => {
              setInstaState("loading");
              try {
                const result = await handleInstagramShare(
                  typeInfo.slug,
                  typeInfo.name
                );
                setInstaState(result === "cancelled" ? "idle" : result);
              } catch (e) {
                console.error("Instagram share error:", e);
                setInstaState("error");
              }
              setTimeout(() => setInstaState("idle"), 5000);
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            {instaState === "loading"
              ? "画像を生成中…"
              : instaState === "error"
                ? "エラーが発生しました"
                : instaState === "shared"
                  ? "シェアしました！"
                  : instaState === "downloaded"
                    ? "画像を保存しました！"
                    : "Instagramでシェア"}
          </button>
        </div>
        {instaState === "downloaded" && (
          <p className="share-hint">
            保存した画像をInstagramのストーリーズやフィードに投稿してください
          </p>
        )}

        {/* ── タイプ詳細への導線 ── */}
        <div className="type-hub-link">
          <a
            href={`/types/${typeInfo.slug}`}
            className="type-hub-btn"
            style={{ borderColor: accentColor, color: accentColor }}
            onClick={() => trackEvent("to_type_hub", { type: typeInfo.slug })}
          >
            {typeInfo.name.split("（")[0]}タイプの詳細を見る →
          </a>
        </div>

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
