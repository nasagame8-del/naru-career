"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type BannerConfig = {
  href: string;
  title: string;
  description: string;
  btnText: string;
};

const CTA_FOCUS_MAP: Record<string, BannerConfig> = {
  "ai-interview": {
    href: "/ai-interview-check",
    title: "あなたの回答、AIはどう見る？",
    description: "4つの質問でAI面接の評価ポイントをチェック。無料・登録不要です。",
    btnText: "AI面接チェックを受ける",
  },
};

type Props = {
  /** /agent-diagnosis or /shindan（ctaFocus未設定時のフォールバック） */
  href: string;
  /** frontmatterのctaFocus値 */
  ctaFocus?: string;
};

const DISMISS_KEY = "diagnosis-banner-dismissed";

export function DiagnosisBanner({ href, ctaFocus }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const onScroll = () => {
      const scrollPct =
        window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPct >= 0.5) {
        setVisible(true);
        window.removeEventListener("scroll", onScroll);
      }
    };

    // 途中位置で復元された場合にも出せるよう、初回にも判定する
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  if (!visible) return null;

  // ctaFocusがマップにあればそれを使い、なければ既存の2択ロジック
  const config: BannerConfig = ctaFocus && CTA_FOCUS_MAP[ctaFocus]
    ? CTA_FOCUS_MAP[ctaFocus]
    : {
        href,
        title: href === "/agent-diagnosis"
          ? "自分に合うエージェントが分からない方へ"
          : "自分に向いている職種を知りたい方へ",
        description: href === "/agent-diagnosis"
          ? "5つの質問に答えるだけ。完全無料・登録不要です。"
          : "20のYES／NOに答えるだけ（約2分）。完全無料・登録不要です。",
        btnText: href === "/agent-diagnosis" ? "エージェント相性診断" : "RPG適職診断を受けてみる",
      };

  return (
    <aside
      aria-label="診断のご案内"
      className="fixed bottom-0 left-0 right-0 md:bottom-6 md:left-auto md:right-6 md:w-[360px] z-40 animate-slide-up"
    >
      <div className="bg-surface border border-line shadow-lg md:rounded-lg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-5 relative">
        <button
          onClick={close}
          aria-label="閉じる"
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-bg-soft flex items-center justify-center text-ink-soft hover:text-ink hover:bg-line transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <p className="text-[13px] font-bold text-ink pr-8 mb-1.5">{config.title}</p>
        <p className="text-[11px] text-ink-soft leading-relaxed mb-3">{config.description}</p>
        <Link
          href={config.href}
          className="block w-full bg-primary text-white text-center font-bold text-[13px] py-2.5 rounded-full hover:bg-primary/90 transition-colors"
        >
          {config.btnText}
        </Link>
      </div>
    </aside>
  );
}
