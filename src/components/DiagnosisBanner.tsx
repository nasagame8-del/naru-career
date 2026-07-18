"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Props = {
  /** /agent-diagnosis or /diagnosis */
  href: string;
};

export function DiagnosisBanner({ href }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // セッション内で既に閉じていたら表示しない
    if (sessionStorage.getItem("diagnosis-banner-dismissed")) {
      setDismissed(true);
      return;
    }

    const onScroll = () => {
      const scrollPct =
        window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPct >= 0.5) {
        setVisible(true);
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem("diagnosis-banner-dismissed", "1");
  };

  if (dismissed || !visible) return null;

  const isAgent = href === "/agent-diagnosis";
  const title = isAgent
    ? "自分に合うエージェントが分からない方へ"
    : "自分に向いている職種を知りたい方へ";
  const btnText = isAgent ? "エージェント相性診断" : "適職診断を受けてみる";

  return (
    <div className="fixed bottom-0 left-0 right-0 md:bottom-6 md:left-auto md:right-6 md:w-[360px] z-40 animate-slide-up">
      <div className="bg-white border border-line shadow-lg md:rounded-xl p-4 md:p-5 relative">
        {/* 閉じるボタン */}
        <button
          onClick={close}
          aria-label="閉じる"
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-bg-soft flex items-center justify-center text-ink-soft hover:text-ink hover:bg-line transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <p className="text-[13px] font-bold text-ink pr-8 mb-1.5">{title}</p>
        <p className="text-[11px] text-ink-soft leading-relaxed mb-3">
          5つの質問に答えるだけ。完全無料・登録不要です。
        </p>
        <Link
          href={href}
          className="block w-full bg-accent text-white text-center font-bold text-[13px] py-2.5 rounded-full hover:bg-accent/90 transition-colors"
        >
          {btnText}
        </Link>
      </div>
    </div>
  );
}
